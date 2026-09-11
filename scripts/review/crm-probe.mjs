// CRM Lab review (Phase 11, CRM-001 … CRM-004). Drives the real Lab at /crm against a built
// preview: open the training account, work in it the way a learner would, reload, work offline,
// reload offline, reconnect, reset, work again, and reload once more — checking at every step that
// what was done is still there and came from the simulator rather than from React state.
//
//   BASE=http://localhost:4173 node scripts/review/crm-probe.mjs
import { openPage, session, serviceWorkerSessions, setViewport, sleep } from './cdp.mjs';

const BASE = process.env.BASE ?? 'http://localhost:4173';

const report = { base: BASE, steps: {}, failures: [] };
const { page, browser, close } = await session();

const waitFor = async (expression, tries = 80) => {
  for (let i = 0; i < tries; i += 1) {
    if (await page.evaluate(`Boolean(${expression})`)) return true;
    await sleep(250);
  }
  return false;
};

const text = () => page.evaluate('document.body.innerText');
const has = async (needle) => (await text()).includes(needle);

/** Clicks the first element matching a selector, reporting whether there was one. */
const click = (selector) =>
  page.evaluate(
    `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; el.scrollIntoView({ block: 'center' }); el.click(); return true; })()`,
  );

/** Clicks a control by its visible text, which is how a learner finds it. */
const clickText = (tag, label) =>
  page.evaluate(
    `(() => { const el = [...document.querySelectorAll(${JSON.stringify(tag)})].find((x) => x.textContent.trim() === ${JSON.stringify(label)}); if (!el) return false; el.scrollIntoView({ block: 'center' }); el.click(); return true; })()`,
  );

