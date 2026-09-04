// Drives the Calendar Lab in a real Chromium with DevTools input (CAL-001, CAL-003, A11Y-001,
// RSP-004): change the settings that decide availability and watch the schedule change, add a
// second host and read who the calendar assigned and why, give a service its own length and
// staff, book a time the engine actually offered, confirm it, move it, cancel it, and check that
// a cancellation starts the recovery workflow. Then the shared-account checks, a reload, the
// keyboard, the five review widths with touch, and reduced motion. Writes calendar-probe.json and
// calendar-*.png to .review/ (override with REVIEW_OUT).
//   BASE=http://localhost:4173 node scripts/review/calendar-probe.mjs
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
const text = (page, selector) => page.evaluate(`(${q(selector)}?.textContent ?? '')`);
const click = (page, selector) =>
  page.evaluate(
    `(() => { const el = ${q(selector)}; if (!el) return false; el.scrollIntoView({ block: 'center' }); el.click(); return true; })()`,
  );
const setSelect = (page, selector, value) =>
  page.evaluate(
    `(() => { const el = ${q(selector)}; if (!el) return false; const setter = Object.getOwnPropertyDescriptor(el.__proto__, 'value').set; setter.call(el, ${JSON.stringify(value)}); el.dispatchEvent(new Event('change', { bubbles: true })); return el.value === ${JSON.stringify(value)}; })()`,
  );
const setText = (page, selector, value) =>
  page.evaluate(
    `(() => { const el = ${q(selector)}; if (!el) return false; const setter = Object.getOwnPropertyDescriptor(el.__proto__, 'value').set; setter.call(el, ${JSON.stringify(value)}); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`,
  );
