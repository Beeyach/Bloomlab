import { execFileSync } from 'node:child_process';
import { expect, it } from 'vitest';

it('fails sync review for caught errors, false or missing verdicts, never just successful cleanup', () => {
  const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  const script = `import assert from 'node:assert/strict';
    import {probeExitCode} from './scripts/review/probe-result.mjs';
    assert.equal(probeExitCode({ok:true}),0);
    for(const report of [undefined,{}, {ok:false}, {error:'controlled'}, {ok:true,error:'controlled'}])
      assert.equal(probeExitCode(report),1);`;
  expect(() =>
    execFileSync(process.execPath, ['--input-type=module', '-e', script], {
      cwd: root,
      stdio: 'pipe',
    }),
  ).not.toThrow();
});
