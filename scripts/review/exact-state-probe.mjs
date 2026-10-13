// Exact route and native-input assertions supplement the feature probes. Controlled import
// failures cover route recovery, not every storage/provider/rubric failure or human judgment.
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import {
  session,
  setViewport,
  openPage,
  navigateDocument,
  screenshot,
  resetIndexedDbFixture,
  sleep,
} from './cdp.mjs';
import { probeHelpers } from './probe-lib.mjs';
import { ROUTER_INVENTORY, SCREEN_INVENTORY } from './screen-matrix.mjs';
import {
  joinExactStates,
  injectNotFoundFault,
  createInterceptionTracker,
  waitForControlledState,
} from './exact-state-evidence.mjs';
import { runSemanticStates } from './semantic-state-cases.mjs';

const base = process.env.BASE ?? 'http://127.0.0.1:4191';
const head = process.env.REVIEW_HEAD;
assert(head, 'Exact-state probe requires REVIEW_HEAD');
const out = resolve(process.env.REVIEW_OUT ?? '.review/exact-states');
mkdirSync(out, { recursive: true });
const report = {
  head,
  status: 'RUNNING',
  cells: [],
  external_requests_blocked: 0,
  probe_sources: Object.fromEntries(
    ['exact-state-probe.mjs', 'semantic-state-cases.mjs', 'exact-state-evidence.mjs'].map(
      (name) => [
        name,
        createHash('sha256')
          .update(readFileSync(new URL(name, import.meta.url)))
          .digest('hex'),
      ],
    ),
  ),
  limitation:
    'Controlled route loading/failure and named native actions; feature-specific empty/result and provider acceptance are separate.',
};
const { page: connection, close } = await session();
const interceptions = createInterceptionTracker(base);
const page = {
  ...connection,
  async send(method, params) {
    // Includes navigations issued by the semantic fixture helpers. Held imports are not jobs.
    if (method === 'Page.navigate') await interceptions.drain();
    return connection.send(method, params);
  },
};
const { waitFor, click, typeInto, createKeyAndLink } = probeHelpers({ base });
let fixture = null;
const held = [];
const CONTROLLED_STATE_POLL_MS = 125;

async function wait(expression, label) {
  assert(await waitFor(page, expression), label);
}

async function identity(screen) {
  assert.equal(await page.evaluate('location.pathname'), screen.path);
  const observed = await page.evaluate(
    "document.querySelector('[data-build-id]')?.dataset.buildId",
  );
  assert.equal(observed, head, 'Exact-state browser identity');
  return observed;
}

async function record(screen, state, scope, assertions, input, notApplicable) {
  const row = {
    head,
    browser_head: head,
    name: screen.name,
    path: screen.path,
    state,
    scope,
    status: 'PASSED',
    assertions: assertions.map((name) => ({ name, passed: true })),
    ...(input ? { input } : {}),
    ...(notApplicable ? { ...notApplicable, status: 'N/A' } : {}),
  };
  await screenshot(page, resolve(out, `${screen.name}-${state}.png`));
  row.screenshot = `${screen.name}-${state}.png`;
  row.screenshot_sha256 = createHash('sha256')
    .update(readFileSync(resolve(out, row.screenshot)))
    .digest('hex');
  report.cells.push(row);
  console.log(`EXACT_STATE ${screen.name}:${state}`);
}

async function key(key, code = key) {
  const value = key === 'Tab' ? 9 : key === 'Enter' ? 13 : 0;
  await page.send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key,
    code,
    windowsVirtualKeyCode: value,
    ...(key === 'Enter' ? { text: '\r' } : {}),
  });
  await page.send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key,
    code,
    windowsVirtualKeyCode: value,
  });
}

const SPECIAL = {
  skills: { selector: 'main button[aria-pressed="false"]', outcome: 'pressed' },
  crm: { label: 'Pipeline', outcome: 'current-area' },
  workflow: { label: 'Settings', outcome: 'workflow-settings' },
  funnel: { selector: '[data-testid="funnel-mode-preview"]', outcome: 'pressed' },
  calendar: { selector: '[data-testid="calendar-add"]', outcome: 'calendar-draft' },
  reporting: { selector: '[data-testid="run-window"]', outcome: 'reporting-result' },
  'exercise-say-it': { label: 'Open notes', outcome: 'call-notes' },
};

