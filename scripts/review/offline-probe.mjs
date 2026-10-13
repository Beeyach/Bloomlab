// Verifies the local-first and PWA requirements (DATA-001, DATA-002, DATA-003) against a built
// app: service-worker control, installability, the offline indicator, an offline reload served
// from the precache, an API call that is *not* served from cache, and a local write that survives
// the offline reload. Offline is emulated on the page and on the service worker itself.
// Writes offline-probe.json and offline-home.png to .review/.
//   BASE=https://bloomlab-preview.example.workers.dev node scripts/review/offline-probe.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

import {
  openPage,
  screenshot,
  serviceWorkerSessions,
  session,
  setViewport,
  sleep,
} from './cdp.mjs';

const OUT = resolve(process.env.REVIEW_OUT ?? '.review');
const BASE = process.env.BASE ?? 'http://localhost:4173';
const LABEL = `Offline check ${new Date().toISOString().slice(11, 19)}`;

const conditions = (offline) => ({
  offline,
  latency: 0,
  downloadThroughput: -1,
  uploadThroughput: -1,
});

async function clickButton(page, name) {
  const box = await page.evaluate(`(() => {
    const el = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === ${JSON.stringify(name)});
    if (!el) return null;
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);
  if (!box) throw new Error(`No button named ${name}`);
  await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...box });
  await page.send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    ...box,
    button: 'left',
    clickCount: 1,
  });
  await page.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    ...box,
    button: 'left',
    clickCount: 1,
  });
}

const mainIncludes = (page, text) =>
  page.evaluate(
    `document.querySelector('main')?.textContent.includes(${JSON.stringify(text)}) ?? false`,
  );

async function waitFor(page, expression, tries = 50) {
  for (let i = 0; i < tries; i++) {
    if (await page.evaluate(expression)) return true;
    await sleep(100);
  }
  return false;
}

const indicator = (page) =>
  page.evaluate("document.querySelector('[role=status]')?.textContent ?? null");

mkdirSync(OUT, { recursive: true });
const { page, browser, close } = await session();
await page.send('Network.enable');
const report = { base: BASE };
try {
  await setViewport(page, 1024, 900, { mobile: false });

  // ---------- first load: the service worker takes control, the manifest is installable ----------
  // The Phase 3 device controls now live in Sync; Home is the Command Center.
  await openPage(page, `${BASE}/sync`);
  report.serviceWorker = await page.evaluate(`(async () => {
    const reg = await navigator.serviceWorker.ready;
    for (let i = 0; i < 100 && !navigator.serviceWorker.controller; i++) await new Promise((r) => setTimeout(r, 100));
    const names = await caches.keys();
    const entries = [];
    for (const name of names) { const c = await caches.open(name); entries.push([name, (await c.keys()).length]); }
    return { scope: reg.scope, controlled: !!navigator.serviceWorker.controller, caches: entries };
  })()`);
  const manifest = await page.send('Page.getAppManifest');
  report.manifest = { url: manifest.url, errors: manifest.errors, parsed: !!manifest.data };
  report.installability = (await page.send('Page.getInstallabilityErrors')).installabilityErrors;
  report.storage = await page.evaluate(
    `(async () => ({ persisted: await navigator.storage.persisted(), databases: (await indexedDB.databases()).map((d) => d.name + '@' + d.version) }))()`,
  );
  report.loadedBuild = await page.evaluate(
    "document.querySelector('[data-build-id]')?.dataset.buildId",
  );
  if (process.env.REVIEW_HEAD) assert.equal(report.loadedBuild, process.env.REVIEW_HEAD);

  // ---------- go offline on the page *and* on the worker ----------
  const workers = await serviceWorkerSessions(browser, new URL(BASE).origin);
  await workers.send('Network.enable');
  await workers.send('Network.emulateNetworkConditions', conditions(true));
  await page.send('Network.emulateNetworkConditions', conditions(true));
  await sleep(400);
  report.offline = {
    workersEmulated: workers.count,
    navigatorOnLine: await page.evaluate('navigator.onLine'),
    indicatorBeforeReload: await indicator(page),
  };

  // The shell must come from the precache; the API must not come from any cache.
  await page.send('Page.reload', { ignoreCache: false });
  // Page reload creates a new document whose navigator.onLine signal can reset even though the
  // service worker remained network-disabled for the actual navigation. Reassert both targets
  // before reading the user-visible state and attempting the uncached API request.
  await workers.send('Network.emulateNetworkConditions', conditions(true));
  await page.send('Network.emulateNetworkConditions', conditions(true));
  await sleep(1000);
  await waitFor(page, "!!document.querySelector('main h1')");
  report.offline.heading = await page.evaluate("document.querySelector('h1')?.textContent ?? null");
  report.offline.navigatorOnLineAfterReload = await page.evaluate('navigator.onLine');
  report.offline.indicatorAfterReload = await indicator(page);
  report.offline.apiFetch = await page.evaluate(
    `fetch('/api/health').then((r) => 'served ' + r.status + ' ' + (r.headers.get('content-type') || '')).catch((e) => 'failed: ' + e.message)`,
  );
  await screenshot(page, `${OUT}/offline-home.png`, { x: 0, y: 0, width: 1024, height: 700 });

  // ---------- offline write: rename the device, reload offline, still there ----------
  await waitFor(
    page,
    "[...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Rename')",
  );
  await clickButton(page, 'Rename');
  await sleep(200);
  await page.evaluate(
    `(() => { const i = document.querySelector('[aria-labelledby=device-title] input'); i.focus(); i.select(); })()`,
  );
  await page.send('Input.insertText', { text: LABEL });
  await sleep(100);
  await clickButton(page, 'Save');
  await sleep(500);
  report.offline.labelAfterSave = await mainIncludes(page, LABEL);
  await page.send('Page.reload', { ignoreCache: false });
  await workers.send('Network.emulateNetworkConditions', conditions(true));
  await page.send('Network.emulateNetworkConditions', conditions(true));
  await sleep(1000);
  await waitFor(
    page,
    `document.querySelector('main')?.textContent.includes(${JSON.stringify(LABEL)})`,
  );
  report.offline.labelAfterOfflineReload = await mainIncludes(page, LABEL);
  report.offline.stored = await page.evaluate(`(() => new Promise((resolve) => {
    const req = indexedDB.open('bloomlab');
    req.onsuccess = () => { const db = req.result; const tx = db.transaction('device'); const get = tx.objectStore('device').getAll(); get.onsuccess = () => { resolve(get.result.map((d) => ({ label: d.label, learner: d.learner_id.slice(0, 6), persisted: d.storage_persisted }))); db.close(); }; };
    req.onerror = () => resolve('error');
  }))()`);
  report.offline.localStorageKeys = await page.evaluate('Object.keys(localStorage)');

  // ---------- back online ----------
  await workers.send('Network.emulateNetworkConditions', conditions(false));
  await page.send('Network.emulateNetworkConditions', conditions(false));
  await sleep(400);
  report.online = {
    indicator: await indicator(page),
    apiFetch: await page.evaluate(
      `fetch('/api/health').then((r) => r.json()).then((j) => j.environment).catch((e) => 'failed: ' + e.message)`,
    ),
    build: await page.evaluate(
      "fetch('/api/health',{cache:'no-store'}).then(r=>r.json()).then(j=>j.build_id)",
    ),
  };
  assert(report.serviceWorker.controlled && report.offline.workersEmulated > 0);
  assert(report.manifest.parsed && report.manifest.errors.length === 0);
  assert.equal(report.installability.length, 0);
  assert(!report.offline.navigatorOnLine && !report.offline.navigatorOnLineAfterReload);
  assert(report.offline.heading && report.offline.apiFetch.startsWith('failed:'));
  assert(report.offline.labelAfterSave && report.offline.labelAfterOfflineReload);
  assert.equal(report.online.build, report.loadedBuild);
  report.status = 'passed';
} finally {
  writeFileSync(`${OUT}/offline-probe.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await close();
}
