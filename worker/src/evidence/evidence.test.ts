import { env } from 'cloudflare:test';
import { describe, it, expect, vi } from 'vitest';
import { generateSyncKey } from '@bloomlab/shared';
import { link } from '../sync/handlers';
import { handleEvidence } from './handlers';

const png = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN1kAAAAASUVORK5CYII=',
  ),
  (c) => c.charCodeAt(0),
);
const exercise = 'EX-FIELDWORK-snapshot-no-show-system';
async function setup() {
  const device_id = crypto.randomUUID();
  const learner = await link(
    { secret: generateSyncKey(), device: { device_id, label: 'Evidence test' } },
    env.DB,
    env.SYNC_KEY_PEPPER,
  );
  const attempt = crypto.randomUUID();
  const id = crypto.randomUUID();
  const request = (
    method: string,
    token: string | null = learner.session_token,
    bytes = png,
    type = 'image/png',
    suffix = '',
  ) =>
    handleEvidence(
      new Request(
        `https://bloomlab.test/api/evidence/assets/${id}${suffix}${method === 'PUT' ? `?attempt_id=${attempt}&exercise_id=${exercise}&item_key=destination_workflow` : ''}`,
        {
          method,
          headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), 'content-type': type },
          ...(method === 'PUT' ? { body: bytes } : {}),
        },
      ),
      env,
    );
  return { request, id, attempt, learner, device_id };
}
describe('FLD-002 private evidence assets in real local D1/R2', () => {
  it('uploads once, reads private metadata/bytes, and tombstones deletion idempotently without provider egress', async () => {
    const external = vi.spyOn(globalThis, 'fetch');
    const { request, id } = await setup();
    expect((await request('PUT')).status).toBe(200);
    const first = await (await request('GET')).json();
    expect(first).toMatchObject({ asset_id: id, status: 'ready', width: 1, height: 1 });
    expect(first).not.toHaveProperty('object_key');
    expect(await (await request('PUT')).json()).toEqual(first);
    const image = await request('GET', undefined, png, 'image/png', '/image');
    expect(image.headers.get('cache-control')).toContain('no-store');
    expect(image.headers.get('x-content-type-options')).toBe('nosniff');
    expect(new Uint8Array(await image.arrayBuffer())).toEqual(png);
    expect(await (await request('DELETE')).json()).toMatchObject({ status: 'deleted' });
    expect((await request('DELETE')).status).toBe(200);
    expect((await request('GET', undefined, png, 'image/png', '/image')).status).toBe(410);
    expect((await request('PUT')).status).toBe(410);
    expect(await env.MEDIA.list({ prefix: 'evidence/' })).toMatchObject({ objects: [] });
    expect(external).not.toHaveBeenCalled();
    external.mockRestore();
  });
  it('denies other learners, anonymous and revoked sessions on read/delete/upload', async () => {
    const a = await setup();
    const b = await setup();
    expect((await a.request('PUT')).status).toBe(200);
    for (const method of ['GET', 'DELETE', 'PUT']) {
      expect((await a.request(method, b.learner.session_token)).status).toBe(404);
      expect((await a.request(method, null)).status).toBe(401);
    }
    await env.DB.prepare('UPDATE devices SET revoked_at=? WHERE device_id=?')
      .bind(new Date().toISOString(), a.device_id)
      .run();
    for (const method of ['GET', 'DELETE', 'PUT'])
      expect((await a.request(method)).status).toBe(401);
  });
  it('rejects forged MIME, excessive dimensions, oversized bodies and changed bytes', async () => {
    const { request } = await setup();
    expect(
      (await request('PUT', undefined, new Uint8Array(new TextEncoder().encode('<svg></svg>'))))
        .status,
    ).toBe(415);
    expect((await request('PUT', undefined, png, 'image/jpeg')).status).toBe(415);
    const huge = png.slice();
    new DataView(huge.buffer).setUint32(16, 9000);
    expect((await request('PUT', undefined, huge)).status).toBe(415);
    expect((await request('PUT', undefined, new Uint8Array(8 * 1024 * 1024 + 1))).status).toBe(413);
    expect((await request('PUT')).status).toBe(200);
    const changed = png.slice();
    changed[40] = 2;
    expect((await request('PUT', undefined, changed)).status).toBe(409);
  });
  it('a delete overtaking an upload reserves a tombstone and cannot be resurrected', async () => {
    const { request } = await setup();
    expect((await request('DELETE')).status).toBe(200);
    expect((await request('PUT')).status).toBe(410);
    expect(await (await request('GET')).json()).toMatchObject({ status: 'deleted' });
  });
  it('keeps failed deletion explicit and retryable, denying reads while cleanup is pending', async () => {
    const { request } = await setup();
    await request('PUT');
    const remove = vi
      .spyOn(env.MEDIA, 'delete')
      .mockRejectedValueOnce(new Error('storage unavailable'));
    expect((await request('DELETE')).status).toBe(503);
    remove.mockRestore();
    expect(await (await request('GET')).json()).toMatchObject({ status: 'deleting' });
    expect((await request('GET', undefined, png, 'image/png', '/image')).status).toBe(410);
    expect((await request('DELETE')).status).toBe(200);
  });
  it('recovers a failed R2 put and refuses metadata when the object disappeared', async () => {
    const { request, id } = await setup();
    const put = vi.spyOn(env.MEDIA, 'put').mockRejectedValueOnce(new Error('unavailable'));
    expect((await request('PUT')).status).toBe(503);
    put.mockRestore();
    expect((await request('PUT')).status).toBe(200);
    const row = await env.DB.prepare('SELECT object_key FROM evidence_assets WHERE asset_id=?')
      .bind(id)
      .first<{ object_key: string }>();
    await env.MEDIA.delete(row!.object_key);
    expect((await request('GET')).status).toBe(409);
  });
});