function nativeActionExpression(screen) {
  const special = SPECIAL[screen.name];
  return `(() => {
    const spec=${JSON.stringify(special ?? {})};
    const visible=e=>e.getClientRects().length&&!e.disabled;
    const target=spec.selector?document.querySelector(spec.selector):spec.label?
      [...document.querySelectorAll('main button')].find(e=>e.textContent.trim()===spec.label):
      [...document.querySelectorAll('main a[href]')].find(e=>visible(e)&&
        new URL(e.href).origin===location.origin&&e.getAttribute('href')!==location.pathname);
    if(!target||!visible(target))return null;
    target.setAttribute('data-exact-action','true');
    const url=target.tagName==='A'?new URL(target.href):null;
    return {label:(target.getAttribute('aria-label')||target.textContent).trim().slice(0,100),
      destination:url?url.pathname+url.search+url.hash:null,outcome:spec.outcome||'navigation'};
  })()`;
}

async function nativeAction(screen, state) {
  await setViewport(page, state === 'touch' ? 390 : 1440, 800);
  await interceptions.drain();
  fixture = null;
  await resetIndexedDbFixture(page, base);
  await openPage(page, base + screen.path);
  await wait("!!document.querySelector('main h1')", `${screen.name} ready`);
  await identity(screen);
  const actionExpression = nativeActionExpression(screen);
  await wait(actionExpression, `${screen.name} has no defined native action`);
  const action = await page.evaluate(actionExpression);
  await page.evaluate(`(() => {
    globalThis.__exactInput=[];
    for(const type of ['keydown','touchstart','touchend','click'])
      document.addEventListener(type,e=>{
        if(e.target.closest('[data-exact-action]')) globalThis.__exactInput.push({type,trusted:e.isTrusted});
      },{capture:true});
  })()`);
  const assertions = ['exact screen path and browser build'];
  const beforeScreenshot = `${screen.name}-${state}-before.png`;
  const captureInput = () => screenshot(page, resolve(out, beforeScreenshot), undefined, false);
  if (state === 'keyboard') {
    // Reach the action using only Tab; focus() is not used to bypass the actual tab order.
    let reached = false;
    for (let i = 0; i < 180; i++) {
      await key('Tab');
      if (await page.evaluate("document.activeElement?.matches('[data-exact-action]')")) {
        reached = true;
        break;
      }
    }
    assert(reached, `${screen.name} action unreachable by Tab`);
    assert(
      await page.evaluate(`(() => {const e=document.activeElement,s=getComputedStyle(e);
      return e.matches(':focus-visible')&&s.outlineStyle!=='none'&&parseFloat(s.outlineWidth)>=2})()`),
      `${screen.name} visible keyboard focus`,
    );
    assertions.push('action reached by native Tab with visible focus ring');
    await captureInput();
    await key('Enter');
  } else {
    assert(await page.evaluate("matchMedia('(pointer:coarse)').matches"), 'Touch emulation active');
    await page.evaluate(
      `document.querySelector('[data-exact-action]').scrollIntoView({block:'center'})`,
    );
    await page.evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
    await captureInput();
    const point =
      await page.evaluate(`(() => {const e=document.querySelector('[data-exact-action]'),
      r=e.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;
      return {x,y,height:r.height,width:r.width,button:e.tagName==='BUTTON',hit:e.contains(document.elementFromPoint(x,y))}})()`);
    assert(
      point.hit && (!point.button || (point.height >= 44 && point.width >= 44)),
      `${screen.name} visible touch action; buttons require 44px`,
    );
    await page.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: point.x, y: point.y }],
    });
    await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    assertions.push(
      point.button
        ? 'coarse pointer and native tap reached a visible 44px button'
        : 'coarse pointer and native tap hit the named link; inline-link target size is not certified',
    );
  }
  const condition = {
    navigation: `location.pathname+location.search+location.hash===${JSON.stringify(action.destination)}`,
    pressed: `document.querySelector('[data-exact-action]')?.getAttribute('aria-pressed')==='true'`,
    'current-area': `document.querySelector('[data-exact-action]')?.getAttribute('aria-current')==='page'`,
    'workflow-settings': `new URLSearchParams(location.search).get('node')==='settings'`,
    'calendar-draft': `document.querySelector('[data-testid="calendar-save"]')?.disabled===false`,
    'reporting-result': `!!document.querySelector('[data-testid="largest-loss"]')`,
    'call-notes': `!!document.querySelector('#call-notes-panel textarea')`,
  }[action.outcome];
  await wait(condition, `${screen.name} ${state} action outcome`);
  const events = await page.evaluate('globalThis.__exactInput');
  assert(events.length && events.every((event) => event.trusted), 'Trusted native events required');
  assert(
    events.some((event) => event.type === 'click'),
    'Native activation observed',
  );
  await record(
    screen,
    state,
    `Native ${state}: ${action.label}; ${action.outcome}. This is a named screen action, not an exhaustive workflow audit.`,
    [...assertions, 'native activation produced the named action outcome'],
    {
      kind: state,
      trusted: true,
      events: [...new Set(events.map((event) => event.type))],
      action,
      before_screenshot: beforeScreenshot,
      before_sha256: createHash('sha256')
        .update(readFileSync(resolve(out, beforeScreenshot)))
        .digest('hex'),
    },
  );
}

