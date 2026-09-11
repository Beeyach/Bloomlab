#!/usr/bin/env node
// Exact-head deployed Preview closeout. All provider-facing exercises use their controlled probe
// fixtures; live fieldwork and production are forbidden. A nonzero child is retained in the
// report and fails the attestation rather than being converted into a pass.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { openPage, session, sleep } from './cdp.mjs';
import { probeHelpers } from './probe-lib.mjs';

const base = process.env.BASE;
const head = process.env.REVIEW_HEAD;
assert(base && new URL(base).protocol === 'https:', 'BASE must be the deployed HTTPS Preview');
assert(head && /^[0-9a-f]{40}$/.test(head), 'REVIEW_HEAD must be the exact 40-character commit');
assert.notEqual(process.env.FIELDWORK_LIVE, '1', 'Live fieldwork is forbidden in closeout');
const out = resolve(process.env.REVIEW_OUT ?? '.review/field-ready');
const evidenceRoot = resolve(out, 'browser');
mkdirSync(evidenceRoot, { recursive: true });

const probes = [
  'polish',
  'a11y',
  'rail',
  'navigation',
  'sidebar-resize',
  'restore',
  'search',
  'moments',
  'lazy-route',
  'connect',
  'advanced-labs',
  'advanced-paths',
  'academy',
  'exercise',
  'workflow',
  'crm-review',
  'funnel',
  'calendar',
  'reporting',
  'incident',
  'sales',
  'pricing',
  'negotiation',
  'call',
  'fieldwork',
  'portfolio',
  'clients',
  'offline',
  'sync',
  'clients-sync',
  'portfolio-sync',
  'remediation-home',
  'remediation-keyboard',
  'remediation-draft',
  'remediation-exercise',
];