/** Types into a control and fires the event React listens for. */
const fill = (selector, value) =>
  page.evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return false;
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype
      : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)});
    el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
    return true;
  })()`);

const submit = (selector) =>
  page.evaluate(
    `(() => { const el = document.querySelector(${JSON.stringify(selector)}); const form = el?.closest('form'); if (!form) return false; form.requestSubmit(); return true; })()`,
  );

const openCrm = async (query = '') => {
  await openPage(page, `${BASE}/crm${query}`);
  return waitFor("document.querySelector('[data-contact]')");
};

const check = (name, condition) => {
  report.steps[name] = condition;
  if (!condition) report.failures.push(name);
  return condition;
};

try {
  await setViewport(page, 1440, 950, { mobile: false });

  // 1–3. Open the Lab, resume the training account, select a contact.
  check('opened', await openCrm());
  report.steps.contacts = await page.evaluate("document.querySelectorAll('[data-contact]').length");
  check('resumedAccount', report.steps.contacts > 0);
  check('selectedContact', await click('[data-contact="maria"]'));
  await sleep(500);
  check('detailOpened', await has('Do not disturb'));

  // 4. Edit a contact field: do-not-disturb is one click and one event.
  const dndBefore = await has('On — no outbound messages');
  await clickText('button', dndBefore ? 'Turn off' : 'Turn on');
  await sleep(600);
  check('editedContactField', (await has('On — no outbound messages')) !== dndBefore);

  // 5. Assign an owner.
  await page.evaluate(`(() => {
    const sel = [...document.querySelectorAll('select')].find((s) => [...s.options].some((o) => /Dana/.test(o.textContent)));
    if (!sel) return false;
    const dana = [...sel.options].find((o) => /Dana/.test(o.textContent));
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(sel, dana.value);
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  await sleep(600);
  check('assignedOwner', await has('Dana Okafor'));

  // 6. Add a tag.
  await fill('input[list]', 'crm-probe');
  await submit('input[list]');
  await sleep(600);
  check('addedTag', await has('crm-probe'));

  // 7–8. Define a custom field in Setup, then set its value back on the contact.
  await openCrm('?area=setup');
  await waitFor("document.body.innerText.includes('Custom Fields')");
  await page.evaluate(`(() => {
    const inputs = [...document.querySelectorAll('form input')];
    const set = (el, v) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); };
    set(inputs[0], 'Probe field');
    set(inputs[1], 'probe_field');
    return true;
  })()`);
  await clickText('button', 'Define field');
  await sleep(700);
  check('definedField', await has('probe_field'));

  await openCrm('?area=contacts&record=maria');
  await sleep(500);
  const setValue = await page.evaluate(`(() => {
    const labels = [...document.querySelectorAll('label')];
    const label = labels.find((l) => l.textContent.trim() === 'Probe field');
    const input = label ? document.getElementById(label.getAttribute('for')) : null;
    if (!input) return false;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'probe value');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('blur', { bubbles: true }));
    return true;
  })()`);
  await sleep(700);
  check('setFieldValue', setValue);

  // 9. A note.
  await clickText('button', 'Notes');
  await sleep(300);
  await fill('textarea', 'Probe note.');
  await submit('textarea');
  await sleep(600);
  check('addedNote', await has('Probe note.'));

  // 10–11. A task, then completing it.
  await clickText('button', 'Tasks');
  await sleep(300);
  await page.evaluate(`(() => {
    const label = [...document.querySelectorAll('label')].find((l) => l.textContent.trim().startsWith('New task'));
    const input = label ? document.getElementById(label.getAttribute('for')) : null;
    if (!input) return false;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'Probe task');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.closest('form').requestSubmit();
    return true;
  })()`);
  await sleep(700);
  check('createdTask', await has('Probe task'));
  await clickText('button', 'Complete');
  await sleep(700);
  check('completedTask', await has('Probe task — done'));

  // 12. A new opportunity, created from the contact.
  await clickText('button', 'Record');
  await sleep(300);
  await clickText('button', 'New opportunity');
  await sleep(400);
  await clickText('button', 'Create opportunity');
  await sleep(800);
  report.steps.opportunityCount = await page.evaluate(`(() => {
    return document.body.innerText.split('Consultations').length - 1;
  })()`);
  check('createdOpportunity', report.steps.opportunityCount > 0);

  // 13. A stage move — through the picker, which is the keyboard and touch path.
  await openCrm('?area=pipeline');
  await waitFor("document.querySelector('[data-opportunity]')");
  await click('[data-opportunity="opp-maria"]');
  await waitFor("document.body.innerText.includes('Opportunity owner')");
  const moved = await page.evaluate(`(() => {
    const sel = [...document.querySelectorAll('select')].find((s) => [...s.options].some((o) => o.value === 'Consult Done'));
    if (!sel) return false;
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(sel, 'Consult Done');
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  await sleep(800);
  check('movedStageWithoutDrag', moved);

  // 14–15. Reload: every one of those must still be there, and be in the history.
  await openCrm('?area=contacts&record=maria');
  await waitFor("document.body.innerText.includes('crm-probe')");
  report.steps.afterReload = await page.evaluate(`(() => ({
    tag: document.body.innerText.includes('crm-probe'),
    owner: document.body.innerText.includes('Dana Okafor'),
  }))()`);
  check('persistedAcrossReload', report.steps.afterReload.tag && report.steps.afterReload.owner);

  await clickText('button', 'Activity');
  await sleep(500);
  const history = await text();
  report.steps.activity = {
    tag: history.includes('Tag added: crm-probe'),
    assigned: history.includes('Contact assigned to Dana Okafor'),
    note: history.includes('Note added'),
    task: history.includes('Task completed'),
    stage: history.includes('Moved to Consult Done'),
  };
  check('activityDerivedFromRun', Object.values(report.steps.activity).every(Boolean));

  // 16–19. Offline: the Lab is local-first, so a CRM change must not wait for the Worker.
  report.steps.serviceWorker = await page.evaluate(`(async () => {
    const registration = await navigator.serviceWorker.ready;
    for (let i = 0; i < 100 && !navigator.serviceWorker.controller; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return { scope: registration.scope, controlled: !!navigator.serviceWorker.controller };
  })()`);
  const workers = await serviceWorkerSessions(browser, new URL(BASE).origin);
  const offline = { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 };
  await page.send('Network.enable');
  await page.send('Network.emulateNetworkConditions', offline);
  await workers?.send?.('Network.enable');
  await workers?.send?.('Network.emulateNetworkConditions', offline);

  await clickText('button', 'Record');
  await sleep(300);
  await fill('input[list]', 'offline-tag');
  await submit('input[list]');
  await sleep(700);
  check('mutatedOffline', await has('offline-tag'));

  await openCrm('?area=contacts&record=maria');
  await waitFor("document.body.innerText.includes('offline-tag')", 40);
  check('offlineChangeSurvivedOfflineReload', await has('offline-tag'));

  await page.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
  });
  await workers?.send?.('Network.emulateNetworkConditions', {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
  });
  await sleep(500);
  check('consistentAfterReconnect', await has('offline-tag'));

  // 22–25. Reset, then work again, then reload: Phase 10's generation rule has to hold, so the
  // post-reset history must persist rather than collide with the run's first life (D-087).
  await clickText('button', 'Reset account');
  await sleep(300);
  await clickText('button', 'Reset account');
  await sleep(1200);
  await openCrm('?area=contacts&record=maria');
  await sleep(600);
  check('resetClearedTheProbeTag', !(await has('crm-probe')));

  await fill('input[list]', 'after-reset');
  await submit('input[list]');
  await sleep(700);
  check('mutatedAfterReset', await has('after-reset'));

  await openCrm('?area=contacts&record=maria');
  await waitFor("document.body.innerText.includes('after-reset')", 40);
  check('postResetActivitySurvivedReload', await has('after-reset'));
} catch (error) {
  report.failures.push(`threw: ${error instanceof Error ? error.message : String(error)}`);
} finally {
  await close();
}

report.verdict = report.failures.length === 0 ? 'PASS' : 'FAIL';
console.log(JSON.stringify(report, null, 2));
if (report.failures.length > 0) process.exitCode = 1;
