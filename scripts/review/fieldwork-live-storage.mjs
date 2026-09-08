// Isolated synthetic learner and image only. Never real-GHL acceptance or provider input.
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { generateSyncKey } from '../../packages/shared/src/syncKey.ts';
const base = process.env.BASE;
assert(base && process.env.REVIEW_HEAD, 'Set BASE and REVIEW_HEAD');
const health = await (await fetch(base + '/api/health')).json();
assert.equal(health.build_id, process.env.REVIEW_HEAD);
const report = {
  head: health.build_id,
  base,
  checks: [],
  kind: 'Live Preview Worker/private asset boundary with isolated synthetic image and learners; no real GHL work',
};
async function link(secret = generateSyncKey()) {
  const response = await fetch(base + '/api/sync/link', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      secret,
      device: { device_id: crypto.randomUUID(), label: 'Phase 22 private storage probe' },
    }),
  });
  assert.equal(response.status, 200);
  return response.json();
}
const key = generateSyncKey();
const a = await link(key);
const other = await link();
const owner = await link(key);
const id = crypto.randomUUID();
const attempt = crypto.randomUUID();
const bytes = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN1kAAAAASUVORK5CYII=',
  'base64',
);
const assetPath = `/api/evidence/assets/${id}`;
async function request(path, identity, init = {}) {
  return fetch(base + path, {
    ...init,
    redirect: 'error',
    headers: {
      ...(identity ? { authorization: `Bearer ${identity.session_token}` } : {}),
      ...init.headers,
    },
  });
}
try {
  const query = `?attempt_id=${attempt}&exercise_id=EX-FIELDWORK-snapshot-no-show-system&item_key=destination_workflow`;
  const put = () =>
    request(assetPath + query, a, {
      method: 'PUT',
      headers: { 'content-type': 'image/png' },
      body: bytes,
    });
  const uploaded = await put();
  assert.equal(uploaded.status, 200);
  const meta = await uploaded.json();
  assert.equal(meta.status, 'ready');
  assert(!('object_key' in meta));
  const retry = await put();
  assert.equal(retry.status, 200);
  assert.deepEqual(await retry.json(), meta);
  const image = await request(assetPath + '/image', a);
  assert.equal(image.status, 200);
  assert(image.headers.get('cache-control').includes('no-store'));
  assert.equal(image.headers.get('x-content-type-options'), 'nosniff');
  assert.deepEqual(Buffer.from(await image.arrayBuffer()), bytes);
  report.checks.push('live private upload, immutable replay and exact image read');
  for (const path of [assetPath, assetPath + '/image']) {
    assert.equal((await request(path, other)).status, 404);
    assert.equal((await request(path, null)).status, 401);
  }
  assert.equal((await request(assetPath, other, { method: 'DELETE' })).status, 404);
  assert.equal((await request(assetPath, null, { method: 'DELETE' })).status, 401);
  report.checks.push('foreign and anonymous read/delete denied');
  const revoke = await request('/api/sync/devices/revoke', owner, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ device_id: a.device_id }),
  });
  assert.equal(revoke.status, 200);
  for (const path of [assetPath, assetPath + '/image'])
    assert.equal((await request(path, a)).status, 401);
  assert.equal((await request(assetPath, a, { method: 'DELETE' })).status, 401);
  report.checks.push('revocation effective on next metadata/image/delete request');
  const removed = await request(assetPath, owner, { method: 'DELETE' });
  assert.equal(removed.status, 200);
  assert.equal((await removed.json()).status, 'deleted');
  assert.equal((await request(assetPath + '/image', owner)).status, 410);
  assert.equal((await request(assetPath, owner, { method: 'DELETE' })).status, 200);
  report.checks.push('linked owner deletion and idempotent tombstone; private bytes unavailable');
  const after = await (await fetch(base + '/api/health')).json();
  assert.equal(after.build_id, report.head);
  const out = resolve(process.env.REVIEW_OUT ?? '.review/phase-22-live-storage');
  mkdirSync(out, { recursive: true });
  writeFileSync(resolve(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally {
  await request(assetPath, owner, { method: 'DELETE' });
  await request('/api/sync/devices/revoke', owner, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ device_id: owner.device_id }),
  });
  await request('/api/sync/devices/revoke', other, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ device_id: other.device_id }),
  });
}
