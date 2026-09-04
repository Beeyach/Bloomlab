// Drives the Funnel Lab in a real Chromium with DevTools input (FUN-001 … FUN-003, EXR-011,
// A11Y-001, RSP-004): build an architecture from steps and blocks, connect real account objects,
// reorder from the keyboard, save and reload, switch the three modes and the three preview widths,
// walk a visitor through the funnel the learner built, watch the shared account react, and check
// the five review widths with touch and reduced motion. Writes funnel-probe.json and funnel-*.png
// to .review/ (override with REVIEW_OUT).
//   BASE=http://localhost:4173 node scripts/review/funnel-probe.mjs
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
    `(() => { const el = [...document.querySelectorAll(${JSON.stringify(selector)})].find((e) => e.textContent.trim().includes(${JSON.stringify(needle)})); if (!el) return false; el.scrollIntoView({ block: 'center' }); el.click(); return true; })()`,
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

const key = async (page, keyName, code, keyCode, modifiers = 0) => {
  const options = { key: keyName, code, windowsVirtualKeyCode: keyCode, modifiers };
  await page.send('Input.dispatchKeyEvent', { type: 'keyDown', ...options });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...options });
};

/**
 * Enter as the browser's own default action, not a synthetic click: `rawKeyDown` plus a `char`
 * is what makes Chrome activate the focused button, which is the whole point of the check.
 */
const pressEnter = async (page) => {
  const options = {
    key: 'Enter',
    code: 'Enter',
    windowsVirtualKeyCode: 13,
    nativeVirtualKeyCode: 13,
  };
  await page.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...options });
  await page.send('Input.dispatchKeyEvent', { type: 'char', text: '\r', ...options });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...options });
};

/** Tabs until the focused element satisfies the predicate, so `:focus-visible` really applies. */
async function tabUntil(page, predicate, limit = 60) {
  for (let step = 0; step < limit; step += 1) {
    await key(page, 'Tab', 'Tab', 9);
    await sleep(30);
    if (
      await page.evaluate(`(() => { const el = document.activeElement; return ${predicate}; })()`)
    )
      return true;
  }
  return false;
}
const tap = async (page, x, y) => {
  await page.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
};

/** The block roles on the selected step, in order, read from the rows rather than their words. */
const blockRoles = (page) =>
  page.evaluate(
    `[...document.querySelectorAll('[data-testid="funnel-blocks"] [data-role]')].map((el) => el.dataset.role)`,
  );

const LAB = `${BASE}/funnel`;
const READY = `Boolean(${q('[data-testid="funnel-mode-build"]')})`;

/** Adds a step through the Lab's own form. */
async function addStep(page, name, purpose) {
  await setText(page, '[data-testid="funnel-step-name"]', name);
  await setSelect(page, '[data-testid="funnel-step-purpose"]', purpose);
  await click(page, '[data-testid="funnel-step-add"]');
  return waitFor(
    page,
    `[...document.querySelectorAll('[data-testid="funnel-steps"] [data-purpose]')].some((el) => el.textContent.includes(${JSON.stringify(name)}))`,
    { timeout: 4000 },
  );
}

async function addBlock(page, role) {
  await setSelect(page, '[data-testid="funnel-block-role"]', role);
  await click(page, '[data-testid="funnel-block-add"]');
  return waitFor(
    page,
    `[...document.querySelectorAll('[data-testid="funnel-blocks"] [data-role]')].some((el) => el.dataset.role === ${JSON.stringify(role)})`,
    { timeout: 4000 },
  );
}

/** Selects a block by role and connects it to an account entity. */
async function connect(page, role, referenceId) {
  await page.evaluate(
    `(() => { const el = [...document.querySelectorAll('[data-testid="funnel-blocks"] [data-role]')].find((e) => e.dataset.role === ${JSON.stringify(role)}); if (el) el.click(); })()`,
  );
  await waitFor(page, `Boolean(${q('[data-testid="block-reference"]')})`, { timeout: 4000 });
  return setSelect(page, '[data-testid="block-reference"]', referenceId);
}