const report = {
  schema_version: 1,
  base,
  head,
  node: process.version,
  ci: {
    run_id: process.env.GITHUB_RUN_ID ?? null,
    attempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
    url: process.env.GITHUB_RUN_ID
      ? `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
      : null,
  },
  acceptance_boundary:
    'Verification success is not full C1-C8 acceptance. GHL-005/GHL-010 remain PARTIAL and DES-018 remains IN_PROGRESS; see the source requirement ledger for all retained boundaries.',
  fieldwork_live: false,
  production: 'SKIPPED',
  identities: {},
  stages: [],
};

async function identity(label) {
  let health;
  let healthAttempts = 0;
  for (; healthAttempts < 60; healthAttempts++) {
    try {
      const response = await fetch(
        `${base}/api/health?field_ready=${encodeURIComponent(`${head}-${label}-${healthAttempts}`)}`,
        {
          cache: 'no-store',
          headers: { 'cache-control': 'no-cache' },
          signal: AbortSignal.timeout(10_000),
        },
      );
      if (response.ok) health = await response.json();
      if (health?.environment === 'preview' && health?.build_id === head) break;
    } catch {
      // A just-published Worker can briefly be unavailable at one edge; exact equality below
      // remains mandatory after this bounded convergence window.
    }
    await sleep(500);
  }
  assert(health, `${label} Worker health did not become available`);
  assert.equal(health.environment, 'preview');
  assert.equal(health.build_id, head);
  const browser = await session();
  try {
    await browser.page.send('Network.enable');
    await browser.page.send('Network.setCacheDisabled', { cacheDisabled: true });
    let browserHead;
    let browserAttempts = 0;
    for (; browserAttempts < 12; browserAttempts++) {
      await openPage(browser.page, `${base}/?field_ready=${head}-${label}-${browserAttempts}`);
      const { waitFor } = probeHelpers({ base });
      await waitFor(browser.page, `!!document.querySelector('[data-build-id]')`, 20);
      browserHead = await browser.page.evaluate(
        `document.querySelector('[data-build-id]')?.dataset.buildId`,
      );
      if (browserHead === head) break;
      await browser.page.evaluate(`Promise.all([
        navigator.serviceWorker?.getRegistrations().then((rows) => Promise.all(rows.map((row) => row.unregister()))),
        caches?.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      ])`);
      await sleep(500);
    }
    assert.equal(browserHead, head);
    report.identities[label] = {
      browser: browserHead,
      worker: health.build_id,
      health_attempts: healthAttempts + 1,
      browser_attempts: browserAttempts + 1,
    };
  } finally {
    await browser.close();
  }
}

async function run(name, script, args = [], extraEnv = {}) {
  const directory = resolve(out, name);
  mkdirSync(directory, { recursive: true });
  const log = createWriteStream(resolve(directory, 'run.log'));
  const started = Date.now();
  console.log(`FIELD_READY_STAGE ${name} starting`);
  const result = await new Promise((done) => {
    const child = spawn(process.execPath, [script, ...args], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        BASE: base,
        REVIEW_HEAD: head,
        FIELDWORK_LIVE: '0',
        ...extraEnv,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.pipe(process.stdout);
    child.stderr.pipe(process.stderr);
    child.stdout.pipe(log, { end: false });
    child.stderr.pipe(log, { end: false });
    child.on('error', (error) => done({ code: null, error: String(error) }));
    child.on('close', (code, signal) => done({ code, signal }));
  });
  await new Promise((done) => log.end(done));
  const row = {
    name,
    ...result,
    elapsed_ms: Date.now() - started,
    status: result.code === 0 ? 'PASSED' : 'FAILED',
  };
  report.stages.push(row);
  writeFileSync(resolve(out, 'attestation.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`FIELD_READY_STAGE ${JSON.stringify(row)}`);
}

await identity('before');
await run('browser', 'scripts/review/phase-26-suite.mjs', probes, {
  REVIEW_OUT: evidenceRoot,
  REVIEW_SCROLLBARS: '1',
});
await run('ai-off', 'scripts/review/ai-off-suite.mjs', [], {
  REVIEW_OUT: resolve(out, 'ai-off'),
});
await run('binary-recovery', 'scripts/review/binary-recovery-probe.mjs', [], {
  REVIEW_OUT: resolve(out, 'binary-recovery'),
});
await run('failure-isolation', 'scripts/review/failure-isolation-probe.mjs', [], {
  REVIEW_OUT: resolve(out, 'failure-isolation'),
});
await run('ghl-terminology', 'scripts/ghl-terminology.mjs');
await run('screen-states', 'scripts/review/screen-state-matrix.mjs', [], {
  EVIDENCE_ROOT: evidenceRoot,
  REVIEW_OUT: resolve(out, 'screen-states'),
});
await identity('after');

const terminology = JSON.parse(readFileSync(resolve('.content/ghl-terminology.json'), 'utf8'));
report.terminology = {
  registry_records: terminology.registry_records,
  scoped_files: terminology.scoped_files,
  text_segments: terminology.text_segments,
  problems: terminology.problems.length,
};
const statePath = resolve(out, 'screen-states', 'screen-state-matrix.json');
if (existsSync(statePath)) {
  const states = JSON.parse(readFileSync(statePath, 'utf8'));
  report.screen_state_coverage = { requirement: states.requirement, summary: states.summary };
}
const deployLogPath = resolve(out, 'deploy.log');
assert(existsSync(deployLogPath), 'Missing captured Wrangler deployment log');
const deployLog = readFileSync(deployLogPath, 'utf8');
const workerVersion = deployLog.match(
  /(?:Current Version ID|Worker Version ID|Version ID):\s*([0-9a-f-]{36})/i,
)?.[1];
assert(workerVersion, 'Wrangler deployment log did not expose the Worker version ID');
report.deployment = {
  worker_version: workerVersion,
  migrations: 'bloomlab-dev only; see migrations.log',
  production: 'SKIPPED',
};
report.status =
  report.stages.every((stage) => stage.status === 'PASSED') &&
  report.identities.before.browser === head &&
  report.identities.before.worker === head &&
  report.identities.after.browser === head &&
  report.identities.after.worker === head
    ? 'PASSED'
    : 'FAILED';
writeFileSync(resolve(out, 'attestation.json'), `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(
  resolve(out, 'attestation.md'),
  [
    '# Field-Ready v1 exact-head Preview attestation',
    '',
    `- Status: ${report.status}`,
    `- Git head: \`${head}\``,
    `- Node: \`${report.node}\``,
    `- CI: ${report.ci.url ?? 'local diagnostic'} (attempt ${report.ci.attempt ?? 'n/a'})`,
    `- Acceptance boundary: ${report.acceptance_boundary}`,
    `- Preview: ${base}`,
    `- Worker version: \`${workerVersion}\``,
    `- Browser / Worker before: \`${report.identities.before.browser}\` / \`${report.identities.before.worker}\``,
    `- Browser / Worker after: \`${report.identities.after.browser}\` / \`${report.identities.after.worker}\``,
    `- Critical browser probes: ${probes.length}`,
    `- Terminology: ${report.terminology.registry_records} records, ${report.terminology.scoped_files} files, ${report.terminology.text_segments} text segments, ${report.terminology.problems} problems`,
    '- Migrations: bloomlab-dev only',
    '- Provider spend: $0; controlled fixtures only',
    '- Production: SKIPPED',
    '',
    '| Stage | Status | Duration (ms) |',
    '| --- | --- | ---: |',
    ...report.stages.map((stage) => `| ${stage.name} | ${stage.status} | ${stage.elapsed_ms} |`),
    '',
  ].join('\n'),
);
console.log(JSON.stringify(report, null, 2));
if (report.status !== 'PASSED') process.exitCode = 1;
