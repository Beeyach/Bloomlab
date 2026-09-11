// INF-011 exact injected-failure matrix on real routes/state. Fixtures exist only in this browser.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { openPage, screenshot } from './cdp.mjs';
import { probeHelpers } from './probe-lib.mjs';
import { probeExitCode } from './probe-result.mjs';

const base = process.env.BASE ?? 'http://localhost:4173';
const head = process.env.REVIEW_HEAD;
const out = resolve(process.env.REVIEW_OUT ?? '.review/failure-isolation');
mkdirSync(out, { recursive: true });
const { waitFor, click, typeInto, createKeyAndLink, device, requestSync } = probeHelpers({ base });
const browser = await device('Field-Ready failure isolation');
const { page } = browser;
const report = { base, head: head ?? null, matrix: [], ok: false };

await page.send('Page.addScriptToEvaluateOnNewDocument', {
  source: `(() => {
    const mode = sessionStorage.getItem('__bloomlab_controlled_failure');
    if (mode === 'call' || mode === 'ai' || mode === 'sync' || mode === 'sync-pull') {
      const original = globalThis.fetch.bind(globalThis);
      globalThis.fetch = (input, init) => {
        const path = new URL(typeof input === 'string' ? input : input.url, location.href).pathname;
        if ((mode === 'call' && path.startsWith('/api/call/')) ||
            (mode === 'ai' && path.startsWith('/api/ai/')) ||
            (mode === 'sync' && path === '/api/sync/push') ||
            (mode === 'sync-pull' && path === '/api/sync/pull')) {
          sessionStorage.setItem('__bloomlab_failed_' + mode, String(Number(sessionStorage.getItem('__bloomlab_failed_' + mode) || 0) + 1));
          return Promise.resolve(Response.json({ error: 'controlled_' + mode + '_failure' }, { status: 503 }));
        }
        return original(input, init);
      };
    }
    if (mode === 'workflow') {
      globalThis.Worker = class ControlledFailingWorker {
        onmessage = null; onerror = null;
        postMessage() { queueMicrotask(() => this.onerror?.({ message: 'Controlled Workflow Worker failure', filename: '', lineno: 0 })); }
        terminate() {}
      };
    }
  })();`,
});

const setFailure = (mode) =>
  page.evaluate(
    mode
      ? `sessionStorage.setItem('__bloomlab_controlled_failure',${JSON.stringify(mode)})`
      : `sessionStorage.removeItem('__bloomlab_controlled_failure')`,
  );
const rows = async (table) => {
  // Serialize inside the page. Returning a deeply nested IndexedDB object graph directly makes
  // CDP walk every reference and Chrome eventually rejects it as "Object reference chain is too
  // long". The probes only assert persisted JSON data, so a JSON boundary is also more exact.
  const encoded = await page.evaluate(`new Promise((resolve,reject)=>{
    const request=indexedDB.open('bloomlab'); request.onerror=()=>reject(request.error);
    request.onsuccess=()=>{const database=request.result,tx=database.transaction(${JSON.stringify(table)}),read=tx.objectStore(${JSON.stringify(table)}).getAll();
      read.onsuccess=()=>resolve(JSON.stringify(read.result));read.onerror=()=>reject(read.error);tx.oncomplete=()=>database.close();};
  })`);
  return JSON.parse(encoded);
};
const localEvidence = async () => {
  const notes = await rows('notes');
  const sentinel = notes.find((note) => note.body === 'Field-Ready failure sentinel');
  return {
    present: Boolean(sentinel && !sentinel.deleted_at),
    id: sentinel?.id ?? null,
    count: notes.length,
  };
};
async function waitLocalEvidence() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if ((await localEvidence()).present) return true;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return false;
}
const matrix = (failure, unaffected, extra = {}) => {
  const row = { failure, unaffected, ...extra };
  report.matrix.push(row);
  console.log(failure, JSON.stringify(row));
};
async function usable(path, ready) {
  await openPage(page, base + path);
  assert(await waitFor(page, ready), `${path} did not recover after an unrelated failure`);
  const local = await localEvidence();
  assert(local.present, `Local sentinel disappeared at ${path}`);
  return { path, local: local.present };
}
async function unaffected(paths) {
  const results = [];
  for (const [path, ready] of paths) results.push(await usable(path, ready));
  return results;
}
const academy = [
  '/academy/LU-funnel-math-basics',
  `document.querySelector('main h1')?.textContent.length>0`,
];
const crm = [
  '/crm',
  `document.querySelector('main h1')?.textContent.trim()==='CRM' && !document.body.textContent.includes('Opening the training account')`,
];
const workflow = ['/workflow', `!!document.querySelector('[data-testid="test-panel"]')`];
const call = [
  '/exercise/EX-SAY_IT-northwind-cold-call',
  `!!document.querySelector('[data-testid="call-room"]')`,
];

