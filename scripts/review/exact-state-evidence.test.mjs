import assert from 'node:assert/strict';
import test from 'node:test';
import { joinExactStates, INCIDENT_NA_REASON } from './exact-state-evidence.mjs';
import * as evidence from './exact-state-evidence.mjs';

test('waits for controlled interception before accepting an already-visible loading screen', async () => {
  let polls = 0;
  let visibleReads = 0;
  const passed = await evidence.waitForControlledState({
    intercepted: () => polls >= 2,
    visible: async () => {
      visibleReads++;
      return true;
    },
    pause: async () => {
      polls++;
    },
  });
  assert.equal(passed, true);
  assert.equal(polls, 2);
  assert.equal(visibleReads, 1);
});

test('rejects visible loading UI when the controlled import never arrives', async () => {
  let polls = 0;
  const passed = await evidence.waitForControlledState({
    intercepted: () => false,
    visible: async () => true,
    pause: async () => {
      polls++;
    },
  });
  assert.equal(passed, false);
  assert.equal(polls, 80);
});

test('rejects an intercepted import without the requested visible state', async () => {
  const passed = await evidence.waitForControlledState({
    intercepted: () => true,
    visible: async () => false,
    pause: async () => {},
  });
  assert.equal(passed, false);
});

const interception = (changes = {}) => ({
  requestId: 'fetch-1',
  networkId: 'network-1',
  resourceType: 'Script',
  request: { url: 'http://127.0.0.1:4191/assets/Screen-abc.js' },
  ...changes,
});
const tracker = () => {
  assert.equal(typeof evidence.createInterceptionTracker, 'function');
  return evidence.createInterceptionTracker('http://127.0.0.1:4191');
};

for (const resourceType of ['Script', 'Stylesheet'])
  test(`records only browser-confirmed local ${resourceType} cancellation separately`, async () => {
    const guard = tracker();
    const event = interception({
      resourceType,
      request: {
        url: `http://127.0.0.1:4191/assets/Screen-abc.${resourceType === 'Script' ? 'js' : 'css'}`,
      },
    });
    guard.loadingFailed({ requestId: event.networkId, canceled: true });
    guard.track(event, () => Promise.reject(new Error('Invalid InterceptionId. ')));
    await guard.drain();
    assert.deepEqual(guard.results().failures, []);
    assert.equal(guard.results().localAssetCancellations.length, 1);
  });

for (const [name, event, cancellation, message] of [
  ['uncanceled request', interception(), { requestId: 'network-1', canceled: false }],
  ['wrong network ID', interception(), { requestId: 'network-other', canceled: true }],
  [
    'missing network ID',
    interception({ networkId: undefined }),
    { requestId: 'fetch-1', canceled: true },
  ],
  ['API request', interception({ request: { url: 'http://127.0.0.1:4191/api/sync/push' } })],
  ['health API request', interception({ request: { url: 'http://127.0.0.1:4191/api/health' } })],
  [
    'external asset',
    interception({ request: { url: 'https://provider.invalid/assets/Screen.js' } }),
  ],
  ['unexpected error', interception(), undefined, 'Connection closed'],
  ['similar but inexact error', interception(), undefined, 'Invalid InterceptionId. unexpected'],
  ['non-asset script', interception({ request: { url: 'http://127.0.0.1:4191/Screen.js' } })],
  ['non-script resource', interception({ resourceType: 'Fetch' })],
  ['mismatched resource extension', interception({ resourceType: 'Stylesheet' })],
])
  test(`keeps ${name} interception failure fatal`, async () => {
    const guard = tracker();
    guard.loadingFailed(cancellation ?? { requestId: 'network-1', canceled: true });
    guard.track(event, () => Promise.reject(new Error(message ?? 'Invalid InterceptionId.')));
    await guard.drain();
    assert.equal(guard.results().failures.length, 1);
    assert.deepEqual(guard.results().localAssetCancellations, []);
  });

test('does not infer cancellation without an explicit loadingFailed event', async () => {
  const guard = tracker();
  guard.track(interception(), () => Promise.reject(new Error('Invalid InterceptionId.')));
  await guard.drain();
  assert.equal(guard.results().failures.length, 1);
});

test('correlates cancellation arriving after the interception response failure', async () => {
  const guard = tracker();
  guard.track(interception(), () => Promise.reject(new Error('Invalid InterceptionId.')));
  await guard.drain();
  assert.equal(guard.results().failures.length, 1);
  guard.loadingFailed({ requestId: 'network-1', canceled: true });
  assert.equal(guard.results().failures.length, 0);
  assert.equal(guard.results().localAssetCancellations.length, 1);
});

