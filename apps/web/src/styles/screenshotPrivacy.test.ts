import { execFileSync } from 'node:child_process';
import { expect, it } from 'vitest';

it('masks private screenshot content, restores the DOM and fails closed', () => {
  const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  const script = `
    import assert from 'node:assert/strict';
    import {mkdtempSync, existsSync, rmSync} from 'node:fs';
    import {tmpdir} from 'node:os';
    import {join} from 'node:path';
    import {JSDOM} from 'jsdom';
    import {screenshot} from './scripts/review/cdp.mjs';
    const folder = mkdtempSync(join(tmpdir(), 'screenshot-privacy-'));
    const dom = new JSDOM('<p data-testid="sync-key">synthetic-key</p><div data-review-private><span>private</span></div><input data-review-private value="entered-key"><img alt="QR code of your Bloomlab Sync Key"><p id="ordinary">ordinary content</p>', {runScripts:'outside-only'});
    let captures = 0;
    let failCapture = false;
    const page = {
      evaluate: async expression => dom.window.eval(expression),
      send: async (method, options) => {
        captures++;
        assert.equal(method, 'Page.captureScreenshot');
        assert.equal(options.captureBeyondViewport, false);
        for (const element of dom.window.document.querySelectorAll('[data-testid], [data-review-private], [data-review-private] *, img'))
          assert.equal(dom.window.getComputedStyle(element).visibility, 'hidden');
        assert.equal(dom.window.getComputedStyle(dom.window.document.querySelector('#ordinary')).visibility, 'visible');
        if (failCapture) throw new Error('capture failed');
        return {data: Buffer.from('fixture image').toString('base64')};
      }
    };
    const original = dom.window.document.documentElement.outerHTML;
    try {
      await screenshot(page, join(folder,'ok.png'), undefined, false);
      assert.ok(existsSync(join(folder,'ok.png')));
      assert.equal(dom.window.document.documentElement.outerHTML, original);
      failCapture = true;
      await assert.rejects(screenshot(page, join(folder,'failed.png'), undefined, false), /capture failed/);
      assert.equal(dom.window.document.documentElement.outerHTML, original);
      assert.equal(existsSync(join(folder,'failed.png')), false);
      const evaluate = page.evaluate;
      page.evaluate = async expression => expression.includes('createElement') ? false : evaluate(expression);
      await assert.rejects(screenshot(page, join(folder,'unmasked.png')), /privacy masking failed/);
      assert.equal(captures, 2);
      assert.equal(existsSync(join(folder,'unmasked.png')), false);
    } finally { dom.window.close(); rmSync(folder, {recursive:true, force:true}); }
  `;
  expect(() =>
    execFileSync(process.execPath, ['--input-type=module', '-e', script], {
      cwd: root,
      stdio: 'pipe',
    }),
  ).not.toThrow();
});
