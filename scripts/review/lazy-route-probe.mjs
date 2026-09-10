// Read-only page-execution/network boundary check, not Lighthouse/CWV or a hardware benchmark.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { session, openPage, setViewport, sleep } from './cdp.mjs';
const base = process.env.BASE ?? 'http://127.0.0.1:4183';
const out = resolve(process.env.REVIEW_OUT ?? '.review/phase-26-lazy');
mkdirSync(out, { recursive: true });
const { page, close } = await session();
const report = { base, head: process.env.REVIEW_HEAD ?? null, screens: [] };
try {
  await setViewport(page, 390, 800);
  await page.send('Profiler.enable');
  for (const path of ['/academy/LU-connect-webhooks', '/workflow']) {
    await page.send('Profiler.startPreciseCoverage', { callCount: true, detailed: false });
    await openPage(page, base + path);
    await sleep(1200);
    const coverage = await page.send('Profiler.takePreciseCoverage');
    await page.send('Profiler.stopPreciseCoverage');
    const executed = coverage.result
      .filter(
        (s) => s.url.startsWith(base) && s.functions.some((f) => f.ranges.some((r) => r.count > 0)),
      )
      .map((s) => new URL(s.url).pathname);
    const assets = await page.evaluate(
      `performance.getEntriesByType('resource').map(r=>({path:new URL(r.name).pathname,type:r.initiatorType,bytes:r.transferSize,duration:Math.round(r.duration)}))`,
    );
    const cached = await page.evaluate(
      `caches.keys().then(async names=>(await Promise.all(names.map(async n=>(await (await caches.open(n)).keys()).map(r=>new URL(r.url).pathname)))).flat())`,
    );
    const row = {
      path,
      executed,
      assets,
      workflowPrecached: cached.filter((p) => /WorkflowLab|simulator.worker/.test(p)),
      browser: await page.evaluate('document.documentElement.dataset.buildId'),
    };
    report.screens.push(row);
    if (report.head) assert.equal(row.browser, report.head);
    const workflow = executed.some((p) => /WorkflowLab-/.test(p));
    assert.equal(
      workflow,
      path === '/workflow',
      'Workflow route code must execute only on its own route',
    );
  }
  report.status = 'PASSED';
  console.log(
    'Academy does not execute Workflow Lab; explicit Workflow navigation loads the route. Background PWA precache is reported separately.',
  );
} catch (error) {
  report.status = 'FAILED';
  report.error = String(error);
  throw error;
} finally {
  writeFileSync(resolve(out, 'lazy-route-probe.json'), JSON.stringify(report, null, 2));
  await close();
}
