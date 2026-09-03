// Academy review (CUR-036, DES-020, A11Y-001 Phase 8 share, DATA-001..003): drives the built app
// in Chrome through a unit — keyboard on the interactive, the disclosure and Finish; the evidence
// row it writes; reload; the unit offline; a second unit finished offline; touch at 390 px;
// reduced motion. Writes academy-probe.json to .review/.
//   BASE=http://localhost:4173 node scripts/review/academy-probe.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

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
const UNIT = '/academy/LU-funnel-math-basics?skill=SK-STRATEGIZE-funnel-math';
const SECOND_UNIT = '/academy/LU-tags-vs-custom-fields';

const conditions = (offline) => ({
  offline,
  latency: 0,
  downloadThroughput: -1,
  uploadThroughput: -1,
});

const key = (page, type, text) =>
  page.send('Input.dispatchKeyEvent', {
    type,
    key: text,
    code: text,
    windowsVirtualKeyCode:
      text === 'Tab'
        ? 9
        : text === 'Enter'
          ? 13
          : text === 'ArrowRight'
            ? 39
            : text === 'Escape'
              ? 27
              : 0,
  });
const press = async (page, text) => {
  // Enter activates buttons and summaries only through a char event, as a real keypress does.
  if (text === 'Enter') {
    await page.send('Input.dispatchKeyEvent', {
      type: 'keyDown',
      key: 'Enter',
      code: 'Enter',
      text: '\r',
      windowsVirtualKeyCode: 13,
    });
  } else {
    await key(page, 'rawKeyDown', text);
  }
  await key(page, 'keyUp', text);
  await sleep(60);
};

const tap = async (page, x, y) => {
  await page.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
};

const rect = (page, selector) =>
  page.evaluate(
    `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, cx: r.x + r.width / 2, cy: r.y + r.height / 2 }; })()`,
  );

const waitFor = async (page, expression, tries = 80) => {
  for (let i = 0; i < tries; i += 1) {
    if (await page.evaluate(`Boolean(${expression})`)) return true;
    await sleep(150);
  }
  return false;
};

const focusEl = (page, selector) =>
  page.evaluate(
    `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; el.scrollIntoView({ block: 'center' }); el.focus(); return document.activeElement === el; })()`,
  );

const results = (page) =>
  page.evaluate("document.querySelector('[data-testid=funnel-results]')?.textContent ?? ''");
const finishState = (page) =>
  page.evaluate(
    "(() => { const s = document.querySelector('#finish'); return s ? s.textContent.replace(/\\s+/g, ' ').slice(0, 120) : null; })()",
  );
const evidenceRows = (page) =>
  page.evaluate(`(() => new Promise((resolve) => {
    const req = indexedDB.open('bloomlab');
    req.onsuccess = () => { const db = req.result; const tx = db.transaction('skill_evidence'); const get = tx.objectStore('skill_evidence').getAll(); get.onsuccess = () => { resolve(get.result.map((r) => ({ skill: r.skill_id, kind: r.kind, result: r.result, source: r.source, content: r.versions && r.versions.content }))); db.close(); }; };
    req.onerror = () => resolve('error');
  }))()`);

