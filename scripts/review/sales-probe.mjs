// Drives the selling families in a real Chromium with DevTools input (EXR-012 … EXR-018,
// CONV-002, SAL-001 … SAL-013, A11Y-001, RSP-004). It does the work a learner would do: judges
// three businesses, writes findings and gets held to three labels, writes to a cap, explains the
// same system twice, and holds a thread with a client that answers back. Then the five review
// widths, the keyboard path and reduced motion. Writes sales-probe.json and sales-*.png to
// .review/ (override with REVIEW_OUT).
//   BASE=http://localhost:4173 node scripts/review/sales-probe.mjs
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

const PROSPECT = 'EX-PROSPECT_IT-three-businesses';
const AUDIT = 'EX-AUDIT_IT-northwind-outside-in';
const COLD_EMAIL = 'EX-WRITE_IT-northwind-cold-email';
const CLIENT_COMMS = 'EX-WRITE_IT-glowhaus-slipped-date';
const EXPLAIN = 'EX-EXPLAIN_IT-no-show-system';
const DISCOVERY = 'EX-WRITE_IT-summit-written-discovery';
const CLOSING = 'EX-WRITE_IT-summit-after-the-proposal';

const q = (selector) => `document.querySelector(${JSON.stringify(selector)})`;
const at = (testid) => q(`[data-testid="${testid}"]`);
const exists = (page, testid) => page.evaluate(`Boolean(${at(testid)})`);
const text = (page, selector) => page.evaluate(`(${q(selector)}?.textContent ?? '')`);
const valueOf = (page, testid) => page.evaluate(`(${at(testid)}?.value ?? null)`);
const click = (page, testid) =>
  page.evaluate(
    `(() => { const el = ${at(testid)}; if (!el) return false; el.scrollIntoView({ block: 'center' }); el.click(); return true; })()`,
  );

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

async function tabUntil(page, predicate, limit = 150) {
  for (let step = 0; step < limit; step += 1) {
    await key(page, 'Tab', 'Tab', 9);
    await sleep(15);
    if (
      await page.evaluate(`(() => { const el = document.activeElement; return ${predicate}; })()`)
    )
      return true;
  }
  return false;
}

/** Opens an exercise and waits for its work area. */
async function open(page, id, readyTestId) {
  await openPage(page, `${BASE}/exercise/${id}`);
  const ready = await waitFor(page, `Boolean(${at(readyTestId)})`);
  await sleep(300);
  return ready;
}

/**
 * Starts from nothing, so a second branch of the same thread is a second attempt rather than a
 * continuation of the first. Cleared through the protocol, because the page holds the connection.
 */
async function reset(page) {
  await page.send('Storage.clearDataForOrigin', {
    origin: new URL(BASE).origin,
    storageTypes: 'indexeddb',
  });
  await sleep(250);
}

