// Drives the Incident Room in a real Chromium with DevTools input (SIM-011, DES-013, A11Y-001,
// RSP-004). It reproduces all nine failures rather than looking for their names: for each one it
// opens the case, runs it, and reads the evidence a learner would read — the skipped step and its
// reason, the response status, the branch comparison, the run that ended failed, the calendar that
// offers nothing. Then the answer-leak check, the keyboard, the five review widths and reduced
// motion. Writes incident-probe.json and incident-*.png to .review/ (override with REVIEW_OUT).
//   BASE=http://localhost:4173 node scripts/review/incident-probe.mjs
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

const CASE_READY = `Boolean(${q('[data-testid="incident-reset"]')})`;

/** Opens one incident and reproduces it, then returns the whole page text and its log rows. */
async function stage(page, scenarioId) {
  await openPage(page, `${BASE}/incident/${scenarioId}`);
  const ready = await waitFor(page, CASE_READY);
  await sleep(400);
  if (await exists(page, '[data-testid="reproduce"]')) {
    await click(page, '[data-testid="reproduce"]');
    await waitFor(page, `!${q('[data-testid="reproduce"]')}`, { timeout: 30000 });
  }
  await sleep(500);
  const body = await text(page, 'body');
  const reasons = await page.evaluate(
    `[...document.querySelectorAll('[data-testid^="log-reason-"]')].map((el) => el.textContent.trim())`,
  );
  return { ready, body, reasons };
}