async function waitFor(page, expression, { timeout = 10000, every = 100 } = {}) {
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

/** Enter as the browser's own default action, which is what activates a focused button. */
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
async function tabUntil(page, predicate, limit = 90) {
  for (let step = 0; step < limit; step += 1) {
    await key(page, 'Tab', 'Tab', 9);
    await sleep(25);
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
const rectOf = (page, selector) =>
  page.evaluate(
    `(() => { const el = ${q(selector)}; if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; })()`,
  );

/** The instants the schedule is currently offering, read from the slot buttons themselves. */
const slotTimes = (page) =>
  page.evaluate(
    `[...document.querySelectorAll('[data-testid="calendar-week"] [data-testid^="slot-"]')].map((el) => el.dataset.testid.slice(5))`,
  );

const chain = (page) => text(page, '[data-testid="calendar-chain"]');

const LAB = `${BASE}/calendar`;
const READY = `Boolean(${q('[data-testid="calendar-week"]')})`;

/** Saves, then waits for the account to hold the new version rather than for the button. */
async function save(page) {
  // The button is only enabled once React has taken the edit, so wait for that rather than for a
  // fixed pause: a click on a disabled button is silently nothing.
  await waitFor(page, `${q('[data-testid="calendar-save"]')}?.disabled === false`, {
    timeout: 6000,
  });
  await click(page, '[data-testid="calendar-save"]');
  const ok = await waitFor(
    page,
    `(${q('[data-testid="calendar-save-state"]')}?.textContent ?? '').startsWith('Saved')`,
    { timeout: 8000 },
  );
  if (!ok) {
    console.log('  save-state:', await text(page, '[data-testid="calendar-save-state"]'));
    console.log('  refusal:', await text(page, '[data-testid="calendar-refusal"]'));
  }
  return ok;
}

/** Resets the account so a section starts from the scenario's own beginning. */
async function resetAccount(page) {
  await click(page, '[data-testid="calendar-reset"]');
  await waitFor(page, `Boolean(${q('[data-testid="calendar-reset-confirm"]')})`, { timeout: 4000 });
  await click(page, '[data-testid="calendar-reset-confirm"]');
  await sleep(600);
  return waitFor(page, READY, { timeout: 8000 });
}

const { page, close } = await session();
try {
  /* ---- 1. the route opens on the shared account (CAL-001) -------------------------------- */
  await setViewport(page, 1440, 950, { mobile: false });
  await openPage(page, LAB);
  const ready = await waitFor(page, READY);
  await sleep(300);
  const body = await text(page, 'body');
  section('route-opens', {
    ready,
    onTheAccount: body.includes('Glowhaus'),
    // The two appointments the scenario starts with are drawn on the day they are on.
    showsWhatIsBooked:
      (await exists(page, '[data-testid="appointment-appt-nadia"]')) &&
      (await exists(page, '[data-testid="appointment-appt-marcus"]')),
    fiveSettingGroups:
      (await exists(page, '[data-testid="group-basics"]')) &&
      (await exists(page, '[data-testid="group-availability"]')) &&
      (await exists(page, '[data-testid="group-staff"]')) &&
      (await exists(page, '[data-testid="group-service"]')) &&
      (await exists(page, '[data-testid="group-rules"]')),
    noGamification: !/\bXP\b|\bstars?\b|\blevel \d|\bpoints\b|\bstreak\b/i.test(body),
    noEyebrow: await page.evaluate(
      `[...document.querySelectorAll('*')].every((el) => { const s = getComputedStyle(el); return !(s.textTransform === 'uppercase' && parseFloat(s.fontSize) < 13 && el.textContent.trim().length > 0 && el.children.length === 0); })`,
    ),
    noMonospace: await page.evaluate(
      `[...document.querySelectorAll('*')].every((el) => !/mono|courier|consolas/i.test(getComputedStyle(el).fontFamily))`,
    ),
  });
  await screenshot(page, resolve(OUT, 'calendar-1440.png'), null, false);

  /* ---- 2. the same run every other Lab uses (D-108) -------------------------------------- */
  // Not a claim about stores: the appointment booked here has to be visible in the CRM Lab,
  // because there is one account and one run behind both screens.
  await click(page, '[data-testid="slot-2026-09-09T15:00:00-05:00"]');
  await setSelect(page, '[data-testid="booking-contact"]', 'soraya');
  await click(page, '[data-testid="booking-book"]');
  const sharedBooked = await waitFor(
    page,
    `(${q('[data-testid="calendar-chain"]')}?.textContent ?? '').includes('appointment.booked')`,
    { timeout: 8000 },
  );
  // The Workflow Lab, opened on the same scenario, is the same run: it has to already hold the
  // run the booking's own trigger started.
  await openPage(page, `${BASE}/workflow?scenario=SC-glowhaus-calendar`);
  await waitFor(page, `document.body.textContent.includes('Glowhaus')`, { timeout: 12000 });
  await sleep(900);
  const workflowKnows = await page.evaluate(
    `document.body.textContent.includes('Consultation Reminder')`,
  );
  const workflowRunCount = await page.evaluate(
    `(() => { const m = document.body.textContent.match(/Runs\\s*(\\d+)/); return m ? Number(m[1]) : -1; })()`,
  );
  await openPage(page, LAB);
  await waitFor(page, READY);
  await sleep(400);
  section(
    'shared-run',
    {
      bookedInTheCalendarLab: sharedBooked,
      theWorkflowLabIsTheSameAccount: workflowKnows,
      theBookingsRunIsThere: workflowRunCount !== 0,
      stillHereAfterSwitching: await page.evaluate(
        `document.querySelector('[data-testid="appointments"]').textContent.includes('Soraya')`,
      ),
    },
    { workflowRunCount },
  );
  await resetAccount(page);

  /* ---- 3. duration and slot interval change what is offered (CAL-001) -------------------- */
  const beforeDuration = await slotTimes(page);
  await click(page, '[data-testid="group-basics"]');
  await setText(page, '[data-testid="calendar-duration"]', '60');
  const savedDuration = await save(page);
  await sleep(300);
  const afterDuration = await slotTimes(page);
  section('duration-changes-availability', {
    saved: savedDuration,
    hadHalfHours: beforeDuration.includes('2026-09-08T09:30:00-05:00'),
    nowOnTheHour: !afterDuration.includes('2026-09-08T09:30:00-05:00'),
    stillOffersSomething: afterDuration.length > 0,
    summaryFollows: (await text(page, '[data-testid="calendar-summary"]')).includes('1 hour'),
  });

  /* ---- 4. minimum notice hides what is too soon (CAL-001) -------------------------------- */
  await resetAccount(page);
  await click(page, '[data-testid="group-availability"]');
  await setText(page, '[data-testid="calendar-notice"]', '240');
  const savedNotice = await save(page);
  await sleep(300);
  const afterNotice = await slotTimes(page);
  section('minimum-notice', {
    saved: savedNotice,
    hidesWhatIsTooSoon: !afterNotice.includes('2026-09-08T09:00:00-05:00'),
    offersTheBoundary: afterNotice.includes('2026-09-08T13:00:00-05:00'),
  });

  /* ---- 5. buffers protect the turnover (CAL-001) ----------------------------------------- */
  await resetAccount(page);
  await click(page, '[data-testid="group-availability"]');
  await setText(page, '[data-testid="calendar-pre-buffer"]', '15');
  await setText(page, '[data-testid="calendar-post-buffer"]', '15');
  const savedBuffer = await save(page);
  await sleep(300);
  const afterBuffer = await slotTimes(page);
  section('buffers', {
    saved: savedBuffer,
    // Nadia holds 11:00 and Marcus 11:30. A booking at 10:30 would end with no gap before Nadia.
    blocksTheSlotThatTouches: !afterBuffer.includes('2026-09-08T10:30:00-05:00'),
    keepsTheOneOutside: afterBuffer.includes('2026-09-08T12:30:00-05:00'),
  });

  /* ---- 6. working hours are real (CAL-001) ----------------------------------------------- */
  await resetAccount(page);
  await click(page, '[data-testid="group-availability"]');
  await setText(page, '[data-testid="window-start-0"]', '13:00');
  const savedHours = await save(page);
  await sleep(300);
  const afterHours = await slotTimes(page);
  section('working-hours', {
    saved: savedHours,
    mondayMovedLater: !afterHours.some((at) => at.startsWith('2026-09-14T09')),
    mondayStillOpens: afterHours.some((at) => at.startsWith('2026-09-14T13')),
    tuesdayUntouched: afterHours.includes('2026-09-08T09:00:00-05:00'),
  });

  /* ---- 7. a second host, an assignment rule, and the reason (CAL-001) -------------------- */
  await resetAccount(page);
  await click(page, '[data-testid="group-basics"]');
  await setSelect(page, '[data-testid="calendar-type"]', 'round_robin');
  await click(page, '[data-testid="group-staff"]');
  await setSelect(page, '[data-testid="staff-add"]', 'ivy');
  const savedTeam = await save(page);
  await sleep(400);
  const elevenLabel = await text(page, '[data-testid="slot-2026-09-08T11:00:00-05:00"]');
  await click(page, '[data-testid="slot-2026-09-08T11:00:00-05:00"]');
  await sleep(200);
  const chosenNote = await text(page, '[data-testid="chosen-slot"]');
  section('round-robin', {
    saved: savedTeam,
    // Theo is with Nadia at 11:00, so the 11:00 opening comes back as Ivy's.
    assignsTheFreeOne: elevenLabel.includes('Ivy Chen'),
    saysWhy: /only one free|next free|fewest/.test(chosenNote),
    namesTheHost: chosenNote.includes('Ivy Chen'),
  });
  await screenshot(page, resolve(OUT, 'calendar-round-robin.png'), null, false);

  /* ---- 8. staff selection (CAL-001) ------------------------------------------------------ */
  await click(page, '[data-testid="group-staff"]');
  await setSelect(page, '[data-testid="calendar-staff-selection"]', 'yes');
  const savedSelection = await save(page);
  await sleep(400);
  const staffPicker = await exists(page, '[data-testid="booking-staff"]');
  await setSelect(page, '[data-testid="booking-staff"]', 'theo');
  await sleep(400);
  const theoOnly = await page.evaluate(
    `[...document.querySelectorAll('[data-testid="calendar-week"] [data-testid^="slot-"]')].every((el) => el.textContent.includes('Theo'))`,
  );
  section('staff-selection', {
    saved: savedSelection,
    offersAChoice: staffPicker,
    honoursIt: theoOnly,
  });
  await setSelect(page, '[data-testid="booking-staff"]', '');
  await sleep(300);

  /* ---- 9. a service is behaviour, not a label (CAL-001) ---------------------------------- */
  await resetAccount(page);
  await setSelect(page, '[data-testid="calendar-picker"]', 'treatments');
  await waitFor(page, `Boolean(${q('[data-testid="booking-service"]')})`, { timeout: 6000 });
  await click(page, '[data-testid="group-service"]');
  await waitFor(page, `Boolean(${q('[data-testid="service-duration-signature-facial"]')})`, {
    timeout: 4000,
  });
  await setText(page, '[data-testid="service-duration-signature-facial"]', '90');
  await click(page, '[data-testid="service-staff-signature-facial-ivy"]');
  const savedService = await save(page);
  await sleep(300);
  await setSelect(page, '[data-testid="booking-service"]', 'signature-facial');
  await sleep(500);
  const facialSlots = await slotTimes(page);
  const facialLabel = await page.evaluate(
    `[...document.querySelectorAll('[data-testid="calendar-week"] [data-testid^="slot-"]')].every((el) => el.textContent.includes('Ivy'))`,
  );
  await setSelect(page, '[data-testid="booking-service"]', 'laser-consult');
  await sleep(500);
  const laserSlots = await slotTimes(page);
  section('service-behaviour', {
    saved: savedService,
    someTimesForEach: facialSlots.length > 0 && laserSlots.length > 0,
    // A 90-minute facial cannot start at 17:00 in a day that closes at 18:00; a 60-minute one can.
    lengthNarrowsTheDay:
      !facialSlots.includes('2026-09-08T17:00:00-05:00') &&
      facialSlots.includes('2026-09-08T16:30:00-05:00'),
    otherServiceStillFits: laserSlots.includes('2026-09-08T17:00:00-05:00'),
    staffNarrowed: facialLabel,
  });

  /* ---- 10. booking puts a real event through the shared engine (CAL-003) ----------------- */
  await resetAccount(page);
  await setSelect(page, '[data-testid="calendar-picker"]', 'consultation');
  await waitFor(page, `Boolean(${q('[data-testid="slot-2026-09-10T13:00:00-05:00"]')})`, {
    timeout: 6000,
  });
  await click(page, '[data-testid="slot-2026-09-10T13:00:00-05:00"]');
  await setSelect(page, '[data-testid="booking-contact"]', 'soraya');
  await sleep(200);
  const bookingWhat = await text(page, '[data-testid="booking-what"]');
  await click(page, '[data-testid="booking-book"]');
  const booked = await waitFor(
    page,
    `(${q('[data-testid="calendar-chain"]')}?.textContent ?? '').includes('appointment.booked')`,
    { timeout: 8000 },
  );
  await sleep(400);
  const afterBooking = await chain(page);
  section('booking', {
    booked,
    saysWhatItWillBook: bookingWhat.includes('Theo Marsh'),
    // The reminder enrolled through the trigger. Nothing here injected an enrolment.
    enrolledTheReminder:
      afterBooking.includes('workflow.enrolled') &&
      afterBooking.includes('Consultation Reminder') &&
      afterBooking.includes('caused by it'),
    appointmentIsInTheList: await page.evaluate(
      `document.querySelector('[data-testid="appointments"]').textContent.includes('Soraya')`,
    ),
  });

  const appointmentId = await page.evaluate(
    `(() => { const el = [...document.querySelectorAll('[data-testid^="appointment-row-"]')].find((e) => e.textContent.includes('Soraya')); return el ? el.dataset.testid.slice('appointment-row-'.length) : ''; })()`,
  );

  /* ---- 11. confirmation is a real status path (CAL-001, CAL-003) ------------------------- */
  await click(page, `[data-testid="appointment-row-${appointmentId}"]`);
  await waitFor(page, `Boolean(${q(`[data-testid="confirm-${appointmentId}"]`)})`, {
    timeout: 4000,
  });
  await click(page, `[data-testid="confirm-${appointmentId}"]`);
  const confirmed = await waitFor(
    page,
    `(${q('[data-testid="calendar-chain"]')}?.textContent ?? '').includes('appointment.status_changed')`,
    { timeout: 8000 },
  );
  await sleep(400);
  const afterConfirm = await chain(page);
  section('confirmation', {
    confirmed,
    accountShowsIt: await page.evaluate(
      `document.querySelector('[data-testid="appointments"]').textContent.includes('Confirmed')`,
    ),
    startedTheConfirmedWorkflow: afterConfirm.includes('Confirmed Prep'),
  });

  /* ---- 12. reschedule uses the same engine (CAL-001, CAL-003) ---------------------------- */
  await click(page, '[data-testid="slot-2026-09-11T10:00:00-05:00"]');
  await sleep(200);
  await click(page, `[data-testid="reschedule-${appointmentId}"]`);
  const moved = await waitFor(
    page,
    `(${q('[data-testid="calendar-chain"]')}?.textContent ?? '').includes('appointment.rescheduled')`,
    { timeout: 8000 },
  );
  await sleep(400);
  // While the appointment is still selected the schedule is its move picker, so its own time is
  // offered back — moving it to where it already is has to stay legal. Deselecting returns the
  // ordinary booking view, where the time it holds is taken.
  const timesWhileSelected = await slotTimes(page);
  await click(page, `[data-testid="appointment-row-${appointmentId}"]`);
  await sleep(400);
  const timesAfterMove = await slotTimes(page);
  section('reschedule', {
    moved,
    oldTimeIsFree: timesAfterMove.includes('2026-09-10T13:00:00-05:00'),
    newTimeIsTaken: !timesAfterMove.includes('2026-09-11T10:00:00-05:00'),
    movePickerOffersItsOwnTime: timesWhileSelected.includes('2026-09-11T10:00:00-05:00'),
    listShowsTheNewTime: await page.evaluate(
      `document.querySelector('[data-testid="appointments"]').textContent.includes('11 Sep')`,
    ),
  });

  /* ---- 13. cancellation starts the recovery workflow (CAL-003, D-131) -------------------- */
  // The row may already be open from the reschedule; opening it again would close it.
  if (!(await exists(page, `[data-testid="cancel-${appointmentId}"]`))) {
    await click(page, `[data-testid="appointment-row-${appointmentId}"]`);
    await waitFor(page, `Boolean(${q(`[data-testid="cancel-${appointmentId}"]`)})`, {
      timeout: 4000,
    });
  }
  await click(page, `[data-testid="cancel-${appointmentId}"]`);
  const cancelled = await waitFor(
    page,
    `(${q('[data-testid="calendar-chain"]')}?.textContent ?? '').includes('appointment.cancelled')`,
    { timeout: 8000 },
  );
  await sleep(500);
  const afterCancel = await chain(page);
  const freedTimes = await slotTimes(page);
  section('cancellation', {
    cancelled,
    pulledTheReminderOut: afterCancel.includes('workflow.exited'),
    startedRecovery: afterCancel.includes('Cancellation Recovery'),
    accountShowsCancelled: await page.evaluate(
      `document.querySelector('[data-testid="appointments"]').textContent.includes('Cancelled')`,
    ),
    freesTheTime: freedTimes.includes('2026-09-11T10:00:00-05:00'),
  });
  await screenshot(page, resolve(OUT, 'calendar-lifecycle.png'), null, false);

  /* ---- 14. the Funnel Lab asks the same engine (D-129) ----------------------------------- */
  // The proof has to be end to end: change the calendar in one Lab, and the visitor in the other
  // Lab is offered different times. Both Labs are opened on the same scenario, so the run, the
  // account and the calendar are literally the same objects.
  const FUNNEL_SCENARIO = 'SC-glowhaus-funnel';
  await openPage(page, `${BASE}/calendar?scenario=${FUNNEL_SCENARIO}`);
  await waitFor(page, READY, { timeout: 10000 });
  await sleep(400);
  await click(page, '[data-testid="group-availability"]');
  await setText(page, '[data-testid="calendar-notice"]', '2880');
  const savedForFunnel = await save(page);
  await sleep(300);
  const calendarTimes = await slotTimes(page);

  await openPage(page, `${BASE}/funnel`);
  await waitFor(page, `Boolean(${q('[data-testid="funnel-mode-build"]')})`, { timeout: 10000 });
  await sleep(400);
  await click(page, '[data-testid="funnel-new"]');
  await waitFor(page, `Boolean(${q('[data-testid="funnel-step-name"]')})`, { timeout: 4000 });
  await setText(page, '[data-testid="funnel-step-name"]', 'Pick a time');
  await setSelect(page, '[data-testid="funnel-step-purpose"]', 'booking');
  await click(page, '[data-testid="funnel-step-add"]');
  await waitFor(page, `Boolean(${q('[data-testid="funnel-block-role"]')})`, { timeout: 4000 });
  await setSelect(page, '[data-testid="funnel-block-role"]', 'calendar');
  await click(page, '[data-testid="funnel-block-add"]');
  await waitFor(
    page,
    `[...document.querySelectorAll('[data-testid="funnel-blocks"] [data-role]')].some((el) => el.dataset.role === 'calendar')`,
    { timeout: 4000 },
  );
  await page.evaluate(
    `(() => { const el = [...document.querySelectorAll('[data-testid="funnel-blocks"] [data-role]')].find((e) => e.dataset.role === 'calendar'); if (el) el.click(); })()`,
  );
  await waitFor(page, `Boolean(${q('[data-testid="block-reference"]')})`, { timeout: 4000 });
  await setSelect(page, '[data-testid="block-reference"]', 'consultation');
  await click(page, '[data-testid="funnel-save"]');
  await waitFor(page, `/Saved · version \\d+/.test(document.body.textContent ?? '')`, {
    timeout: 8000,
  });
  await click(page, '[data-testid="funnel-mode-simulate"]');
  await sleep(600);
  const visitorSlots = await page.evaluate(
    `(() => { const el = document.querySelector('[data-testid^="visitor-slot-"]'); return el ? [...el.options].map((o) => o.value) : []; })()`,
  );
  section('funnel-shares-the-engine', {
    calendarSaved: savedForFunnel,
    funnelOffersSomething: visitorSlots.length > 0,
    // Two days of notice on the calendar, and the funnel's visitor honours it — one engine.
    honoursTheNotice: visitorSlots.every((at) => at >= '2026-09-10'),
    sameFirstOpening: visitorSlots[0] === calendarTimes[0],
  });

  /* ---- 15. it survives a reload (CAL-001) ------------------------------------------------ */
  // The calendar changed above was the funnel scenario's, so this reload goes back to that one.
  await openPage(page, `${BASE}/calendar?scenario=${FUNNEL_SCENARIO}`);
  await waitFor(page, READY);
  await sleep(400);
  await click(page, '[data-testid="group-availability"]');
  const noticeAfterReload = await page.evaluate(
    `${q('[data-testid="calendar-notice"]')}?.value ?? ''`,
  );
  section('persistence', {
    keptTheSetting: noticeAfterReload === '2880',
    keptTheVersion: /Saved · version \d+/.test(
      await text(page, '[data-testid="calendar-save-state"]'),
    ),
  });

  /* ---- 16. the keyboard reaches everything (A11Y-001) ------------------------------------ */
  await resetAccount(page);
  const reachedGroup = await tabUntil(page, `el?.dataset?.testid === 'group-availability'`);
  await pressEnter(page);
  await sleep(300);
  const groupOpened = await exists(page, '[data-testid="calendar-notice"]');
  const focusVisible = await page.evaluate(
    `(() => { const el = document.activeElement; if (!el) return false; const s = getComputedStyle(el); return s.outlineStyle !== 'none' || s.boxShadow !== 'none'; })()`,
  );
  const reachedSlot = await tabUntil(page, `el?.dataset?.testid?.startsWith('slot-')`);
  await pressEnter(page);
  await sleep(300);
  const slotChosen = await exists(page, '[data-testid="chosen-slot"]');
  section('keyboard', {
    reachedGroup,
    groupOpened,
    focusVisible,
    reachedSlot,
    slotChosenFromTheKeyboard: slotChosen,
  });

  /* ---- 17. the five review widths (RSP-004) ---------------------------------------------- */
  for (const [width, height] of [
    [1440, 950],
    [1024, 820],
    [768, 1024],
    [390, 844],
    [320, 720],
  ]) {
    const mobile = width <= 768;
    await setViewport(page, width, height, { mobile });
    await openPage(page, LAB);
    await waitFor(page, READY);
    await sleep(500);
    const noOverflow = await page.evaluate(
      'document.documentElement.scrollWidth <= innerWidth + 1',
    );
    const rail = await page.evaluate(
      `(() => { const el = document.querySelector('nav'); if (!el) return null; const r = el.getBoundingClientRect(); return Math.round(${width >= 768 ? 'r.width' : 'r.height'}); })()`,
    );
    let settingsReachable = await exists(page, '[data-testid="group-basics"]');
    if (width < 768) {
      const opener = await rectOf(page, '[data-testid="settings-open"]');
      if (opener) {
        await tap(page, opener.x + opener.w / 2, opener.y + opener.h / 2);
        await sleep(400);
      }
      settingsReachable = await exists(page, '[data-testid="calendar-name"]');
      await key(page, 'Escape', 'Escape', 27);
      await sleep(250);
    }
    // Only what is actually on screen: a control inside a closed sheet has no size to measure.
    const targets = await page.evaluate(
      `[...document.querySelectorAll('[data-testid^="slot-"], [data-testid^="group-"], [data-testid="calendar-save"]')].filter((el) => el.getClientRects().length > 0).every((el) => el.getBoundingClientRect().height >= 43)`,
    );
    const scheduleThere = await exists(page, '[data-testid="calendar-week"]');
    const bookingThere = await page.evaluate(
      `Boolean(document.querySelector('[data-testid="booking-book"]') || document.querySelector('[data-testid="booking-blocked"]'))`,
    );
    const appointmentsThere = await page.evaluate(
      `Boolean(document.querySelector('[data-testid="appointments"]') || document.querySelector('[data-testid="appointments-empty"]'))`,
    );
    section(`width-${width}`, {
      noHorizontalOverflow: noOverflow,
      scheduleStillThere: scheduleThere,
      settingsReachable,
      bookingStillThere: bookingThere,
      appointmentsStillThere: appointmentsThere,
      touchTargets44: targets,
      railUnchanged: width >= 768 ? rail === 104 : rail !== null,
    });
    await screenshot(page, resolve(OUT, `calendar-${width}.png`), null, false);
  }

  /* ---- 18. reduced motion (MOT-002) ------------------------------------------------------ */
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
writeFileSync(resolve(OUT, 'calendar-probe.json'), JSON.stringify(report, null, 2));
console.log(
  report.passed
    ? 'calendar probe: PASS'
    : `calendar probe: FAIL (${failures} section${failures === 1 ? '' : 's'})`,
);
process.exit(report.passed ? 0 : 1);
