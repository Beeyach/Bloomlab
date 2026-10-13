import { env } from 'cloudflare:test';
import { generateSyncKey } from '@bloomlab/shared';
import { describe, expect, it, vi } from 'vitest';
import content from 'virtual:bloomlab-content';
import { link } from '../sync/handlers';
import { encodeRecoveryArchive, recoveryChecksum } from './format';
import { handleRecovery } from './handlers';

async function fixture() {
  const linked = await link(
    {
      secret: generateSyncKey(),
      device: { device_id: crypto.randomUUID(), label: 'Lifecycle test' },
    },
    env.DB,
    env.SYNC_KEY_PEPPER,
  );
  const bytes = new TextEncoder().encode('%PDF-1.4\nSynthetic lifecycle file\n');
  const assetId = crypto.randomUUID();
  const archive = await encodeRecoveryArchive({
    format: 'bloomlab-private-binary-recovery',
    schema_version: 1,
    backup_id: crypto.randomUUID(),
    learner_id: linked.learner_id,
    created_at: '2026-09-10T12:00:00.000Z',
    call_attempts: [],
    assets: [
      {
        kind: 'scenario_attachment',
        id: assetId,
        mime_type: 'application/pdf',
        byte_length: bytes.byteLength,
        checksum: await recoveryChecksum(bytes),
        bytes,
        metadata: {
          scenario_id: content.scenarios[0]!.id,
          name: 'lifecycle.pdf',
          created_at: '2026-09-10T12:00:00.000Z',
          updated_at: '2026-09-10T12:00:00.000Z',
        },
      },
    ],
  });
  const request = (path: string, method = 'POST', body?: BodyInit) =>
    handleRecovery(
      new Request(`https://bloomlab.test/api/recovery/${path}`, {
        method,
        headers: { authorization: `Bearer ${linked.session_token}` },
        ...(body ? { body } : {}),
      }),
      env,
    );
  return { request, archive, assetId };
}

async function staged(a: Awaited<ReturnType<typeof fixture>>) {
  const response = await a.request('preview', 'POST', a.archive);
  expect(response.status).toBe(200);
  const preview = (await response.json()) as { stage_id: string };
  const row = await env.DB.prepare('SELECT object_key FROM recovery_stages WHERE stage_id=?')
    .bind(preview.stage_id)
    .first<{ object_key: string }>();
  return { id: preview.stage_id, key: row!.object_key };
}

function barrier() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

