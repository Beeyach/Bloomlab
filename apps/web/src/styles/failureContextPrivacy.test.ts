import { execFileSync } from 'node:child_process';
import { expect, it } from 'vitest';

it('keeps private text and URL secrets out of the actual failure-isolation report collector', () => {
  const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  const script = `
    import assert from 'node:assert/strict';
    import {readFileSync} from 'node:fs';
    import {JSDOM} from 'jsdom';
    const source = readFileSync('./scripts/review/failure-isolation-probe.mjs', 'utf8');
    const expression = source.slice(source.indexOf('report.failureContext =')).split('\x60')[1];
    const secret = 'private-negative-control';
    const dom = new JSDOM('<p data-testid="sync-key">'+secret+'</p><div data-review-private>'+secret+'</div><button data-sync-completed="7">Sync now</button>', {
      url:'https://preview.example.test/sync?key='+secret+'#'+secret, runScripts:'outside-only'
    });
    try {
      Object.defineProperty(dom.window.document.body, 'innerText', {value:dom.window.document.body.textContent});
      dom.window.sessionStorage.setItem('__bloomlab_failed_push', '2');
      const report = dom.window.eval(expression);
      assert.equal(JSON.stringify(report).includes(secret), false);
      assert.equal(report.url, 'https://preview.example.test/sync');
      assert.equal(report.syncCompleted, '7');
      assert.equal(report.injectedRequests.__bloomlab_failed_push, '2');
    } finally { dom.window.close(); }
  `;
  expect(() =>
    execFileSync(process.execPath, ['--input-type=module', '-e', script], {
      cwd: root,
      stdio: 'pipe',
    }),
  ).not.toThrow();
});
