import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { generateSyncKey } from '../../packages/shared/src/syncKey.ts';
const base = process.env.BASE;
assert(base && process.env.REVIEW_HEAD, 'BASE and REVIEW_HEAD required for deployed verification');
const out = resolve(process.env.REVIEW_OUT ?? '.review/phase-23-portfolio');
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
  device: { device_id: deviceA, label: 'Phase 23 controlled sync A' },
});
const b = await call('/api/sync/link', {
  secret,
  device: { device_id: deviceB, label: 'Phase 23 controlled sync B' },
});
const stranger = await call('/api/sync/link', {
  secret: generateSyncKey(),
  device: { device_id: crypto.randomUUID(), label: 'Phase 23 isolation check' },
});
const at = new Date().toISOString(),
  id = 'pp:PF-consultation-booking-system';
const kinds = [
  'brief',
  'business_problem',
  'architecture',
  'funnel',
  'workflows',
  'screenshots',
  'learner_reasoning',
  'skills_demonstrated',
  'assistance_level',
  'real_ghl_evidence',
];
const record = {
  id,
  learner_id: a.learner_id,
  device_id: deviceA,
  created_at: at,
  updated_at: at,
  revision: 1,
  deleted_at: null,
  schema_version: 1,
  template_id: 'PF-consultation-booking-system',
  project_id: 'PRJ-consultation-booking-system',
  reflection: 'Controlled sync reflection',
  artifacts: Object.fromEntries(
    kinds.map((kind) => [
      kind,
      {
        source: ['brief', 'business_problem'].includes(kind) ? 'project' : 'contributions',
        reference_id: ['brief', 'business_problem'].includes(kind) ? 'PRJ-consultation-booking-system' : id,
      },
    ]),
  ),
};
const push = (row, token = a.session_token, base_revision = 0) =>
  call(
    '/api/sync/push',
    { operations: [{ seq: 1, entity: 'portfolio_projects', base_revision, record: row }] },
    token,
  );
assert.equal((await push(record)).outcomes[0].status, 'applied');
const pull = await call('/api/sync/pull', { cursor: 0 }, b.session_token);
assert.deepEqual(pull.changes[0].record.artifacts, record.artifacts);
assert.equal(pull.changes[0].record.reflection, record.reflection);
assert.equal(
  (await call('/api/sync/pull', { cursor: 0 }, stranger.session_token)).changes.length,
  0,
);
assert.equal((await push({ ...record, image_bytes: [1, 2] })).outcomes[0].status, 'rejected');
assert.equal(
  (
    await push(
      { ...record, reflection: 'A changed', updated_at: new Date().toISOString(), revision: 2 },
      a.session_token,
      1,
    )
  ).outcomes[0].status,
  'applied',
);
assert.equal(
  (
    await push(
      { ...record, device_id: deviceB, reflection: 'B changed concurrently', revision: 2 },
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
writeFileSync(
  resolve(out, 'live-sync.json'),
  JSON.stringify(
    {
      head: process.env.REVIEW_HEAD,
      base,
      health,
      checks: [
        'D1 ten-category roundtrip',
        'linked-device pull',
        'cross-learner isolation',
        'anonymous 401',
        'binary rejection',
        'reflection conflict',
        'controlled record tombstoned',
      ],
    },
    null,
    2,
  ),
);
console.log('Live portfolio metadata sync passed; no keys or session tokens written to report.');
