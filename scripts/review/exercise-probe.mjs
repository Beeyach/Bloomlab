// Exercise runner review (EXR-001 … EXR-003, EXR-022, A11Y-001 Phase 9 share, DATA-001..003):
// drives the built app in Chrome through a full attempt — touch at 390 px, the hint ladder,
// submit, the result, retry — plus reduced motion and an offline submission that survives a
// reload and queues for sync. Writes exercise-probe.json to .review/.
//   BASE=http://localhost:4173 node scripts/review/exercise-probe.mjs
import assert from 'node:assert/strict';
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
const DECISION =
  '/exercise/EX-ARCHITECTURE_DECISION-treatment-interest?skill=SK-ARCHITECT-tags-vs-custom-fields';
const PRESSURE = '/exercise/EX-REBUILD_BLIND-appointment-reminders';
const BUILD = '/exercise/EX-BUILD_IT-no-show-recovery';

const conditions = (offline) => ({
  offline,
  latency: 0,
  downloadThroughput: -1,
  uploadThroughput: -1,
});

const tap = async (page, x, y) => {
  await page.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
};

const rectOf = (page, selector) =>
  page.evaluate(
    `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return null; el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return { cx: r.x + r.width / 2, cy: r.y + r.height / 2, w: Math.round(r.width), h: Math.round(r.height) }; })()`,
  );

const buttonRect = (page, label) =>
  page.evaluate(
    `(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === ${JSON.stringify(label)}); if (!b) return null; b.scrollIntoView({ block: 'center' }); const r = b.getBoundingClientRect(); return { cx: r.x + r.width / 2, cy: r.y + r.height / 2, w: Math.round(r.width), h: Math.round(r.height) }; })()`,
  );

const waitFor = async (page, expression, tries = 80) => {
  for (let i = 0; i < tries; i += 1) {
    if (await page.evaluate(`Boolean(${expression})`)) return true;
    await sleep(150);
  }
  return false;
};

const text = (page, selector) =>
  page.evaluate(
    `document.querySelector(${JSON.stringify(selector)})?.textContent.replace(/\\s+/g, ' ').trim().slice(0, 180) ?? null`,
  );

const rows = (page, store) =>
  page.evaluate(`(() => new Promise((resolve) => {
    const req = indexedDB.open('bloomlab');
    req.onsuccess = () => { const db = req.result; const tx = db.transaction(${JSON.stringify(store)}); const get = tx.objectStore(${JSON.stringify(store)}).getAll(); get.onsuccess = () => { resolve(get.result.length); db.close(); }; };
    req.onerror = () => resolve('error');
  }))()`);

const attemptDraft = (page) =>
  page.evaluate(`(() => new Promise((resolve) => {
    const req = indexedDB.open('bloomlab');
    req.onsuccess = () => { const db = req.result; const tx = db.transaction('workspace'); const get = tx.objectStore('workspace').getAll(); get.onsuccess = () => { const row = get.result.find((r) => String(r.key).startsWith('exercise.attempt.')); resolve(row ? { key: row.key, attempt_id: row.value.attempt_id, hints: row.value.hints_revealed, choice: row.value.response.choice, text: String(row.value.response.text || '').slice(0, 40) } : null); db.close(); }; };
    req.onerror = () => resolve('error');
  }))()`);

