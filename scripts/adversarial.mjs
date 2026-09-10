// Re-run actual regressions and derive each PASS/FAIL from Vitest's fresh machine report.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ADVERSARIAL_CASES } from './adversarial-cases.mjs';

assert.equal(ADVERSARIAL_CASES.length, 15);
assert.equal(new Set(ADVERSARIAL_CASES.map((row) => row.id)).size, 15);
const out = resolve(process.env.REVIEW_OUT ?? '.review/adversarial');
mkdirSync(out, { recursive: true });
// A unique report name cannot accidentally consume a successful result from a previous run.
const path = resolve(out, 'vitest-' + Date.now() + '-' + process.pid + '.json');
const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const names = [...new Set(ADVERSARIAL_CASES.flatMap((row) => row.tests))];
// Filtering must retain the registry's integrity checks as well as individual fixture behavior.
names.push(
  'gives every fixture a unique, stable id',
  'names an owner for every reserved fixture, and asserts nothing for it',
  'gives every implemented fixture something to run and something to check',
);
const child = spawn(
  process.execPath,
  [
    resolve('node_modules/vitest/vitest.mjs'),
    'run',
    ...new Set(ADVERSARIAL_CASES.map((row) => row.file)),
    '-t',
    names.map(escape).join('|'),
    '--reporter=json',
    '--outputFile=' + path,
  ],
  { stdio: 'inherit' },
);
const exit = await new Promise((done, reject) => {
  child.on('error', reject);
  child.on('exit', (code) => done(code));
});
const raw = JSON.parse(readFileSync(path, 'utf8'));
const rows = ADVERSARIAL_CASES.map((row) => {
  const file = raw.testResults.find((file) => file.name === resolve(row.file));
  const observed = row.tests.map((title) => {
    const matches = file?.assertionResults.filter((test) => test.title === title) ?? [];
    return {
      title,
      status: matches.length === 1 ? matches[0].status : 'missing-or-ambiguous',
      failures: matches.flatMap((test) => test.failureMessages),
    };
  });
  return {
    ...row,
    observed,
    status: observed.every((test) => test.status === 'passed') ? 'PASS' : 'FAIL',
  };
});
const report = {
  head: process.env.BLOOMLAB_BUILD_ID ?? process.env.REVIEW_HEAD ?? null,
  generated_at: new Date().toISOString(),
  provider_spend_usd: 0,
  source: path,
  exit,
  cases: rows,
  passed: rows.filter((row) => row.status === 'PASS').length,
  failed: rows.filter((row) => row.status !== 'PASS').length,
};
writeFileSync(resolve(out, 'adversarial.json'), JSON.stringify(report, null, 2));
writeFileSync(
  resolve(out, 'adversarial.md'),
  '# Adversarial run — master §142\n\n' +
    rows
      .map(
        (row) =>
          '## ' +
          row.id +
          ' — ' +
          row.name +
          '\n\n- Setup: ' +
          row.setup +
          '\n- Expected: ' +
          row.expected +
          '\n- Observed: ' +
          row.status +
          '; ' +
          row.observed.map((test) => test.title + ' → ' + test.status).join('; ') +
          '\n- Regression: `' +
          row.file +
          '`\n- Limit: ' +
          row.limitation +
          '\n',
      )
      .join('\n'),
);
console.log(
  'Adversarial: ' + report.passed + '/15 PASS; ' + report.failed + ' FAIL; provider spend $0',
);
assert.equal(exit, 0, 'Regression runner failed');
assert.equal(raw.success, true, 'Vitest report is not successful');
assert.equal(report.failed, 0, 'Missing or failed adversarial evidence');
