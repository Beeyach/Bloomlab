// Real axe-core browser gate. No disabled rules, exclusions, snapshots or provider calls.
// By default serves the existing build itself; BASE selects an already running local/Preview app.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { session, openPage, setViewport, sleep } from './cdp.mjs';
import { probeHelpers } from './probe-lib.mjs';
import { SCREEN_MATRIX } from './screen-matrix.mjs';

const require = createRequire(import.meta.url);
const source = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const base = process.env.BASE ?? 'http://127.0.0.1:4197';
const out = resolve(process.env.REVIEW_OUT ?? '.review/accessibility');
mkdirSync(out, { recursive: true });
const widths = (process.env.WIDTHS ?? '1440,390').split(',').map(Number);
const report = { base, head: process.env.REVIEW_HEAD ?? null, scans: [], negativeControl: false };
const serious = (violations) =>
  violations.filter((v) => ['serious', 'critical'].includes(v.impact));
let server;
let browser;
try {
  if (!process.env.BASE) {
    server = spawn(
      process.execPath,
      [
        resolve('node_modules/vite/bin/vite.js'),
        'preview',
        '--host',
        '127.0.0.1',
        '--port',
        '4197',
        '--strictPort',
      ],
      {
        cwd: resolve('apps/web'),
        stdio: 'inherit',
      },
    );
    let ready = false;
    for (let i = 0; i < 120; i++) {
      assert(server.exitCode === null, 'Accessibility preview server exited');
      try {
        ready = (await fetch(base)).ok;
      } catch {
        /* starting */
      }
      if (ready) break;
      await sleep(250);
    }
    assert(ready, 'Accessibility preview server not ready');
  }
  browser = await session();
  const { page } = browser;
  const { waitFor, click } = probeHelpers({ base });
  if (report.head) {
    report.health = await (await fetch(base + '/api/health')).json();
    assert.equal(report.health.build_id, report.head);
  }
  async function scan(name, width) {
    // Measure the presented state, not a transient sheet entrance's opacity.
    await page.evaluate(
      `Promise.all(document.getAnimations().filter(a => a.effect?.getTiming().iterations !== Infinity).map(a => a.finished.catch(() => null)))`,
    );
    await page.evaluate(source);
    const results = await page.evaluate(
      `axe.run(document, { resultTypes: ['violations', 'incomplete'] }).then(r => ({ version: r.testEngine.version, violations: r.violations, incomplete: r.incomplete, passes: r.passes.length }))`,
    );
    report.scans.push({ name, width, ...results });
    console.log(
      JSON.stringify({
        name,
        width,
        serious: serious(results.violations).map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => n.target),
        })),
        advisory: results.violations.filter((v) => !serious([v]).length).map((v) => v.id),
        incomplete: results.incomplete.map((v) => v.id),
      }),
    );
  }
  for (const width of widths) {
    await setViewport(page, width, 600);
    for (const [name, path] of SCREEN_MATRIX) {
      await openPage(page, base + path);
      assert(
        await waitFor(
          page,
          `!!document.querySelector('main h1') && ![...document.querySelectorAll('[role=status]')].some(e => /^(Loading|Opening the unit)/.test(e.textContent.trim()))`,
        ),
        name + ' did not render',
      );
      assert(
        !(await page.evaluate(
          `document.querySelector('main')?.textContent.includes('This page could not open')`,
        )),
        name + ' crashed',
      );
      if (report.head)
        assert.equal(
          await page.evaluate("document.querySelector('[data-build-id]')?.dataset.buildId"),
          report.head,
        );
      await scan(name, width);
    }
    // A real failure state, with the request intercepted before it can create/link a learner.
    // The generated local key is never sent, recorded or included in the report.
    await openPage(page, base + '/sync');
    assert(
      await waitFor(
        page,
        `[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Create a sync key')`,
      ),
    );
    await page.evaluate(
      `(() => { const original = window.fetch.bind(window); window.fetch = (input, init) => new URL(typeof input === 'string' ? input : input.url, location.href).pathname.startsWith('/api/sync/') ? Promise.resolve(Response.json({error:'Controlled connection failure'}, {status:503})) : original(input, init); })()`,
    );
    await click(page, 'Create a sync key');
    await click(page, 'input[type=checkbox]');
    await click(page, 'Link this device');
    assert(
      await waitFor(
        page,
        `document.querySelector('main [role=alert]')?.textContent.includes('Controlled connection failure')`,
      ),
    );
    await scan('sync-link-error', width);
    // Drop the document-scoped transport fixture and unsubmitted key before continuing.
    await openPage(page, base + '/search');
    if (width < 768) {
      await click(page, '[data-testid="rail-more"]');
      await scan('phone-more-open', width);
    }
  }
  // An actual inaccessible DOM control must be detected: proves the engine and severity policy.
  await page.evaluate(
    `(() => { const b = document.createElement('button'); b.id = 'a11y-negative-control'; b.style.cssText = 'position:fixed;top:0;left:0;width:60px;height:60px;z-index:99999'; document.body.append(b); })()`,
  );
  const negative = await page.evaluate(`axe.run(document).then(r => r.violations)`);
  assert(
    serious(negative).some(
      (v) =>
        v.id === 'button-name' && v.nodes.some((n) => n.target.includes('#a11y-negative-control')),
    ),
    'axe failed its negative control',
  );
  report.negativeControl = true;
  await page.evaluate(`document.querySelector('#a11y-negative-control').remove()`);
  report.blockingViolations = report.scans.flatMap((s) =>
    serious(s.violations).map((v) => ({ name: s.name, width: s.width, id: v.id })),
  );
  assert.equal(report.blockingViolations.length, 0, JSON.stringify(report.blockingViolations));
  report.status = 'PASSED';
} catch (error) {
  report.status = 'FAILED';
  report.error = String(error);
  throw error;
} finally {
  writeFileSync(resolve(out, 'a11y-probe.json'), JSON.stringify(report, null, 2));
  await browser?.close();
  server?.kill();
}
