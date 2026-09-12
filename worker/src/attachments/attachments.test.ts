import { env } from 'cloudflare:test';
import { generateSyncKey } from '@bloomlab/shared';
import { describe, expect, it, vi } from 'vitest';
import content from 'virtual:bloomlab-content';
import { link } from '../sync/handlers';
import { ATTACHMENT_MAX_BYTES, handleAttachments } from './handlers';

const scenarioId = content.scenarios[0]!.id;
const pdf = new TextEncoder().encode('%PDF-1.4\nSynthetic Bloomlab case file\n');

async function setup() {
  const linked = await link(
    {
      secret: generateSyncKey(),
      device: { device_id: crypto.randomUUID(), label: 'Attachment test' },
    },
    env.DB,
    env.SYNC_KEY_PEPPER,
  );
  const id = crypto.randomUUID();
  const request = (
    path = `/${id}`,
    method = 'GET',
    token: string | null = linked.session_token,
    bytes: BodyInit | null = null,
    type = 'application/pdf',
  ) =>
    handleAttachments(
      new Request(`https://bloomlab.test/api/attachments${path}`, {
        method,
        headers: {
          ...(token ? { authorization: `Bearer ${token}` } : {}),
          ...(bytes ? { 'content-type': type } : {}),
        },
        ...(bytes ? { body: bytes } : {}),
      }),
      env,
    );
  return { linked, id, request };
}

describe('DATA-006 private scenario attachments', () => {
  it('uploads, lists, downloads and deletes a bounded case file through authenticated D1/R2', async () => {
    const a = await setup();
    const uploaded = await a.request(
      `/${a.id}?scenario_id=${scenarioId}&name=brief.pdf`,
      'PUT',
      undefined,
      pdf,
    );
    expect(uploaded.status).toBe(200);
    expect(await uploaded.json()).toMatchObject({
      attachment_id: a.id,
      scenario_id: scenarioId,
      name: 'brief.pdf',
      status: 'ready',
      byte_length: pdf.byteLength,
    });
    const list = await a.request(`?scenario_id=${scenarioId}`);
    expect(await list.json()).toEqual([expect.objectContaining({ attachment_id: a.id })]);
    const download = await a.request(`/${a.id}/file`);
    expect(download.headers.get('content-disposition')).toContain('brief.pdf');
    expect(new Uint8Array(await download.arrayBuffer())).toEqual(pdf);
    expect(
      await env.MEDIA.list({ prefix: `attachments/v1/${a.linked.learner_id}/` }),
    ).toMatchObject({
      objects: [expect.objectContaining({ size: pdf.byteLength })],
    });
    expect(await (await a.request(`/${a.id}`, 'DELETE')).json()).toMatchObject({
      status: 'deleted',
    });
    expect((await a.request(`/${a.id}/file`)).status).toBe(410);
  });

  it('fails closed for anonymous/foreign access, unsupported or malformed bytes, oversize and ID reuse', async () => {
    const a = await setup();
    const b = await setup();
    const upload = `/${a.id}?scenario_id=${scenarioId}&name=brief.pdf`;
    expect((await a.request(upload, 'PUT', null, pdf)).status).toBe(401);
    expect(
      (await a.request(upload, 'PUT', undefined, new Uint8Array([1, 2]), 'image/png')).status,
    ).toBe(415);
    expect(
      (await a.request(upload, 'PUT', undefined, new TextEncoder().encode('not pdf'))).status,
    ).toBe(415);
    expect(
      (await a.request(upload, 'PUT', undefined, new Uint8Array(ATTACHMENT_MAX_BYTES + 1))).status,
    ).toBe(413);
    expect((await a.request(upload, 'PUT', undefined, pdf)).status).toBe(200);
    expect((await a.request(`/${a.id}`, 'GET', b.linked.session_token)).status).toBe(403);
    const changed = new TextEncoder().encode('%PDF-1.4\nDifferent');
    expect((await a.request(upload, 'PUT', undefined, changed)).status).toBe(409);
  });

  it('keeps partial R2 writes/deletes explicit and retryable', async () => {
    const a = await setup();
    const upload = `/${a.id}?scenario_id=${scenarioId}&name=brief.pdf`;
    const put = vi.spyOn(env.MEDIA, 'put').mockRejectedValueOnce(new Error('R2 down'));
    expect((await a.request(upload, 'PUT', undefined, pdf)).status).toBe(503);
    put.mockRestore();
    expect((await a.request(upload, 'PUT', undefined, pdf)).status).toBe(200);
    const remove = vi.spyOn(env.MEDIA, 'delete').mockRejectedValueOnce(new Error('R2 down'));
    expect((await a.request(`/${a.id}`, 'DELETE')).status).toBe(503);
    remove.mockRestore();
    expect(await (await a.request(`/${a.id}`)).json()).toMatchObject({ status: 'deleting' });
    expect((await a.request(`/${a.id}`, 'DELETE')).status).toBe(200);
  });
});
