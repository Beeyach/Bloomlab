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
  it('creates the spec §93 tables plus notes, media and call infrastructure, and no curriculum tables', async () => {
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
        'voice_generation_jobs',
        'call_attempts',
        'call_recordings',
        'call_turns',
        'call_voice_assets',
      ].sort(),
    );
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
