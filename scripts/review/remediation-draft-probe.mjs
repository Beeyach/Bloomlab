// DATA-001 / SYNC-007: an unsaved layout edit survives a genuinely offline reload,
// without creating account events or sync operations. Only synthetic local learner state.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { openPage, serviceWorkerSessions, session, setViewport, sleep } from './cdp.mjs';
const BASE = process.env.BASE ?? 'http://localhost:4183';
const OUT = resolve(process.env.REVIEW_OUT ?? '.review/remediation/draft');
mkdirSync(OUT, { recursive: true });
const report = { base: BASE, checks: [] };
const wait = async (page, expression) => {
  for (let i = 0; i < 600; i++) {
    if (await page.evaluate(expression)) return;
    await sleep(100);
  }
  throw new Error(`Timeout: ${expression}`);
};
const transform = `document.querySelector('[data-node="n1"]')?.parentElement.style.transform`;
const snapshot = `new Promise((resolve, reject) => {
  const req = indexedDB.open('bloomlab'); req.onerror = () => reject(new Error('IndexedDB unavailable'));
  req.onsuccess = () => { const db = req.result; const names = ['sim_events','sync_queue','workspace'];
    const tx = db.transaction(names); const values = {};
    for (const name of names) { const q = tx.objectStore(name).getAll(); q.onsuccess = () => { values[name] = name === 'workspace' ? q.result.filter(r => r.key.startsWith('workflow.draft.')).length : q.result.length; }; }
    tx.oncomplete = () => { db.close(); resolve(values); }; tx.onerror = () => reject(new Error('Read failed'));
  };
})`;
for (const width of (process.env.REVIEW_WIDTHS ?? '1440,1024,768,390,320').split(',').map(Number)) {
  const { page, browser, close } = await session();
  try {
    await page.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `window.__draftErrors=[];const reportError=console.error;console.error=(...args)=>{window.__draftErrors.push(args.map(String).join(' '));reportError(...args)}`,
    });
    await setViewport(page, width, 480, { mobile: width < 768 });
    await page.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
    });
    await openPage(page, `${BASE}/workflow`);
    await wait(page, `Boolean(document.querySelector('[data-node="n1"]'))`);
    await wait(page, `Boolean(navigator.serviceWorker.controller)`);
    const build = await page.evaluate(`document.querySelector('[data-build-id]')?.dataset.buildId`);
    if (process.env.REVIEW_HEAD) assert.equal(build, process.env.REVIEW_HEAD);
    const workers = await serviceWorkerSessions(browser, new URL(BASE).origin);
    assert(workers.count > 0);
    await workers.send('Network.enable');
    await page.send('Network.enable');
    const offline = { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 };
    await workers.send('Network.emulateNetworkConditions', offline);
    await page.send('Network.emulateNetworkConditions', offline);
    const before = await page.evaluate(snapshot);
    let moved;
    if (width >= 768) {
      const original = await page.evaluate(transform);
      await page.evaluate(`document.querySelector('[data-node="n1"]').click()`);
      await sleep(250);
      await page.evaluate(`document.querySelector('[data-testid="workflow-canvas"]').focus()`);
      for (const type of ['keyDown', 'keyUp'])
        await page.send('Input.dispatchKeyEvent', {
          type,
          key: 'ArrowDown',
          code: 'ArrowDown',
          windowsVirtualKeyCode: 40,
        });
      await wait(page, `${transform} !== ${JSON.stringify(original)}`);
      moved = await page.evaluate(transform);
    } else {
      // Phone's intentional vertical editor: use its real step insertion, not a hidden canvas.
      await page.evaluate(
        `document.querySelector('[data-node="n1"]').closest('li').querySelector('button:not([data-node])').click()`,
      );
      await wait(page, `Boolean(document.querySelector('[data-palette="GHL-WF-WAIT"] button'))`);
      await page.evaluate(`document.querySelector('[data-palette="GHL-WF-WAIT"] button').click()`);
      await wait(page, `Boolean(document.querySelector('[data-node="n4"]'))`);
    }
    await wait(page, `(${snapshot}).then(rows => rows.workspace > 0)`);
    await sleep(100);
    await page.send('Page.reload');
    // Preserve the Worker-offline reload and restore the new document's navigator.onLine signal.
    await workers.send('Network.emulateNetworkConditions', offline);
    await page.send('Network.emulateNetworkConditions', offline);
    await wait(page, `Boolean(document.querySelector('[data-node="n1"]'))`);
    if (width >= 768) assert.equal(await page.evaluate(transform), moved);
    else assert(await page.evaluate(`Boolean(document.querySelector('[data-node="n4"]'))`));
    assert(
      await page.evaluate(
        `document.body.textContent.includes('Unsaved draft') && !navigator.onLine`,
      ),
    );
    const after = await page.evaluate(snapshot);
    assert.equal(after.sim_events, before.sim_events);
    assert.equal(after.sync_queue, before.sync_queue);
    assert(await page.evaluate(`document.documentElement.scrollWidth <= innerWidth`));
    report.checks.push({
      width,
      height: 480,
      build,
      offlineReload: true,
      unsavedEditRecovered: width >= 768 ? 'layout nudge' : 'step insertion',
      noEventsOrSync: true,
    });
    console.log(`PASS draft offline reload ${width}×480`);
  } catch (error) {
    console.error(
      JSON.stringify({
        width,
        failure: String(error),
        browserErrors: await page.evaluate('window.__draftErrors'),
        resources: await page.evaluate(
          `performance.getEntriesByType('resource').filter(r=>r.name.includes('/assets/')).map(r=>new URL(r.name).pathname)`,
        ),
      }),
    );
    throw error;
  } finally {
    await close();
  }
}
writeFileSync(resolve(OUT, 'draft-probe.json'), JSON.stringify(report, null, 2));