mkdirSync(OUT, { recursive: true });
const { page, browser, close } = await session();
await page.send('Network.enable');
const report = { base: BASE };
try {
  // ---------- desktop keyboard flow ----------
  await setViewport(page, 1280, 900, { mobile: false });
  await page.send('Emulation.setFocusEmulationEnabled', { enabled: true });
  await openPage(page, `${BASE}${UNIT}`);
  await waitFor(page, "document.querySelector('[data-testid=funnel-results]')");
  await waitFor(
    page,
    "[...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Finish this unit')",
  );
  report.render = {
    h1: await page.evaluate("document.querySelector('h1')?.textContent"),
    h2: await page.evaluate("[...document.querySelectorAll('main h2')].map((h) => h.textContent)"),
    embeds: await page.evaluate(
      "[...document.querySelectorAll('[data-embed]')].map((e) => e.dataset.embed)",
    ),
    figureLabelled: await page.evaluate(
      "(() => { const f = document.querySelector('[data-embed=diagram-funnel]'); const c = f && document.getElementById(f.getAttribute('aria-labelledby')); return c ? c.textContent.slice(0, 80) : null; })()",
    ),
    evidenceBefore: await evidenceRows(page),
  };

  const slider = "input[type=range][id$='-show']";
  report.keyboard = { sliderFocused: await focusEl(page, slider) };
  const before = await results(page);
  await press(page, 'ArrowRight');
  await press(page, 'ArrowRight');
  report.keyboard.sliderValue = await page.evaluate(
    `document.querySelector(${JSON.stringify(slider)}).value`,
  );
  const after = await results(page);
  report.keyboard.resultsChanged = before !== after;
  report.keyboard.salesAfterArrows = after.match(/\d+ sales/)?.[0] ?? null;

  report.keyboard.summaryFocused = await focusEl(page, '[data-embed=depth] summary');
  await press(page, 'Enter');
  report.keyboard.depthOpen = await page.evaluate(
    "document.querySelector('[data-embed=depth]').open",
  );

  report.keyboard.finishFocused = await page.evaluate(
    "(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Finish this unit'); b.scrollIntoView({ block: 'center' }); b.focus(); return document.activeElement === b && getComputedStyle(b).outlineStyle !== 'none'; })()",
  );
  await press(page, 'Enter');
  await waitFor(
    page,
    "document.querySelector('#finish')?.textContent.includes('You finished this unit')",
  );
  report.keyboard.finishText = await finishState(page);
  report.keyboard.evidenceAfter = await evidenceRows(page);
  report.keyboard.nextStep = await page.evaluate(
    "document.querySelector('[data-testid=next-step]')?.textContent.replace(/\\s+/g, ' ').slice(0, 140) ?? null",
  );
  await screenshot(page, `${OUT}/academy-finished-1280.png`, {
    x: 0,
    y: 0,
    width: 1280,
    height: 900,
  });

  // ---------- reload: completion persists, nothing duplicated ----------
  await page.send('Page.reload', { ignoreCache: false });
  await sleep(800);
  await waitFor(
    page,
    "document.querySelector('#finish')?.textContent.includes('You finished this unit')",
  );
  report.reload = {
    finishText: await finishState(page),
    finishButtonPresent: await page.evaluate(
      "[...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Finish this unit')",
    ),
    evidenceCount: (await evidenceRows(page)).length,
  };

  // ---------- offline: the unit still opens, a second unit can be finished, reload keeps it ----------
  await page.evaluate('navigator.serviceWorker.ready.then(() => true)');
  for (
    let i = 0;
    i < 50 && !(await page.evaluate('Boolean(navigator.serviceWorker.controller)'));
    i++
  )
    await sleep(100);
  // Visit the second unit once online so its chunk is cached, then leave it for the offline pass.
  await openPage(page, `${BASE}${SECOND_UNIT}`);
  await waitFor(
    page,
    "[...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Finish this unit')",
  );
  const workers = await serviceWorkerSessions(browser, new URL(BASE).origin);
  await workers.send('Network.enable');
  await workers.send('Network.emulateNetworkConditions', conditions(true));
  await page.send('Network.emulateNetworkConditions', conditions(true));
  await sleep(400);
  await page.send('Page.reload', { ignoreCache: false });
  await sleep(1000);
  const offlineOpened = await waitFor(
    page,
    "document.querySelector('main h1')?.textContent.includes('Tag, custom field, or custom value?')",
  );
  await waitFor(
    page,
    "[...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Finish this unit')",
  );
  report.offline = {
    navigatorOnLine: await page.evaluate('navigator.onLine'),
    secondUnitOpened: offlineOpened,
    workflowDiagramPresent: await page.evaluate(
      "Boolean(document.querySelector('[data-embed=feature]'))",
    ),
    apiFetch: await page.evaluate(
      `fetch('/api/health').then((r) => 'served ' + r.status).catch((e) => 'failed: ' + e.message)`,
    ),
  };
  await page.evaluate(
    "(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Finish this unit'); b.scrollIntoView({ block: 'center' }); b.click(); })()",
  );
  await waitFor(
    page,
    "document.querySelector('#finish')?.textContent.includes('You finished this unit')",
  );
  report.offline.finishedOffline = await finishState(page);
  await page.send('Page.reload', { ignoreCache: false });
  await sleep(1000);
  await waitFor(
    page,
    "document.querySelector('#finish')?.textContent.includes('You finished this unit')",
  );
  report.offline.afterOfflineReload = await finishState(page);
  report.offline.evidence = await evidenceRows(page);
  report.offline.queued = await page.evaluate(`(() => new Promise((resolve) => {
    const req = indexedDB.open('bloomlab');
    req.onsuccess = () => { const db = req.result; const tx = db.transaction('sync_queue'); const c = tx.objectStore('sync_queue').count(); c.onsuccess = () => { resolve(c.result); db.close(); }; };
    req.onerror = () => resolve('error');
  }))()`);
  await workers.send('Network.emulateNetworkConditions', conditions(false));
  await page.send('Network.emulateNetworkConditions', conditions(false));
  await sleep(400);
  report.online = {
    apiFetch: await page.evaluate(
      `fetch('/api/health').then((r) => r.json()).then((j) => j.environment).catch((e) => 'failed: ' + e.message)`,
    ),
  };

  // ---------- reduced motion ----------
  await page.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  });
  await openPage(page, `${BASE}${UNIT}`);
  await waitFor(page, "document.querySelector('[data-embed=diagram-funnel]')");
  report.reducedMotion = {
    barTransition: await page.evaluate(
      "getComputedStyle(document.querySelector('[data-embed=diagram-funnel] li span span')).transitionDuration",
    ),
    motionToken: await page.evaluate(
      "getComputedStyle(document.documentElement).getPropertyValue('--bl-motion-base').trim()",
    ),
  };
  await page.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }],
  });

  // ---------- touch at 390 ----------
  await setViewport(page, 390, 844, { mobile: true });
  await page.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
  await openPage(
    page,
    `${BASE}${SECOND_UNIT.replace('tags-vs-custom-fields', 'workflow-foundations')}`,
  );
  await waitFor(
    page,
    "[...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Finish this unit')",
  );
  report.touch = {
    coarse: await page.evaluate("matchMedia('(pointer: coarse)').matches"),
    hOverflow: await page.evaluate('document.documentElement.scrollWidth > innerWidth'),
    pathSteps: await page.evaluate(
      "[...document.querySelectorAll('[data-embed=diagram-workflow] li')].map((li) => li.dataset.kind + ':' + Math.round(li.getBoundingClientRect().top))",
    ),
    inputFontSizes: await page.evaluate(
      "[...document.querySelectorAll('main input')].map((i) => parseFloat(getComputedStyle(i).fontSize))",
    ),
  };
  const summary = await rect(page, '[data-embed=depth] summary');
  if (summary) {
    await page.evaluate(
      "document.querySelector('[data-embed=depth] summary').scrollIntoView({ block: 'center' })",
    );
    const s2 = await rect(page, '[data-embed=depth] summary');
    await tap(page, s2.cx, s2.cy);
    await sleep(200);
    report.touch.depthOpenedByTap = await page.evaluate(
      "document.querySelector('[data-embed=depth]').open",
    );
    report.touch.summaryHeight = Math.round(s2.h);
  }
  await page.evaluate(
    "[...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Finish this unit').scrollIntoView({ block: 'center' })",
  );
  const finish = await page.evaluate(
    "(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Finish this unit'); const r = b.getBoundingClientRect(); return { cx: r.x + r.width / 2, cy: r.y + r.height / 2, h: r.height }; })()",
  );
  report.touch.finishHeight = Math.round(finish.h);
  await tap(page, finish.cx, finish.cy);
  await waitFor(
    page,
    "document.querySelector('#finish')?.textContent.includes('You finished this unit')",
  );
  report.touch.finished = await finishState(page);
  await screenshot(page, `${OUT}/academy-touch-390.png`, { x: 0, y: 0, width: 390, height: 844 });

  // The funnel-math slider by touch, on the first unit at 390.
  await openPage(page, `${BASE}${UNIT}`);
  await waitFor(page, "document.querySelector('[data-testid=funnel-results]')");
  await page.evaluate(
    `document.querySelector(${JSON.stringify(slider)}).scrollIntoView({ block: 'center' })`,
  );
  const track = await rect(page, slider);
  const beforeTap = await results(page);
  await tap(page, track.x + track.w * 0.9, track.cy);
  await sleep(200);
  report.touch.sliderAfterTap = await page.evaluate(
    `document.querySelector(${JSON.stringify(slider)}).value`,
  );
  report.touch.sliderResultsChanged = (await results(page)) !== beforeTap;
  report.touch.sliderHeight = Math.round(track.h);
} finally {
  writeFileSync(`${OUT}/academy-probe.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await close();
}