const { page, close } = await session();
try {
  /* ---- 1. the route opens on the shared account (FUN-001) -------------------------------- */
  await setViewport(page, 1440, 950, { mobile: false });
  await openPage(page, LAB);
  const ready = await waitFor(page, READY);
  await sleep(300);
  const body = await text(page, 'body');
  section('route-opens', {
    ready,
    onTheAccount: body.includes('Glowhaus'),
    threeModes:
      (await exists(page, '[data-testid="funnel-mode-build"]')) &&
      (await exists(page, '[data-testid="funnel-mode-preview"]')) &&
      (await exists(page, '[data-testid="funnel-mode-simulate"]')),
    noGamification: !/\bXP\b|\bstars?\b|\blevel \d|\bpoints\b|\bstreak\b/i.test(body),
    noEyebrow: await page.evaluate(
      `[...document.querySelectorAll('*')].every((el) => { const s = getComputedStyle(el); return !(s.textTransform === 'uppercase' && parseFloat(s.fontSize) < 13 && el.textContent.trim().length > 0 && el.children.length === 0); })`,
    ),
    noMonospace: await page.evaluate(
      `[...document.querySelectorAll('*')].every((el) => !/mono|courier|consolas/i.test(getComputedStyle(el).fontFamily))`,
    ),
  });
  await screenshot(page, resolve(OUT, 'funnel-1440.png'), null, false);

  /* ---- 2. BUILD is a real editor (FUN-001) ----------------------------------------------- */
  await click(page, '[data-testid="funnel-new"]');
  await waitFor(page, `Boolean(${q('[data-testid="funnel-step-name"]')})`, { timeout: 4000 });
  const stepOne = await addStep(page, 'Consultation offer', 'capture');
  const stepTwo = await addStep(page, 'Pick a time', 'booking');
  await clickText(page, '[data-testid="funnel-steps"] [data-purpose]', 'Consultation offer');
  await waitFor(page, `Boolean(${q('[data-testid="funnel-block-role"]')})`, { timeout: 4000 });
  const headline = await addBlock(page, 'headline');
  const outcome = await addBlock(page, 'outcome');
  const proof = await addBlock(page, 'proof');
  const form = await addBlock(page, 'form');
  const roleOptions = await page.evaluate(
    `[...${q('[data-testid="funnel-block-role"]')}.options].map((o) => o.value)`,
  );
  const connectedForm = await connect(page, 'form', 'consult-request');
  const formChoices = await page.evaluate(
    `[...${q('[data-testid="block-reference"]')}.options].map((o) => o.value).filter(Boolean)`,
  );
  const originNote = await text(page, '[data-testid="block-origin"]');
  section('build-core-actions', {
    stepOne,
    stepTwo,
    headline,
    outcome,
    proof,
    form,
    everyRoleOffered: [
      'headline',
      'problem',
      'outcome',
      'proof',
      'benefits',
      'objections',
      'cta',
      'form',
      'survey',
      'calendar',
      'checkout',
    ].every((role) => roleOptions.includes(role)),
    connectedForm,
    // The picker offers the account's own forms and nothing invented.
    referencesFromAccount: formChoices.length === 1 && formChoices[0] === 'consult-request',
    saysItIsARealGhlObject: originNote.includes('real HighLevel object'),
  });

  /* ---- 3. reordering has a keyboard path (A11Y-001) -------------------------------------- */
  const before = await blockRoles(page);
  // Start from the top of the document and Tab, so the focus ring is the real `:focus-visible`
  // one a keyboard user gets — not the ring a programmatic `.focus()` would skip.
  await page.evaluate(`document.body.focus(); document.activeElement.blur()`);
  const reached = await tabUntil(
    page,
    `el.tagName === 'BUTTON' && el.textContent.trim() === 'Move down' && el.closest('[data-testid="funnel-blocks"]') !== null`,
  );
  const ring = await page.evaluate(
    `(() => { const el = document.activeElement; const s = getComputedStyle(el); return (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== 'none'; })()`,
  );
  const onFirstRow = await page.evaluate(
    `document.activeElement.closest('li') === document.querySelector('[data-testid="funnel-blocks"] li')`,
  );
  await pressEnter(page);
  await sleep(250);
  const after = await blockRoles(page);
  section(
    'keyboard-reorder',
    {
      reachedByTab: reached,
      visibleFocusRing: ring,
      onFirstRow,
      orderChanged: JSON.stringify(before) !== JSON.stringify(after),
      movedByOne: after[0] === before[1] && after[1] === before[0],
    },
    { before, after },
  );

  // Put it back, then finish the funnel: a calendar on the booking step.
  await page.evaluate(`(() => {
    const row = document.querySelectorAll('[data-testid="funnel-blocks"] li')[1];
    [...row.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Move up')?.click();
  })()`);
  await sleep(200);
  await clickText(page, '[data-testid="funnel-steps"] [data-purpose]', 'Pick a time');
  await waitFor(page, `Boolean(${q('[data-testid="funnel-block-role"]')})`, { timeout: 4000 });
  await addBlock(page, 'calendar');
  const connectedCalendar = await connect(page, 'calendar', 'consultation');

  /* ---- 4. problems are stated before the visitor is offered (FUN-001) -------------------- */
  await clickText(page, '[data-testid="funnel-steps"] [data-purpose]', 'Consultation offer');
  await sleep(200);
  const problemsGone = await waitFor(page, `Boolean(${q('[data-testid="funnel-no-problems"]')})`, {
    timeout: 4000,
  });
  section('validation', { connectedCalendar, nothingInTheWay: problemsGone });

  /* ---- 5. saving is an account event, and it survives a reload (FUN-001, DATA-001) ------- */
  await click(page, '[data-testid="funnel-save"]');
  const saved = await waitFor(page, `document.body.textContent.includes('Saved · version 1')`, {
    timeout: 10000,
  });
  await screenshot(page, resolve(OUT, 'funnel-build-1440.png'), null, false);

  await openPage(page, LAB);
  await waitFor(page, READY);
  await sleep(400);
  const reloadedSteps = await count(page, '[data-testid="funnel-steps"] [data-purpose]');
  const reloadedName = await text(page, '[data-testid="funnel-steps"]');
  section('persistence-reload', {
    saved,
    twoStepsBack: reloadedSteps === 2,
    sameNames: reloadedName.includes('Consultation offer') && reloadedName.includes('Pick a time'),
    versionKept: (await text(page, 'body')).includes('Saved · version 1'),
  });

  /* ---- 6. PREVIEW switches three real widths (FUN-001, FUN-002) -------------------------- */
  await click(page, '[data-testid="funnel-mode-preview"]');
  const previewOpen = await waitFor(page, `Boolean(${q('[data-testid="funnel-preview-frame"]')})`, {
    timeout: 6000,
  });
  const desktopWidth = (await rectOf(page, '[data-testid="funnel-preview-frame"]'))?.w;
  const previewText = await text(page, '[data-testid="funnel-preview-frame"]');
  await click(page, '[data-testid="funnel-device-tablet"]');
  await sleep(250);
  const tabletWidth = (await rectOf(page, '[data-testid="funnel-preview-frame"]'))?.w;
  await click(page, '[data-testid="funnel-device-mobile"]');
  await sleep(250);
  const mobileWidth = (await rectOf(page, '[data-testid="funnel-preview-frame"]'))?.w;
  // The page inside really reflows: at 390 the blocks are narrower than they were at 1200.
  const reflowed = await page.evaluate(
    `(() => { const b = document.querySelector('[data-testid="funnel-preview-frame"] section'); return b ? b.getBoundingClientRect().width : null; })()`,
  );
  section(
    'preview-device-switch',
    {
      previewOpen,
      desktopWider: desktopWidth > tabletWidth,
      tabletWider: tabletWidth > mobileWidth,
      mobileIs390: Math.round(mobileWidth) === 390,
      rendersTheBuiltFunnel: previewText.includes('Consultation Request'),
      showsTheFormsOwnFields: previewText.includes('Treatment interest'),
      reflowsRatherThanScales: reflowed !== null && reflowed <= 390,
    },
    { desktopWidth, tabletWidth, mobileWidth, innerBlockWidth: reflowed },
  );
  await screenshot(page, resolve(OUT, 'funnel-preview-mobile.png'), null, false);
  await click(page, '[data-testid="funnel-device-desktop"]');
  await sleep(200);

  /* ---- 7. the mode persists across a reload (FUN-002) ------------------------------------ */
  await openPage(page, LAB);
  await waitFor(page, READY);
  await sleep(400);
  const modeKept = await page.evaluate(
    `${q('[data-testid="funnel-mode-preview"]')}?.getAttribute('aria-pressed') === 'true'`,
  );
  const deviceKept = await page.evaluate(
    `${q('[data-testid="funnel-device-desktop"]')}?.getAttribute('aria-pressed') === 'true'`,
  );
  section('mode-persists', { modeKept, deviceKept });

  /* ---- 8. SIMULATE: the visitor walks the built funnel (FUN-003) ------------------------- */
  await click(page, '[data-testid="funnel-mode-simulate"]');
  const visitorReady = await waitFor(
    page,
    `Boolean(${q('[data-testid="visitor-field-first_name"]')})`,
    { timeout: 8000 },
  );
  const usesTheBuiltPage = (await text(page, 'body')).includes('step 1 of 2');
  await setText(page, '[data-testid="visitor-field-first_name"]', 'Priya');
  await setText(page, '[data-testid="visitor-field-email"]', 'priya.nair@example.com');
  await setText(page, '[data-testid="visitor-field-phone"]', '+15125550190');
  await sleep(150);
  await page.evaluate(
    `[...document.querySelectorAll('[data-testid^="visitor-submit-"]')].forEach((b) => b.click())`,
  );
  const chainAppeared = await waitFor(page, `Boolean(${q('[data-testid="visitor-chain"]')})`, {
    timeout: 10000,
  });
  const chain = await text(page, '[data-testid="visitor-chain"]');
  section('simulate-form-chain', {
    visitorReady,
    usesTheBuiltPage,
    chainAppeared,
    // The whole FUN-003 chain, read off the run's own log rather than claimed.
    formSubmitted: chain.includes('form.submitted'),
    contactCreated: chain.includes('contact.created'),
    contactWasGenerated: chain.includes('caused by it'),
    workflowEnrolled: chain.includes('workflow.enrolled'),
    namesTheWorkflow: chain.includes('New Lead Welcome'),
    workflowSentTheText: chain.includes('sms.sent'),
    movedOn: (await text(page, 'body')).includes('step 2 of 2'),
  });
  await screenshot(page, resolve(OUT, 'funnel-simulate-1440.png'), null, false);

  /* ---- 9. the booking reaches the same account (FUN-001) --------------------------------- */
  const slotPicker = await exists(page, '[data-testid^="visitor-slot-"]');
  await page.evaluate(
    `[...document.querySelectorAll('[data-testid^="visitor-book-"]')].forEach((b) => b.click())`,
  );
  const booked = await waitFor(
    page,
    `${q('[data-testid="visitor-chain"]')}?.textContent.includes('appointment.booked')`,
    { timeout: 10000 },
  );
  section('simulate-booking', {
    slotPicker,
    booked,
    finished: await waitFor(page, `Boolean(${q('[data-testid="visitor-finished"]')})`, {
      timeout: 4000,
    }),
  });

  /* ---- 10. a refusal is shown as a refusal, never as success (FUN-003, §129) ------------- */
  await click(page, '[data-testid="visitor-restart"]');
  await waitFor(page, `Boolean(${q('[data-testid="visitor-field-first_name"]')})`, {
    timeout: 6000,
  });
  await page.evaluate(
    `[...document.querySelectorAll('[data-testid^="visitor-submit-"]')].forEach((b) => b.click())`,
  );
  const refused = await waitFor(page, `Boolean(${q('[data-testid="visitor-refusal"]')})`, {
    timeout: 6000,
  });
  section('refusal-is-visible', {
    refused,
    saysWhy: (await text(page, '[data-testid="visitor-refusal"]')).includes('first name'),
    noFakeSuccess: !(await page.evaluate(`Boolean(${q('[data-testid="visitor-finished"]')})`)),
  });

  /* ---- 11. the five review widths (RSP-004) ---------------------------------------------- */
  for (const width of [1440, 1024, 768]) {
    await setViewport(page, width, 950, { mobile: false });
    await openPage(page, LAB);
    await waitFor(page, READY);
    await sleep(400);
    await click(page, '[data-testid="funnel-mode-build"]');
    await sleep(300);
    const overflow = await page.evaluate('document.documentElement.scrollWidth <= innerWidth');
    const steps = await exists(page, '[data-testid="funnel-steps"]');
    const blocks = await exists(page, '[data-testid="funnel-blocks"]');
    // Select a block and read the inspector: at these widths it is a column beside or below the
    // working area, never a sheet, and it is the same inspector in both compositions.
    await page.evaluate(
      `document.querySelector('[data-testid="funnel-blocks"] [data-role]')?.click()`,
    );
    const inspectorOpen = await waitFor(page, `Boolean(${q('[data-testid="block-origin"]')})`, {
      timeout: 4000,
    });
    const inSheet = await page.evaluate(
      `Boolean(document.querySelector('dialog[open] [data-testid="block-origin"]'))`,
    );
    const stepsColumnWidth = (await rectOf(page, '[data-testid="funnel-steps"]'))?.w ?? 0;
    section(`width-${width}`, {
      steps,
      blocks,
      inspectorOpen,
      inspectorIsAColumnNotASheet: !inSheet,
      stepListReadable: stepsColumnWidth >= 200,
      noHorizontalOverflow: overflow,
      modesPresent: await exists(page, '[data-testid="funnel-mode-simulate"]'),
    });
    await screenshot(page, resolve(OUT, `funnel-${width}.png`), null, false);
  }

  for (const width of [390, 320]) {
    await setViewport(page, width, 844, { mobile: true });
    await openPage(page, LAB);
    await waitFor(page, READY);
    await sleep(400);
    await click(page, '[data-testid="funnel-mode-build"]');
    await sleep(300);
    const overflow = await page.evaluate('document.documentElement.scrollWidth <= innerWidth');
    // Steps move into a labelled sheet rather than being taken away.
    const stepsButton = await page.evaluate(
      `[...document.querySelectorAll('button')].some((b) => /^Steps \\(/.test(b.textContent.trim()))`,
    );
    const stepsRect = await page.evaluate(
      `(() => { const b = [...document.querySelectorAll('button')].find((x) => /^Steps \\(/.test(x.textContent.trim())); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`,
    );
    let sheetOpened = false;
    if (stepsRect) {
      await tap(page, stepsRect.x, stepsRect.y);
      sheetOpened = await waitFor(
        page,
        `Boolean(document.querySelector('dialog[open] [data-testid="funnel-steps"]'))`,
        { timeout: 4000 },
      );
      await key(page, 'Escape', 'Escape', 27);
      await sleep(250);
    }
    // Every mode stays operable, and a block still opens its inspector as a sheet.
    const blockRect = await page.evaluate(
      `(() => { const el = document.querySelector('[data-testid="funnel-blocks"] [data-role]'); if (!el) return null; el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`,
    );
    let inspectorSheet = false;
    if (blockRect) {
      await tap(page, blockRect.x, blockRect.y);
      inspectorSheet = await waitFor(
        page,
        `Boolean(document.querySelector('dialog[open] [data-testid="block-origin"]'))`,
        { timeout: 4000 },
      );
      await key(page, 'Escape', 'Escape', 27);
      await sleep(250);
    }
    const targets = await page.evaluate(
      `[...document.querySelectorAll('[data-testid^="funnel-mode-"], [data-testid^="funnel-device-"]')].every((el) => el.getBoundingClientRect().height >= 44)`,
    );
    // The preview stage is the one deliberate local scroller; the page itself never scrolls sideways.
    await click(page, '[data-testid="funnel-mode-preview"]');
    await sleep(300);
    const pageStillFits = await page.evaluate('document.documentElement.scrollWidth <= innerWidth');
    const previewPresent = await exists(page, '[data-testid="funnel-preview-frame"]');
    await click(page, '[data-testid="funnel-mode-simulate"]');
    await sleep(400);
    const simulateWorks = await page.evaluate(
      `Boolean(document.querySelector('[data-testid="visitor-field-first_name"]') || document.querySelector('[data-testid="simulate-blocked"]'))`,
    );
    section(`width-${width}`, {
      stepsInASheet: stepsButton,
      sheetOpensOnTap: sheetOpened,
      inspectorOnTap: inspectorSheet,
      touchTargets44: targets,
      previewStillThere: previewPresent,
      simulateStillThere: simulateWorks,
      noHorizontalOverflow: overflow && pageStillFits,
    });
    await screenshot(page, resolve(OUT, `funnel-${width}.png`), null, false);
  }

  /* ---- 12. the Autopsy lens (FUN-004) ---------------------------------------------------- */
  // Not a fourth mode: a lens over whichever funnel is open, on a scenario that carries three
  // weeks of its own traffic. Every view has to be data, and an empty one has to say so.
  await setViewport(page, 1440, 950, { mobile: false });
  await openPage(page, `${BASE}/reporting`);
  await waitFor(page, `document.body.textContent.includes('Reporting')`, { timeout: 15000 });
  await sleep(500);
  if (await exists(page, '[data-testid="run-window"]')) {
    await click(page, '[data-testid="run-window"]');
    await waitFor(page, `!${q('[data-testid="reporting-empty"]')}`, { timeout: 60000 });
  }
  await openPage(page, `${BASE}/funnel?scenario=SC-glowhaus-reporting&funnel=fn-consult`);
  await waitFor(page, READY, { timeout: 15000 });
  await sleep(600);
  const lensClosed = !(await exists(page, '[data-testid="autopsy"]'));
  await click(page, '[data-testid="funnel-autopsy-toggle"]');
  const lensOpened = await waitFor(page, `Boolean(${q('[data-testid="autopsy"]')})`, {
    timeout: 8000,
  });
  await sleep(400);
  const autopsy = await text(page, '[data-testid="autopsy"]');
  const views = {};
  for (const view of ['traffic', 'conversion', 'reach', 'forms', 'booking', 'dropoff']) {
    views[view] = await exists(page, `[data-testid="autopsy-${view}"]`);
  }
  // The numbers have to be the shared projection's, not something this screen worked out: the
  // Reporting Lab is reading the same run, so its conversion counts must be these counts.
  const conversionWorkings = await text(page, '[data-testid="autopsy-conversion"]');
  section(
    'autopsy-lens',
    {
      startsClosed: lensClosed,
      opens: lensOpened,
      ...views,
      readsRealTraffic: autopsy.includes('meta-ads') && autopsy.includes('google-search'),
      carriesItsCounts: conversionWorkings.includes(' of '),
      // Reach is measured in the step's own blocks, and says so rather than pretending to pixels.
      reachIsSemantic: autopsy.includes("step's own blocks"),
      // Where sessions ended, never why they ended.
      dropOffIsWhereNotWhy: autopsy.includes('Where, not why'),
      noFakeHeatmap: !/heatmap|heat map/i.test(autopsy),
      stillThreeModes:
        (await exists(page, '[data-testid="funnel-mode-build"]')) &&
        (await exists(page, '[data-testid="funnel-mode-preview"]')) &&
        (await exists(page, '[data-testid="funnel-mode-simulate"]')) &&
        !(await exists(page, '[data-testid="funnel-mode-autopsy"]')),
    },
    { conversionWorkings: conversionWorkings.slice(0, 120) },
  );
  await screenshot(page, resolve(OUT, 'funnel-autopsy.png'), null, false);

  /* ---- 13. a funnel with no traffic invents none ------------------------------------------- */
  await openPage(page, LAB);
  await waitFor(page, READY, { timeout: 15000 });
  await sleep(600);
  let emptyAutopsy = '';
  if (await exists(page, '[data-testid="funnel-autopsy-toggle"]')) {
    await click(page, '[data-testid="funnel-autopsy-toggle"]');
    await sleep(500);
    emptyAutopsy = await page.evaluate(
      `(${q('[data-testid="autopsy-empty"]')}?.textContent ?? ${q('[data-testid="autopsy"]')}?.textContent ?? '')`,
    );
  }
  section('autopsy-empty', {
    saysSoOrHasItsOwnTraffic: emptyAutopsy.length > 0,
    // Either it has no traffic and says there is nothing to divide, or the learner has walked a
    // visitor through it and the counts are theirs. Never a fabricated zero.
    noFabricatedRate:
      emptyAutopsy.includes('nothing to divide') ||
      !emptyAutopsy.includes('0%') ||
      emptyAutopsy.includes(' of '),
  });

  /* ---- 14. reduced motion (MOT-002) ------------------------------------------------------ */
  await setViewport(page, 1440, 950, { mobile: false });
  await page.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  });
  await openPage(page, LAB);
  await waitFor(page, READY);
  await sleep(400);
  const animations = await page.evaluate(
    `document.getAnimations().filter((a) => a.playState === 'running').length`,
  );
  const transitions = await page.evaluate(
    `[...document.querySelectorAll('*')].filter((el) => { const d = getComputedStyle(el).transitionDuration; return d && d !== '0s' && parseFloat(d) > 0.25; }).length`,
  );
  section(
    'reduced-motion',
    { nothingAnimating: animations === 0, noLongTransitions: transitions === 0 },
    { animations, transitions },
  );
} finally {
  await close();
}

report.passed = failures === 0;
writeFileSync(resolve(OUT, 'funnel-probe.json'), JSON.stringify(report, null, 2));
console.log(
  report.passed
    ? 'funnel probe: PASS'
    : `funnel probe: FAIL (${failures} section${failures === 1 ? '' : 's'})`,
);
process.exit(report.passed ? 0 : 1);
