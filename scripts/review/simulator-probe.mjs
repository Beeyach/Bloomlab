// Simulator harness review (Phase 10, SIM-006 … SIM-018). Drives the real engine through the
// harness at /system/simulator: the clock moves, an injected event changes the account, the queue
// drains, a checkpoint is taken, a replay is compared, a reload resumes the same run, and the run
// keeps working with the network switched off.
//
//   BASE=http://localhost:4173 node scripts/review/simulator-probe.mjs
import { openPage, session, serviceWorkerSessions, setViewport, sleep } from './cdp.mjs';

const BASE = process.env.BASE ?? 'http://localhost:4173';

const waitFor = async (page, expression, tries = 80) => {
  for (let i = 0; i < tries; i += 1) {
    if (await page.evaluate(`Boolean(${expression})`)) return true;
    await sleep(250);
  }
  return false;
};

/** Reads a labelled value out of the run bar. */
const fact = (label) =>
  `[...document.querySelectorAll('dt')].find((dt) => dt.textContent.trim() === ${JSON.stringify(label)})?.nextElementSibling?.textContent.trim() ?? null`;

/** Waits for the control to exist before clicking it: a deployed host renders slower than localhost. */
const clickButton = async (page, text, tries = 40) => {
  for (let i = 0; i < tries; i += 1) {
    const clicked = await page.evaluate(
      `(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === ${JSON.stringify(text)}); if (!b) return false; b.scrollIntoView({ block: 'center' }); b.click(); return true; })()`,
    );
    if (clicked) {
      await sleep(500);
      return;
    }
    await sleep(250);
  }
  throw new Error(`No button labelled "${text}" after waiting`);
};

const counts = (page) =>
  page.evaluate(`(() => {
    const section = (title) => [...document.querySelectorAll('h2')].find((h) => h.textContent.trim() === title)?.closest('div, section, article')?.parentElement;
    const listUnder = (title) => {
      const heading = [...document.querySelectorAll('h2')].find((h) => h.textContent.trim() === title);
      if (!heading) return 0;
      const container = heading.parentElement;
      const list = container.querySelector('ol, ul');
      return list ? list.children.length : 0;
    };
    void section;
    return {
      queue: listUnder('Scheduled events'),
      log: listUnder('Event log'),
      execution: listUnder('Execution records'),
      snapshots: listUnder('Snapshots and replay'),
    };
  })()`);

const report = { base: BASE, steps: {} };
const { page, browser, close } = await session();