describe('private recovery stage lifecycle', () => {
  it('claims cancellation before deleting bytes so confirmation cannot restore cancelled media', async () => {
    const a = await fixture();
    const stage = await staged(a);
    const entered = barrier();
    const blocked = barrier();
    const originalDelete = env.MEDIA.delete.bind(env.MEDIA);
    const deletion = vi.spyOn(env.MEDIA, 'delete').mockImplementationOnce(async (key) => {
      entered.release();
      await blocked.promise;
      await originalDelete(key);
    });
    const cancel = a.request(`stages/${stage.id}/cancel`, 'DELETE');
    try {
      await entered.promise;
      const confirm = await a.request(`stages/${stage.id}/confirm`);
      blocked.release();
      expect((await cancel).status).toBe(200);
      expect(confirm.status).toBe(409);
      expect(
        await env.DB.prepare('SELECT status FROM recovery_stages WHERE stage_id=?')
          .bind(stage.id)
          .first(),
      ).toEqual({ status: 'cancelled' });
      expect(
        await env.DB.prepare('SELECT attachment_id FROM scenario_attachments WHERE attachment_id=?')
          .bind(a.assetId)
          .first(),
      ).toBeNull();
      expect(await env.MEDIA.head(stage.key)).toBeNull();
    } finally {
      blocked.release();
      await cancel;
      deletion.mockRestore();
    }
  });

  it('retains the retry archive when recording restored status fails', async () => {
    const a = await fixture();
    const stage = await staged(a);
    await env.DB.prepare(
      "CREATE TRIGGER reject_restored BEFORE UPDATE OF status ON recovery_stages WHEN NEW.status='restored' BEGIN SELECT RAISE(FAIL, 'synthetic final update failure'); END",
    ).run();
    try {
      expect((await a.request(`stages/${stage.id}/confirm`)).status).toBe(503);
      expect(
        await env.DB.prepare('SELECT status FROM recovery_stages WHERE stage_id=?')
          .bind(stage.id)
          .first(),
      ).toEqual({ status: 'failed' });
      expect(await env.MEDIA.head(stage.key)).not.toBeNull();
    } finally {
      await env.DB.prepare('DROP TRIGGER reject_restored').run();
    }
    expect((await a.request(`stages/${stage.id}/confirm`)).status).toBe(200);
    expect(await env.MEDIA.head(stage.key)).toBeNull();
    expect((await a.request(`stages/${stage.id}/confirm`)).status).toBe(409);
  });

  it('retries only stage cleanup after restoration succeeds but deletion fails', async () => {
    const a = await fixture();
    const stage = await staged(a);
    const deletion = vi
      .spyOn(env.MEDIA, 'delete')
      .mockRejectedValueOnce(new Error('synthetic delete failure'));
    try {
      const response = await a.request(`stages/${stage.id}/confirm`);
      expect(response.status).toBe(503);
      expect(await response.text()).not.toContain('synthetic delete failure');
    } finally {
      deletion.mockRestore();
    }
    expect(
      await env.DB.prepare('SELECT status FROM recovery_stages WHERE stage_id=?')
        .bind(stage.id)
        .first(),
    ).toEqual({ status: 'restored' });
    const saved = await env.DB.prepare('SELECT * FROM scenario_attachments WHERE attachment_id=?')
      .bind(a.assetId)
      .first();
    expect(await env.MEDIA.head(stage.key)).not.toBeNull();
    expect((await a.request(`stages/${stage.id}/confirm`)).status).toBe(200);
    expect(
      await env.DB.prepare('SELECT * FROM scenario_attachments WHERE attachment_id=?')
        .bind(a.assetId)
        .first(),
    ).toEqual(saved);
    expect(await env.MEDIA.head(stage.key)).toBeNull();
    expect((await a.request(`stages/${stage.id}/confirm`)).status).toBe(409);
  });

  it('retries deletion after cancellation without allowing a later restore', async () => {
    const a = await fixture();
    const stage = await staged(a);
    const deletion = vi
      .spyOn(env.MEDIA, 'delete')
      .mockRejectedValueOnce(new Error('synthetic cancel failure'));
    try {
      expect((await a.request(`stages/${stage.id}/cancel`, 'DELETE')).status).toBe(503);
    } finally {
      deletion.mockRestore();
    }
    expect((await a.request(`stages/${stage.id}/confirm`)).status).toBe(409);
    expect((await a.request(`stages/${stage.id}/cancel`, 'DELETE')).status).toBe(200);
    expect(await env.MEDIA.head(stage.key)).toBeNull();
  });

  it('removes a delayed upload when cancellation has already claimed its stage', async () => {
    const a = await fixture();
    const entered = barrier();
    const blocked = barrier();
    const originalPut = env.MEDIA.put.bind(env.MEDIA);
    const upload = vi
      .spyOn(env.MEDIA, 'put')
      .mockImplementationOnce(async (key, value, options) => {
        entered.release();
        await blocked.promise;
        return originalPut(key, value, options);
      });
    const preview = a.request('preview', 'POST', a.archive);
    try {
      await entered.promise;
      const row = await env.DB.prepare(
        "SELECT stage_id,object_key FROM recovery_stages WHERE status='uploading'",
      ).first<{ stage_id: string; object_key: string }>();
      expect((await a.request(`stages/${row!.stage_id}/cancel`, 'DELETE')).status).toBe(200);
      blocked.release();
      expect((await preview).status).toBe(409);
      expect(await env.MEDIA.head(row!.object_key)).toBeNull();
      expect(
        await env.DB.prepare('SELECT status FROM recovery_stages WHERE stage_id=?')
          .bind(row!.stage_id)
          .first(),
      ).toEqual({ status: 'cancelled' });
    } finally {
      blocked.release();
      await preview;
      upload.mockRestore();
    }
  });

  it('rejects expired confirmation while allowing the owner to remove its staged bytes', async () => {
    const a = await fixture();
    const stage = await staged(a);
    await env.DB.prepare('UPDATE recovery_stages SET expires_at=? WHERE stage_id=?')
      .bind('2020-01-01T00:00:00.000Z', stage.id)
      .run();
    expect((await a.request(`stages/${stage.id}/confirm`)).status).toBe(410);
    expect(await env.MEDIA.head(stage.key)).not.toBeNull();
    expect((await a.request(`stages/${stage.id}/cancel`, 'DELETE')).status).toBe(200);
    expect(await env.MEDIA.head(stage.key)).toBeNull();
  });
});
