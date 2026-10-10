import { execFileSync } from 'node:child_process';
import { expect, it } from 'vitest';

it('matches exact adversarial report paths across Windows and POSIX separators', () => {
  const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  const script = `
    import assert from 'node:assert/strict';
    import {findReportFile} from './scripts/adversarial-evidence.mjs';
    const expected = 'C:/repo/apps/web/test.ts';
    const actual = {name:expected};
    const files = [{name:'C:/other/apps/web/test.ts'}, actual];
    assert.equal(findReportFile(files, expected.replaceAll('/', String.fromCharCode(92))), actual);
    assert.equal(findReportFile(files, expected), actual);
    assert.equal(findReportFile(files, 'C:/repo/apps/web/missing.ts'), undefined);
    const posix = {name:'/repo/apps/web/test.ts'};
    assert.equal(findReportFile([posix], posix.name), posix);
  `;
  expect(() =>
    execFileSync(process.execPath, ['--input-type=module', '-e', script], {
      cwd: root,
      stdio: 'pipe',
    }),
  ).not.toThrow();
});