try {
  await setViewport(page, 1280, 900, { mobile: false });
  await openPage(page, `${BASE}/system/simulator?scenario=SC-glowhaus-no-show`);
  const ready = await waitFor(page, "document.querySelector('h1')?.textContent === 'Simulator'");
  report.steps.opened = ready;

  await waitFor(
    page,
    "[...document.querySelectorAll('h2')].some((h) => h.textContent === 'Time machine')",
  );

  // 1. Choose the scenario with a queue and injectable actions, so the probe drives all of it.
  report.steps.scenarios = await page.evaluate(
    "[...document.querySelectorAll('select option')].map((o) => o.value)",
  );
  await page.evaluate(`(() => {
    const select = document.querySelector('select');
    const wanted = [...select.options].find((o) => o.value === 'SC-glowhaus-no-show');
    if (!wanted) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
    setter.call(select, wanted.value);
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  await sleep(900);
  report.steps.scenario = await page.evaluate("document.querySelector('select')?.value ?? null");
  report.steps.startTime = await page.evaluate(fact('Simulator time'));
  report.steps.timezone = await page.evaluate(fact('Timezone'));
  report.steps.engine = await page.evaluate(fact('Engine'));
  report.steps.seed = await page.evaluate(fact('Seed'));
  report.steps.before = await counts(page);

  // 2. The Time Machine moves the clock, and running past a queued event drains the queue.
  await clickButton(page, '+1 minute');
  report.steps.afterMinute = await page.evaluate(fact('Simulator time'));
  await clickButton(page, '+1 hour');
  report.steps.afterHour = await page.evaluate(fact('Simulator time'));
  report.steps.afterHourCounts = await counts(page);
  await clickButton(page, '+1 day');
  report.steps.afterDay = await page.evaluate(fact('Simulator time'));

  // 3. Next Event moves to the earliest queued entry.
  const hasNext = await page.evaluate(
    "!([...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Next event')?.disabled ?? true)",
  );
  report.steps.nextEventAvailable = hasNext;
  if (hasNext) {
    await clickButton(page, 'Next event');
    report.steps.afterNextEvent = await page.evaluate(fact('Simulator time'));
  }
  report.steps.afterTimeTravel = await counts(page);

  // 4. Injecting a scenario action changes the account, and the log records it as injected.
  const action = await page.evaluate(`(() => {
    const heading = [...document.querySelectorAll('h2')].find((h) => h.textContent.trim() === 'Event injector');
    const button = heading?.parentElement?.querySelector('button');
    return button ? button.textContent.trim() : null;
  })()`);
  report.steps.injectorAction = action;
  if (action) {
    await clickButton(page, action);
    report.steps.afterInject = await counts(page);
    report.steps.injectedInLog = await page.evaluate(
      "[...document.querySelectorAll('li')].some((li) => li.textContent.includes('Injected'))",
    );
  }

  // 5. A checkpoint, then a replay compared against the live run.
  await clickButton(page, 'Take a checkpoint');
  report.steps.afterCheckpoint = await counts(page);
  await clickButton(page, 'Replay this run');
  report.steps.replayVerdict = await page.evaluate(
    "document.querySelector('[data-testid=replay-result]')?.textContent.trim() ?? null",
  );

  // 6. A reload resumes the same run at the same time, with the same history.
  const beforeReload = {
    time: await page.evaluate(fact('Simulator time')),
    counts: await counts(page),
  };
  await openPage(page, `${BASE}/system/simulator?scenario=SC-glowhaus-no-show`);
  await waitFor(
    page,
    "[...document.querySelectorAll('h2')].some((h) => h.textContent === 'Time machine')",
  );
  report.steps.reload = {
    before: beforeReload,
    after: { time: await page.evaluate(fact('Simulator time')), counts: await counts(page) },
  };

  // 7. Offline: the engine has no network to lose, so the run must keep working.
  // The shell has to be in the precache before the network goes away, or an offline reload has
  // nothing to load — on a deployed host that install takes longer than the first page view.
  report.steps.serviceWorker = await page.evaluate(`(async () => {
    const registration = await navigator.serviceWorker.ready;
    for (let i = 0; i < 100 && !navigator.serviceWorker.controller; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    const names = await caches.keys();
    let entries = 0;
    for (const name of names) entries += (await (await caches.open(name)).keys()).length;
    return { scope: registration.scope, controlled: !!navigator.serviceWorker.controller, entries };
  })()`);
  const workers = await serviceWorkerSessions(browser, new URL(BASE).origin);
  await page.send('Network.enable');
  await page.send('Network.emulateNetworkConditions', {
    offline: true,
    latency: 0,
    downloadThroughput: 0,
    uploadThroughput: 0,
  });
  await workers?.send?.('Network.enable');
  await workers?.send?.('Network.emulateNetworkConditions', {
    offline: true,
    latency: 0,
    downloadThroughput: 0,
    uploadThroughput: 0,
  });
  await clickButton(page, '+1 hour');
  report.steps.offline = {
    time: await page.evaluate(fact('Simulator time')),
    counts: await counts(page),
    errorShown: await page.evaluate("Boolean(document.querySelector('[role=alert]'))"),
  };
  await openPage(page, `${BASE}/system/simulator?scenario=SC-glowhaus-no-show`);
  await waitFor(
    page,
    "[...document.querySelectorAll('h2')].some((h) => h.textContent === 'Time machine')",
  );
  report.steps.offlineReload = {
    time: await page.evaluate(fact('Simulator time')),
    counts: await counts(page),
  };
  await page.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
  });

  // 8. Reset returns the run to the scenario's authored beginning, and that survives a reload.
  await clickButton(page, 'Reset to the start');
  report.steps.afterReset = {
    time: await page.evaluate(fact('Simulator time')),
    counts: await counts(page),
  };
  await openPage(page, `${BASE}/system/simulator?scenario=SC-glowhaus-no-show`);
  await waitFor(
    page,
    "[...document.querySelectorAll('h2')].some((h) => h.textContent === 'Time machine')",
  );
  report.steps.afterResetReload = {
    time: await page.evaluate(fact('Simulator time')),
    counts: await counts(page),
  };

  // 9. No monospace and no tiny uppercase label anywhere on the page (DES-024, DES-025).
  report.steps.typography = await page.evaluate(`(() => {
    const bad = { mono: [], eyebrow: [] };
    const rail = document.querySelector('nav[aria-label=Primary]');
    for (const el of document.querySelectorAll('main *, body > div > *')) {
      if (rail && rail.contains(el)) continue;
      const s = getComputedStyle(el);
      if (/mono|Courier|Consolas/i.test(s.fontFamily)) bad.mono.push(el.tagName + '.' + el.className);
      if (s.textTransform === 'uppercase' && parseFloat(s.fontSize) < 13 && el.textContent.trim().length > 0) {
        bad.eyebrow.push(el.tagName + '.' + el.className);
      }
    }
    return { mono: [...new Set(bad.mono)].slice(0, 8), eyebrow: [...new Set(bad.eyebrow)].slice(0, 8) };
  })()`);

  // 10. Keyboard: every control is reachable and operable without a pointer (A11Y-004).
  report.steps.keyboard = await page.evaluate(`(() => {
    const focusable = [...document.querySelectorAll('button, select, a[href]')].filter(
      (el) => !el.disabled && el.offsetParent !== null,
    );
    const small = focusable
      .map((el) => ({ label: (el.textContent || el.tagName).trim().slice(0, 28), rect: el.getBoundingClientRect() }))
      .filter((item) => item.rect.height < 44 || item.rect.width < 44)
      .map((item) => item.label + ' ' + Math.round(item.rect.width) + 'x' + Math.round(item.rect.height));
    return { focusable: focusable.length, under44: small };
  })()`);
  report.steps.hOverflow = await page.evaluate('document.documentElement.scrollWidth > innerWidth');
} finally {
  await close();
}

console.log(JSON.stringify(report, null, 2));
