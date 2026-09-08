// Two built app shells and real service workers, with a virtual microphone and controlled
// call/provider HTTP fixtures. No physical-device or live-provider acceptance claim.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { validateContentDir } from '@bloomlab/content-schema/node';
import { session, openPage, setViewport, screenshot, sleep } from './cdp.mjs';
import { probeHelpers } from './probe-lib.mjs';
import { callFixtures } from './call-fixtures.mjs';

const roots = [process.env.PWA_OLD, process.env.PWA_NEW].map((path) => resolve(path ?? ''));
assert(
  roots.every((path) => existsSync(resolve(path, 'sw.js'))),
  'PWA_OLD and PWA_NEW must be built client directories',
);
const builds = ['local-pwa-a', 'local-pwa-b'];
const out = resolve(process.env.REVIEW_OUT ?? '.review/phase-21-pwa-update');
mkdirSync(out, { recursive: true });
let serving = 0;
const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};
const server = createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname === '/api/health') {
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(JSON.stringify({ ok: true, build_id: builds[serving], environment: 'preview' }));
    return;
  }
  let file = resolve(roots[serving], '.' + pathname);
  if (!file.startsWith(roots[serving] + sep)) file = resolve(roots[serving], 'index.html');
  if (!existsSync(file) || !extname(file)) file = resolve(roots[serving], 'index.html');
  res.writeHead(200, {
    'content-type': mime[extname(file)] ?? 'application/octet-stream',
    'cache-control': 'no-cache',
  });
  res.end(readFileSync(file));
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}`;
const { waitFor, typeInto } = probeHelpers({ base });
const compiled = await validateContentDir(resolve('content'), { enforceLock: true });
assert(compiled.bundle);
const bundle = compiled.bundle;
const exercises = bundle.exercises.filter((e) => e.call);
const cold = exercises.find((e) => e.call.mode === 'cold_call');
const rubric = bundle.rubrics.find((r) => r.id === cold.grading.rubric);
const phrases = [
  'Do you have a minute to ask about unanswered quotes?',
  'Who handles quote follow-up today?',
  'The gap is unanswered quotes, not replacing dispatch. Is that right?',
  'Could we arrange a short process review with Tina?',
];
const report = {
  scope: 'Real A/B PWA lifecycle and native virtual-microphone capture; controlled HTTP providers.',
  scenarios: [],
  widths: [],
};
async function scenario(kind) {
  serving = 0;
  const { page, close } = await session();
  const act = async (label) => {
    assert(
      await waitFor(
        page,
        `[...document.querySelectorAll('button')].some(b=>b.textContent.trim()===${JSON.stringify(label)}&&!b.disabled)`,
      ),
      `Enabled ${label}`,
    );
    await page.evaluate(
      `[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(label)}).click()`,
    );
  };
  const phase = async (name) =>
    assert(
      await waitFor(
        page,
        `document.querySelector('[data-testid=call-room]')?.dataset.phase===${JSON.stringify(name)}`,
      ),
      `Phase ${name}`,
    );
  const loaded = () => page.evaluate("document.querySelector('[data-build-id]')?.dataset.buildId");
  const safe = () =>
    waitFor(
      page,
      "[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Reload to update'&&!b.disabled)",
    );
  const speak = async () => {
    await act('Record reply');
    await phase('recording');
    await sleep(500);
    await act('Stop recording');
    await phase('locally_saved');
    await act('Transcribe recording');
    await phase('transcript_review');
  };
  const confirm = async (text) => {
    await typeInto(page, '#call-transcript', text);
    await act('Confirm transcript and continue');
  };
  try {
    await page.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `(${callFixtures.toString()})(${JSON.stringify(exercises)},${JSON.stringify(rubric)},${JSON.stringify(bundle.content_version)});sessionStorage.setItem('pwa-probe-loads',String(Number(sessionStorage.getItem('pwa-probe-loads')||0)+1));`,
    });
    await setViewport(page, 390, 900, { mobile: true });
    await page.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
    });
    await openPage(page, base);
    assert(await waitFor(page, '!!document.querySelector("[data-build-id]")'));
    assert(await waitFor(page, "window.__callProbe.rows('device').then(rows=>rows.length===1)"));
    await page.evaluate(
      `(async()=>{await window.__callProbe.rows('device');await new Promise((resolve,reject)=>{const r=indexedDB.open('bloomlab');r.onsuccess=()=>{const db=r.result,tx=db.transaction('device','readwrite'),s=tx.objectStore('device'),q=s.getAll();q.onsuccess=()=>s.put({...q.result[0],session_token:'call-probe-session'});tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>reject(tx.error);};});await navigator.serviceWorker.ready;})()`,
    );
    assert(await waitFor(page, '!!navigator.serviceWorker.controller'));
    await openPage(page, `${base}/exercise/${cold.id}`);
    await act('Start call');
    await act('Continue with client text');
    if (kind === 'recording' || kind === 'local-save') {
      await act('Record reply');
      await phase('recording');
      await sleep(500);
      if (kind === 'local-save') {
        await page.evaluate(
          `(()=>{const digest=crypto.subtle.digest.bind(crypto.subtle);let release;const gate=new Promise(r=>release=r);window.__releaseLocalSave=release;crypto.subtle.digest=async(...args)=>{window.__localSaveWaiting=true;await gate;return digest(...args);};})()`,
        );
        await act('Stop recording');
        assert(await waitFor(page, 'window.__localSaveWaiting===true'));
        await phase('recording');
      }
    } else if (kind === 'review' || kind === 'pending-turn') {
      await speak();
      await typeInto(page, '#call-transcript', phrases[0]);
      if (kind === 'pending-turn') {
        await page.evaluate("window.__callProbe.hold('confirm')");
        await act('Confirm transcript and continue');
        await phase('evaluating');
      }
    } else if (kind === 'feedback') {
      for (let turn = 0; turn < 4; turn++) {
        if (turn) await act('Continue with client text');
        await speak();
        await confirm(phrases[turn]);
      }
      await act('Continue with client text');
      await phase('complete');
      await page.evaluate("window.__callProbe.hold('feedback')");
      await act('Get call feedback');
      assert(
        await waitFor(
          page,
          "[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Getting feedback…'&&b.disabled)",
        ),
      );
    }
    const loads = await page.evaluate("sessionStorage.getItem('pwa-probe-loads')");
    assert.equal(await loaded(), builds[0]);
    await page.evaluate(
      "window.__controllerChanges=0;navigator.serviceWorker.addEventListener('controllerchange',()=>window.__controllerChanges++)",
    );
    serving = 1;
    await page.evaluate(
      "window.dispatchEvent(new Event('focus'));navigator.serviceWorker.getRegistration().then(r=>r.update())",
    );
    assert(await waitFor(page, "!!document.querySelector('[data-testid=app-update]')", 150));
    assert(
      await waitFor(page, 'navigator.serviceWorker.getRegistration().then(r=>!!r.waiting)', 150),
    );
    assert.equal(await loaded(), builds[0]);
    assert(
      await page.evaluate(
        "!!document.querySelector('[data-testid=app-update] [role=status][aria-live=polite]')",
      ),
    );
    if (kind === 'idle') {
      assert(await safe());
      for (const width of [1440, 1024, 768, 390, 320]) {
        await setViewport(page, width, 900, { mobile: width < 768 });
        assert(await page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'));
        await screenshot(page, resolve(out, `update-${width}.png`), undefined, false);
        report.widths.push(width);
      }
    } else {
      assert.equal(await safeWithNoWait(page), false);
      // Another tab can activate a waiting worker. This tab must keep its live recording/work.
      await page.evaluate(
        "navigator.serviceWorker.getRegistration().then(r=>r.waiting.postMessage({type:'SKIP_WAITING'}))",
      );
      assert(await waitFor(page, 'window.__controllerChanges>0'));
      await sleep(200);
      assert.equal(await loaded(), builds[0]);
      assert.equal(await page.evaluate("sessionStorage.getItem('pwa-probe-loads')"), loads);
      assert.equal(await safeWithNoWait(page), false);
      await screenshot(page, resolve(out, `deferred-${kind}-390.png`), undefined, false);
      if (kind === 'recording') {
        await act('Stop recording');
        await phase('locally_saved');
      }
      if (kind === 'local-save') {
        await page.evaluate('window.__releaseLocalSave()');
        await phase('locally_saved');
      }
      if (kind === 'review') await confirm(phrases[0]);
      if (kind === 'pending-turn') await page.evaluate("window.__callProbe.release('confirm')");
      if (kind === 'feedback') await page.evaluate("window.__callProbe.release('feedback')");
      assert(await safe());
      // Finishing a checkpoint enables the action; it still does not auto-reload.
      assert.equal(await loaded(), builds[0]);
    }
    await act('Reload to update');
    assert(
      await waitFor(
        page,
        `document.querySelector('[data-build-id]')?.dataset.buildId===${JSON.stringify(builds[1])}`,
        150,
      ),
    );
    const persisted = await page.evaluate(
      "Promise.all([window.__callProbe.rows('workspace'),window.__callProbe.rows('call_recordings'),window.__callProbe.rows('exercise_attempts')]).then(([work,audio,attempts])=>({active:work.filter(r=>r.key.startsWith('exercise.attempt')).length,audio:audio.map(r=>({bytes:r.blob.size})),completed:attempts.length}))",
    );
    if (kind === 'recording' || kind === 'local-save')
      assert(persisted.audio.some((r) => r.bytes > 0));
    else if (kind === 'feedback') assert.equal(persisted.completed, 1);
    else assert.equal(persisted.active, 1);
    report.scenarios.push({
      kind,
      before: builds[0],
      after: await loaded(),
      retained_until_safe: true,
      explicit_reload: true,
      persisted,
      result: 'passed',
    });
  } catch (error) {
    report.failure = {
      kind,
      ui: await page.evaluate(
        "({phase:document.querySelector('[data-testid=call-room]')?.dataset.phase,buttons:[...document.querySelectorAll('main button')].map(b=>({label:b.textContent.trim(),disabled:b.disabled})),alerts:[...document.querySelectorAll('[role=alert]')].map(e=>e.textContent)})",
      ),
    };
    await screenshot(page, resolve(out, `failure-${kind}.png`), undefined, false);
    throw error;
  } finally {
    await close();
  }
}
async function safeWithNoWait(page) {
  return page.evaluate(
    "[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Reload to update'&&!b.disabled)",
  );
}
try {
  for (const kind of ['idle', 'recording', 'local-save', 'review', 'pending-turn', 'feedback'])
    await scenario(kind);
  report.status = 'passed';
} catch (error) {
  report.status = 'failed';
  report.error = String(error);
  throw error;
} finally {
  server.closeAllConnections();
  server.close();
  writeFileSync(resolve(out, 'pwa-update-probe.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
}
