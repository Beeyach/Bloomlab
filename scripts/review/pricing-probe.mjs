// Drives the Pricing Arena in a real Chromium with DevTools input (EXR-016, PRI-001, PRI-002,
// SAL-009, SAL-016, A11Y-001, RSP-004). It prices a real deal the way a learner would: reads what
// the client asked for, takes scope out and reads what that leaves them with, sets eight numbers,
// watches its own arithmetic, submits, and only then sees what the work cost. Then the five
// review widths, the keyboard path and reduced motion. Writes pricing-probe.json and
// pricing-*.png to .review/ (override with REVIEW_OUT).
//   BASE=http://localhost:4173 node scripts/review/pricing-probe.mjs
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  openPage,
  resetIndexedDbFixture,
  screenshot,
  session,
  setViewport,
  sleep,
} from './cdp.mjs';

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

const GLOWHAUS = 'EX-PRICE_IT-glowhaus-two-locations';
const SUMMIT = 'EX-PRICE_IT-summit-application-funnel';
const PROPOSAL = 'EX-WRITE_IT-summit-proposal';

const q = (selector) => `document.querySelector(${JSON.stringify(selector)})`;
const at = (testid) => q(`[data-testid="${testid}"]`);
const exists = (page, testid) => page.evaluate(`Boolean(${at(testid)})`);
const text = (page, selector) => page.evaluate(`(${q(selector)}?.textContent ?? '')`);
const valueOf = (page, testid) => page.evaluate(`(${at(testid)}?.value ?? null)`);
const click = (page, testid) =>
  page.evaluate(
    `(() => { const el = ${at(testid)}; if (!el) return false; el.scrollIntoView({ block: 'center' }); el.click(); return true; })()`,
  );

/** Activate the real associated label, including native touch on phones. */
const toggleScope = async (page, name) => {
  const target = await page.evaluate(`(() => {
    const label = [...document.querySelectorAll('label')].find((el) => el.textContent.startsWith(${JSON.stringify(name)}));
    const box = label && document.getElementById(label.getAttribute('for'));
    if (!box) return false;
    if (box.disabled) return 'locked';
    label.scrollIntoView({ block: 'center' });
    const r = label.getBoundingClientRect(), x = r.left + r.width/2, y = r.top + r.height/2;
    return { x, y, width: r.width, height: r.height, hit: label.contains(document.elementFromPoint(x,y)), touch: matchMedia('(pointer:coarse)').matches, id: box.id, before: box.checked };
  })()`);
  if (!target || target === 'locked') return target;
  if (!target.hit || (target.touch && (target.width < 44 || target.height < 44))) return false;
  if (target.touch) {
    await page.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: target.x, y: target.y }],
    });
    await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else {
    for (const type of ['mousePressed', 'mouseReleased'])
      await page.send('Input.dispatchMouseEvent', {
        type,
        x: target.x,
        y: target.y,
        button: 'left',
        clickCount: 1,
      });
  }
  await sleep(100);
  return page.evaluate(
    `document.getElementById(${JSON.stringify(target.id)}).checked !== ${target.before}`,
  );
};

