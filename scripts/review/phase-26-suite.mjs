// Sequential, isolated-profile browser review. No paid/live provider mode is permitted.
// Each child keeps its assertions and raw artifact; any child failure fails the suite.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createWriteStream, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const allowed = [
  'polish',
  'a11y',
  'rail',
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
];
const selected = process.argv.slice(2);
assert(selected.length > 0, 'Name the probes to run; see the explicit allowlist.');
assert(
  selected.every((name) => allowed.includes(name)),
  'Unknown probe',
);
assert.notEqual(process.env.FIELDWORK_LIVE, '1', 'Only controlled fieldwork is allowed');
const out = resolve(process.env.REVIEW_OUT ?? '.review/phase-26-suite');
mkdirSync(out, { recursive: true });
const report = {
  base: process.env.BASE ?? null,
  head: process.env.REVIEW_HEAD ?? null,
  probes: [],
};
assert(report.base, 'BASE must name the built local or Preview app');
// A freshly started server may need a moment to bind. This is bounded readiness, not a retry
// of failed assertions. Exact-head suites refuse another Worker's identity before any probe.
const deadline = Date.now() + 30_000;
let health;
while (Date.now() < deadline) {
  try {
    const response = await fetch(report.base + '/api/health', {
      signal: AbortSignal.timeout(2000),
    });
    if (response.ok) {
      health = await response.json();
      break;
    }
  } catch {
    /* server still starting */
  }
  await new Promise((done) => setTimeout(done, 250));
}
assert(health, 'Built app did not become ready');
if (report.head) assert.equal(health.build_id, report.head);
report.healthBefore = health;
for (const name of selected) {
  const dir = resolve(out, name);
  mkdirSync(dir, { recursive: true });
  const log = createWriteStream(resolve(dir, 'run.log'));
  const started = Date.now();
  console.log('Starting ' + name);
  const result = await new Promise((done) => {
    const child = spawn(process.execPath, ['scripts/review/' + name + '-probe.mjs'], {
      env: { ...process.env, REVIEW_OUT: dir, FIELDWORK_LIVE: '0' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.pipe(log, { end: false });
    child.stderr.pipe(log, { end: false });
    child.on('error', (error) => done({ code: null, error: String(error) }));
    child.on('close', (code, signal) => done({ code, signal }));
  });
  await new Promise((done) => log.end(done));
  const row = {
    name,
    ...result,
    elapsedMs: Date.now() - started,
    status: result.code === 0 ? 'PASSED' : 'FAILED',
  };
  report.probes.push(row);
  report.status = report.probes.every((p) => p.status === 'PASSED') ? 'PASSED' : 'FAILED';
  writeFileSync(resolve(out, 'suite.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(row));
}
try {
  report.healthAfter = await (
    await fetch(report.base + '/api/health', { signal: AbortSignal.timeout(10_000) })
  ).json();
  if (report.head) assert.equal(report.healthAfter.build_id, report.head);
} catch (error) {
  report.status = 'FAILED';
  report.error = String(error);
}
writeFileSync(resolve(out, 'suite.json'), JSON.stringify(report, null, 2));
if (report.status !== 'PASSED') process.exitCode = 1;