async function routeState(screen, state) {
  const route = ROUTER_INVENTORY.find((row) => row.id === screen.route_id);
  const notFound = screen.route_id === 'not-found';
  assert(notFound || route?.module, `Missing router-derived module for ${screen.name}`);
  await interceptions.drain();
  fixture = { module: notFound ? 'index' : route.module, state, notFound, intercepted: 0 };
  // Wait for this loader's document, without waiting for the held lazy route to render.
  await navigateDocument(page, base + screen.path);
  const expression =
    state === 'loading'
      ? `[...document.querySelectorAll('main [role="status"]')].some(e=>e.textContent.trim()==='Loading…')`
      : `document.querySelector('main [role="alert"] h1')?.textContent==='This screen hit a problem.'`;
  assert(
    await waitForControlledState({
      intercepted: () => fixture.intercepted > 0,
      visible: () => page.evaluate(expression),
      pause: () => sleep(CONTROLLED_STATE_POLL_MS),
    }),
    `${screen.name} controlled ${state} was not intercepted and visible`,
  );
  await identity(screen);
  assert(fixture.intercepted > 0, 'Controlled route import was not intercepted');
  assert(await page.evaluate("!!document.querySelector('nav')"), 'Navigation shell survived');
  await record(
    screen,
    state,
    state === 'loading'
      ? 'Held route module displays the real shared loading UI on this exact path.'
      : notFound
        ? 'Controlled render exception in the exact static NotFound component is contained by the real screen boundary.'
        : 'Rejected route module displays the real screen boundary; storage, grading and provider errors are separate.',
    [
      'exact screen path and browser build',
      'controlled route import intercepted',
      `${state} UI visible on the exact route`,
      'navigation shell remains available',
    ],
  );
  fixture = null;
  for (const event of held.splice(0))
    await interceptions.track(event, () =>
      page.send('Fetch.continueRequest', { requestId: event.requestId }),
    );
  if (state === 'loading')
    await wait("!!document.querySelector('main h1')", 'Held import recovers when released');
  else {
    // Navigation must recover without dismissing or weakening the failed-screen assertion.
    const recovery = screen.path === '/' ? '/campaign' : '/';
    await click(page, `nav a[href="${recovery}"]`);
    await wait(
      `location.pathname===${JSON.stringify(recovery)}&&!!document.querySelector('main h1')`,
      'Failure recovery navigation',
    );
  }
}