/** Types into a React-controlled field the way a keyboard does, then lets React see it. */
const type = (page, testid, value) =>
  page.evaluate(`(() => {
    const el = ${at(testid)};
    if (!el) return false;
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)});
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);

async function waitFor(page, expression, { timeout = 15000, every = 100 } = {}) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await page.evaluate(expression)) return true;
    await sleep(every);
  }
  return false;
}

const key = async (page, keyName, code, keyCode, modifiers = 0) => {
  const options = { key: keyName, code, windowsVirtualKeyCode: keyCode, modifiers };
  await page.send('Input.dispatchKeyEvent', { type: 'keyDown', ...options });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...options });
};

/** Space needs its character with it, or Chromium delivers a key press that activates nothing. */
const pressSpace = async (page) => {
  const options = { key: ' ', code: 'Space', windowsVirtualKeyCode: 32, text: ' ' };
  await page.send('Input.dispatchKeyEvent', { type: 'keyDown', ...options });
  await page.send('Input.dispatchKeyEvent', { type: 'char', ...options });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...options });
};

async function tabUntil(page, predicate, limit = 200) {
  for (let step = 0; step < limit; step += 1) {
    await key(page, 'Tab', 'Tab', 9);
    await sleep(12);
    if (
      await page.evaluate(`(() => { const el = document.activeElement; return ${predicate}; })()`)
    )
      return true;
  }
  return false;
}

async function open(page, id, readyTestId) {
  await openPage(page, `${BASE}/exercise/${id}`);
  const ready = await waitFor(page, `Boolean(${at(readyTestId)})`);
  if (!ready) {
    const context = await page.evaluate(
      `({path:location.pathname, main:document.querySelector('main')?.innerText.slice(0,2000), alerts:[...document.querySelectorAll('[role=alert]')].map(el=>el.textContent)})`,
    );
    writeFileSync(
      resolve(OUT, 'readiness-failure.json'),
      JSON.stringify({ id, readyTestId, ...context }, null, 2),
    );
    await screenshot(page, resolve(OUT, 'readiness-failure.png'), null, false);
  }
  assert(ready, `${id} did not render ${readyTestId}`);
  await sleep(300);
  return ready;
}

async function reset(page) {
  await resetIndexedDbFixture(page, BASE);
  await sleep(250);
}

/** Fills in a whole defensible deal on the Glowhaus exercise. */
async function priceTheGlowhausDeal(page) {
  await type(page, 'deal-project', '3200');
  await type(page, 'deal-rush-fee', '600');
  await click(page, 'deposit-kind-percent');
  await type(page, 'deposit-value', '40');
  await type(page, 'deal-timeline', '11');
  await type(page, 'deal-revisions', '1');
  await type(page, 'deal-recurring', '250');
  for (const [index, line] of [
    'Writing the treatment descriptions',
    'Paid ad management',
    'Anything added to Square after the import date',
  ].entries()) {
    await click(page, 'exclusion-add');
    await waitFor(page, `Boolean(${at(`exclusion-${index}`)})`);
    await type(page, `exclusion-${index}`, line);
  }
  await sleep(500);
}

const { page, close } = await session();
try {
  await setViewport(page, 1440, 1000, { mobile: false });

  /* ---- 1. the desk is one object with seven areas (PRI-001) ------------------------------- */
  await reset(page);
  const ready = await open(page, GLOWHAUS, 'deal-desk');
  const desk = await text(page, '[data-testid="deal-desk"]');
  section('desk-opens', {
    ready,
    requirements: desk.includes('What they asked for'),
    scope: desk.includes('What is in the deal'),
    price: desk.includes('The price'),
    payment: desk.includes('How it is paid'),
    timeline: desk.includes('How long it takes'),
    recurring: desk.includes('What recurs'),
    exclusions: desk.includes('What is not included'),
    clientsOwnWords: desk.includes('Dana retypes every lead'),
    noGamification: !/\bXP\b|\b\d+\s*points\b|earn(ed)? points|\bstreak\b|level up/i.test(desk),
  });
  await screenshot(page, resolve(OUT, 'pricing-desk-1440.png'), null, false);

  /* ---- 2. the hidden economics are not on the screen (EXR-016) --------------------------- */
  section('economics-hidden', {
    noMargin: !/margin/i.test(desk),
    noCost: !/\bcost\b/i.test(desk),
    noHourlyRate: !desk.includes('$55'),
    noScopeHours: !/\b\d+ hours\b/.test(desk),
    noPricePerLine: !/\$\d+ ?(Included|Excluded|Required)/.test(desk),
    noFloor: !/\bfloor\b/i.test(desk),
    // The scenario's own hidden facts stay in the scenario (§40).
    noHiddenFacts:
      !/second front desk|not hired|burned before|burnt before/i.test(desk) &&
      !desk.includes('hidden_facts'),
  });

  /* ---- 3. taking scope out has visible structural consequences (PRI-001) ------------------ */
  const before = await text(page, '[data-testid="requirement-stop_retyping"]');
  await toggleScope(page, 'Connecting Meta Lead Ads');
  const answered = await waitFor(
    page,
    `${at('requirement-stop_retyping')}?.textContent.includes('Nothing left in the deal answers this')`,
  );
  const afterRemoval = await text(page, '[data-testid="deal-desk"]');
  section('scope-consequences', {
    startsAnswered: before.includes('The deal answers this'),
    requirementGoesUnanswered: answered,
    saysWhatItLeavesBehind: afterRemoval.includes('Leads keep arriving by email'),
    stillNoPrice: !/\$\d+ ?(Included|Excluded)/.test(afterRemoval),
    countMoves: afterRemoval.includes('6 of 7 lines in'),
    lockedLineCannotBeRemoved: (await toggleScope(page, 'Two booking calendars')) === 'locked',
  });
  await screenshot(page, resolve(OUT, 'pricing-scope-removed-1440.png'), null, false);

  /* ---- 4. it comes back, and the learner's own arithmetic adds up (EXR-016) --------------- */
  await toggleScope(page, 'Connecting Meta Lead Ads');
  await waitFor(
    page,
    `${at('requirement-stop_retyping')}?.textContent.includes('The deal answers this')`,
  );
  await priceTheGlowhausDeal(page);
  section('the-eight-answers', {
    total: (await text(page, '[data-testid="deal-total"]')).includes('$3,800'),
    dueNow: (await text(page, '[data-testid="deal-due-now"]')).includes('$1,520'),
    onDelivery: (await text(page, '[data-testid="deal-on-delivery"]')).includes('$2,280'),
    recurringYear: (await text(page, '[data-testid="deal-recurring-annual"]')).includes('$3,000'),
    rushNoticed: await exists(page, 'deal-rushed'),
    threeExclusions: (await valueOf(page, 'exclusion-2'))?.startsWith('Anything added') === true,
    stillNoMargin: !/margin/i.test(await text(page, '[data-testid="deal-desk"]')),
  });
  await screenshot(page, resolve(OUT, 'pricing-priced-1440.png'), null, false);

  /* ---- 5. it survives a reload (§52, D-158) ---------------------------------------------- */
  await open(page, GLOWHAUS, 'deal-desk');
  section('reload', {
    projectKept: (await valueOf(page, 'deal-project')) === '3200',
    timelineKept: (await valueOf(page, 'deal-timeline')) === '11',
    depositKept: (await valueOf(page, 'deposit-value')) === '40',
    exclusionKept:
      (await valueOf(page, 'exclusion-0'))?.startsWith('Writing the treatment') === true,
    totalRecomputed: (await text(page, '[data-testid="deal-total"]')).includes('$3,800'),
  });

  /* ---- 6. what it cost, only after submitting (EXR-016, PRI-002) -------------------------- */
  const submitted = await page.evaluate(`(() => {
    const button = [...document.querySelectorAll('button')].find((el) => el.textContent.trim() === 'Run it');
    if (!button) return false;
    button.click();
    return true;
  })()`);
  const revealed = await waitFor(page, `Boolean(${at('deal-reveal')})`);
  const reveal = await text(page, '[data-testid="deal-reveal"]');
  section('reveal-after-submit', {
    submitted,
    revealed,
    // 31 hours of scope, 2 for the revision round, 6 for compressing the timeline, at $55.
    scopeHours: reveal.includes('31 hours'),
    deliveryCost: reveal.includes('$2,145'),
    contingency: reveal.includes('$322'),
    quoted: (await text(page, '[data-testid="reveal-total"]')).includes('$3,800'),
    margin: (await text(page, '[data-testid="reveal-margin"]')).includes('44%'),
    saysWhatAMarginWouldNeed: reveal.includes('40% margin would have needed'),
    noSingleCorrectPrice: !/correct price|the right price|ideal price/i.test(reveal),
  });
  await screenshot(page, resolve(OUT, 'pricing-reveal-1440.png'), null, false);

  /* ---- 7. an underpriced deal fails, and says why ----------------------------------------- */
  await reset(page);
  await open(page, GLOWHAUS, 'deal-desk');
  await priceTheGlowhausDeal(page);
  await type(page, 'deal-project', '900');
  await type(page, 'deal-rush-fee', '0');
  await sleep(400);
  await page.evaluate(`(() => {
    const button = [...document.querySelectorAll('button')].find((el) => el.textContent.trim() === 'Run it');
    button?.click();
  })()`);
  const failedBody = (await waitFor(page, `Boolean(${at('deal-reveal')})`))
    ? await text(page, 'body')
    : '';
  section('underpriced-fails', {
    graded: failedBody.length > 0,
    critical: failedBody.includes('Critical'),
    saysTheFloor: /at or above what delivering the scope costs/i.test(failedBody),
    notPassed: !/^Passed/m.test(failedBody.slice(0, 400)),
  });
  await screenshot(page, resolve(OUT, 'pricing-underpriced-1440.png'), null, false);

  /* ---- 8. the proposal is all eight sections (SAL-009) ------------------------------------ */
  await reset(page);
  const proposalReady = await open(page, PROPOSAL, 'written-problem');
  const proposalBody = await text(page, 'body');
  section('proposal-sections', {
    ready: proposalReady,
    problem: await exists(page, 'written-problem'),
    recommendation: await exists(page, 'written-recommendation'),
    scope: await exists(page, 'written-scope'),
    price: await exists(page, 'written-price'),
    timeline: await exists(page, 'written-timeline'),
    assumptions: await exists(page, 'written-assumptions'),
    exclusions: await exists(page, 'written-exclusions'),
    acceptance: await exists(page, 'written-acceptance'),
    nothingPrefilled: !proposalBody.includes('Dear Marcus'),
  });
  await screenshot(page, resolve(OUT, 'pricing-proposal-1440.png'), null, false);

  /* ---- 9. the five review widths (RSP-004) ------------------------------------------------ */
  for (const width of [1440, 1024, 768, 390, 320]) {
    await setViewport(page, width, width < 500 ? 780 : 950, { mobile: width < 768 });
    await reset(page);
    await open(page, GLOWHAUS, 'deal-desk');
    await click(page, 'exclusion-add');
    await waitFor(page, `Boolean(${at('exclusion-0')})`);
    await sleep(400);
    const noOverflow = await page.evaluate(
      `document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1`,
    );
    const inputs16 = await page.evaluate(
      `[...document.querySelectorAll('textarea, input[type="text"], input[type="number"]')].filter((el) => el.getClientRects().length > 0).every((el) => parseFloat(getComputedStyle(el).fontSize) >= 16)`,
    );
    const targets = await page.evaluate(
      `[...document.querySelectorAll('[data-testid^="deal-"], [data-testid^="deposit-"], [data-testid="exclusion-add"]')].map((el) => el.closest('label, button, dl') ?? el).filter((el) => el.getClientRects().length > 0).every((el) => el.getBoundingClientRect().height >= 43)`,
    );
    const scopeTargets = await page.evaluate(
      `[...document.querySelectorAll('[data-included]')].filter((el) => el.getClientRects().length > 0).every((el) => el.getBoundingClientRect().height >= 43)`,
    );
    const rail = await page.evaluate(
      `(() => { const el = document.querySelector('nav[aria-label="Primary"]'); return el ? { width: el.getBoundingClientRect().width, token: parseFloat(getComputedStyle(el).getPropertyValue('--bl-size-rail')) } : null; })()`,
    );
    section(`width-${width}`, {
      noHorizontalOverflow: noOverflow,
      allSevenAreas: (await text(page, '[data-testid="deal-desk"]')).includes('What recurs'),
      scopeStillDecidable: scopeTargets,
      inputsAtLeast16px: inputs16,
      touchTargets44: targets,
      railMatchesActiveToken:
        width >= 768 ? rail !== null && Math.abs(rail.width - rail.token) < 0.5 : rail !== null,
      stillNoEconomics: !/margin/i.test(await text(page, '[data-testid="deal-desk"]')),
    });
    await screenshot(page, resolve(OUT, `pricing-${width}.png`), null, false);
  }

  /* ---- 10. pricing a deal on a phone ------------------------------------------------------ */
  await setViewport(page, 390, 780, { mobile: true });
  await reset(page);
  await open(page, GLOWHAUS, 'deal-desk');
  await type(page, 'deal-project', '3200');
  await type(page, 'deal-rush-fee', '600');
  await sleep(400);
  section('phone', {
    totalsUsable: (await text(page, '[data-testid="deal-total"]')).includes('$3,800'),
    noHorizontalOverflow: await page.evaluate(
      `document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1`,
    ),
    scopeRemovable: (await toggleScope(page, 'Booking page design')) === true,
    consequenceReadable: (await text(page, '[data-testid="deal-desk"]')).includes(
      'Priya gets the default booking page',
    ),
  });
  await screenshot(page, resolve(OUT, 'pricing-phone-390.png'), null, false);

  /* ---- 11. the whole desk by keyboard (A11Y-001) ------------------------------------------ */
  await setViewport(page, 1440, 1000, { mobile: false });
  await reset(page);
  await open(page, SUMMIT, 'deal-desk');
  const reachedScope = await tabUntil(
    page,
    `el.type === 'checkbox' && Boolean(el.closest('[data-included]'))`,
  );
  const focusRing = await page.evaluate(
    `(() => { const el = document.activeElement; const s = getComputedStyle(el, ':focus-visible'); return s.outlineStyle !== 'none' || s.boxShadow !== 'none'; })()`,
  );
  await pressSpace(page);
  await sleep(250);
  const removedByKeyboard = await page.evaluate(
    `document.querySelectorAll('[data-included="false"]').length > 0`,
  );
  const reachedProject = await tabUntil(page, `el.getAttribute('data-testid') === 'deal-project'`);
  section('keyboard', {
    reachedTheScope: reachedScope,
    focusIsVisible: focusRing,
    removedALineWithTheKeyboard: removedByKeyboard,
    reachedThePrice: reachedProject,
  });

  /* ---- 12. reduced motion and a quiet interface (MOT-002, §70) ---------------------------- */
  await page.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  });
  await open(page, GLOWHAUS, 'deal-desk');
  const animating = await page.evaluate(
    `document.getAnimations().filter((a) => a.playState === 'running').length`,
  );
  const transitions = await page.evaluate(
    `[...document.querySelectorAll('*')].filter((el) => { const d = getComputedStyle(el).transitionDuration; return d && d !== '0s' && parseFloat(d) > 0.25; }).length`,
  );
  const monospace = await page.evaluate(
    `[...document.querySelectorAll('*')].filter((el) => /mono|courier|consolas/i.test(getComputedStyle(el).fontFamily)).length`,
  );
  section(
    'quiet-interface',
    {
      nothingAnimating: animating === 0,
      noLongTransitions: transitions === 0,
      noLearnerMonospace: monospace === 0,
    },
    { animating, transitions, monospace },
  );
} finally {
  await close();
}

report.passed = failures === 0;
writeFileSync(resolve(OUT, 'pricing-probe.json'), JSON.stringify(report, null, 2));
console.log(
  report.passed
    ? 'pricing probe: PASS'
    : `pricing probe: FAIL (${failures} section${failures === 1 ? '' : 's'})`,
);
process.exit(report.passed ? 0 : 1);
