import { PORTFOLIO_ARTIFACT_KINDS } from '@bloomlab/content-schema';
import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  formatSyncKey,
  generateSyncKey,
  type DevicesResponse,
  type LinkResponse,
  type PullResponse,
  type PushResponse,
  type SyncRecord,
} from '@bloomlab/shared';

import worker from '../index';
import { hashSyncKey } from './crypto';

async function call<T>(
  path: string,
  body?: unknown,
  token?: string,
  method = body === undefined ? 'GET' : 'POST',
): Promise<{ status: number; body: T }> {
  const request = new Request(`https://bloomlab.test${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const response = await worker.fetch(
    request as Request<unknown, IncomingRequestCfProperties>,
    env,
  );
  return { status: response.status, body: (await response.json()) as T };
}

const note = (id: string, device_id: string, body: string, updated_at: string): SyncRecord => ({
  id,
  learner_id: 'ignored-by-server',
  created_at: '2026-09-02T10:00:00.000Z',
  updated_at,
  revision: 1,
  device_id,
  deleted_at: null,
  body,
  target_kind: 'general',
  target_ref: null,
});

let key: string;
let deviceA: string;
let deviceB: string;
let n1: string;
let a: LinkResponse;
let b: LinkResponse;

// Fresh key, device ids and record ids per test, so tests never depend on storage isolation.
beforeEach(async () => {
  key = generateSyncKey();
  deviceA = `device-a-${crypto.randomUUID()}`;
  deviceB = `device-b-${crypto.randomUUID()}`;
  n1 = `n1-${crypto.randomUUID()}`;
  a = (
    await call<LinkResponse>('/api/sync/link', {
      secret: formatSyncKey(key),
      device: { device_id: deviceA, label: 'Desktop Chrome' },
    })
  ).body;
  b = (
    await call<LinkResponse>('/api/sync/link', {
      secret: key.toLowerCase(),
      device: { device_id: deviceB, label: "Ary's Android" },
    })
  ).body;
});

describe('link (SYNC-001 … SYNC-004)', () => {
  it('creates the learner on the first device and joins the second to it', async () => {
    expect(a.created).toBe(true);
    expect(b.created).toBe(false);
    expect(b.learner_id).toBe(a.learner_id);
    expect(a.session_token).not.toBe(b.session_token);
    expect(a.session_token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('stores only SHA-256(secret + pepper) for the learner and hashes for devices', async () => {
    const learner = await env.DB.prepare('SELECT * FROM learners WHERE learner_id = ?1')
      .bind(a.learner_id)
      .first<Record<string, string>>();
    // The pepper comes from the Worker's secret binding, never from the database (SYNC-003).
    expect(learner?.key_hash).toBe(await hashSyncKey(key, env.SYNC_KEY_PEPPER as string));
    expect(Object.values(learner ?? {})).not.toContain(key);
    const device = await env.DB.prepare('SELECT * FROM devices WHERE device_id = ?1')
      .bind(deviceA)
      .first<Record<string, unknown>>();
    expect(Object.keys(device ?? {}).sort()).toEqual([
      'created_at',
      'device_id',
      'device_label',
      'last_seen_at',
      'learner_id',
      'revoked_at',
      'token_hash',
    ]);
    expect(device?.token_hash).not.toBe(a.session_token);
    expect(device?.device_label).toBe('Desktop Chrome');
  });

  it('rejects malformed keys and devices linked to another learner', async () => {
    const bad = await call<{ error: string }>('/api/sync/link', {
      secret: 'BLM-NOPE',
      device: { device_id: 'x', label: 'x' },
    });
    expect(bad.status).toBe(400);
    const other = await call<{ error: string }>('/api/sync/link', {
      secret: generateSyncKey(),
      device: { device_id: deviceA, label: 'Stolen' },
    });
    expect(other.status).toBe(409);
  });

  it('requires a session token for everything else and refuses unknown ones', async () => {
    expect((await call('/api/sync/devices')).status).toBe(401);
    expect((await call('/api/sync/devices', undefined, 'not-a-token')).status).toBe(401);
  });
});

describe('push and pull (SYNC-007 … SYNC-010, DATA-001)', () => {
  it('applies a write from one device and delivers it to the other', async () => {
    const pushed = await call<PushResponse>(
      '/api/sync/push',
      {
        operations: [
          {
            seq: 1,
            entity: 'notes',
            base_revision: 0,
            record: note(n1, deviceA, 'hello', '2026-09-02T10:01:00.000Z'),
          },
        ],
      },
      a.session_token,
    );
    expect(pushed.body.outcomes).toEqual([{ seq: 1, status: 'applied', revision: 1 }]);

    const pulled = await call<PullResponse>('/api/sync/pull', { cursor: 0 }, b.session_token);
    expect(pulled.body.changes).toHaveLength(1);
    expect(pulled.body.changes[0]?.record).toMatchObject({
      id: n1,
      body: 'hello',
      revision: 1,
      device_id: deviceA,
      learner_id: a.learner_id,
    });
    expect(pulled.body.cursor).toBeGreaterThan(0);
    expect(pulled.body.more).toBe(false);

    const again = await call<PullResponse>(
      '/api/sync/pull',
      { cursor: pulled.body.cursor },
      b.session_token,
    );
    expect(again.body.changes).toEqual([]);
  });

  it('fast-forwards a device that built on the latest revision', async () => {
    await call(
      '/api/sync/push',
      {
        operations: [
          {
            seq: 1,
            entity: 'notes',
            base_revision: 0,
            record: note(n1, deviceA, 'v1', '2026-09-02T10:01:00.000Z'),
          },
        ],
      },
      a.session_token,
    );
    const second = await call<PushResponse>(
      '/api/sync/push',
      {
        operations: [
          {
            seq: 2,
            entity: 'notes',
            base_revision: 1,
            record: note(n1, deviceB, 'v2 from b', '2026-09-02T10:02:00.000Z'),
          },
        ],
      },
      b.session_token,
    );
    expect(second.body.outcomes).toEqual([{ seq: 2, status: 'applied', revision: 2 }]);
  });

  it('turns divergent snapshot edits into a conflict, and a forced choice resolves it', async () => {
    await call(
      '/api/sync/push',
      {
        operations: [
          {
            seq: 1,
            entity: 'notes',
            base_revision: 0,
            record: note(n1, deviceA, 'v1', '2026-09-02T10:01:00.000Z'),
          },
        ],
      },
      a.session_token,
    );
    // Both devices edit revision 1 offline.
    await call(
      '/api/sync/push',
      {
        operations: [
          {
            seq: 2,
            entity: 'notes',
            base_revision: 1,
            record: note(n1, deviceA, 'a edit', '2026-09-02T10:05:00.000Z'),
          },
        ],
      },
      a.session_token,
    );
    const divergent = await call<PushResponse>(
      '/api/sync/push',
      {
        operations: [
          {
            seq: 3,
            entity: 'notes',
            base_revision: 1,
            record: note(n1, deviceB, 'b edit', '2026-09-02T10:06:00.000Z'),
          },
        ],
      },
      b.session_token,
    );
    expect(divergent.body.outcomes[0]).toMatchObject({
      seq: 3,
      status: 'conflict',
      server: { body: 'a edit', revision: 2 },
    });
    const stored = await env.DB.prepare('SELECT payload FROM notes WHERE id = ?1')
      .bind(n1)
      .first<{ payload: string }>();
    expect(JSON.parse(stored?.payload ?? '{}').body).toBe('a edit');

    const resolved = await call<PushResponse>(
      '/api/sync/push',
      {
        operations: [
          {
            seq: 4,
            entity: 'notes',
            base_revision: 1,
            force: true,
            record: note(n1, deviceB, 'b edit', '2026-09-02T10:07:00.000Z'),
          },
        ],
      },
      b.session_token,
    );
    expect(resolved.body.outcomes).toEqual([{ seq: 4, status: 'applied', revision: 3 }]);
  });

  it('rejects writes for another device or unknown entities without touching the log', async () => {
    const result = await call<PushResponse>(
      '/api/sync/push',
      {
        operations: [
          {
            seq: 1,
            entity: 'notes',
            base_revision: 0,
            record: note('n9', deviceB, 'spoof', '2026-09-02T10:01:00.000Z'),
          },
          { seq: 2, entity: 'skills', base_revision: 0, record: note('x', deviceA, '', '') },
        ],
      },
      a.session_token,
    );
    expect(result.body.outcomes.map((o) => o.status)).toEqual(['rejected', 'rejected']);
    const ops = await env.DB.prepare(
      'SELECT COUNT(*) AS n FROM sync_operations WHERE learner_id = ?1',
    )
      .bind(a.learner_id)
      .first<{ n: number }>();
    expect(ops?.n).toBe(0);
  });
});

describe('devices (SYNC-004, SYNC-005)', () => {
  it('lists connected devices, renames the current one, and revokes on the next request', async () => {
    const list = await call<DevicesResponse>('/api/sync/devices', undefined, a.session_token);
    expect(list.body.devices.map((d) => [d.device_label, d.current, d.revoked_at])).toEqual([
      ['Desktop Chrome', true, null],
      ["Ary's Android", false, null],
    ]);

    const renamed = await call<DevicesResponse>(
      '/api/sync/devices/label',
      { label: 'Studio desktop' },
      a.session_token,
    );
    expect(renamed.body.devices[0]?.device_label).toBe('Studio desktop');

    const revoked = await call<DevicesResponse>(
      '/api/sync/devices/revoke',
      { device_id: deviceB },
      a.session_token,
    );
    expect(revoked.body.devices[1]?.revoked_at).not.toBeNull();
    expect((await call('/api/sync/devices', undefined, b.session_token)).status).toBe(401);
    expect((await call('/api/sync/pull', { cursor: 0 }, b.session_token)).status).toBe(401);
  });
});

describe('schema (DATA-004, DATA-005)', () => {
  it('creates the spec §93 tables plus notes, private media/recovery and call infrastructure, and no curriculum tables', async () => {
    const { results } = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'd1_%' AND name NOT LIKE '_cf_%'",
    ).all<{ name: string }>();
    const names = results.map((r) => r.name).sort();
    expect(names).toEqual(
      [
        'learners',
        'devices',
        'sync_sessions',
        'skill_progress',
        'skill_evidence',
        'campaign_progress',
        'exercise_attempts',
        'review_queue',
        'fieldwork',
        'notes',
        'sim_projects',
        'sim_snapshots',
        'sim_events',
        'client_progress',
        'portfolio_projects',
        'portfolio_assets',
        'ai_usage',
        'ai_feedback',
        'rubric_runs',
        'content_versions',
        'sync_operations',
        'feature_flags',
        'media_assets',
        'evidence_assets',
        'voice_generation_jobs',
        'call_attempts',
        'call_recordings',
        'call_turns',
        'call_voice_assets',
        'scenario_attachments',
        'recovery_stages',
      ].sort(),
    );
    for (const learnerOwned of [
      'media_assets',
      'evidence_assets',
      'call_attempts',
      'call_recordings',
      'call_voice_assets',
      'scenario_attachments',
      'recovery_stages',
    ]) {
      const columns = await env.DB.prepare(`PRAGMA table_info(${learnerOwned})`).all<{
        name: string;
      }>();
      expect(
        columns.results.map((column) => column.name),
        `${learnerOwned} must carry explicit ownership`,
      ).toContain('learner_id');
    }
    for (const forbidden of ['skills', 'units', 'exercises', 'ghl_features', 'registry']) {
      expect(names).not.toContain(forbidden);
    }
  });
});

describe('idempotency and deletions', () => {
  const opsFor = async (learnerId: string) =>
    (
      await env.DB.prepare('SELECT COUNT(*) AS n FROM sync_operations WHERE learner_id = ?1')
        .bind(learnerId)
        .first<{ n: number }>()
    )?.n;

  it('confirms a replayed push without a new revision or log row', async () => {
    const record = note(n1, deviceA, 'once', '2026-09-02T10:01:00.000Z');
    const first = await call<PushResponse>(
      '/api/sync/push',
      { operations: [{ seq: 1, entity: 'notes', base_revision: 0, record }] },
      a.session_token,
    );
    // The client never saw the response: it retries the identical operation.
    const replay = await call<PushResponse>(
      '/api/sync/push',
      { operations: [{ seq: 1, entity: 'notes', base_revision: 0, record }] },
      a.session_token,
    );
    expect(first.body.outcomes).toEqual([{ seq: 1, status: 'applied', revision: 1 }]);
    expect(replay.body.outcomes).toEqual([{ seq: 1, status: 'applied', revision: 1 }]);
    expect(await opsFor(a.learner_id)).toBe(1);
  });

  it('propagates a soft delete to the other device and never resurrects it', async () => {
    const live = note(n1, deviceA, 'to be removed', '2026-09-02T10:01:00.000Z');
    await call(
      '/api/sync/push',
      { operations: [{ seq: 1, entity: 'notes', base_revision: 0, record: live }] },
      a.session_token,
    );
    const first = await call<PullResponse>('/api/sync/pull', { cursor: 0 }, b.session_token);
    expect(first.body.changes[0]?.record.deleted_at).toBeNull();

    const removed = {
      ...live,
      updated_at: '2026-09-02T10:02:00.000Z',
      deleted_at: '2026-09-02T10:02:00.000Z',
    };
    const deletion = await call<PushResponse>(
      '/api/sync/push',
      { operations: [{ seq: 2, entity: 'notes', base_revision: 1, record: removed }] },
      a.session_token,
    );
    expect(deletion.body.outcomes).toEqual([{ seq: 2, status: 'applied', revision: 2 }]);

    const second = await call<PullResponse>(
      '/api/sync/pull',
      { cursor: first.body.cursor },
      b.session_token,
    );
    expect(second.body.changes).toHaveLength(1);
    expect(second.body.changes[0]?.record).toMatchObject({
      id: n1,
      deleted_at: '2026-09-02T10:02:00.000Z',
      revision: 2,
    });

    // A stale edit from B on the deleted note is a conflict, not a silent resurrection.
    const stale = await call<PushResponse>(
      '/api/sync/push',
      {
        operations: [
          {
            seq: 3,
            entity: 'notes',
            base_revision: 1,
            record: note(n1, deviceB, 'zombie', '2026-09-02T10:03:00.000Z'),
          },
        ],
      },
      b.session_token,
    );
    expect(stale.body.outcomes[0]).toMatchObject({ status: 'conflict' });
  });
});

describe('PORT-001 private metadata sync', () => {
  it('round-trips all ten categories through D1, scopes ownership, and refuses binary/public fields', async () => {
    const id = `pp:${n1}`;
    const record: SyncRecord = {
      ...note(id, deviceA, '', '2026-09-02T10:01:00.000Z'),
      schema_version: 1,
      template_id: 'PF-consultation-booking-system',
      project_id: 'project',
      reflection: 'Saved reflection',
      artifacts: Object.fromEntries(
        PORTFOLIO_ARTIFACT_KINDS.map((kind) => [
          kind,
          {
            source: ['brief', 'business_problem'].includes(kind) ? 'project' : 'contributions',
            reference_id: ['brief', 'business_problem'].includes(kind) ? 'project' : id,
          },
        ]),
      ),
    };
    delete record.body;
    delete record.target_kind;
    delete record.target_ref;
    const push = (entity: string, value: unknown, seq = 1) =>
      call<PushResponse>(
        '/api/sync/push',
        { operations: [{ seq, entity, base_revision: 0, record: value }] },
        a.session_token,
      );
    expect((await push('portfolio_projects', record)).body.outcomes[0]?.status).toBe('applied');
    const linked = (await call<PullResponse>('/api/sync/pull', { cursor: 0 }, b.session_token)).body
      .changes;
    expect(linked[0]?.record).toMatchObject({
      id,
      learner_id: a.learner_id,
      reflection: 'Saved reflection',
      artifacts: record.artifacts,
    });
    const stranger = (
      await call<LinkResponse>('/api/sync/link', {
        secret: generateSyncKey(),
        device: { device_id: crypto.randomUUID(), label: 'Separate learner' },
      })
    ).body;
    expect(
      (await call<PullResponse>('/api/sync/pull', { cursor: 0 }, stranger.session_token)).body
        .changes,
    ).toEqual([]);
    for (const extra of [
      { image_bytes: [1, 2] },
      { public_url: 'https://public.invalid' },
      { session_token: 'secret' },
      { client_outcomes: 'invented' },
    ]) {
      expect(
        (await push('portfolio_projects', { ...record, ...extra })).body.outcomes[0]?.status,
      ).toBe('rejected');
    }
    const asset = {
      id: `pa:${n1}`,
      learner_id: a.learner_id,
      device_id: deviceA,
      created_at: record.created_at,
      updated_at: record.updated_at,
      revision: 1,
      deleted_at: null,
      schema_version: 1,
      portfolio_id: id,
      attempt_id: n1,
    };
    expect((await push('portfolio_assets', asset)).body.outcomes[0]?.status).toBe('applied');
    expect(
      (await push('portfolio_assets', { ...asset, blob: 'binary' })).body.outcomes[0]?.status,
    ).toBe('rejected');
    const missing = structuredClone(record);
    delete (missing.artifacts as Record<string, unknown>).brief;
    expect((await push('portfolio_projects', missing)).body.outcomes[0]?.status).toBe('rejected');
  });
});

describe('Phase 24 client relationship snapshots', () => {
  it('round-trips owned attempt references, rejects hidden/media fields and reports divergent edits', async () => {
    const record: SyncRecord = {
      id: `cp:CL-${n1}`,
      learner_id: a.learner_id,
      device_id: deviceA,
      created_at: '2026-09-09T10:00:00.000Z',
      updated_at: '2026-09-09T10:00:00.000Z',
      revision: 1,
      deleted_at: null,
      schema_version: 1,
      client_id: `CL-${n1}`,
      relationship: 'discovery',
      journal: [{ id: 'note1', at: '2026-09-09T10:00:00.000Z', text: 'Verify routing ownership.' }],
      engagements: {
        'PRJ-field-ready-capstone': {
          content_version: '2026.09.21',
          stage_attempts: { audit: { 'EX-AUDIT_IT-glowhaus-boss': 'saved-attempt' } },
        },
      },
    };
    const push = (value: unknown, token = a.session_token, base_revision = 0) =>
      call<PushResponse>(
        '/api/sync/push',
        { operations: [{ seq: 1, entity: 'client_progress', base_revision, record: value }] },
        token,
      );
    expect((await push(record)).body.outcomes[0]?.status).toBe('applied');
    const changes = (await call<PullResponse>('/api/sync/pull', { cursor: 0 }, b.session_token))
      .body.changes;
    expect(changes[0]?.record).toMatchObject({
      client_id: record.client_id,
      engagements: record.engagements,
    });
    for (const extra of [
      { hidden_state: { trust: 99 } },
      { image_bytes: 'private' },
      { outcome: 'Revenue doubled' },
    ])
      expect((await push({ ...record, ...extra })).body.outcomes[0]?.status).toBe('rejected');
    const updated = { ...record, updated_at: '2026-09-09T11:00:00.000Z', relationship: 'proposal' };
    expect((await push(updated, a.session_token, 1)).body.outcomes[0]?.status).toBe('applied');
    expect(
      (
        await push(
          {
            ...record,
            device_id: deviceB,
            updated_at: '2026-09-09T12:00:00.000Z',
            relationship: 'paused',
          },
          b.session_token,
          1,
        )
      ).body.outcomes[0]?.status,
    ).toBe('conflict');
    const stranger = (
      await call<LinkResponse>('/api/sync/link', {
        secret: generateSyncKey(),
        device: { device_id: crypto.randomUUID(), label: 'Other learner' },
      })
    ).body;
    expect(
      (await call<PullResponse>('/api/sync/pull', { cursor: 0 }, stranger.session_token)).body
        .changes,
    ).toEqual([]);
  });
});
