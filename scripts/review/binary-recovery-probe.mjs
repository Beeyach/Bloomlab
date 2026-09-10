// DATA-006: isolated synthetic Preview learner/files only. No production, provider or GHL access.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { generateSyncKey } from '../../packages/shared/src/syncKey.ts';
import { probeExitCode } from './probe-result.mjs';

const base = process.env.BASE ?? 'http://localhost:4173';
const head = process.env.REVIEW_HEAD;
assert(head, 'Set REVIEW_HEAD to the exact deployed commit');
const out = resolve(process.env.REVIEW_OUT ?? '.review/binary-recovery');
mkdirSync(out, { recursive: true });
const report = {
  base,
  head,
  kind: 'Synthetic Preview private-media recovery; no provider or real-GHL activity',
  checks: [],
  ok: false,
};

async function link(label) {
  const response = await fetch(`${base}/api/sync/link`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      secret: generateSyncKey(),
      device: { device_id: crypto.randomUUID(), label },
    }),
  });
  assert.equal(response.status, 200);
  return response.json();
}

const request = (path, identity, init = {}) =>
  fetch(`${base}${path}`, {
    ...init,
    redirect: 'error',
    headers: {
      ...(identity ? { authorization: `Bearer ${identity.session_token}` } : {}),
      ...init.headers,
    },
  });

let owner;
let foreign;
let attachmentId;
try {
  const before = await (await fetch(`${base}/api/health`, { cache: 'no-store' })).json();
  assert.equal(before.build_id, head);
  assert.equal(before.environment, 'preview');
  owner = await link('Field-Ready binary recovery');
  foreign = await link('Field-Ready foreign recovery');
  attachmentId = crypto.randomUUID();
  const scenario = 'SC-glowhaus-incident-missing-phone';
  const bytes = Buffer.from('%PDF-1.4\nSynthetic Field-Ready case file\n');
  const assetPath = `/api/attachments/${attachmentId}`;
  const upload = await request(
    `${assetPath}?scenario_id=${encodeURIComponent(scenario)}&name=preview-case.pdf`,
    owner,
    { method: 'PUT', headers: { 'content-type': 'application/pdf' }, body: bytes },
  );
  assert.equal(upload.status, 200);
  const metadata = await upload.json();
  assert.equal(metadata.status, 'ready');
  assert(!('object_key' in metadata));
  assert.equal((await request(assetPath, null)).status, 401);
  assert.equal((await request(assetPath, foreign)).status, 403);
  const listing = await request(`/api/attachments?scenario_id=${scenario}`, owner);
  assert.deepEqual(
    (await listing.json()).map((asset) => asset.attachment_id),
    [attachmentId],
  );
  const download = await request(`${assetPath}/file`, owner);
  assert.equal(download.status, 200);
  assert.deepEqual(Buffer.from(await download.arrayBuffer()), bytes);
  report.checks.push('private scenario upload/list/download; anonymous and foreign access denied');

  const exported = await request('/api/recovery/export', owner, { method: 'POST' });
  assert.equal(exported.status, 200);
  assert(exported.headers.get('content-type').includes('application/vnd.bloomlab.recovery-v1'));
  const archive = Buffer.from(await exported.arrayBuffer());
  assert.equal(archive.subarray(0, 8).toString(), 'BLMR2V1\n');
  const headerLength = archive.readUInt32BE(8);
  const headerText = archive.subarray(12, 12 + headerLength).toString('utf8');
  const header = JSON.parse(headerText);
  assert.equal(header.learner_id, owner.learner_id);
  assert.deepEqual(
    header.assets.map((asset) => asset.kind),
    ['scenario_attachment'],
  );
  assert(!/session.?token|sync.?key|api.?key|provider.?key|base64/i.test(headerText));
  report.checks.push(
    'verified bounded v1 export manifest contains bytes/checksum and no credentials',
  );

  const preview = await request('/api/recovery/preview', owner, {
    method: 'POST',
    headers: { 'content-type': 'application/vnd.bloomlab.recovery-v1' },
    body: archive,
  });
  assert.equal(preview.status, 200);
  const staged = await preview.json();
  assert.deepEqual(staged.counts, { add: 0, repair: 0, keep: 1, deleted: 0 });
  const confirmed = await request(`/api/recovery/stages/${staged.stage_id}/confirm`, owner, {
    method: 'POST',
  });
  assert.equal(confirmed.status, 200);
  assert.equal((await confirmed.json()).status, 'restored');
  report.checks.push('restore preview is explicit; confirmation keeps matching current media');

  const cancellable = await request('/api/recovery/preview', owner, {
    method: 'POST',
    headers: { 'content-type': 'application/vnd.bloomlab.recovery-v1' },
    body: archive,
  });
  const secondStage = await cancellable.json();
  assert.equal(
    (
      await request(`/api/recovery/stages/${secondStage.stage_id}/cancel`, owner, {
        method: 'DELETE',
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await request('/api/recovery/preview', foreign, {
        method: 'POST',
        headers: { 'content-type': 'application/vnd.bloomlab.recovery-v1' },
        body: archive,
      })
    ).status,
    403,
  );
  const corrupt = Buffer.from(archive);
  corrupt[corrupt.length - 1] ^= 1;
  assert.equal(
    (
      await request('/api/recovery/preview', owner, {
        method: 'POST',
        headers: { 'content-type': 'application/vnd.bloomlab.recovery-v1' },
        body: corrupt,
      })
    ).status,
    400,
  );
  report.checks.push('cancel succeeds; foreign-owner and checksum-corrupt archives fail closed');

  assert.equal((await request(assetPath, owner, { method: 'DELETE' })).status, 200);
  assert.equal((await request(`${assetPath}/file`, owner)).status, 410);
  const after = await (await fetch(`${base}/api/health`, { cache: 'no-store' })).json();
  assert.equal(after.build_id, head);
  report.worker = {
    before: before.build_id,
    after: after.build_id,
    environment: after.environment,
  };
  report.ok = true;
} catch (error) {
  report.error = String(error?.stack ?? error);
} finally {
  if (owner && attachmentId)
    await request(`/api/attachments/${attachmentId}`, owner, { method: 'DELETE' }).catch(() => {});
  for (const identity of [owner, foreign]) {
    if (!identity) continue;
    await request('/api/sync/devices/revoke', identity, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ device_id: identity.device_id }),
    }).catch(() => {});
  }
  writeFileSync(resolve(out, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report));
}
process.exitCode = probeExitCode(report);
