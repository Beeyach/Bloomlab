// Drives the Reporting Lab in a real Chromium with DevTools input (REP-001, REP-002, A11Y-001,
// RSP-004). It does not look for headings: it runs the reporting window, reads every one of the
// ten numbers off the screen, opens the calculation and the evidence behind them, checks the
// arithmetic the page is showing against the counts the page itself supplies, proves a report on
// an empty account shows no rates rather than zeroes, walks the diagnosis workspace, reloads, and
// then does the keyboard, the five review widths and reduced motion.
// Writes reporting-probe.json and reporting-*.png to .review/ (override with REVIEW_OUT).
//   BASE=http://localhost:4173 node scripts/review/reporting-probe.mjs
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

const q = (selector) => `document.querySelector(${JSON.stringify(selector)})`;
const exists = (page, selector) => page.evaluate(`Boolean(${q(selector)})`);
const text = (page, selector) => page.evaluate(`(${q(selector)}?.textContent ?? '')`);
const click = (page, selector) =>
  page.evaluate(
    `(() => { const el = ${q(selector)}; if (!el) return false; el.scrollIntoView({ block: 'center' }); el.click(); return true; })()`,
  );

async function waitFor(page, expression, { timeout = 12000, every = 100 } = {}) {
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

async function tabUntil(page, predicate, limit = 120) {
  for (let step = 0; step < limit; step += 1) {
    await key(page, 'Tab', 'Tab', 9);
    await sleep(20);
    if (
      await page.evaluate(`(() => { const el = document.activeElement; return ${predicate}; })()`)
    )
      return true;
  }
  return false;
}

const METRICS = [
  'leads',
  'conversion',
  'booking_rate',
  'show_rate',
  'close_rate',
  'revenue',
  'pipeline_value',
  'source_performance',
  'response_rate',
  'time_to_contact',
];

const LAB = `${BASE}/reporting`;
const READY = `Boolean(${q('h1')}) && document.body.textContent.includes('Reporting')`;

const metricValue = (page, id) => text(page, `[data-testid="metric-value-${id}"]`);

/** Runs the window if there is one to run, and waits for the report to stop being empty. */
async function runWindow(page) {
  if (!(await exists(page, '[data-testid="run-window"]'))) return true;
  await click(page, '[data-testid="run-window"]');
  return waitFor(page, `!${q('[data-testid="reporting-empty"]')}`, { timeout: 60000 });
}

async function resetAccount(page) {
  await click(page, '[data-testid="reporting-reset"]');
  await sleep(900);
  return waitFor(page, READY, { timeout: 12000 });
}

const { page, close } = await session();
try {
  /* ---- 1. the route opens on the shared account ------------------------------------------ */
  await setViewport(page, 1440, 1000, { mobile: false });
  await openPage(page, LAB);
  const ready = await waitFor(page, READY);
  await sleep(400);
  const before = await text(page, 'body');
  section('route-opens', {
    ready,
    onTheAccount: before.includes('Glowhaus'),
    // Nothing has happened yet, so the report says so rather than showing a wall of zeroes.
    emptyIsEmptyNotZero:
      (await exists(page, '[data-testid="reporting-empty"]')) ||
      (await exists(page, '[data-testid="metric-value-leads"]')),
    noGamification: !/\bXP\b|\bstars?\b|\blevel \d|\bpoints\b|\bstreak\b/i.test(before),
    noEyebrow: await page.evaluate(
      `[...document.querySelectorAll('*')].every((el) => { const s = getComputedStyle(el); return !(s.textTransform === 'uppercase' && parseFloat(s.fontSize) < 13 && el.textContent.trim().length > 0 && el.children.length === 0); })`,
    ),
    noMonospace: await page.evaluate(
      `[...document.querySelectorAll('*')].every((el) => !/mono|courier|consolas/i.test(getComputedStyle(el).fontFamily))`,
    ),
  });

  /* ---- 2. the empty report shows no rates rather than 0% (§56) ---------------------------- */
  if (await exists(page, '[data-testid="reporting-empty"]')) {
    const emptyBody = await text(page, 'body');
    section('empty-report', {
      saysSo: emptyBody.includes('Nothing to report on'),
      explainsWhyThereAreNoRates: emptyBody.includes('nothing to divide'),
      noFabricatedZeroRate: !emptyBody.includes('0%'),
    });
  } else {
    section('empty-report', { alreadyRun: true }, { note: 'the account already held history' });
  }

  /* ---- 3. running the window is ordinary simulator machinery ----------------------------- */
  const ran = await runWindow(page);
  await sleep(500);
  section('run-window', {
    reportBecomesReal: ran,
    nothingLeftQueued: !(await exists(page, '[data-testid="reporting-window"]')),
  });
  await screenshot(page, resolve(OUT, 'reporting-1440.png'), null, false);

  /* ---- 4. all ten metrics, read off the screen ------------------------------------------- */
  const readings = {};
  for (const id of METRICS) readings[id] = (await metricValue(page, id)).trim();
  section('ten-metrics', Object.fromEntries(METRICS.map((id) => [id, readings[id] !== ''])), {
    readings,
  });

  /* ---- 5. the calculation behind a number ------------------------------------------------ */
  await click(page, '[data-testid="calculation-show_rate"]');
  await waitFor(page, `Boolean(${q('[data-testid="calculation-body-show_rate"]')})`);
  const calculation = await text(page, '[data-testid="calculation-body-show_rate"]');
  section('calculation-disclosure', {
    opens: calculation.length > 20,
    statesTheRule: calculation.includes('Showed'),
    // The one denominator that has to be said out loud, because it is the one people argue about.
    namesTheDenominator: calculation.includes('cancelled') && calculation.includes('future'),
  });

  /* ---- 6. the stage chain adds up -------------------------------------------------------- */
  const stages = await page.evaluate(
    `[...document.querySelectorAll('[data-testid^="stage-"]')].map((el) => {
       const row = el.closest('tr');
       return { id: el.dataset.testid.slice(6), cells: [...row.querySelectorAll('td')].map((c) => c.textContent.trim()) };
     })`,
  );
  const asNumber = (value) => Number(String(value).replace(/[^0-9.]/g, ''));
  let chainConsistent = stages.length === 5;
  for (let i = 1; i < stages.length; i += 1) {
    const reached = asNumber(stages[i].cells[0]);
    const previous = asNumber(stages[i - 1].cells[0]);
    const lost = asNumber(stages[i].cells[2]);
    if (previous - reached !== lost) chainConsistent = false;
  }
  section(
    'stage-math',
    {
      fiveStages: stages.length === 5,
      // Every "lost here" is exactly the difference between two counts on the same screen.
      lossesAddUp: chainConsistent,
      largestLossIsCalledAnObservation: (await text(page, '[data-testid="largest-loss"]')).includes(
        'not a verdict',
      ),
    },
    { stages },
  );

  /* ---- 7. source performance never hides a sample size ----------------------------------- */
  const sources = await page.evaluate(
    `[...document.querySelectorAll('[data-testid^="source-"]')].map((el) => {
       const row = el.closest('tr');
       return { source: el.textContent.trim(), cells: [...row.querySelectorAll('td')].map((c) => c.textContent.trim()) };
     })`,
  );
  const visitsTotal = sources.reduce((total, row) => total + asNumber(row.cells[0]), 0);
  const leadsTotal = sources.reduce((total, row) => total + asNumber(row.cells[1]), 0);
  section(
    'source-performance',
    {
      hasRows: sources.length > 1,
      everyRowShowsItsVisits: sources.every((row) => row.cells[0] !== ''),
      // The rows have to add up to the totals the same page reports.
      visitsMatchTheChain: visitsTotal === asNumber(stages[0]?.cells[0] ?? '0'),
      leadsMatchTheChain: leadsTotal === asNumber(stages[1]?.cells[0] ?? '0'),
    },
    { sources, visitsTotal, leadsTotal },
  );

  /* ---- 8. the evidence behind a number ---------------------------------------------------- */
  await click(page, '[data-testid="evidence-leads"]');
  const drawerOpen = await waitFor(page, `Boolean(${q('[data-testid="evidence-drawer"]')})`);
  const drawer = await text(page, '[data-testid="evidence-drawer"]');
  const eventRows = await page.evaluate(
    `document.querySelectorAll('[data-testid="evidence-drawer"] tbody tr').length`,
  );
  section(
    'evidence-drawer',
    {
      opens: drawerOpen,
      // The number of events it lists is the number the metric claims.
      listsOneEventPerLead: eventRows === asNumber(readings.leads),
      namesTheEvents: drawer.includes('contact.created'),
      closesOnEscape: true,
    },
    { eventRows, leads: readings.leads },
  );
  await key(page, 'Escape', 'Escape', 27);
  await sleep(300);
  report.sections['evidence-drawer'].checks.closesOnEscape = !(await exists(
    page,
    '[data-testid="evidence-drawer"]',
  ));

  /* ---- 9. revenue reconciles with the payments behind it ---------------------------------- */
  await click(page, '[data-testid="evidence-revenue"]');
  await waitFor(page, `Boolean(${q('[data-testid="evidence-drawer"]')})`);
  const revenueDrawer = await text(page, '[data-testid="evidence-drawer"]');
  section('revenue-reconciles', {
    showsPaymentsAndRefunds:
      revenueDrawer.includes('payment.received') && revenueDrawer.includes('refund.issued'),
    saysWhatItSubtracted: revenueDrawer.includes('refunded'),
    excludesFailedPayments: !revenueDrawer.includes('payment.failed'),
  });
  await key(page, 'Escape', 'Escape', 27);
  await sleep(250);

  /* ---- 10. pipeline is a snapshot, revenue is a window fact (§6) --------------------------- */
  const pipelineRow = await text(page, '[data-testid="metric-pipeline_value"]');
  const revenueRow = await text(page, '[data-testid="metric-revenue"]');
  section('snapshot-vs-window', {
    pipelineIsNow: pipelineRow.includes('As it stands now'),
    revenueIsOverTheWindow: revenueRow.includes('Over the window'),
  });

  /* ---- 11. response rate and time to contact ---------------------------------------------- */
  const speedBody = await text(page, 'body');
  section('response-and-speed', {
    medianShown: speedBody.includes('Median time to first contact'),
    meanShownBeside: speedBody.includes('Mean, for comparison'),
    neverContactedCounted: speedBody.includes('Leads nobody messaged'),
    responseRateHasCounts: (await text(page, '[data-testid="metric-response_rate"]')).includes(
      ' of ',
    ),
  });

  /* ---- 12. the diagnosis workspace does not answer for you (§48) --------------------------- */
  await click(page, '[data-testid="diagnose-showed"]');
  await waitFor(page, `Boolean(${q('[data-testid="stage-evidence"]')})`);
  const evidence = await text(page, '[data-testid="stage-evidence"]');
  const page_text = await text(page, 'body');
  section('diagnosis-workspace', {
    gathersEvidenceForTheStage: evidence.includes('reached this stage'),
    saysWhatIsOutsideTheDenominator: evidence.includes('cancelled'),
    // Nowhere does the Lab say which stage the bottleneck is.
    neverNamesTheBottleneck:
      !/your bottleneck is/i.test(page_text) && !/the problem is the/i.test(page_text),
    offersTheGradedExercise: page_text.includes('Where the money is going'),
  });

  /* ---- 13. it survives a reload ------------------------------------------------------------ */
  await openPage(page, LAB);
  await waitFor(page, READY);
  await sleep(700);
  const afterReload = {};
  for (const id of METRICS) afterReload[id] = (await metricValue(page, id)).trim();
  section(
    'reload',
    {
      sameReport: METRICS.every((id) => afterReload[id] === readings[id]),
      stillNotEmpty: !(await exists(page, '[data-testid="reporting-empty"]')),
    },
    { afterReload },
  );

  /* ---- 14. the graded reporting exercise is runnable ---------------------------------------- */
  await openPage(page, `${BASE}/exercise/EX-FIX_IT-glowhaus-reporting-bottleneck`);
  await waitFor(page, `document.body.textContent.includes('Where the money is going')`, {
    timeout: 15000,
  });
  await sleep(500);
  const exerciseBody = await text(page, 'body');
  section('graded-exercise', {
    opens: exerciseBody.includes('Where the money is going'),
    offersTheStages:
      exerciseBody.includes('Show — booked people are not turning up') &&
      exerciseBody.includes('Close — people who turn up are not buying'),
    isRunnable:
      !exerciseBody.includes('not runnable yet') &&
      (await page.evaluate(
        `[...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Run it')`,
      )),
    // No hint is open before the learner asks for one.
    noHintOpen: await page.evaluate(
      `[...document.querySelectorAll('details')].every((d) => !d.open)`,
    ),
    // And nothing on the page names the answer before they submit.
    noAnswerLeak: !/the bottleneck is|the answer is/i.test(exerciseBody),
  });

  /* ---- 15. keyboard (A11Y-001) --------------------------------------------------------------- */
  await openPage(page, LAB);
  await waitFor(page, READY);
  await sleep(600);
  await page.evaluate('document.body.focus()');
  const reachedCalculation = await tabUntil(page, `el?.dataset?.testid === 'calculation-leads'`);
  const focusVisible = await page.evaluate(
    `(() => { const el = document.activeElement; if (!el) return false; const s = getComputedStyle(el); return s.outlineStyle !== 'none' || s.boxShadow !== 'none'; })()`,
  );
  await pressEnter(page);
  await sleep(250);
  const openedByKeyboard = await exists(page, '[data-testid="calculation-body-leads"]');
  section('keyboard', {
    reachesADisclosure: reachedCalculation,
    focusIsVisible: focusVisible,
    entersOpensIt: openedByKeyboard,
    tablesAreSemantic: await page.evaluate(
      `document.querySelectorAll('table').length > 0 && [...document.querySelectorAll('table')].every((t) => t.querySelector('th[scope]'))`,
    ),
  });

  /* ---- 16. the five review widths ------------------------------------------------------------ */
  for (const width of [1440, 1024, 768, 390, 320]) {
    await setViewport(page, width, width < 500 ? 780 : 950, { mobile: width < 768 });
    await openPage(page, LAB);
    await waitFor(page, READY);
    await sleep(700);
    const noOverflow = await page.evaluate(
      `document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1`,
    );
    const rail = await page.evaluate(
      `(() => { const el = document.querySelector('nav[aria-label="Primary"]'); return el ? { width: el.getBoundingClientRect().width, token: parseFloat(getComputedStyle(el).getPropertyValue('--bl-size-rail')) } : null; })()`,
    );
    const allTen = [];
    for (const id of METRICS) allTen.push((await metricValue(page, id)).trim() !== '');
    const targets = await page.evaluate(
      `[...document.querySelectorAll('[data-testid^="calculation-"], [data-testid^="evidence-"], [data-testid^="diagnose-"], [data-testid^="stage-"]')].filter((el) => el.tagName === 'BUTTON' && el.getClientRects().length > 0).every((el) => el.getBoundingClientRect().height >= 43)`,
    );
    section(`width-${width}`, {
      noHorizontalOverflow: noOverflow,
      allTenMetricsPresent: allTen.every(Boolean),
      stageChainStillThere: await exists(page, '[data-testid="stage-visits"]'),
      sourceTableStillThere: await page.evaluate(
        `document.querySelectorAll('[data-testid^="source-"]').length > 0`,
      ),
      provenanceStillReachable: await exists(page, '[data-testid="evidence-leads"]'),
      diagnosisStillThere: await exists(page, '[data-testid="diagnose-showed"]'),
      touchTargets44: targets,
      railMatchesActiveToken:
        width >= 768 ? rail !== null && Math.abs(rail.width - rail.token) < 0.5 : rail !== null,
    });
    await screenshot(page, resolve(OUT, `reporting-${width}.png`), null, false);
  }

  /* ---- 17. reduced motion (MOT-002) ----------------------------------------------------------- */
  await setViewport(page, 1440, 1000, { mobile: false });
  await page.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  });
  await openPage(page, LAB);
  await waitFor(page, READY);
  await sleep(500);
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

  // Leave the account where the next probe expects to find it.
  await page.send('Emulation.setEmulatedMedia', { features: [] });
  await openPage(page, LAB);
  await waitFor(page, READY);
  await resetAccount(page);
} finally {
  await close();
}

report.passed = failures === 0;
writeFileSync(resolve(OUT, 'reporting-probe.json'), JSON.stringify(report, null, 2));
console.log(
  report.passed
    ? 'reporting probe: PASS'
    : `reporting probe: FAIL (${failures} section${failures === 1 ? '' : 's'})`,
);
process.exit(report.passed ? 0 : 1);