test('drains pending handlers including failures added during the drain', async () => {
  const guard = tracker();
  let release;
  const pending = new Promise((resolve) => {
    release = resolve;
  });
  guard.track(interception(), async () => {
    await pending;
    guard.track(interception({ networkId: 'network-2' }), () =>
      Promise.reject(new Error('Connection closed')),
    );
  });
  let drained = false;
  const complete = guard.drain().then(() => {
    drained = true;
  });
  await Promise.resolve();
  assert.equal(drained, false);
  release();
  await complete;
  assert.equal(guard.results().failures.length, 1);
});

test('cancellation diagnostics omit URL secrets, request identities and arbitrary error text', async () => {
  const guard = tracker();
  const event = interception({
    request: { url: 'http://127.0.0.1:4191/assets/Screen.js?secret=private-marker' },
  });
  guard.loadingFailed({ requestId: event.networkId, canceled: true });
  guard.track(event, () => Promise.reject(new Error('Invalid InterceptionId.')));
  guard.track(interception(), () => Promise.reject(new Error('private-error-marker')));
  await guard.drain();
  const output = JSON.stringify(guard.results());
  assert(!/private-marker|private-error-marker|network-1|fetch-1/.test(output));
});

test('document navigation rejects previous-loader and wrong-frame load evidence', async () => {
  const { navigateDocument } = await import('./cdp.mjs');
  let listener;
  let reply;
  let complete = false;
  const page = {
    on(_method, callback) {
      listener = callback;
      return () => {};
    },
    async send(method) {
      if (method === 'Page.navigate')
        return new Promise((resolve) => {
          reply = resolve;
        });
      return {};
    },
  };
  const navigation = navigateDocument(page, 'http://127.0.0.1:4191/workflow').then(() => {
    complete = true;
  });
  await new Promise(setImmediate);
  listener({ name: 'load', loaderId: 'previous', frameId: 'main' });
  reply({ loaderId: 'current', frameId: 'main' });
  await new Promise(setImmediate);
  assert.equal(complete, false);
  listener({ name: 'load', loaderId: 'current', frameId: 'other' });
  await new Promise(setImmediate);
  assert.equal(complete, false);
  listener({ name: 'load', loaderId: 'current', frameId: 'main' });
  await navigation;
  assert.equal(complete, true);
});

test('document navigation keeps a matching load event received before its command reply', async () => {
  const { navigateDocument } = await import('./cdp.mjs');
  let listener;
  const page = {
    on(_method, callback) {
      listener = callback;
      return () => {};
    },
    async send(method) {
      if (method === 'Page.navigate') {
        listener({ name: 'load', loaderId: 'current', frameId: 'main' });
        return { loaderId: 'current', frameId: 'main' };
      }
      return {};
    },
  };
  await navigateDocument(page, 'http://127.0.0.1:4191/workflow');
});

const head = '6b0226eb35d83b96f442b26c97495385b43de33c';
const screens = [{ name: 'workflow', path: '/workflow' }];
const proof = () => ({
  head,
  browser_head: head,
  name: 'workflow',
  path: '/workflow',
  state: 'keyboard',
  status: 'PASSED',
  scope: 'Native keyboard activation of the screen recovery link',
  screenshot: 'workflow-keyboard.png',
  screenshot_sha256: 'a'.repeat(64),
  assertions: [{ name: 'reached intended screen', passed: true }],
  input: {
    kind: 'keyboard',
    trusted: true,
    events: ['keydown', 'click'],
    before_screenshot: 'workflow-keyboard-before.png',
    before_sha256: 'b'.repeat(64),
  },
});
const report = (rows = [proof()]) => ({ head, status: 'PASSED', cells: rows });
test('joins only the exact screen and state with successful assertions', () => {
  const cells = joinExactStates(report(), head, screens);
  assert.equal(cells.get('workflow:keyboard').status, 'PROVEN_BROWSER');
  assert.equal(cells.has('workflow:touch'), false);
});
for (const [name, edit] of [
  [
    'wrong head',
    (r) => {
      r.head = 'old';
    },
  ],
  [
    'wrong browser build',
    (r) => {
      r.cells[0].browser_head = 'old';
    },
  ],
  [
    'wrong screen path',
    (r) => {
      r.cells[0].path = '/crm';
    },
  ],
  [
    'unknown screen',
    (r) => {
      r.cells[0].name = 'invented';
    },
  ],
  [
    'failed suite',
    (r) => {
      r.status = 'FAILED';
    },
  ],
  [
    'failed cell',
    (r) => {
      r.cells[0].status = 'FAILED';
    },
  ],
  [
    'failed assertion',
    (r) => {
      r.cells[0].assertions[0].passed = false;
    },
  ],
  [
    'missing assertions',
    (r) => {
      r.cells[0].assertions = [];
    },
  ],
  [
    'synthetic input',
    (r) => {
      r.cells[0].input.trusted = false;
    },
  ],
  [
    'wrong input kind',
    (r) => {
      r.cells[0].input.kind = 'touch';
    },
  ],
  [
    'missing activation',
    (r) => {
      r.cells[0].input.events = ['keydown'];
    },
  ],
  [
    'duplicate attribution',
    (r) => {
      r.cells.push(proof());
    },
  ],
  [
    'unknown state',
    (r) => {
      r.cells[0].state = 'invented';
    },
  ],
  [
    'missing screenshot',
    (r) => {
      delete r.cells[0].screenshot;
    },
  ],
  [
    'mismatched artifact',
    (r) => {
      r.cells[0].screenshot = '../crm-keyboard.png';
    },
  ],
  [
    'missing screenshot digest',
    (r) => {
      delete r.cells[0].screenshot_sha256;
    },
  ],
])
  test(`rejects ${name} without promoting any cells`, () => {
    const invalid = report();
    edit(invalid);
    assert.throws(() => joinExactStates(invalid, head, screens));
  });
