import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('..', import.meta.url));
const result = spawnSync(process.execPath, ['scripts/ghl-terminology.mjs', '--negative-control'], {
  cwd: root,
  encoding: 'utf8',
});

for (const [line, description, finding] of [
  [1, 'direct native heading casing', 'native label'],
  [2, 'literal-expression native heading casing', 'native label'],
  [3, 'nested static native heading casing', 'native label'],
  [4, 'lowercase known stale alias', 'stale alias'],
  [5, 'case drift in a known registry ID', 'registry id'],
  [6, 'lowercase unknown registry ID', 'registry id'],
  [7, 'lowercase branded native heading', 'branded native name'],
  [8, 'partially lowercase possessive branded heading', 'branded native name'],
]) {
  test(`rejects ${description}`, () => {
    assert.equal(result.status, 1, result.stderr);
    assert.match(
      result.stderr,
      new RegExp(`negative-control\\.tsx line ${line}: .*${finding}`, 'i'),
    );
  });
}

test('accepts dynamic headings, canonical names and generic instance prose', () => {
  assert.equal(result.status, 1, result.stderr);
  assert.doesNotMatch(result.stderr, /negative-control\.tsx line (?:9|10|11|12):/);
});
