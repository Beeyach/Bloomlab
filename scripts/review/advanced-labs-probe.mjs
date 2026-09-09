// Phase 25 checkpoint C: real saved accounts, five widths and short-height input.
// All records and outcomes are synthetic. No provider or real HighLevel account is contacted.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { session, openPage, setViewport, screenshot, sleep } from './cdp.mjs';
import { probeHelpers } from './probe-lib.mjs';

const BASE = process.env.BASE ?? 'http://127.0.0.1:4183';
const OUT = resolve(process.env.REVIEW_OUT ?? '.review/phase-25-labs');
const HEAD = process.env.REVIEW_HEAD;
mkdirSync(OUT, { recursive: true });
const result = { base: BASE, widths: [], flows: {}, head: HEAD ?? null };
const browser = await session();
const { page } = browser;
const { waitFor, click, typeInto, hasButton } = probeHelpers({ base: BASE });
const has = (text) =>
  `document.querySelector('main')?.textContent.includes(${JSON.stringify(text)})`;
const go = async (path, ready) => {
  await openPage(page, BASE + path);
  assert(await waitFor(page, ready), `${path} did not open`);
};
const select = async (selector, value) => {
  assert(
    await page.evaluate(
      `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el || ![...el.options].some(o => o.value === ${JSON.stringify(value)})) return false; Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(el, ${JSON.stringify(value)}); el.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`,
    ),
    `${selector} has no ${value}`,
  );
  assert(
    await waitFor(
      page,
      `document.querySelector(${JSON.stringify(selector)})?.value === ${JSON.stringify(value)}`,
    ),
  );
};
async function form(operation, values, { refused = false } = {}) {
  const prefix = `form[data-operation="${operation}"]`;
  for (const [name, value] of Object.entries(values)) {
    const selector = `${prefix} [name="${name}"]`;
    const tag = await page.evaluate(`document.querySelector(${JSON.stringify(selector)})?.tagName`);
    if (tag === 'SELECT') await select(selector, value);
    else await typeInto(page, selector, value);
  }
  await click(page, `${prefix} button[type="submit"]`);
  assert(
    await waitFor(
      page,
      refused
        ? has('Bloomlab refused that change')
        : `document.querySelector(${JSON.stringify(prefix)})?.textContent.includes('Saved in this training account.')`,
    ),
    `${operation} ${refused ? 'refusal' : 'save'} missing`,
  );
  await sleep(100);
}
async function layout(name, width) {
  const measured = await page.evaluate(
    `(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, controls: [...document.querySelectorAll('main form input:not([type=checkbox]),main form select,main form button,main nav button,[data-testid=class-capacity],[data-testid^=resource-]')].filter(el => el.getClientRects().length && !el.disabled).map(el => ({ tag: el.tagName, height: el.getBoundingClientRect().height })) }))()`,
  );
  assert(measured.scrollWidth <= width + 1, `${name} overflows at ${width}`);
  assert(
    measured.controls.every((c) => c.height >= 43),
    `${name} has a short touch target at ${width}`,
  );
  result.widths.push({ name, ...measured });
  await screenshot(page, `${OUT}/${name}-${width}.png`, undefined, false);
}
async function calendarSave() {
  await click(page, '[data-testid="calendar-save"]');
  assert(
    await waitFor(
      page,
      `document.querySelector('[data-testid="calendar-save-state"]')?.textContent.startsWith('Saved')`,
    ),
  );
}
try {
  await setViewport(page, 1440, 900);
  await go('/settings/ai', '!!document.querySelector("main select")');
  await select('main select', 'Off');
  await go('/crm?area=companies', has('No companies yet'));
  result.flows.emptyCompanies = true;
  await form('COMPANY_SAVED', { id: 'agency', name: 'Training Agency' });
  await form('COMPANY_CONTACT_LINKED', { contact: 'maria', company: 'agency' });
  await form('COMPANY_SAVED', { id: 'agency', name: 'Renamed Training Agency' });
  await go('/crm?area=companies', has('Renamed Training Agency'));
  assert(await page.evaluate(has('1 associated contacts')));
  result.flows.companyReferenceAndReload = true;

  await go('/crm?area=objects', has('No object schemas yet'));
  await click(page, 'Add field');
  await form('OBJECT_SCHEMA_SAVED', {
    id: 'properties',
    name: 'Properties',
    'key-0': 'value',
    'type-0': 'number',
    'required-0': 'true',
    'key-1': 'ready',
    'type-1': 'boolean',
    'required-1': 'false',
  });
  await select('[data-testid="object-picker"]', 'properties');
  await form('OBJECT_RECORD_SAVED', {
    id: 'home-one',
    name: 'Home One',
    'value-value': '250000',
    'value-ready': 'true',
  });
  await form('OBJECT_ASSOCIATION_SAVED', {
    id: 'owner-one',
    record: 'home-one',
    contact: 'maria',
    label: 'Owner',
  });
  await form('OBJECT_AUTOMATION_SAVED', {
    id: 'property-review',
    on: 'created',
    field: 'ready',
    equals: 'true',
    recipient: 'priya',
    message: 'Review property',
    enabled: 'true',
  });
  await form('OBJECT_RECORD_SAVED', {
    id: 'home-two',
    name: 'Home Two',
    'value-value': '200000',
    'value-ready': 'true',
  });
  assert(await page.evaluate(has('Review property · Home Two')));
  // Reusing the schema identifier with an incompatible field type is an atomic refusal.
  await form(
    'OBJECT_SCHEMA_SAVED',
    {
      id: 'properties',
      name: 'Properties',
      'key-0': 'value',
      'type-0': 'boolean',
      'required-0': 'true',
      'key-1': 'ready',
      'type-1': 'boolean',
      'required-1': 'false',
    },
    { refused: true },
  );
  assert(await page.evaluate(has('250000')));
  await go('/crm?area=objects', '!!document.querySelector("[data-testid=object-picker]")');
  await select('[data-testid="object-picker"]', 'properties');
  assert(await page.evaluate(has('Owner: Maria Delgado')));
  result.flows.typedObjectsAssociationsAutomationRefusalReload = true;

  await go('/crm?area=lists', has('No saved segments yet'));
  await click(page, 'Add rule');
  await form('SMART_LIST_SAVED', {
    id: 'reachable-meta',
    name: 'Reachable Meta leads',
    match: 'all',
    'field-0': 'tags',
    'operator-0': 'is',
    'type-0': 'text',
    'value-0': 'meta-lead',
    'field-1': 'dnd',
    'operator-1': 'is',
    'type-1': 'boolean',
    'value-1': 'false',
  });
  assert(await page.evaluate(has('Reachable Meta leads · 2 of 5 contacts')));
  await go('/crm?area=contacts&record=maria', hasButton('Turn on'));
  await click(page, 'Turn on');
  assert(await waitFor(page, hasButton('Turn off')));
  await go('/crm?area=lists', has('Reachable Meta leads · 1 of 5 contacts'));
  await go('/crm?area=contacts&record=maria', hasButton('Turn off'));
  await click(page, 'Turn off');
  assert(await waitFor(page, hasButton('Turn on')));
  result.flows.liveSegmentation = true;

  await go('/payments', has('No Lab prices yet'));
  await form('PRODUCT_SAVED', { id: 'training-service', name: 'Training service' });
  await form('PRICE_CREATED', {
    id: 'training-once',
    name: 'Training one-time',
    product: 'training-service',
    cents: '2500',
    interval: 'one_time',
  });
  await form('PRICE_CREATED', {
    id: 'training-monthly',
    name: 'Training monthly',
    product: 'training-service',
    cents: '2500',
    interval: 'month',
  });
  await click(page, 'Links & invoices');
  await form('PAYMENT_LINK_SAVED', {
    id: 'training-link',
    name: 'Training monthly link',
    price: 'training-monthly',
    active: 'true',
  });
  await form('INVOICE_CREATED', {
    id: 'training-invoice',
    contact: 'maria',
    price: 'training-once',
  });
  await click(page, 'Payment attempts');
  await select('main select', 'invoice');
  await form('PAYMENT_CHECKOUT', {
    id: 'training-failed',
    target: 'training-invoice',
    outcome: 'failed',
    reason: 'Synthetic decline',
  });
  await form('PAYMENT_CHECKOUT', {
    id: 'training-retry',
    target: 'training-invoice',
    outcome: 'success',
  });
  await form(
    'PAYMENT_CHECKOUT',
    { id: 'training-duplicate', target: 'training-invoice', outcome: 'success' },
    { refused: true },
  );
  await click(page, 'Dismiss');
  await click(page, 'Ledger & subscriptions');
  await form('REFUND_ISSUED', { payment: 'training-retry', reason: 'Synthetic refund' });
  await click(page, 'Payment attempts');
  await select('main select', 'payment_link');
  await form('PAYMENT_CHECKOUT', {
    id: 'training-first',
    target: 'training-link',
    contact: 'maria',
    subscription: 'training-sub',
    outcome: 'success',
  });
  await select('main select', 'subscription');
  await page.send('Network.emulateNetworkConditions', {
    offline: true,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
  });
  await form('PAYMENT_CHECKOUT', {
    id: 'training-renewal-failed',
    target: 'training-sub',
    outcome: 'failed',
    reason: 'Synthetic renewal decline',
  });
  await page.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
  });
  await form('PAYMENT_CHECKOUT', {
    id: 'training-renewal-retry',
    target: 'training-sub',
    outcome: 'success',
  });
  await go('/payments', hasButton('Ledger & subscriptions'));
  await click(page, 'Ledger & subscriptions');
  assert(await page.evaluate(has('training-retry · Maria Delgado · $25.00 USD · refunded')));
  assert(await page.evaluate(has('2 successful charges')));
  result.flows.paymentsFailureRetryRefundSubscriptionOfflineReload = true;

  for (const slug of ['companies-objects', 'smart-lists', 'payment-lifecycle']) {
    await go(`/exercise/EX-BUILD_IT-${slug}`, hasButton('Run it'));
    await click(page, 'Run it');
    assert(
      await waitFor(page, '!!document.querySelector("[data-outcome=passed]")'),
      `${slug} grades the real account`,
    );
  }
  result.flows.crmPaymentsPracticalsGraded = true;

  await go('/calendar', '!!document.querySelector("[data-testid=calendar-picker]")');
  await select('[data-testid="calendar-picker"]', 'consultation');
  await click(page, '[data-testid="group-basics"]');
  await select('[data-testid="calendar-type"]', 'class');
  await typeInto(page, '[data-testid="class-capacity"]', '2');
  await calendarSave();
  const slotId = await page.evaluate(
    `[...document.querySelectorAll('[data-testid^="slot-"]')].find(el => el.textContent.includes('2 seats left'))?.dataset.testid`,
  );
  assert(slotId, 'Class offers remaining seats');
  await click(page, `[data-testid="${slotId}"]`);
  await select('[data-testid="booking-contact"]', 'soraya');
  await click(page, '[data-testid="booking-book"]');
  assert(
    await waitFor(
      page,
      `document.querySelector(${JSON.stringify(`[data-testid="${slotId}"]`)})?.textContent.includes('1 seats left')`,
    ),
  );
  await click(page, `[data-testid="${slotId}"]`);
  await select('[data-testid="booking-contact"]', 'nadia');
  await click(page, '[data-testid="booking-book"]');
  assert(
    await waitFor(page, `!document.querySelector(${JSON.stringify(`[data-testid="${slotId}"]`)})`),
  );
  const attendee = await page.evaluate(
    `[...document.querySelectorAll('[data-testid^="appointment-row-"]')].find(el => el.textContent.includes('Soraya'))?.dataset.testid.slice('appointment-row-'.length)`,
  );
  assert(attendee);
  await click(page, `[data-testid="appointment-row-${attendee}"]`);
  await click(page, `[data-testid="cancel-${attendee}"]`);
  assert(
    await waitFor(
      page,
      `document.querySelector(${JSON.stringify(`[data-testid="${slotId}"]`)})?.textContent.includes('1 seats left')`,
    ),
  );
  await click(page, '[data-testid="group-service"]');
  await typeInto(page, '[data-testid="resource-id"]', 'room-one');
  await typeInto(page, '[data-testid="resource-name"]', 'Training room');
  await typeInto(page, '[data-testid="resource-capacity"]', '1');
  // Availability updates before the asynchronous account write finishes. Do not click a
  // deliberately disabled control while cancellation is still persisting.
  assert(
    await waitFor(
      page,
      `[...document.querySelectorAll('button')].some(el => el.textContent.trim() === 'Save resource' && !el.disabled)`,
    ),
  );
  await click(page, 'Save resource');
  assert(await waitFor(page, has('Resource saved in this account.')));
  await select('[data-testid="calendar-picker"]', 'treatments');
  await click(page, '[data-testid="group-service"]');
  assert(await waitFor(page, has('Training room')));
  await page.evaluate(
    `void [...document.querySelectorAll('fieldset input[type=checkbox]')][0].click()`,
  );
  await calendarSave();
  await select('[data-testid="booking-service"]', 'signature-facial');
  const treatmentSlot = await page.evaluate(
    `document.querySelector('[data-testid^="slot-"]')?.dataset.testid`,
  );
  assert(treatmentSlot);
  await click(page, `[data-testid="${treatmentSlot}"]`);
  await select('[data-testid="booking-contact"]', 'soraya');
  await click(page, '[data-testid="booking-book"]');
  await sleep(400);
  await go('/exercise/EX-BUILD_IT-advanced-scheduling', hasButton('Run it'));
  await click(page, 'Run it');
  assert(
    await waitFor(page, '!!document.querySelector("[data-outcome=passed]")'),
    'Scheduling practical grades actual bookings and resource configuration',
  );
  result.flows.classSeatsAndResourceConfiguration = true;

  for (const width of [1440, 1024, 768, 390, 320]) {
    await setViewport(page, width, width < 768 ? 844 : 900);
    for (const area of ['companies', 'objects', 'lists']) {
      await go(`/crm?area=${area}`, '!!document.querySelector("form[data-operation]")');
      if (area === 'objects') await select('[data-testid="object-picker"]', 'properties');
      await layout(`crm-${area}`, width);
    }
    await go('/payments', hasButton('Products & prices'));
    for (const [name, label] of [
      ['catalog', 'Products & prices'],
      ['offers', 'Links & invoices'],
      ['attempts', 'Payment attempts'],
      ['ledger', 'Ledger & subscriptions'],
    ]) {
      await click(page, label);
      await layout(`payments-${name}`, width);
    }
    await go('/calendar', '!!document.querySelector("[data-testid=calendar-picker]")');
    await select('[data-testid="calendar-picker"]', 'consultation');
    if (await page.evaluate('!!document.querySelector("[data-testid=settings-open]")'))
      await click(page, '[data-testid="settings-open"]');
    await click(page, '[data-testid="group-basics"]');
    await layout('calendar-class', width);
    await click(page, '[data-testid="group-service"]');
    await layout('calendar-resources', width);
    console.log(`Advanced Labs: ${width}px, nine surfaces passed`);
  }
  await setViewport(page, 1024, 480);
  await page.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  });
  await go('/crm?area=companies', '!!document.querySelector("form[data-operation]")');
  await page.evaluate(`void document.querySelector('main input').focus()`);
  await page.send('Input.dispatchKeyEvent', {
    type: 'rawKeyDown',
    key: 'Tab',
    code: 'Tab',
    windowsVirtualKeyCode: 9,
  });
  await page.send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: 'Tab',
    code: 'Tab',
    windowsVirtualKeyCode: 9,
  });
  const focus = await page.evaluate(
    `({ visible: document.activeElement.matches(':focus-visible'), outline: getComputedStyle(document.activeElement).outlineStyle })`,
  );
  assert(focus.visible && focus.outline !== 'none');
  result.keyboardFocus = focus;
  await setViewport(page, 390, 480);
  await go('/payments', hasButton('Ledger & subscriptions'));
  const point = await page.evaluate(
    `(() => { const el = [...document.querySelectorAll('button')].find(el => el.textContent === 'Ledger & subscriptions'); el.scrollIntoView({block:'center'}); const r = el.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`,
  );
  await page.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
  await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  assert(await waitFor(page, has('Shared event trail')));
  result.touch = true;
  result.reducedMotion = true;
  result.aiOff = true;
  if (HEAD) {
    const health = await (await fetch(`${BASE}/api/health`)).json();
    const build = await page.evaluate(
      `document.querySelector('[data-build-id]')?.getAttribute('data-build-id')`,
    );
    assert.equal(build, HEAD);
    assert.equal(health.build_id, HEAD);
    result.identity = { health, browser: build };
  }
  result.passed = true;
} catch (error) {
  result.failure = await page.evaluate('({url:location.href,text:document.body.innerText})');
  await screenshot(page, `${OUT}/failure.png`, undefined, false);
  throw error;
} finally {
  writeFileSync(`${OUT}/advanced-labs-probe.json`, JSON.stringify(result, null, 2));
  await browser.close();
}
