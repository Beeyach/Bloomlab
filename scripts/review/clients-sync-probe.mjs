import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { generateSyncKey } from '../../packages/shared/src/syncKey.ts';
const base = process.env.BASE;
assert(base && process.env.REVIEW_HEAD, 'BASE and REVIEW_HEAD required for deployed verification');
const out = resolve(process.env.REVIEW_OUT ?? '.review/phase-24-field-ready');
mkdirSync(out, { recursive: true });
const health = await (await fetch(base + '/api/health')).json();
assert.equal(health.build_id, process.env.REVIEW_HEAD);
async function call(path, body, token) {
  const r = await fetch(base + path, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  assert.equal(r.status, 200);
  return data;
}
const secret = generateSyncKey(),
  deviceA = crypto.randomUUID(),
  deviceB = crypto.randomUUID();
const a = await call('/api/sync/link', {
  secret,
  device: { device_id: deviceA, label: 'Phase 24 controlled sync A' },
});
const b = await call('/api/sync/link', {
  secret,
  device: { device_id: deviceB, label: 'Phase 24 controlled sync B' },
});
const stranger = await call('/api/sync/link', {
  secret: generateSyncKey(),
  device: { device_id: crypto.randomUUID(), label: 'Phase 24 isolation check' },
});
const at = new Date().toISOString(),
  id = 'cp:CL-glowhaus-medspa';
const record = {
  id,
  learner_id: a.learner_id,
  device_id: deviceA,
  created_at: at,
  updated_at: at,
  revision: 1,
  deleted_at: null,
  schema_version: 1,
  client_id: 'CL-glowhaus-medspa',
  relationship: 'discovery',
  journal: [
    { id: crypto.randomUUID(), at, text: 'Controlled live client journal; not a learner outcome.' },
  ],
  engagements: {
    'PRJ-field-ready-capstone': {
      content_version: '2026.09.21',
      stage_attempts: { audit: { 'EX-AUDIT_IT-glowhaus-boss': 'controlled-attempt-reference' } },
    },
  },
};
const push = (row, token = a.session_token, base_revision = 0) =>
  call(
    '/api/sync/push',
    { operations: [{ seq: 1, entity: 'client_progress', base_revision, record: row }] },
    token,
  );
assert.equal((await push(record)).outcomes[0].status, 'applied');
const pull = await call('/api/sync/pull', { cursor: 0 }, b.session_token);
assert.deepEqual(pull.changes[0].record.engagements, record.engagements);
assert.deepEqual(pull.changes[0].record.journal, record.journal);
assert.equal(
  (await call('/api/sync/pull', { cursor: 0 }, stranger.session_token)).changes.length,
  0,
);
assert.equal((await push({ ...record, image_bytes: [1, 2] })).outcomes[0].status, 'rejected');
assert.equal(
  (
    await push(
      { ...record, relationship: 'proposal', updated_at: new Date().toISOString(), revision: 2 },
      a.session_token,
      1,
    )
  ).outcomes[0].status,
  'applied',
);
assert.equal(
  (
    await push(
      { ...record, device_id: deviceB, relationship: 'client', revision: 2 },
      b.session_token,
      1,
    )
  ).outcomes[0].status,
  'conflict',
);
const unauth = await fetch(base + '/api/sync/pull', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: '{"cursor":0}',
});
assert.equal(unauth.status, 401);
// The controlled archive is explicitly removed after the live test; no learner work is touched.
assert.equal(
  (
    await push(
      {
        ...record,
        revision: 3,
        updated_at: new Date().toISOString(),
        deleted_at: new Date().toISOString(),
      },
      a.session_token,
      2,
    )
  ).outcomes[0].status,
  'applied',
);
await call('/api/sync/devices/revoke', { device_id: deviceB }, a.session_token);
await call('/api/sync/devices/revoke', { device_id: deviceA }, a.session_token);
await call('/api/sync/devices/revoke', { device_id: stranger.device_id }, stranger.session_token);
writeFileSync(
  resolve(out, 'live-sync.json'),
  JSON.stringify(
    {
      head: process.env.REVIEW_HEAD,
      base,
      health,
      checks: [
        'D1 client journal and stage-attempt references roundtrip',
        'linked-device pull',
        'cross-learner isolation',
        'anonymous 401',
        'binary rejection',
        'relationship/project snapshot conflict',
        'controlled record tombstoned',
      ],
    },
    null,
    2,
  ),
);
console.log('Live client metadata sync passed; no keys or session tokens written to report.');