test('absence of a report leaves all exact cells unverified', () => {
  assert.equal(joinExactStates(undefined, head, screens).size, 0);
});
test('retains the authored incident directory lifecycle exception without calling it a browser PASS', () => {
  const cell = {
    ...proof(),
    name: 'incident',
    path: '/incident',
    state: 'completed',
    screenshot: 'incident-completed.png',
    status: 'N/A',
    reason: INCIDENT_NA_REASON,
    scope: INCIDENT_NA_REASON,
  };
  const joined = joinExactStates(report([cell]), head, [{ name: 'incident', path: '/incident' }]);
  assert.equal(joined.get('incident:completed').status, 'N/A');
});
test('rejects a lifecycle exception for an interactive workflow', () => {
  assert.throws(() =>
    joinExactStates(report([{ ...proof(), status: 'N/A', reason: 'No workflow' }]), head, screens),
  );
});

test('rejects native action evidence without a before-input artifact', () => {
  const invalid = report();
  delete invalid.cells[0].input.before_screenshot;
  assert.throws(() => joinExactStates(invalid, head, screens));
});
test('rejects native action evidence with an unrelated before-input artifact', () => {
  const invalid = report();
  invalid.cells[0].input.before_screenshot = 'crm-touch-before.png';
  assert.throws(() => joinExactStates(invalid, head, screens));
});

test('verifies screenshot bytes and rejects corrupted and missing physical artifacts', async () => {
  const { mkdtempSync, writeFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { createHash } = await import('node:crypto');
  const { verifyExactArtifacts } = await import('./exact-state-evidence.mjs');
  const directory = mkdtempSync(join(tmpdir(), 'bloomlab-exact-test-'));
  try {
    const cell = proof();
    cell.state = 'completed';
    cell.screenshot = 'workflow-completed.png';
    delete cell.input;
    const bytes = Buffer.from('controlled artifact bytes');
    cell.screenshot_sha256 = createHash('sha256').update(bytes).digest('hex');
    writeFileSync(join(directory, cell.screenshot), bytes);
    verifyExactArtifacts([cell], directory);
    writeFileSync(join(directory, cell.screenshot), 'changed');
    assert.throws(() => verifyExactArtifacts([cell], directory));
    cell.screenshot = 'missing.png';
    assert.throws(() => verifyExactArtifacts([cell], directory));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('rejects native input when the original-screen image bytes do not match', async () => {
  const { mkdtempSync, writeFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { createHash } = await import('node:crypto');
  const { verifyExactArtifacts } = await import('./exact-state-evidence.mjs');
  const directory = mkdtempSync(join(tmpdir(), 'bloomlab-input-test-'));
  try {
    const cell = proof(),
      bytes = Buffer.from('controlled artifact bytes');
    cell.screenshot_sha256 = createHash('sha256').update(bytes).digest('hex');
    writeFileSync(join(directory, cell.screenshot), bytes);
    writeFileSync(join(directory, cell.input.before_screenshot), bytes);
    assert.throws(() => verifyExactArtifacts([cell], directory));
    cell.input.before_sha256 = cell.screenshot_sha256;
    verifyExactArtifacts([cell], directory);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

for (const quote of ['"', "'", '`'])
  test(`injects a controlled render exception with ${quote} compiled string delimiters`, async () => {
    const { injectNotFoundFault } = await import('./exact-state-evidence.mjs');
    const source = `jsx('h1', {children:${quote}Nothing at this address.${quote}})`;
    assert.match(injectNotFoundFault(source), /throw new Error/);
  });
test('rejects an absent or ambiguous render marker instead of claiming fault injection', async () => {
  const { injectNotFoundFault } = await import('./exact-state-evidence.mjs');
  assert.throws(() => injectNotFoundFault('unrelated'), /render marker/);
  assert.throws(
    () => injectNotFoundFault('"Nothing at this address."+"Nothing at this address."'),
    /render marker/,
  );
});