const { page, close } = await session();
try {
  await setViewport(page, 1440, 1000, { mobile: false });

  /* ---- 1. PROSPECT IT: three businesses, three answers (EXR-012) -------------------------- */
  await reset(page);
  const prospectReady = await open(page, PROSPECT, 'prospect-desk');
  const tabCount = await page.evaluate(
    `document.querySelectorAll('[data-testid^="prospect-tab-"]').length`,
  );
  const decisionCount = await page.evaluate(
    `document.querySelectorAll('[data-testid^="decision-"]').length`,
  );
  const body1 = await text(page, 'body');
  section('prospect-opens', {
    ready: prospectReady,
    threeBusinesses: tabCount === 3,
    threeAnswersOnly: decisionCount === 3,
    contactMaybeSkip:
      body1.includes('Contact') && body1.includes('Maybe') && body1.includes('Skip'),
    noHiddenEvaluation:
      !body1.includes('acceptable_decisions') && !body1.includes('strongest_decision'),
    // Gamification means a score to collect. "points at a landing page" is ordinary English.
    noGamification: !/\bXP\b|\b\d+\s*points\b|earn(ed)? points|\bstreak\b|level up|superstar/i.test(
      body1,
    ),
  });
  await screenshot(page, resolve(OUT, 'sales-prospect-1440.png'), null, false);

  /* ---- 2. a justified Skip, by keyboard where it counts (SAL-002, A11Y-001) --------------- */
  await click(page, 'prospect-tab-CL-halcyon-yoga');
  await sleep(200);
  // A radio group takes one tab stop and moves inside itself with the arrow keys, which is what
  // a keyboard user actually does.
  const reachedSkip = await tabUntil(
    page,
    `el.getAttribute('data-testid') === 'decision-CL-halcyon-yoga-contact'`,
  );
  await key(page, 'ArrowDown', 'ArrowDown', 40);
  await key(page, 'ArrowDown', 'ArrowDown', 40);
  await sleep(150);
  const skipChecked = await page.evaluate(
    `${at('decision-CL-halcyon-yoga-skip')}?.checked === true`,
  );
  await click(page, 'axis-CL-halcyon-yoga-economics');
  await click(page, 'axis-CL-halcyon-yoga-technical_fit');
  await click(page, 'cite-prospect-CL-halcyon-yoga-ev-hy-prices');
  await click(page, 'cite-prospect-CL-halcyon-yoga-ev-hy-app');
  await type(
    page,
    'reason-CL-halcyon-yoga',
    'Eighteen-dollar classes, and the booking runs in an app the studio cannot change.',
  );
  await sleep(400);
  section('prospect-skip', {
    keyboardReachedTheDecision: reachedSkip,
    keyboardSelectedIt: skipChecked,
    axesRecorded: await page.evaluate(`${at('axis-CL-halcyon-yoga-economics')}?.checked === true`),
    evidenceRecorded: await page.evaluate(
      `${at('cite-prospect-CL-halcyon-yoga-ev-hy-prices')}?.checked === true`,
    ),
    reasonRecorded:
      (await valueOf(page, 'reason-CL-halcyon-yoga'))?.startsWith('Eighteen-dollar') === true,
    tabShowsTheAnswer: (await text(page, '[data-testid="prospect-tab-CL-halcyon-yoga"]')).includes(
      'Skip',
    ),
  });

  /* ---- 3. it is still there after a reload (§52) ------------------------------------------ */
  await open(page, PROSPECT, 'prospect-desk');
  await click(page, 'prospect-tab-CL-halcyon-yoga');
  await sleep(300);
  section('prospect-reload', {
    decisionKept: await page.evaluate(`${at('decision-CL-halcyon-yoga-skip')}?.checked === true`),
    reasonKept:
      (await valueOf(page, 'reason-CL-halcyon-yoga'))?.startsWith('Eighteen-dollar') === true,
    evidenceKept: await page.evaluate(
      `${at('cite-prospect-CL-halcyon-yoga-ev-hy-app')}?.checked === true`,
    ),
  });

  /* ---- 4. AUDIT IT: three labels and nothing else (EXR-013) ------------------------------- */
  await reset(page);
  const auditReady = await open(page, AUDIT, 'audit-desk');
  await click(page, 'finding-add');
  await waitFor(page, `Boolean(${at('finding-claim-0')})`);
  const labels = await page.evaluate(
    `[...document.querySelectorAll('[data-testid^="finding-0-"]')].map((el) => el.value).join(',')`,
  );
  const auditBody = await text(page, 'body');
  section('audit-classifications', {
    ready: auditReady,
    onlyThree: labels === 'verified,likely,unknown',
    noFourthOption: !/\bConfirmed\b|\bAssumed\b|\bProbable\b|\bGuess\b|\bOther\b/.test(auditBody),
    evidenceShown: auditBody.includes('22 hours'),
    // The scenario's hidden facts are not in the evidence pack (§40).
    noHiddenFacts: !auditBody.includes("Tina's inbox only"),
  });

  /* ---- 5. an unsupported Verified is said so, on the spot (SAL-001) ----------------------- */
  await type(page, 'finding-claim-0', 'They never follow up an unsold quote.');
  await click(page, 'finding-0-verified');
  await sleep(300);
  const unsupportedNote = await text(page, '[data-testid="finding-note-0"]');
  await click(page, 'cite-finding-0-ev-nw-reply-22h');
  await sleep(300);
  const afterEvidence = await exists(page, 'finding-note-0');
  section('audit-unsupported-verified', {
    saidSo: /nothing you saw yourself/i.test(unsupportedNote),
    clearsWhenEvidenceIsCited: afterEvidence === false,
  });

  /* ---- 6. an Unknown is asked what would settle it ---------------------------------------- */
  await click(page, 'finding-add');
  await waitFor(page, `Boolean(${at('finding-claim-1')})`);
  await type(page, 'finding-claim-1', 'Nobody chases a quote after the technician leaves.');
  const planBefore = await exists(page, 'finding-plan-1');
  await click(page, 'finding-1-unknown');
  await sleep(250);
  const planAfter = await exists(page, 'finding-plan-1');
  await type(page, 'finding-plan-1', 'Ask Tina what happens to a quote after the visit.');
  await sleep(300);
  section('audit-unknown', {
    noPlanAskedForBefore: planBefore === false,
    planAskedForAfter: planAfter,
    noteClears: (await exists(page, 'finding-note-1')) === false,
  });

  /* ---- 7. the findings survive a reload --------------------------------------------------- */
  await open(page, AUDIT, 'audit-desk');
  section('audit-reload', {
    firstFindingKept:
      (await valueOf(page, 'finding-claim-0'))?.startsWith('They never follow up') === true,
    secondFindingKept:
      (await valueOf(page, 'finding-claim-1'))?.startsWith('Nobody chases') === true,
    labelKept: await page.evaluate(`${at('finding-1-unknown')}?.checked === true`),
  });
  await screenshot(page, resolve(OUT, 'sales-audit-1440.png'), null, false);

  /* ---- 8. WRITE IT: the cap, the next step, the citation (EXR-014, SAL-003) --------------- */
  await reset(page);
  const emailReady = await open(page, COLD_EMAIL, 'write-initial_email');
  await type(page, 'write-initial_email', 'word '.repeat(130));
  await sleep(300);
  const over = await text(page, '[data-testid="count-initial_email"]');
  await type(
    page,
    'write-initial_email',
    'Gary, your form took 22 hours to answer my enquiry on Wednesday. Two competitors let people call straight from the ad. Worth fifteen minutes on Thursday?',
  );
  await sleep(300);
  const under = await text(page, '[data-testid="count-initial_email"]');
  await type(page, 'next-step-initial_email', 'Fifteen minutes on Thursday');
  await click(page, 'cite-cite-initial_email-ev-nw-reply-22h');
  await type(
    page,
    'write-follow_up',
    'One thing I did not send last week: the form on your ads page has no phone number on it at all.',
  );
  await type(page, 'next-step-follow_up', 'Reply yes or no');
  await sleep(400);
  const emailBody = await text(page, 'body');
  section('write-cold-email', {
    ready: emailReady,
    bothMessagesAsked: emailBody.includes('The first email') && emailBody.includes('The follow-up'),
    capEnforcedOnScreen: /Over the cap: 130 words/.test(over),
    countUpdates: /of 120 words/.test(under),
    nextStepAsked: await exists(page, 'next-step-initial_email'),
    evidenceCited: await page.evaluate(
      `${at('cite-cite-initial_email-ev-nw-reply-22h')}?.checked === true`,
    ),
    noAiWriting: !/generate|improve with ai|rewrite this|write it for you/i.test(emailBody),
  });
  await screenshot(page, resolve(OUT, 'sales-write-1440.png'), null, false);

  /* ---- 9. the draft survives a reload ------------------------------------------------------ */
  await open(page, COLD_EMAIL, 'write-initial_email');
  section('write-reload', {
    emailKept: (await valueOf(page, 'write-initial_email'))?.startsWith('Gary,') === true,
    followUpKept: (await valueOf(page, 'write-follow_up'))?.startsWith('One thing') === true,
    nextStepKept:
      (await valueOf(page, 'next-step-initial_email')) === 'Fifteen minutes on Thursday',
  });

  /* ---- 10. the client-communication briefs are real work areas too (SAL-013) --------------- */
  const commsReady = await open(page, CLIENT_COMMS, 'write-delay');
  const commsBody = await text(page, 'body');
  section('write-client-communication', {
    ready: commsReady,
    delayAsked: commsBody.includes('The delay message'),
    approvalAsked: await exists(page, 'write-approval'),
    typesNamed: commsBody.includes('Delay') && commsBody.includes('Approval request'),
  });

  /* ---- 11. EXPLAIN IT: two audiences, kept apart (EXR-018) --------------------------------- */
  const explainReady = await open(page, EXPLAIN, 'write-owner');
  await type(
    page,
    'write-owner',
    'When somebody does not turn up, they get a message the next morning asking if they want to rebook. It costs you two empty chairs a week today.',
  );
  await type(
    page,
    'write-builder',
    'The appointment status changed trigger fires on no-show only, with re-entry off so nobody gets it twice.',
  );
  await sleep(400);
  section('explain-two-audiences', {
    ready: explainReady,
    ownerAsked: await exists(page, 'write-owner'),
    builderAsked: await exists(page, 'write-builder'),
    keptApart: (await valueOf(page, 'write-owner')) !== (await valueOf(page, 'write-builder')),
    ownerCap: (await text(page, '[data-testid="count-owner"]')).includes('of 150 words'),
  });

  /* ---- 12. the thread: one branch (CONV-002) ---------------------------------------------- */
  await reset(page);
  const threadReady = await open(page, DISCOVERY, 'client-thread');
  const openingText = await text(page, '[data-testid="thread-messages"]');
  await click(page, 'move-ask_process');
  await type(page, 'thread-composer', 'What happens today when someone applies?');
  await click(page, 'thread-send');
  const replied = await waitFor(page, `document.body.textContent.includes('lands in my inbox')`);
  const threadBody = await text(page, 'body');
  section('thread-branch-a', {
    ready: threadReady,
    opensOnTheClient: openingText.includes('between client blocks'),
    clientReplied: replied,
    learnerMessageKept: threadBody.includes('What happens today when someone applies?'),
    noCorrectBanner: !/\bcorrect\b/i.test(threadBody),
    noVerdict: !/well done|good job|nice work|great answer/i.test(threadBody),
  });
  await screenshot(page, resolve(OUT, 'sales-thread-1440.png'), null, false);

  /* ---- 13. it is still there after a reload (§31) ------------------------------------------ */
  await open(page, DISCOVERY, 'client-thread');
  const afterReload = await text(page, '[data-testid="thread-messages"]');
  section('thread-persists', {
    priorMessagesKept:
      afterReload.includes('What happens today when someone applies?') &&
      afterReload.includes('lands in my inbox'),
    composerEmpty: (await valueOf(page, 'thread-composer')) === '',
    stillOpen: await exists(page, 'thread-send'),
  });

  /* ---- 14. a different move reaches a different reply -------------------------------------- */
  await reset(page);
  await open(page, DISCOVERY, 'client-thread');
  await click(page, 'move-pitch_first');
  await type(
    page,
    'thread-composer',
    'I would build you an application funnel with qualification.',
  );
  await click(page, 'thread-send');
  const pushedBack = await waitFor(
    page,
    `document.body.textContent.includes('You have not asked me a single thing')`,
  );
  section('thread-branch-b', {
    differentReply: pushedBack,
    notTheOtherBranch: !(await text(page, 'body')).includes('lands in my inbox'),
  });

  /* ---- 15. sending without saying what you are doing ---------------------------------------- */
  await reset(page);
  await open(page, DISCOVERY, 'client-thread');
  await type(page, 'thread-composer', 'Hi Marcus.');
  await click(page, 'thread-send');
  const askedBack = await waitFor(
    page,
    `document.body.textContent.includes('not sure what you are asking me')`,
  );
  section('thread-fallback', {
    clientAsksWhatWasMeant: askedBack,
    markedUnclassified: (await text(page, 'body')).includes(
      'Sent without saying what you were doing',
    ),
  });

  /* ---- 16. closing: chase, then ask for the decision (SAL-008) ------------------------------ */
  await reset(page);
  const closingReady = await open(page, CLOSING, 'client-thread');
  const silence = await text(page, '[data-testid="thread-messages"]');
  await click(page, 'move-follow_up_with_something');
  await type(page, 'thread-composer', 'One thing I did not send you before, and then I will stop.');
  await click(page, 'thread-send');
  await waitFor(page, `document.body.textContent.includes('inside a launch')`);
  await click(page, 'move-ask_commitment');
  await type(page, 'thread-composer', 'Can you decide either way this week?');
  await click(page, 'thread-send');
  await waitFor(page, `document.body.textContent.includes('What do you need from me to start')`);
  await click(page, 'move-set_the_start');
  await type(page, 'thread-composer', 'Tuesday at nine, and I need the form login before then.');
  await click(page, 'thread-send');
  const finished = await waitFor(page, `Boolean(${at('thread-closed')})`);
  section('thread-closing', {
    ready: closingReady,
    opensOnTheSilence: silence.includes('nine days ago'),
    reachedADecision: finished,
    endsWithoutAVerdict: (await text(page, '[data-testid="thread-closed"]')).includes(
      'This thread is finished',
    ),
    noCorrectBanner: !/\bcorrect\b/i.test(await text(page, 'body')),
  });

  /* ---- 17. the five review widths (RSP-004) ------------------------------------------------ */
  for (const width of [1440, 1024, 768, 390, 320]) {
    await setViewport(page, width, width < 500 ? 780 : 950, { mobile: width < 768 });
    await open(page, AUDIT, 'audit-desk');
    await click(page, 'finding-add');
    await waitFor(page, `Boolean(${at('finding-claim-0')})`);
    await sleep(400);
    const noOverflow = await page.evaluate(
      `document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1`,
    );
    const inputs16 = await page.evaluate(
      `[...document.querySelectorAll('textarea, input[type="text"]')].filter((el) => el.getClientRects().length > 0).every((el) => parseFloat(getComputedStyle(el).fontSize) >= 16)`,
    );
    const targets = await page.evaluate(
      `[...document.querySelectorAll('[data-testid^="finding-"], [data-testid^="cite-"], [data-testid="finding-add"]')].map((el) => el.closest('label, button, section') ?? el).filter((el) => el.getClientRects().length > 0).every((el) => el.getBoundingClientRect().height >= 43)`,
    );
    const rail = await page.evaluate(
      `(() => { const el = document.querySelector('nav[aria-label="Primary"]'); return el ? { width: el.getBoundingClientRect().width, token: parseFloat(getComputedStyle(el).getPropertyValue('--bl-size-rail')) } : null; })()`,
    );
    section(`width-${width}`, {
      noHorizontalOverflow: noOverflow,
      evidenceStillThere: (await text(page, 'body')).includes('22 hours'),
      composerStillThere: await exists(page, 'finding-claim-0'),
      classificationsStillThere: await exists(page, 'finding-0-verified'),
      inputsAtLeast16px: inputs16,
      touchTargets44: targets,
      railMatchesActiveToken:
        width >= 768 ? rail !== null && Math.abs(rail.width - rail.token) < 0.5 : rail !== null,
    });
    await screenshot(page, resolve(OUT, `sales-${width}.png`), null, false);
  }

  /* ---- 18. the thread on a phone ------------------------------------------------------------ */
  await setViewport(page, 390, 780, { mobile: true });
  await reset(page);
  await open(page, DISCOVERY, 'client-thread');
  await click(page, 'move-ask_process');
  await type(page, 'thread-composer', 'How does it work today?');
  await click(page, 'thread-send');
  const phoneReplied = await waitFor(
    page,
    `document.body.textContent.includes('lands in my inbox')`,
  );
  section('thread-phone', {
    composerUsable: phoneReplied,
    noHorizontalOverflow: await page.evaluate(
      `document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1`,
    ),
    sendIsATarget: await page.evaluate(
      `${at('thread-send')}?.getBoundingClientRect().height >= 43`,
    ),
  });
  await screenshot(page, resolve(OUT, 'sales-thread-390.png'), null, false);

  /* ---- 19. keyboard through the whole thread ------------------------------------------------ */
  await setViewport(page, 1440, 1000, { mobile: false });
  await reset(page);
  await open(page, DISCOVERY, 'client-thread');
  const reachedMove = await tabUntil(page, `el.getAttribute('data-testid') === 'move-set_agenda'`);
  const focusRing = await page.evaluate(
    `(() => { const el = document.activeElement.closest('label') ?? document.activeElement; const s = getComputedStyle(el, ':focus-visible'); return s.outlineStyle !== 'none' || s.boxShadow !== 'none'; })()`,
  );
  await key(page, 'ArrowDown', 'ArrowDown', 40);
  await sleep(150);
  const chosen = await page.evaluate(`${at('move-ask_process')}?.checked === true`);
  const reachedComposer = await tabUntil(
    page,
    `el.getAttribute('data-testid') === 'thread-composer'`,
  );
  section('keyboard', {
    reachedTheMove: reachedMove,
    focusIsVisible: focusRing,
    selectedWithTheKeyboard: chosen,
    reachedTheComposer: reachedComposer,
  });

  /* ---- 20. reduced motion (MOT-002) --------------------------------------------------------- */
  await page.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  });
  await open(page, PROSPECT, 'prospect-desk');
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
writeFileSync(resolve(OUT, 'sales-probe.json'), JSON.stringify(report, null, 2));
console.log(
  report.passed
    ? 'sales probe: PASS'
    : `sales probe: FAIL (${failures} section${failures === 1 ? '' : 's'})`,
);
process.exit(report.passed ? 0 : 1);