try {
  assert.equal((await (await fetch(base + '/api/health')).json()).build_id, head);
  await page.send('Network.enable');
  await page.send('Network.setCacheDisabled', { cacheDisabled: true });
  await page.send('Network.setBypassServiceWorker', { bypass: true });
  page.on('Network.loadingFailed', interceptions.loadingFailed);
  await page.send('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] });
  page.on('Fetch.requestPaused', (event) => {
    const handle = async () => {
      const url = new URL(event.request.url);
      if (url.origin !== new URL(base).origin) {
        report.external_requests_blocked++;
        return page.send('Fetch.failRequest', {
          requestId: event.requestId,
          errorReason: 'BlockedByClient',
        });
      }
      if (
        fixture &&
        event.resourceType === 'Script' &&
        url.pathname.startsWith(`/assets/${fixture.module}-`) &&
        url.pathname.endsWith('.js')
      ) {
        if (fixture.notFound) {
          const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
          assert(response.ok, 'Controlled render fixture requires the real built asset');
          const code = await response.text();
          if (!code.includes('Nothing at this address.'))
            return page.send('Fetch.continueRequest', { requestId: event.requestId });
          fixture.intercepted++;
          return page.send('Fetch.fulfillRequest', {
            requestId: event.requestId,
            responseCode: 200,
            responseHeaders: [{ name: 'Content-Type', value: 'application/javascript' }],
            body: Buffer.from(injectNotFoundFault(code)).toString('base64'),
          });
        }
        fixture.intercepted++;
        if (fixture.state === 'loading') {
          held.push(event);
          return;
        }
        return page.send('Fetch.fulfillRequest', {
          requestId: event.requestId,
          responseCode: 503,
          responseHeaders: [{ name: 'Content-Type', value: 'application/javascript' }],
          body: '',
        });
      }
      // The additional probe never calls sync, media, AI or other provider APIs.
      if (url.pathname.startsWith('/api/') && url.pathname !== '/api/health')
        return page.send('Fetch.fulfillRequest', {
          requestId: event.requestId,
          responseCode: 503,
          responseHeaders: [{ name: 'Content-Type', value: 'application/json' }],
          body: Buffer.from('{"error":"Controlled service unavailable"}').toString('base64'),
        });
      return page.send('Fetch.continueRequest', { requestId: event.requestId });
    };
    void interceptions.track(event, handle);
  });
  await setViewport(page, 1024, 800);
  // The narrow invocation supports local fixture diagnosis; CI always runs the full suite.
  const semanticOnly = process.argv.includes('--semantic-only');
  const notFoundOnly = process.argv.includes('--not-found-only');
  const inputsOnly = process.argv.includes('--inputs-only');
  assert(
    !((semanticOnly || notFoundOnly || inputsOnly) && process.env.CI),
    'CI must run all exact-state assertions',
  );
  report.scope = inputsOnly
    ? 'native-input-diagnostic'
    : notFoundOnly
      ? 'not-found-render-diagnostic'
      : semanticOnly
        ? 'semantic-fixture-diagnostic'
        : 'full';
  if (notFoundOnly)
    await routeState(
      SCREEN_INVENTORY.find((screen) => screen.name === 'not-found'),
      'error',
    );
  else if (!semanticOnly) {
    if (!inputsOnly)
      for (const state of ['loading', 'error'])
        for (const screen of SCREEN_INVENTORY)
          if (screen.route_id !== 'not-found' || state === 'error') await routeState(screen, state);
    for (const state of ['keyboard', 'touch'])
      for (const screen of SCREEN_INVENTORY) await nativeAction(screen, state);
  }
  if (!notFoundOnly && !inputsOnly)
    await runSemanticStates({
      page,
      base,
      screens: SCREEN_INVENTORY,
      wait,
      click,
      typeInto,
      createKeyAndLink,
      record,
      identity,
    });
  await interceptions.drain();
  assert.equal(interceptions.results().failures.length, 0, 'Every intercepted request was handled');
  report.status = 'PASSED';
  const joined = joinExactStates(report, head, SCREEN_INVENTORY);
  if (report.scope === 'full')
    for (const screen of SCREEN_INVENTORY) {
      for (const state of ['empty', 'loading', 'error', 'completed', 'keyboard', 'touch']) {
        if (
          (screen.family === 'academy' && state === 'empty') ||
          (screen.name === 'not-found' && ['empty', 'loading', 'completed'].includes(state))
        )
          continue;
        assert(
          joined.has(`${screen.name}:${state}`),
          `Missing exact ${screen.name}:${state} evidence`,
        );
      }
    }
} catch (error) {
  report.status = 'FAILED';
  // Controlled fixtures contain no private data; still omit arbitrary DOM or transport bodies.
  report.error = error instanceof Error ? error.message : 'Exact-state probe failed';
  process.exitCode = 1;
} finally {
  // Snapshot natural cancellation evidence before aborting any held request for teardown.
  await interceptions.drain();
  const { failures, localAssetCancellations } = interceptions.results();
  report.interception_failures = failures;
  report.confirmed_local_asset_cancellations = localAssetCancellations;
  if (failures.length && report.status === 'PASSED') {
    report.status = 'FAILED';
    report.error = 'Every intercepted request was handled';
    process.exitCode = 1;
  }
  fixture = null;
  report.teardown_failures = [];
  for (const event of held.splice(0))
    await page
      .send('Fetch.failRequest', { requestId: event.requestId, errorReason: 'Aborted' })
      .catch(() => report.teardown_failures.push({ resource: event.resourceType }));
  writeFileSync(resolve(out, 'exact-state-probe.json'), `${JSON.stringify(report, null, 2)}\n`);
  await close();
}