try {
  const linked = await createKeyAndLink(browser);
  assert(linked.linked, 'Synthetic Preview device must link');
  await browser.go('/system');
  assert(
    await waitFor(
      page,
      `[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Add test note')`,
    ),
  );
  await click(page, 'Add test note');
  assert(await waitFor(page, `!!document.querySelector('textarea')`));
  await typeInto(page, 'textarea', 'Field-Ready failure sentinel');
  await click(page, 'Save note');
  assert(
    await waitFor(
      page,
      `document.querySelector('textarea')?.value==='Field-Ready failure sentinel'`,
    ),
  );
  assert(await waitLocalEvidence());

  // Call Room transport fails at its configuration request. Its local attempt and the shell reload.
  await setFailure('call');
  await openPage(page, base + call[0]);
  assert(await waitFor(page, call[1]));
  assert(
    await waitFor(
      page,
      `document.querySelector('main [role="alert"]')?.textContent.includes('call service is unavailable')`,
    ),
  );
  await screenshot(page, resolve(out, 'call-failure.png'), undefined, false);
  await openPage(page, base + call[0]);
  assert(await waitFor(page, call[1]));
  assert((await localEvidence()).present);
  matrix('Call Room API', await unaffected([workflow, crm, academy]), {
    reload: true,
    local: true,
    failureHeldDuringOtherRoutes: true,
  });

  // A real Workflow operation reaches a browser Worker that crashes before returning an outcome.
  await setFailure('workflow');
  await openPage(page, base + workflow[0]);
  assert(
    await waitFor(
      page,
      `document.querySelector('[data-testid="start-first-step"]')?.disabled===false`,
    ),
  );
  const runBefore = JSON.stringify(await rows('sim_projects'));
  await page.evaluate(`document.querySelector('[data-testid="start-first-step"]').click()`);
  assert(
    await waitFor(
      page,
      `document.querySelector('main [role="alert"]')?.textContent.includes('Controlled Workflow Worker failure')`,
    ),
  );
  assert.equal(
    JSON.stringify(await rows('sim_projects')),
    runBefore,
    'Worker crash partially changed the run',
  );
  await screenshot(page, resolve(out, 'workflow-failure.png'), undefined, false);
  await openPage(page, base + workflow[0]);
  assert(
    await waitFor(
      page,
      `document.querySelector('[data-testid="start-first-step"]')?.disabled===false`,
    ),
  );
  assert.equal(JSON.stringify(await rows('sim_projects')), runBefore);
  matrix('Workflow engine Worker', await unaffected([call, crm, academy]), {
    reload: true,
    local: true,
    failureHeldDuringOtherRoutes: true,
    noPartialRun: true,
  });

  // Objective checks checkpoint an open answer before the AI route fails; retry reuses that attempt.
  await setFailure('ai');
  const aiPath = '/exercise/EX-WHAT_WOULD_YOU_BUILD-glowhaus-leads';
  await openPage(page, base + aiPath);
  assert(await waitFor(page, `!!document.querySelector('main textarea')`));
  const answer =
    'I would ask Priya to verify response times first. Start with an owned manual callback queue and daily review; defer complex automation until volume and consent are established.';
  await page.evaluate(
    `(()=>{const input=document.querySelector('main textarea'),set=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set;set.call(input,${JSON.stringify(answer)});input.dispatchEvent(new Event('input',{bubbles:true}));})()`,
  );
  await click(page, 'Run it');
  assert(
    await waitFor(
      page,
      `document.querySelector('main [role="alert"]')?.textContent.includes('AI evaluation is unavailable')`,
    ),
  );
  const pending = (await rows('workspace')).find(
    (row) => row.value?.exercise_id === 'EX-WHAT_WOULD_YOU_BUILD-glowhaus-leads',
  );
  assert.equal(pending.value.response.text, answer);
  assert(
    pending.value.submitted?.rubric_id,
    'Objective result was not checkpointed before AI failure',
  );
  await screenshot(page, resolve(out, 'ai-failure.png'), undefined, false);
  await openPage(page, base + aiPath);
  assert(
    await waitFor(
      page,
      `document.querySelector('main textarea')?.value===${JSON.stringify(answer)}`,
    ),
  );
  assert(
    await waitFor(
      page,
      `[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Retry evaluation')`,
    ),
  );
  await click(page, 'Retry evaluation');
  assert(
    await waitFor(
      page,
      `document.querySelector('main [role="alert"]')?.textContent.includes('AI evaluation is unavailable')`,
    ),
  );
  const retried = (await rows('workspace')).find(
    (row) => row.value?.exercise_id === 'EX-WHAT_WOULD_YOU_BUILD-glowhaus-leads',
  );
  assert.equal(retried.value.attempt_id, pending.value.attempt_id);
  assert.equal(
    (await rows('exercise_attempts')).filter(
      (row) => row.exercise_id === 'EX-WHAT_WOULD_YOU_BUILD-glowhaus-leads',
    ).length,
    0,
  );
  const deterministic = '/exercise/EX-WHAT_WOULD_YOU_BUILD-connect-json';
  await openPage(page, base + deterministic);
  assert(await waitFor(page, `!!document.querySelector('[data-testid="write-repair"]')`));
  for (const [selector, value] of [
    [
      '[data-testid="write-repair"]',
      '{"contact":{"name":"Jordan","active":false,"budget":0},"tags":["consult"]}',
    ],
    ['[data-testid="write-projection"]', '{"active":false,"budget":0,"tag_count":1}'],
  ])
    await page.evaluate(
      `(()=>{const input=document.querySelector(${JSON.stringify(selector)}),set=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set;set.call(input,${JSON.stringify(value)});input.dispatchEvent(new Event('input',{bubbles:true}));})()`,
    );
  await click(page, 'Run it');
  assert(await waitFor(page, `!!document.querySelector('[data-outcome="passed"]')`));
  matrix('AI client/gateway', await unaffected([workflow, crm, academy]), {
    reload: true,
    local: true,
    failureHeldDuringOtherRoutes: true,
    sameAttemptOnRetry: true,
    deterministicCompletion: true,
  });

  // A failed push keeps the local record/outbox; reconnect drains it without duplicating the note.
  await setFailure('sync');
  await openPage(page, base + '/system');
  assert(
    await waitFor(
      page,
      `[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Add test note')`,
    ),
  );
  const notesBeforeFailure = await rows('notes');
  const priorNoteIds = new Set(notesBeforeFailure.map((note) => note.id));
  await click(page, 'Add test note');
  for (
    let attempt = 0;
    attempt < 40 && (await rows('notes')).length <= notesBeforeFailure.length;
    attempt += 1
  )
    await new Promise((resolve) => setTimeout(resolve, 100));
  await requestSync(page);
  assert(await waitFor(page, `document.body.textContent.includes('controlled_sync_failure')`));
  const failedNotes = await rows('notes');
  const retryNote = failedNotes.find((note) => !priorNoteIds.has(note.id));
  assert(retryNote, 'Add test note did not persist a new note');
  // The screen can still show the previous scheduled attempt's error while the explicit
  // retry owns this row as syncing. Wait for the actual outbox rollback, not stale error text.
  const pendingRetry = async () =>
    (await rows('sync_queue')).some(
      (operation) =>
        operation.entity === 'notes' &&
        operation.entity_id === retryNote.id &&
        operation.status === 'pending',
    );
  for (let attempt = 0; attempt < 80 && !(await pendingRetry()); attempt += 1)
    await new Promise((resolve) => setTimeout(resolve, 100));
  assert(await pendingRetry(), 'Failed push did not return the new note to pending');
  await openPage(page, base + '/system');
  assert.equal((await rows('notes')).length, failedNotes.length);
  const newerBody = 'Newer local work written while sync is unavailable';
  assert(await waitFor(page, `!!document.querySelector('textarea')`));
  await typeInto(page, 'textarea', newerBody);
  await click(page, 'Save note');
  for (
    let attempt = 0;
    attempt < 80 &&
    (await rows('notes')).find((note) => note.id === retryNote.id)?.body !== newerBody;
    attempt += 1
  )
    await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal((await rows('notes')).find((note) => note.id === retryNote.id)?.body, newerBody);
  const pushUnaffected = await unaffected([workflow, crm, academy, call]);
  await setFailure(null);
  await openPage(page, base + '/system');
  await waitFor(
    page,
    `[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Sync now')`,
  );
  await requestSync(page);
  const retryStillQueued = async () =>
    (await rows('sync_queue')).some(
      (operation) => operation.entity === 'notes' && operation.entity_id === retryNote.id,
    );
  for (let attempt = 0; attempt < 160 && (await retryStillQueued()); attempt += 1)
    await new Promise((resolve) => setTimeout(resolve, 125));
  assert.equal(await retryStillQueued(), false, 'Failed note did not drain on retry');
  assert(
    (await rows('sync_shadow')).some(
      (shadow) => shadow.entity === 'notes' && shadow.entity_id === retryNote.id,
    ),
    'Recovered note has no confirmed server shadow',
  );
  for (let attempt = 0; attempt < 160 && (await rows('sync_state'))[0]?.last_error; attempt += 1)
    await new Promise((resolve) => setTimeout(resolve, 125));
  assert.equal((await rows('sync_state'))[0]?.last_error ?? null, null);
  assert.equal((await rows('notes')).length, failedNotes.length);
  assert.equal(
    (await rows('notes')).find((note) => note.id === retryNote.id)?.body,
    newerBody,
    'Retry overwrote newer local work',
  );
  matrix('Sync push', pushUnaffected, {
    reload: true,
    local: true,
    pendingRetried: true,
    failureHeldDuringOtherRoutes: true,
    duplicateNotes: false,
    newerLocalWorkPreserved: true,
  });

  // Pull failure is separate: a rejected push never reaches pullChanges, so one transport
  // failure cannot stand in for both boundaries.
  await setFailure('sync-pull');
  await openPage(page, base + '/system');
  assert(await waitFor(page, `!!document.querySelector('textarea')`));
  const pullBody = 'Local edit retained through a separately failed pull';
  await typeInto(page, 'textarea', pullBody);
  await click(page, 'Save note');
  await requestSync(page);
  assert(await waitFor(page, `document.body.textContent.includes('controlled_sync-pull_failure')`));
  assert(await page.evaluate(`Number(sessionStorage.getItem('__bloomlab_failed_sync-pull')) > 0`));
  const beforePullReload = (await rows('notes')).find((note) => note.id === retryNote.id);
  assert.equal(beforePullReload.body, pullBody);
  await openPage(page, base + '/system');
  assert.equal((await rows('notes')).find((note) => note.id === retryNote.id)?.body, pullBody);
  const pullUnaffected = await unaffected([workflow, crm, academy, call]);
  await setFailure(null);
  await openPage(page, base + '/system');
  assert(
    await waitFor(
      page,
      `[...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'Sync now')`,
    ),
  );
  await requestSync(page);
  for (let attempt = 0; attempt < 160 && (await rows('sync_state'))[0]?.last_error; attempt += 1)
    await new Promise((resolve) => setTimeout(resolve, 125));
  assert.equal((await rows('sync_state'))[0]?.last_error ?? null, null);
  assert.equal((await rows('notes')).length, failedNotes.length);
  assert.equal((await rows('notes')).find((note) => note.id === retryNote.id)?.body, pullBody);
  matrix('Sync pull', pullUnaffected, {
    reload: true,
    local: true,
    failureHeldDuringOtherRoutes: true,
    separatePullFailureObserved: true,
    newerLocalWorkPreserved: true,
    duplicateNotes: false,
  });

  const health = await (await fetch(base + '/api/health', { cache: 'no-store' })).json();
  const browserHead = await page.evaluate(
    `document.querySelector('[data-build-id]')?.dataset.buildId`,
  );
  assert.equal(health.build_id, browserHead);
  if (head) assert.equal(health.build_id, head);
  report.identity = { browser: browserHead, worker: health.build_id };
  report.ok = report.matrix.length === 5;
} catch (error) {
  report.error = String(error?.stack ?? error);
  report.failureContext = await page
    .evaluate(
      `({
    url: location.href, readyState: document.readyState,
    body: document.body.innerText.slice(0, 12000),
    injectedRequests: Object.fromEntries(Object.entries(sessionStorage).filter(([key]) => key.startsWith('__bloomlab_failed_'))),
    syncCompleted: document.querySelector('[data-sync-completed]')?.dataset.syncCompleted ?? null
  })`,
    )
    .catch(() => null);
  await screenshot(page, resolve(out, 'probe-failure.png'), undefined, false).catch(() => {});
} finally {
  await setFailure(null).catch(() => {});
  await page
    .evaluate(
      `(async()=>{const rows=await new Promise((resolve,reject)=>{const request=indexedDB.open('bloomlab');request.onsuccess=()=>{const database=request.result,read=database.transaction('device').objectStore('device').getAll();read.onsuccess=()=>{resolve(read.result);database.close()};read.onerror=()=>reject(read.error)};request.onerror=()=>reject(request.error)});const d=rows[0];if(d?.session_token)await fetch('/api/sync/devices/revoke',{method:'POST',headers:{authorization:'Bearer '+d.session_token,'content-type':'application/json'},body:JSON.stringify({device_id:d.device_id})});})()`,
    )
    .catch(() => {});
  writeFileSync(resolve(out, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report));
  await browser.close();
}
process.exitCode = probeExitCode(report);