mkdirSync(OUT, { recursive: true });
const { page, browser, close } = await session();
await page.send('Network.enable');
const report = { base: BASE };
try {
  // ---------- touch, at a phone width, through a whole attempt ----------
  await setViewport(page, 390, 844, { mobile: true });
  await page.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
  await openPage(page, `${BASE}${DECISION}`);
  await waitFor(page, "document.querySelector('input[type=radio]')");
  report.touch = {
    coarse: await page.evaluate("matchMedia('(pointer: coarse)').matches"),
    hOverflow: await page.evaluate('document.documentElement.scrollWidth > innerWidth'),
    option: await rectOf(page, 'label:has(input[type=radio])'),
    textareaFontSize: await page.evaluate(
      "parseFloat(getComputedStyle(document.querySelector('textarea')).fontSize)",
    ),
    draftBeforeAnyInput: await attemptDraft(page),
    evidenceOnOpen: await rows(page, 'skill_evidence'),
  };

  // Choose an architecture by tapping the row, not a 13 px dot.
  const option = await page.evaluate(
    "(() => { const l = [...document.querySelectorAll('label')].find((x) => x.textContent.trim() === 'Tag'); l.scrollIntoView({ block: 'center' }); const r = l.getBoundingClientRect(); return { cx: r.x + r.width / 2, cy: r.y + r.height / 2, h: Math.round(r.height) }; })()",
  );
  await tap(page, option.cx, option.cy);
  await sleep(250);
  report.touch.optionHeight = option.h;
  report.touch.chosen = await page.evaluate(
    "document.querySelector('input[type=radio]:checked')?.value ?? null",
  );

  // Phase 19: deliberately fail the objective choice so this offline/append-only probe
  // needs no AI. ai-probe covers correct rubric work, failure recovery and a fixture result.
  // Write the reasoning.
  const area = await rectOf(page, 'textarea');
  await tap(page, area.cx, area.cy);
  await page.evaluate("document.querySelector('textarea').focus()");
  await page.send('Input.insertText', {
    text: 'A contact custom field: the reminder template prints it as a merge field.',
  });
  await page.evaluate(
    "document.querySelector('textarea').dispatchEvent(new Event('input', { bubbles: true }))",
  );
  await sleep(400);
  report.touch.draftAfterTyping = await attemptDraft(page);

  // Take one hint and watch the assistance line move.
  const hintButton = await buttonRect(page, 'Show the nudge');
  report.touch.hintButton = hintButton;
  await tap(page, hintButton.cx, hintButton.cy);
  await sleep(400);
  report.touch.assistanceAfterHint = await text(page, '[class*=assistanceValue]');
  report.touch.draftAfterHint = await attemptDraft(page);

  await screenshot(page, `${OUT}/exercise-work-390.png`, { x: 0, y: 0, width: 390, height: 844 });

  // Submit by tap.
  const run = await buttonRect(page, 'Run it');
  report.touch.submitButton = run;
  await tap(page, run.cx, run.cy);
  await waitFor(page, "document.querySelector('[class*=resultTitle]')");
  report.touch.result = await text(page, '[class*=resultTitle]');
  report.touch.resultMeta = await text(page, '[class*=resultMeta]');
  report.touch.checks = await page.evaluate(
    "[...document.querySelectorAll('[class*=check_]')].map((li) => li.textContent.replace(/\\s+/g, ' ').trim().slice(0, 90))",
  );
  report.touch.attempts = await rows(page, 'exercise_attempts');
  report.touch.evidence = await rows(page, 'skill_evidence');
  report.touch.draftAfterSubmit = await attemptDraft(page);
  await screenshot(page, `${OUT}/exercise-result-390.png`, { x: 0, y: 0, width: 390, height: 844 });

  // The result survives a reload, and does not become a second attempt.
  await page.send('Page.reload', { ignoreCache: false });
  await sleep(900);
  await waitFor(page, "document.querySelector('[class*=resultTitle]')");
  report.reload = {
    result: await text(page, '[class*=resultTitle]'),
    attempts: await rows(page, 'exercise_attempts'),
    evidence: await rows(page, 'skill_evidence'),
  };

  // Try again is a new attempt; the old one stays.
  const again = await buttonRect(page, 'Try again');
  await tap(page, again.cx, again.cy);
  await waitFor(page, "document.querySelector('textarea')");
  report.retry = {
    workAreaBack: await page.evaluate("Boolean(document.querySelector('textarea'))"),
    emptyDraft: await page.evaluate("document.querySelector('textarea').value === ''"),
    newAttemptId: (await attemptDraft(page))?.attempt_id ?? null,
    attemptsKept: await rows(page, 'exercise_attempts'),
  };
  report.retry.differentAttempt =
    report.retry.newAttemptId !== report.touch.draftAfterHint?.attempt_id;

  // ---------- a pressure exercise offers nothing to lean on ----------
  await openPage(page, `${BASE}${PRESSURE}`);
  await waitFor(page, "document.querySelector('textarea')");
  report.pressure = {
    hintButtons: await page.evaluate(
      "[...document.querySelectorAll('button')].filter((b) => /Show the/.test(b.textContent)).length",
    ),
    lessonLinks: await page.evaluate(
      "[...document.querySelectorAll('a')].filter((a) => /^Read /.test(a.textContent.trim())).length",
    ),
    assistanceCopy: await page.evaluate(
      "[...document.querySelectorAll('p')].map((p) => p.textContent.trim()).find((t) => /No hints/.test(t)) ?? null",
    ),
  };

  // ---------- the implemented Workflow build exposes its real runtime ----------
  await openPage(page, `${BASE}${BUILD}`);
  assert(
    await waitFor(
      page,
      "[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Run it')",
    ),
  );
  report.runtimeDependency = {
    title: await text(page, '[class*=runtimeTitle]'),
    text: await text(page, '[class*=runtimeText]'),
    submitButtons: await page.evaluate(
      "[...document.querySelectorAll('button')].filter((b) => b.textContent.trim() === 'Run it').length",
    ),
  };
  await screenshot(page, `${OUT}/exercise-runtime-390.png`, {
    x: 0,
    y: 0,
    width: 390,
    height: 844,
  });

  // ---------- reduced motion ----------
  await page.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  });
  await openPage(page, `${BASE}${DECISION}`);
  await waitFor(page, "document.querySelector('input[type=radio]')");
  report.reducedMotion = {
    motionToken: await page.evaluate(
      "getComputedStyle(document.documentElement).getPropertyValue('--bl-motion-base').trim()",
    ),
    optionTransition: await page.evaluate(
      "getComputedStyle(document.querySelector('label:has(input[type=radio])')).transitionDuration",
    ),
  };
  await page.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }],
  });

  // ---------- offline: a deterministic submission finalizes without the network ----------
  await setViewport(page, 1280, 900, { mobile: false });
  await openPage(page, `${BASE}${DECISION}`);
  for (
    let i = 0;
    i < 150 && !(await page.evaluate('Boolean(navigator.serviceWorker.controller)'));
    i++
  ) {
    await sleep(100);
  }
  const workers = await serviceWorkerSessions(browser, new URL(BASE).origin);
  await workers.send('Network.enable');
  await workers.send('Network.emulateNetworkConditions', conditions(true));
  await page.send('Network.emulateNetworkConditions', conditions(true));
  await sleep(400);
  await page.send('Page.reload', { ignoreCache: false });
  await sleep(1200);
  const openedOffline = await waitFor(page, "document.querySelector('input[type=radio]')");
  // Recorded before any interaction, so a failure here still says what the page looked like.
  report.offline = {
    navigatorOnLine: await page.evaluate('navigator.onLine'),
    openedOffline,
    heading: await text(page, 'h1'),
    serviceWorkerControlled: await page.evaluate('Boolean(navigator.serviceWorker.controller)'),
  };
  if (!openedOffline) throw new Error('the runner did not render offline');

  await page.evaluate(
    "[...document.querySelectorAll('label')].find((x) => x.textContent.trim() === 'Tag').click()",
  );
  await page.evaluate("document.querySelector('textarea').focus()");
  await page.send('Input.insertText', { text: 'Contact custom field, printed as a merge field.' });
  await page.evaluate(
    "document.querySelector('textarea').dispatchEvent(new Event('input', { bubbles: true }))",
  );
  await sleep(400);
  await page.evaluate(
    "[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Run it').click()",
  );
  await waitFor(page, "document.querySelector('[class*=resultTitle]')");
  Object.assign(report.offline, {
    result: await text(page, '[class*=resultTitle]'),
    apiFetch: await page.evaluate(
      `fetch('/api/health').then((r) => 'served ' + r.status).catch((e) => 'failed: ' + e.message)`,
    ),
    attempts: await rows(page, 'exercise_attempts'),
    evidence: await rows(page, 'skill_evidence'),
    queued: await rows(page, 'sync_queue'),
  });
  await page.send('Page.reload', { ignoreCache: false });
  await sleep(1000);
  await waitFor(page, "document.querySelector('[class*=resultTitle]')");
  report.offline.afterOfflineReload = await text(page, '[class*=resultTitle]');
  report.offline.attemptsAfterReload = await rows(page, 'exercise_attempts');

  await workers.send('Network.emulateNetworkConditions', conditions(false));
  await page.send('Network.emulateNetworkConditions', conditions(false));
  await sleep(400);
  report.online = {
    apiFetch: await page.evaluate(
      `fetch('/api/health').then((r) => r.json()).then((j) => j.environment).catch((e) => 'failed: ' + e.message)`,
    ),
  };
  await screenshot(page, `${OUT}/exercise-result-1280.png`, {
    x: 0,
    y: 0,
    width: 1280,
    height: 900,
  });
  assert.equal(report.touch.hOverflow, false);
  assert(report.touch.optionHeight >= 44 && report.touch.submitButton.h >= 44);
  assert(report.touch.textareaFontSize >= 16);
  assert.equal(report.touch.evidenceOnOpen, 0);
  assert.equal(report.touch.chosen, 'tag');
  assert.deepEqual(report.touch.draftAfterHint.hints, ['nudge']);
  assert.equal(report.touch.result, 'Needs another run');
  assert.equal(report.touch.attempts, 1);
  assert.equal(report.reload.attempts, 1);
  assert.equal(report.reload.evidence, report.touch.evidence);
  assert.equal(report.retry.differentAttempt, true);
  assert.equal(report.retry.emptyDraft, true);
  assert.equal(report.pressure.hintButtons, 0);
  assert.equal(report.pressure.lessonLinks, 0);
  assert.equal(report.runtimeDependency.title, null);
  assert.equal(report.runtimeDependency.submitButtons, 1);
  assert.equal(report.reducedMotion.motionToken, '0s');
  assert.equal(report.offline.navigatorOnLine, false);
  assert.equal(report.offline.serviceWorkerControlled, true);
  assert.equal(report.offline.result, 'Needs another run');
  assert.equal(report.offline.attempts, 2);
  assert.equal(report.offline.attemptsAfterReload, 2);
  assert.equal(report.offline.afterOfflineReload, report.offline.result);
  assert(report.offline.queued > 0);
  assert.match(report.offline.apiFetch, /^failed:/);
  report.status = 'PASSED';
} catch (error) {
  report.status = 'FAILED';
  report.error = String(error);
  throw error;
} finally {
  writeFileSync(`${OUT}/exercise-probe.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await close();
}