const { page, close } = await session();
try {
  /* ---- 1. the list, then one case -------------------------------------------------------- */
  await setViewport(page, 1440, 1000, { mobile: false });
  await openPage(page, `${BASE}/incident`);
  const listed = await waitFor(page, `document.body.textContent.includes('Something broke')`);
  await sleep(300);
  const cards = await page.evaluate(`document.querySelectorAll('article, li h2 a').length`);
  section('route-opens', {
    listed,
    nineCases: (await page.evaluate(`document.querySelectorAll('li h2 a').length`)) === 9,
    noAlarmWording: !/critical!!|!!!|urgent!!/i.test(await text(page, 'body')),
  });

  /* ---- 2. the case file, before anything is run (DES-013) -------------------------------- */
  await openPage(page, `${BASE}/incident/SC-glowhaus-incident-missing-phone`);
  await waitFor(page, CASE_READY);
  await sleep(400);
  const opening = await text(page, 'body');
  section('case-file', {
    // All four DES-013 parts, before a fix and before any hint.
    symptom: opening.includes('The symptom'),
    clientComplaint: opening.includes('What the client said'),
    logs: opening.includes('Execution log'),
    systemState: opening.includes('System state'),
    // Nothing is expanded that hands over the answer, and there is no answer to hand over.
    noAnswerLeak:
      !/the problem is|the cause is|the fix is|the answer is/i.test(opening) &&
      !/broken_node|expected_fix/i.test(opening),
    noHintOpen: await page.evaluate(
      `[...document.querySelectorAll('details')].every((d) => !d.open)`,
    ),
  });

  /* ---- 3. no alarm anywhere (DES-013) ---------------------------------------------------- */
  const animations = await page.evaluate(
    `document.getAnimations().filter((a) => a.playState === 'running').length`,
  );
  const monospace = await page.evaluate(
    `[...document.querySelectorAll('*')].filter((el) => /mono|courier|consolas/i.test(getComputedStyle(el).fontFamily)).length`,
  );
  const displayFont = await page.evaluate(
    `/Bricolage/i.test(getComputedStyle(document.querySelector('h1')).fontFamily)`,
  );
  const bodyFont = await page.evaluate(
    `/Inter/i.test(getComputedStyle(document.querySelector('blockquote')).fontFamily)`,
  );
  section(
    'understated',
    {
      nothingAnimating: animations === 0,
      noMonospace: monospace === 0,
      headingsAreBricolage: displayFont,
      logsAreInter: bodyFont,
      noEyebrow: await page.evaluate(
        `[...document.querySelectorAll('*')].every((el) => { const s = getComputedStyle(el); return !(s.textTransform === 'uppercase' && parseFloat(s.fontSize) < 13 && el.textContent.trim().length > 0 && el.children.length === 0); })`,
      ),
    },
    { animations, monospace },
  );
  await screenshot(page, resolve(OUT, 'incident-1440.png'), null, false);

  /* ---- 4 … 12. the nine failures, each reproduced ---------------------------------------- */
  const phone = await stage(page, 'SC-glowhaus-incident-missing-phone');
  section('failure-missing-phone', {
    reproduced: phone.ready,
    theStepRanAndWasSkipped: phone.reasons.some((row) => row.includes('no phone number')),
    noMessageDelivered: phone.body.includes('No message has been delivered'),
    contactShowsTheGap: phone.body.includes('None on the record'),
  });

  const dnd = await stage(page, 'SC-glowhaus-incident-dnd');
  section('failure-dnd', {
    reproduced: dnd.ready,
    skippedForDoNotDisturb: dnd.reasons.some((row) => row.includes('do-not-disturb')),
    // The same symptom as the last one, and a different reason: that is the whole lesson.
    notTheSameAsAMissingNumber: !dnd.reasons.some((row) => row.includes('no phone number')),
    contactHasANumber: dnd.body.includes('+15125550144'),
  });

  const auth = await stage(page, 'SC-glowhaus-incident-webhook-auth');
  section('failure-webhook-auth', {
    reproduced: auth.ready,
    credentialRefused: auth.reasons.some((row) => row.includes('refused the credential')),
    statusShown: auth.body.includes('401'),
    endpointDescribedAsSimulated: auth.body.includes('Bloomlab sends no request'),
    // The token itself is never written anywhere a learner or a log can read it.
    noTokenLeak: !auth.body.includes('rota_live_'),
  });

  const field = await stage(page, 'SC-glowhaus-incident-missing-field');
  section('failure-missing-field', {
    reproduced: field.ready,
    branchDecided: field.body.includes('Branch decided'),
    fellToTheFallback: field.body.includes('Took None'),
    andTookARealBranchForTheOther: field.body.includes('Took laser'),
  });

  const slots = await stage(page, 'SC-glowhaus-incident-no-slots');
  section('failure-unavailable-appointment', {
    reproduced: slots.ready,
    offersNothing: slots.body.includes('no times offered'),
    theTeamIsVisible: slots.body.includes('nobody on the team'),
  });

  const reentry = await stage(page, 'SC-glowhaus-incident-duplicate-enrolment');
  section('failure-duplicate-enrolment', {
    reproduced: reentry.ready,
    secondEnrolmentRefused: reentry.reasons.some((row) => row.includes('re-entry is off')),
    onlyOneRun:
      (await page.evaluate(`document.querySelectorAll('[data-testid^="state-run-"]').length`)) ===
      1,
  });

  const condition = await stage(page, 'SC-glowhaus-incident-bad-condition');
  section('failure-bad-condition', {
    reproduced: condition.ready,
    branchRanRatherThanCrashed: condition.body.includes('Branch decided'),
    memberTookTheFallback: condition.body.includes('Took None'),
    theTagIsOnTheContact: condition.body.includes('membership'),
  });

  const loop = await stage(page, 'SC-glowhaus-incident-workflow-loop');
  const loopRuns = await page.evaluate(
    `document.querySelectorAll('[data-testid^="state-run-"]').length`,
  );
  section(
    'failure-workflow-loop',
    {
      reproduced: loop.ready,
      stoppedByTheEngine: loop.reasons.some((row) => row.includes('Going round')),
      // Bounded: it did not run away, and the browser did not freeze getting here.
      boundedRunCount: loopRuns > 1 && loopRuns <= 25,
      accountSurvives: loop.body.includes('Linus'),
    },
    { loopRuns },
  );

  const integration = await stage(page, 'SC-glowhaus-incident-integration');
  section('failure-integration', {
    reproduced: integration.ready,
    serviceIsUnavailable: integration.reasons.some((row) => row.includes('unavailable')),
    // Told apart from the credential failure by the reason, not by the fact of failing.
    notACredentialProblem: !integration.reasons.some((row) =>
      row.includes('refused the credential'),
    ),
    statusShown: integration.body.includes('503'),
  });

  /* ---- 13. every step, when the learner asks for it ---------------------------------------- */
  await click(page, '[data-testid="log-toggle"]');
  await sleep(300);
  const everyStep = await page.evaluate(
    `document.querySelectorAll('[data-testid^="log-reason-"]').length`,
  );
  section(
    'full-log',
    { showsMoreThanTheDecisions: everyStep > integration.reasons.length },
    { decisions: integration.reasons.length, everyStep },
  );

  /* ---- 14. keyboard (A11Y-001) -------------------------------------------------------------- */
  // On a case that has already been reproduced there is nothing left to run, so put it back
  // first: the action being tabbed to has to actually be on the page.
  await openPage(page, `${BASE}/incident/SC-glowhaus-incident-missing-phone`);
  await waitFor(page, CASE_READY);
  await sleep(400);
  await click(page, '[data-testid="incident-reset"]');
  await waitFor(page, `Boolean(${q('[data-testid="reproduce"]')})`, { timeout: 12000 });
  await sleep(500);
  await page.evaluate('document.body.focus()');
  const reachedRun = await tabUntil(page, `el?.dataset?.testid === 'reproduce'`);
  const focusVisible = await page.evaluate(
    `(() => { const el = document.activeElement; if (!el) return false; const s = getComputedStyle(el); return s.outlineStyle !== 'none' || s.boxShadow !== 'none'; })()`,
  );
  await pressEnter(page);
  const ranByKeyboard = await waitFor(page, `!${q('[data-testid="reproduce"]')}`, {
    timeout: 20000,
  });
  section('keyboard', {
    reachesTheAction: reachedRun,
    focusIsVisible: focusVisible,
    enterRunsIt: ranByKeyboard,
    tablesAreSemantic: await page.evaluate(
      `document.querySelectorAll('table').length > 0 && [...document.querySelectorAll('table')].every((t) => t.querySelector('th[scope]'))`,
    ),
    statusIsNotColourAlone: await page.evaluate(
      `[...document.querySelectorAll('[data-testid^="log-reason-"]')].every((el) => el.textContent.trim().length > 0)`,
    ),
  });

  /* ---- 15. the five review widths ------------------------------------------------------------ */
  for (const width of [1440, 1024, 768, 390, 320]) {
    await setViewport(page, width, width < 500 ? 780 : 950, { mobile: width < 768 });
    await openPage(page, `${BASE}/incident/SC-glowhaus-incident-webhook-auth`);
    await waitFor(page, CASE_READY);
    await sleep(700);
    const body = await text(page, 'body');
    const noOverflow = await page.evaluate(
      `document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1`,
    );
    const rail = await page.evaluate(
      `(() => { const el = document.querySelector('nav[aria-label="Primary"]'); return el ? { width: el.getBoundingClientRect().width, token: parseFloat(getComputedStyle(el).getPropertyValue('--bl-size-rail')) } : null; })()`,
    );
    const targets = await page.evaluate(
      `[...document.querySelectorAll('[data-testid="reproduce"], [data-testid="incident-reset"], [data-testid="log-toggle"], [data-testid^="inject-"]')].filter((el) => el.getClientRects().length > 0).every((el) => el.getBoundingClientRect().height >= 43)`,
    );
    section(`width-${width}`, {
      noHorizontalOverflow: noOverflow,
      symptomStillThere: body.includes('The symptom'),
      complaintStillThere: body.includes('What the client said'),
      logsStillThere: body.includes('Execution log'),
      systemStateStillThere: body.includes('System state'),
      actionsStillThere: await exists(page, '[data-testid="incident-reset"]'),
      touchTargets44: targets,
      railMatchesActiveToken:
        width >= 768 ? rail !== null && Math.abs(rail.width - rail.token) < 0.5 : rail !== null,
    });
    await screenshot(page, resolve(OUT, `incident-${width}.png`), null, false);
  }

  /* ---- 16. reduced motion (MOT-002) ----------------------------------------------------------- */
  await setViewport(page, 1440, 1000, { mobile: false });
  await page.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  });
  await openPage(page, `${BASE}/incident/SC-glowhaus-incident-workflow-loop`);
  await waitFor(page, CASE_READY);
  await sleep(500);
  const stillAnimating = await page.evaluate(
    `document.getAnimations().filter((a) => a.playState === 'running').length`,
  );
  const transitions = await page.evaluate(
    `[...document.querySelectorAll('*')].filter((el) => { const d = getComputedStyle(el).transitionDuration; return d && d !== '0s' && parseFloat(d) > 0.25; }).length`,
  );
  section(
    'reduced-motion',
    { nothingAnimating: stillAnimating === 0, noLongTransitions: transitions === 0 },
    { stillAnimating, transitions, cards },
  );
} finally {
  await close();
}

report.passed = failures === 0;
writeFileSync(resolve(OUT, 'incident-probe.json'), JSON.stringify(report, null, 2));
console.log(
  report.passed
    ? 'incident probe: PASS'
    : `incident probe: FAIL (${failures} section${failures === 1 ? '' : 's'})`,
);
process.exit(report.passed ? 0 : 1);
