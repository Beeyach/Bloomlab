// Drives the Workflow Lab, Conversations and the Playground in a real Chromium with DevTools input
// (WFL-001…WFL-012, SIM-014, SIM-015, CONV-001, PERF-002, A11Y-006, RSP-004): edit / undo / redo /
// save, run a test contact, a wait released by the Time Machine, drag and keyboard moves, playback,
// reduced motion, the five review widths, touch on a phone, and a 500-event responsiveness run
// with frame timing while the engine works in the worker. Writes workflow-probe.json and
// workflow-*.png to .review/ (override with REVIEW_OUT).
//   BASE=http://localhost:4173 node scripts/review/workflow-probe.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { openPage, screenshot, session, setViewport, sleep } from './cdp.mjs';

const OUT = resolve(process.env.REVIEW_OUT ?? '.review');
const BASE = process.env.BASE ?? 'http://localhost:4173';
mkdirSync(OUT, { recursive: true });

const report = { base: BASE, sections: {} };
let failures = 0;
const section = (name, checks, extra = {}) => {
  const passed = Object.values(checks).every((value) => value !== false);
  if (!passed) failures += 1;
  report.sections[name] = { passed, checks, ...extra };
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name} ${JSON.stringify(checks)}`);
};

/* ---- page helpers ------------------------------------------------------------------------ */

const q = (selector) => `document.querySelector(${JSON.stringify(selector)})`;
const exists = (page, selector) => page.evaluate(`Boolean(${q(selector)})`);
const count = (page, selector) =>
  page.evaluate(`document.querySelectorAll(${JSON.stringify(selector)}).length`);
const text = (page, selector) => page.evaluate(`(${q(selector)}?.textContent ?? '')`);
const click = (page, selector) =>
  page.evaluate(
    `(() => { const el = ${q(selector)}; if (!el) return false; el.click(); return true; })()`,
  );
const clickText = (page, selector, needle) =>
  page.evaluate(
    `(() => { const el = [...document.querySelectorAll(${JSON.stringify(selector)})].find((e) => e.textContent.trim().includes(${JSON.stringify(needle)})); if (!el) return false; el.click(); return true; })()`,
  );
const setSelect = (page, selector, value) =>
  page.evaluate(
    `(() => { const el = ${q(selector)}; if (!el) return false; el.value = ${JSON.stringify(value)}; el.dispatchEvent(new Event('change', { bubbles: true })); return el.value === ${JSON.stringify(value)}; })()`,
  );
const setText = (page, selector, value) =>
  page.evaluate(
    `(() => { const el = ${q(selector)}; if (!el) return false; const setter = Object.getOwnPropertyDescriptor(el.__proto__, 'value').set; setter.call(el, ${JSON.stringify(value)}); el.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`,
  );
async function waitFor(page, expression, { timeout = 10000, every = 100 } = {}) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await page.evaluate(expression)) return true;
    await sleep(every);
  }
  return false;
}
const rectOf = (page, selector) =>
  page.evaluate(
    `(() => { const el = ${q(selector)}; if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; })()`,
  );
// The node card sits in a positioned wrapper; the wrapper carries the transform.
const transformOf = (page, selector) =>
  page.evaluate(
    `(() => { const el = ${q(selector)}?.parentElement; return el ? el.style.transform : null; })()`,
  );

const startFrames = (page) =>
  page.evaluate(`(() => {
    window.__frames = []; window.__long = []; window.__sampling = true;
    let last = performance.now();
    const loop = () => { const now = performance.now(); window.__frames.push(now - last); last = now; if (window.__sampling) requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
    try { window.__po = new PerformanceObserver((list) => { for (const e of list.getEntries()) window.__long.push(Math.round(e.duration)); }); window.__po.observe({ type: 'longtask', buffered: false }); } catch {}
    return true;
  })()`);
const stopFrames = (page) =>
  page.evaluate(`(() => {
    window.__sampling = false; try { window.__po?.disconnect(); } catch {}
    const f = window.__frames.slice(1); const sorted = [...f].sort((a, b) => a - b);
    const p = (k) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * k))] : null;
    return { frames: f.length, mean: f.length ? +(f.reduce((a, b) => a + b, 0) / f.length).toFixed(1) : null, p95: p(0.95), max: f.length ? Math.round(Math.max(...f)) : null, over50ms: f.filter((x) => x > 50).length, longTasks: window.__long };
  })()`);

const mouse = (page, type, x, y, extra = {}) =>
  page.send('Input.dispatchMouseEvent', {
    type,
    x,
    y,
    button: 'left',
    pointerType: 'mouse',
    ...extra,
  });
const key = async (page, keyName, code, keyCode, modifiers = 0) => {
  await page.send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: keyName,
    code,
    windowsVirtualKeyCode: keyCode,
    modifiers,
  });
  await page.send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: keyName,
    code,
    windowsVirtualKeyCode: keyCode,
    modifiers,
  });
};
const tap = async (page, x, y) => {
  await page.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
};

const LAB = `${BASE}/workflow?scenario=SC-glowhaus-no-show`;
const READY = `Boolean(${q('[data-node="trigger"]')}) && Boolean(${q('[data-testid="test-panel"]')})`;

const { page, close } = await session();
try {
  /* ---- 1. desktop: the Lab is present and edits are drafts (WFL-001, WFL-002) ------------- */
  await setViewport(page, 1440, 950, { mobile: false });
  await openPage(page, LAB);
  const ready = await waitFor(page, READY);
  await sleep(300);
  const colours = await page.evaluate(`(() => {
    const canvas = ${q('[data-testid="workflow-canvas"]')}; const node = ${q('[data-node="n1"]')};
    const lum = (c) => { const m = c.match(/\\d+/g); if (!m) return null; const [r, g, b] = m.map(Number); return +((0.2126 * r + 0.7152 * g + 0.0722 * b) / 255).toFixed(2); };
    return { canvasBg: getComputedStyle(canvas.parentElement).backgroundColor, canvasLum: lum(getComputedStyle(canvas.parentElement).backgroundColor), nodeBg: getComputedStyle(node).backgroundColor, nodeLum: lum(getComputedStyle(node).backgroundColor) };
  })()`);
  section(
    'desktop-present',
    {
      ready,
      canvas: await exists(page, '[data-testid="workflow-canvas"]'),
      palette: await exists(page, '[data-testid="palette"]'),
      timeline: await exists(page, '[data-testid="timeline"]'),
      testPanel: await exists(page, '[data-testid="test-panel"]'),
      history: await exists(page, '[data-testid="history"]'),
      threeNodes: (await count(page, '[data-node]:not([data-node="trigger"])')) === 3,
      realFeatureNames: (await text(page, '[data-node="n1"]')).includes('Send SMS'),
      inkWorkspaceDark: colours.canvasLum !== null && colours.canvasLum < 0.25,
      lightNodes: colours.nodeLum !== null && colours.nodeLum > 0.85,
      paletteFromRegistry: (await count(page, '[data-testid="palette"] [data-palette]')) >= 12,
      nonRunnableMarked: (await text(page, '[data-palette="GHL-WF-GOAL-EVENT"]')).includes(
        'Practised in GHL',
      ),
    },
    { colours },
  );
  await screenshot(page, resolve(OUT, 'workflow-1440.png'), null, false);

  // Add a Wait after n2, undo, redo, save.
  await click(page, '[data-node="n2"]');
  await sleep(150);
  await click(page, '[data-palette="GHL-WF-WAIT"] button');
  const added = await waitFor(page, `Boolean(${q('[data-node="n4"]')})`, { timeout: 3000 });
  const dirty = (await text(page, 'body')).includes('Unsaved draft');
  await click(page, '[data-testid="undo"]');
  const undone = await waitFor(page, `!${q('[data-node="n4"]')}`, { timeout: 3000 });
  await click(page, '[data-testid="redo"]');
  const redone = await waitFor(page, `Boolean(${q('[data-node="n4"]')})`, { timeout: 3000 });
  await click(page, '[data-testid="save"]');
  const savedClean = await waitFor(page, `!document.body.textContent.includes('Unsaved draft')`, {
    timeout: 8000,
  });
  const version2 = (await text(page, '[data-testid="history"]')).includes('Version 2');
  section('desktop-edit-undo-redo-save', { added, dirty, undone, redone, savedClean, version2 });
  await screenshot(page, resolve(OUT, 'workflow-inspector-1440.png'), null, false);

  /* ---- 2. keyboard move and drag (A11Y-006, PERF-002) ------------------------------------ */
  await click(page, '[data-node="n1"]');
  await page.evaluate(`${q('[data-testid="workflow-canvas"]')}.focus()`);
  const before = await transformOf(page, '[data-node="n1"]');
  await key(page, 'ArrowDown', 'ArrowDown', 40);
  await sleep(100);
  const afterKey = await transformOf(page, '[data-node="n1"]');
  await key(page, 'z', 'KeyZ', 90, 2); // Ctrl+Z
  await sleep(100);
  const afterUndo = await transformOf(page, '[data-node="n1"]');
  section('keyboard-move', {
    moved: before !== afterKey && afterKey !== null,
    undone: afterUndo === before,
  });

  const r1 = await rectOf(page, '[data-node="n1"]');
  const startX = r1.x + r1.w / 2;
  const startY = r1.y + 20;
  await startFrames(page);
  await mouse(page, 'mousePressed', startX, startY, { clickCount: 1 });
  for (let i = 1; i <= 40; i += 1) {
    await mouse(page, 'mouseMoved', startX + i * 4, startY + i * 3);
    await sleep(16);
  }
  await mouse(page, 'mouseReleased', startX + 160, startY + 120, { clickCount: 1 });
  await sleep(150);
  const dragFrames = await stopFrames(page);
  const afterDrag = await transformOf(page, '[data-node="n1"]');
  const undoEnabled = await page.evaluate(`!${q('[data-testid="undo"]')}.disabled`);
  await click(page, '[data-testid="undo"]');
  await sleep(100);
  const dragUndone = (await transformOf(page, '[data-node="n1"]')) === before;
  section(
    'drag-move',
    {
      moved: afterDrag !== before,
      oneEdit: undoEnabled && dragUndone,
      smooth: dragFrames.over50ms <= 2,
    },
    { frames: dragFrames },
  );

  /* ---- 3. run a test contact and replay it (WFL-004, WFL-012) ----------------------------- */
  await setSelect(page, '#test-contact', 'maria');
  // The default test fires the configured trigger (Customer Booked Appointment: Maria books) and
  // the engine's matcher enrols her; nothing is enrolled by hand.
  await startFrames(page);
  await click(page, '[data-testid="run-test"]');
  const enrolledByTrigger = await waitFor(
    page,
    `${q('[data-testid="trigger-outcome"]')}?.dataset.outcome === 'enrolled'`,
    { timeout: 8000 },
  );
  // The first execution plays its recorded trace on its own (WFL-012): the timeline is playing,
  // one row is current, the dot is on the canvas, and the End step is not revealed yet.
  const autoPlaying = await waitFor(
    page,
    `${q('[data-testid="timeline"]')}?.dataset.playing === 'true'`,
    { timeout: 3000 },
  );
  const autoCurrent =
    (await count(page, '[data-testid="timeline"] ol li[data-current="true"]')) === 1;
  // The dot appears once the trace reaches its first step (the trigger row has no step yet).
  const dotWhilePlaying = await waitFor(
    page,
    `Boolean(${q('[data-testid="travelling-contact"]')})`,
    {
      timeout: 3000,
      every: 50,
    },
  );
  const endNotRevealed =
    (await page.evaluate(`${q('[data-node="n3"]')}?.dataset.status`)) !== 'done';
  const skipPresent = await exists(page, '[data-testid="skip-playback"]');
  const autoFinished = await waitFor(
    page,
    `${q('[data-testid="timeline"]')}?.dataset.playing !== 'true'`,
    { timeout: 15000 },
  );
  const autoFrames = await stopFrames(page);
  const replayAfterAuto = await page.evaluate(
    `[...document.querySelectorAll('[data-testid="timeline"] button')].some((b) => b.textContent.trim() === 'Replay')`,
  );
  const triggerRowHonest = await page.evaluate(
    `(() => { const t = ${q('[data-testid="timeline"]')}.textContent; return t.includes('Enrolled by Customer Booked Appointment') && !t.includes('Started at the first step'); })()`,
  );
  section(
    'first-execution-autoplay',
    {
      enrolledByTrigger,
      autoPlaying,
      autoCurrent,
      dotWhilePlaying,
      endNotRevealed,
      skipPresent,
      autoFinished,
      replayAfterAuto,
      triggerRowHonest,
      smooth: autoFrames.over50ms <= 2,
    },
    { frames: autoFrames },
  );
  // The saved definition now carries the Wait added above, so the run parks there first; the Time
  // Machine releases it and the run completes — one more fixed wait released in the real Lab.
  const parked = await waitFor(
    page,
    `${q('[data-testid="timeline"]')}.textContent.includes('Until')`,
    { timeout: 8000 },
  );
  await clickText(page, '[data-testid="test-panel"] button', '+1 day');
  const ran = await waitFor(
    page,
    `${q('[data-testid="timeline"]')}.textContent.includes('Run completed')`,
    { timeout: 8000 },
  );
  const timelineText = await text(page, '[data-testid="timeline"]');
  const rows = await count(page, '[data-testid="timeline"] ol li');
  const n1Done = (await page.evaluate(`${q('[data-node="n1"]')}.dataset.status`)) === 'done';
  const dot = await exists(page, '[data-testid="travelling-contact"]');
  await startFrames(page);
  await clickText(page, '[data-testid="timeline"] button', 'Replay');
  await sleep(1500);
  const midCurrent = await count(page, '[data-current="true"]');
  await sleep(2200);
  const playFrames = await stopFrames(page);
  section(
    'run-and-replay',
    {
      parkedAtWait: parked,
      ran,
      rowsRecorded: rows >= 5,
      nodeLit: n1Done,
      travellingDot: dot,
      playbackHighlights: midCurrent === 1,
      playbackSmooth: playFrames.over50ms <= 2,
    },
    { rows, timelineText: timelineText.slice(0, 600), frames: playFrames },
  );
  await screenshot(page, resolve(OUT, 'workflow-run-1440.png'), null, false);

  /* ---- 4. reduced motion: playback shows the end state at once (MOT-002) ------------------ */
  await page.send('Emulation.setEmulatedMedia', {
    media: 'screen',
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  });
  // Reloaded under the emulated preference, so the hook and the stylesheet both see it.
  await openPage(page, LAB);
  await waitFor(page, READY);
  await click(page, '[data-testid="timeline"] [data-run]');
  await waitFor(page, `document.querySelectorAll('[data-testid="timeline"] ol li').length > 0`, {
    timeout: 3000,
  });
  await clickText(page, '[data-testid="timeline"] button', 'Replay');
  await sleep(150);
  const lastCurrent = await page.evaluate(
    `(() => { const rows = [...document.querySelectorAll('[data-testid="timeline"] ol li')]; return rows.length > 0 && rows[rows.length - 1].dataset.current === 'true'; })()`,
  );
  // A fresh first execution under reduced motion: the whole trace at once, nothing travels.
  await setSelect(page, '#test-contact', 'maria');
  await click(page, '[data-testid="run-test"]');
  await waitFor(page, `${q('[data-testid="trigger-outcome"]')}?.dataset.outcome === 'enrolled'`, {
    timeout: 8000,
  });
  await sleep(200);
  const autoplayAtOnce = await page.evaluate(
    `(() => { const t = ${q('[data-testid="timeline"]')}; const rows = [...t.querySelectorAll('ol li')]; return t.dataset.playing !== 'true' && rows.length > 0 && rows[rows.length - 1].dataset.current === 'true'; })()`,
  );
  const dotTransition = await page.evaluate(
    `(() => { const d = ${q('[data-testid="travelling-contact"]')}; return d ? getComputedStyle(d).transitionDuration : null; })()`,
  );
  const reducedSeen = await page.evaluate("matchMedia('(prefers-reduced-motion: reduce)').matches");
  // The token sheet collapses every transition to a hair under reduced motion; anything at or
  // below 20 ms is no travel a person could see.
  const dotSeconds = dotTransition === null ? 0 : Number.parseFloat(dotTransition);
  section(
    'reduced-motion',
    {
      emulated: reducedSeen,
      endStateAtOnce: lastCurrent,
      firstExecutionAtOnce: autoplayAtOnce,
      noDotTravel: Number.isFinite(dotSeconds) && dotSeconds <= 0.02,
    },
    { dotTransition },
  );
  await page.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }],
  });

  /* ---- 5. 500 events while the main thread keeps drawing (SIM-014, PERF-002) -------------- */
  await startFrames(page);
  let eventsAdded = 0;
  let computeMs = 0;
  let ranIn = null;
  const started = Date.now();
  for (let i = 0; i < 90 && eventsAdded < 500; i += 1) {
    const runsBefore = await count(page, '[data-testid="timeline"] [data-run]');
    await click(page, '[data-testid="run-test"]');
    await waitFor(
      page,
      `document.querySelectorAll('[data-testid="timeline"] [data-run]').length > ${runsBefore}`,
      { timeout: 8000, every: 20 },
    );
    const timing = await text(page, '[data-testid="timing"]');
    const m = timing.match(
      /(\d+) events, (\d+) records, (\d+) ms compute in the (worker|main thread), (\d+) ms round trip/,
    );
    if (m) {
      eventsAdded += Number(m[1]);
      computeMs += Number(m[3]);
      ranIn = m[4];
    }
  }
  const busyFrames = await stopFrames(page);
  const stateSize = await page.evaluate(
    `document.querySelectorAll('[data-testid="timeline"] [data-run]').length`,
  );
  section(
    'five-hundred-events',
    {
      reached500: eventsAdded >= 500,
      ranInWorker: ranIn === 'worker',
      // The main thread keeps drawing while the worker computes: 95% of frames under 50 ms and no
      // frame — or long task — over 100 ms across the whole run (PERF-002).
      p95Under50ms: busyFrames.p95 !== null && busyFrames.p95 < 50,
      noFrameOver100ms: busyFrames.max !== null && busyFrames.max < 100,
      noLongTaskOver100ms: !busyFrames.longTasks.some((duration) => duration > 100),
    },
    {
      eventsAdded,
      computeMs,
      ranIn,
      elapsedMs: Date.now() - started,
      runsListed: stateSize,
      frames: busyFrames,
    },
  );

  /* ---- 6. a wait, released by the Time Machine (WFL-008, SIM-007) ------------------------- */
  await openPage(
    page,
    `${BASE}/workflow?scenario=SC-glowhaus-double-reminder&workflow=wf-reminders`,
  );
  await waitFor(page, READY);
  await sleep(300);
  await setSelect(page, '#test-contact', 'maria');
  // Maria books (the trigger is Appointment Status: new) for the 5th at noon, so the 24-hour
  // reminder wait ends on the 4th at noon: one day of waiting, then release on the second.
  await setText(page, '#trigger-starts-at', '2026-09-05T12:00:00-05:00');
  await click(page, '[data-testid="run-test"]');
  const waiting = await waitFor(
    page,
    `${q('[data-testid="timeline"]')}.textContent.includes('Waiting')`,
    { timeout: 8000 },
  );
  const heldUntil = (await text(page, '[data-testid="timeline"]')).includes('Until');
  await clickText(page, '[data-testid="test-panel"] button', '+1 day');
  await sleep(600);
  const stillWaiting = (await text(page, '[data-testid="timeline"]')).includes('Waiting');
  await clickText(page, '[data-testid="test-panel"] button', '+1 day');
  const released = await waitFor(
    page,
    `${q('[data-testid="timeline"]')}.textContent.includes('Wait ended') && ${q('[data-testid="timeline"]')}.textContent.includes('Completed')`,
    { timeout: 8000 },
  );
  const smsRow = (await text(page, '[data-testid="timeline"]')).includes('Send SMS done');
  section('wait-released-by-time-machine', { waiting, heldUntil, stillWaiting, released, smsRow });
  await screenshot(page, resolve(OUT, 'workflow-wait-1440.png'), null, false);

  /* ---- 7. Conversations: the reminder is in the inbox and a reply lands (CONV-001) --------- */
  await openPage(page, `${BASE}/conversations?scenario=SC-glowhaus-double-reminder`);
  const inboxReady = await waitFor(page, `Boolean(${q('[data-thread="maria"]')})`, {
    timeout: 8000,
  });
  await click(page, '[data-thread="maria"]');
  const threadOpen = await waitFor(page, `Boolean(${q('[data-testid="thread"]')})`, {
    timeout: 3000,
  });
  const attributed = (await text(page, '[data-testid="thread"]')).includes(
    'sent by Appointment Reminders',
  );
  await setText(page, '#inbox-body', 'On my way');
  await click(page, '[data-testid="send-message"]');
  const replied = await waitFor(
    page,
    `Boolean(${q('[data-testid="thread"] [data-direction="inbound"]')})`,
    { timeout: 8000 },
  );
  section('conversations', { inboxReady, threadOpen, attributed, replied });
  await screenshot(page, resolve(OUT, 'conversations-1440.png'), null, false);

  /* ---- 8. Playground: unlocked features from the runs above (SIM-015) --------------------- */
  await openPage(page, `${BASE}/playground`);
  const unlocked = await waitFor(page, `Boolean(${q('[data-feature="GHL-WF-SEND-SMS"]')})`, {
    timeout: 8000,
  });
  const simulatedPill = (await text(page, '[data-feature="GHL-WF-SEND-SMS"]')).includes(
    'Simulated',
  );
  const noGamification = !/\bXP\b|\bpoints\b|\bstreak\b/i.test(await text(page, 'main'));
  section('playground', { unlocked, simulatedPill, noGamification });
  await screenshot(page, resolve(OUT, 'playground-1440.png'), null, false);

  /* ---- 9. widths (RSP-004): 1024 and 768 keep the canvas; 390 and 320 recompose ---------- */
  for (const width of [1024, 768]) {
    await setViewport(page, width, 900, { mobile: false });
    await openPage(page, LAB);
    await waitFor(page, READY);
    await sleep(300);
    const columns = await page.evaluate(
      `getComputedStyle(${q('[data-testid="workflow-canvas"]')}.closest('[class*=workspace]')).gridTemplateColumns.split(' ').length`,
    );
    const overflow = await page.evaluate('document.documentElement.scrollWidth <= innerWidth');
    section(`width-${width}`, {
      canvas: await exists(page, '[data-testid="workflow-canvas"]'),
      twoColumns: columns === 2,
      palette: await exists(page, '[data-testid="palette"]'),
      testPanel: await exists(page, '[data-testid="test-panel"]'),
      timeline: await exists(page, '[data-testid="timeline"]'),
      noHorizontalOverflow: overflow,
    });
    await screenshot(page, resolve(OUT, `workflow-${width}.png`), null, false);
  }
  for (const width of [390, 320]) {
    await setViewport(page, width, 844, { mobile: true });
    await openPage(page, LAB);
    await waitFor(page, READY);
    await sleep(300);
    const overflow = await page.evaluate('document.documentElement.scrollWidth <= innerWidth');
    const steps = await exists(page, 'ol[aria-label="Workflow steps, in order"]');
    const noCanvas = !(await exists(page, '[data-testid="workflow-canvas"]'));
    const n1 = await rectOf(page, '[data-node="n1"]');
    await tap(page, n1.x + n1.w / 2, n1.y + n1.h / 2);
    const sheet = await waitFor(
      page,
      `Boolean(document.querySelector('dialog[open] [data-testid="inspector"]'))`,
      { timeout: 3000 },
    );
    const templateField = await exists(page, 'dialog[open] textarea');
    await key(page, 'Escape', 'Escape', 27);
    await sleep(200);
    await clickText(page, 'button', 'Add step');
    const paletteSheet = await waitFor(
      page,
      `Boolean(document.querySelector('dialog[open] [data-testid="palette"]'))`,
      { timeout: 3000 },
    );
    await key(page, 'Escape', 'Escape', 27);
    await sleep(200);
    // The test tab carries both paths, and a run moves the phone to the Timeline tab with the
    // trace playing there (WFL-012 on a phone).
    const bothPaths =
      (await exists(page, '[data-testid="trigger-test"]')) &&
      (await exists(page, '[data-testid="start-at-first-step"]'));
    await setSelect(page, '#test-contact', 'maria');
    await click(page, '[data-testid="run-test"]');
    const movedToTimeline = await waitFor(
      page,
      `${q('[role="tab"][aria-selected="true"]')}?.textContent.trim() === 'Timeline' && Boolean(${q('[data-testid="timeline"] ol li')})`,
      { timeout: 8000 },
    );
    const phoneAutoplay = await waitFor(
      page,
      `${q('[data-testid="timeline"]')}?.dataset.playing === 'true' || ${q('[data-testid="timeline"] ol li[data-current="true"]')} !== null`,
      { timeout: 3000 },
    );
    await clickText(page, '[role="tab"]', 'Timeline');
    const timelineTab = await waitFor(page, `Boolean(${q('[data-testid="timeline"]')})`, {
      timeout: 3000,
    });
    const targets = await page.evaluate(
      `[...document.querySelectorAll('[data-node]')].every((el) => el.getBoundingClientRect().height >= 44)`,
    );
    section(`width-${width}`, {
      verticalEditor: steps,
      canvasNotShrunk: noCanvas,
      tapOpensInspector: sheet,
      configureInSheet: templateField,
      addFromSheet: paletteSheet,
      timelineTab,
      bothTestPaths: bothPaths,
      runMovesToTimeline: movedToTimeline,
      tracePlaysOnPhone: phoneAutoplay,
      touchTargets44: targets,
      noHorizontalOverflow: overflow,
    });
    await screenshot(page, resolve(OUT, `workflow-${width}.png`), null, false);
  }
} finally {
  await close();
}

report.passed = failures === 0;
writeFileSync(resolve(OUT, 'workflow-probe.json'), JSON.stringify(report, null, 2));
console.log(
  report.passed
    ? 'workflow probe: PASS'
    : `workflow probe: FAIL (${failures} section${failures === 1 ? '' : 's'})`,
);
process.exit(report.passed ? 0 : 1);
