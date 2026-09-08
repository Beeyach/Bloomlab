/* global window, document, location, indexedDB */
// Browser/IndexedDB/MediaRecorder review with explicit API fixtures and a virtual microphone.
// This does NOT establish live Google, ElevenLabs, IAM, or private remote R2 acceptance.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { validateContentDir } from '@bloomlab/content-schema/node';
import { resolve } from 'node:path';
import { session, openPage, setViewport, screenshot, sleep } from './cdp.mjs';
import { probeHelpers } from './probe-lib.mjs';

const base = process.env.BASE ?? 'http://127.0.0.1:5174';
const out = resolve(process.env.REVIEW_OUT ?? '.review/phase-21-call');
const compiled = await validateContentDir(resolve('content'), { enforceLock: true });
assert(compiled.bundle, 'Call probe requires validated, locked current content');
const bundle = compiled.bundle;
const exercises = bundle.exercises.filter((e) => e.call);
const cold = exercises.find((e) => e.call.mode === 'cold_call');
const rubric = bundle.rubrics.find((r) => r.id === cold.grading.rubric);
assert(
  process.env.CHROME_FLAGS?.includes('--use-fake-device-for-media-stream'),
  'Use the documented virtual microphone flags; this probe is not a live-provider claim.',
);
mkdirSync(out, { recursive: true });
const { page, close } = await session();
const { waitFor, typeInto } = probeHelpers({ base });
const report = {
  infrastructure:
    'Browser, real IndexedDB and MediaRecorder; virtual microphone and controlled HTTP fixtures. No live provider acceptance or paid provider requests.',
  head_sha: process.env.REVIEW_HEAD,
  base,
  widths: [],
  checks: [],
  requests: [],
};

function fixtures(exercises, rubric, version) {
  const originalFetch = window.fetch.bind(window);
  const saved = JSON.parse(
    sessionStorage.getItem('phase21-probe-server') ?? '{"calls":{},"recordings":{}}',
  );
  const probe = (window.__callProbe = {
    ...saved,
    requests: [],
    microphoneRequests: 0,
    failSTT: false,
    denyMic: false,
    audioDelay: 0,
    failFeedback: false,
    failTurn: false,
    turnBodies: [],
  });
  const gates = {};
  probe.hold = (name) => {
    let release;
    const promise = new Promise((resolve) => {
      release = resolve;
    });
    gates[name] = { promise, release };
  };
  probe.release = (name) => gates[name]?.release();
  const waiting = (name) => gates[name]?.promise;
  probe.clicks = [];
  document.addEventListener('click', (event) =>
    probe.clicks.push(event.target.closest('button')?.textContent?.trim() ?? 'other'),
  );
  const persist = () =>
    sessionStorage.setItem(
      'phase21-probe-server',
      JSON.stringify({ calls: probe.calls, recordings: probe.recordings }),
    );
  probe.rows = (name) =>
    new Promise((resolve, reject) => {
      const request = indexedDB.open('bloomlab');
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction(name);
        const read = tx.objectStore(name).getAll();
        read.onsuccess = () => {
          resolve(read.result);
          db.close();
        };
        read.onerror = () => reject(read.error);
      };
      request.onerror = () => reject(request.error);
    });
  const microphone = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia = (...args) => {
    probe.microphoneRequests++;
    if (probe.denyMic) {
      probe.denyMic = false;
      return Promise.reject(new DOMException('Probe permission denial', 'NotAllowedError'));
    }
    return microphone(...args);
  };
  window.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url, location.href);
    const origins = new Set(JSON.parse(sessionStorage.getItem('call-probe-origins') ?? '[]'));
    if (url.protocol === 'http:' || url.protocol === 'https:') origins.add(url.origin);
    sessionStorage.setItem('call-probe-origins', JSON.stringify([...origins]));
    if (url.pathname.startsWith('/api/sync/'))
      return Response.json(
        { error: 'Sync is offline in this controlled browser fixture' },
        { status: 503 },
      );
    if (!url.pathname.startsWith('/api/call/') && url.pathname !== '/api/ai/evaluate')
      return originalFetch(input, init);
    const method = init.method ?? 'GET';
    probe.requests.push({ path: url.pathname, method });
    const ok = (value, status = 200) => Response.json(value, { status });
    if (new Headers(init.headers).get('authorization') !== 'Bearer call-probe-session')
      return ok({ error: 'device_not_linked' }, 401);
    const path = url.pathname.replace('/api/call/', '');
    const body = typeof init.body === 'string' ? JSON.parse(init.body) : null;
    if (path === 'config') return ok({ enabled: true });
    if (url.pathname === '/api/ai/evaluate') {
      await waiting('feedback');
      if (probe.failFeedback) {
        probe.failFeedback = false;
        return ok({ error: 'evaluation_invalid' }, 502);
      }
      return ok({
        run_id: crypto.randomUUID(),
        rubric_id: rubric.id,
        rubric_version: rubric.version,
        result: {
          score: 100,
          rubric_results: rubric.items.map((item) => ({
            id: item.id,
            passed: true,
            reason: 'Controlled browser-review feedback fixture.',
          })),
          critical_issue: null,
          strengths: ['Controlled fixture.'],
          improvements: ['Live feedback remains to be verified.'],
          next_probe: 'Try another call mode.',
          confidence: 0.9,
        },
      });
    }
    if (path === 'attempts' && method === 'POST') {
      await waiting('start');
      const exercise = exercises.find((e) => e.id === body.exercise_id);
      const node = exercise.conversation?.nodes.find(
        (n) => n.id === exercise.conversation.opening,
      ) ?? {
        id: exercise.negotiation.start,
        client_message: exercise.negotiation.nodes.find((n) => n.id === exercise.negotiation.start)
          .message,
      };
      probe.calls[body.attempt_id] ??= {
        attempt_id: body.attempt_id,
        exercise_id: exercise.id,
        content_version: version,
        turn: 0,
        current: { node: node.id, text: node.client_message, dynamic: false },
        turns: [],
        complete: false,
        projection: {
          complete: false,
          turns: 0,
          talk_ratio_learner: null,
          pitched_before_diagnosis: false,
          diagnosis_agreed: false,
          next_step_agreed: false,
          economically_sound: true,
          structurally_sound: true,
        },
      };
      persist();
      return ok(probe.calls[body.attempt_id]);
    }
    const [kind, id, action] = path.split('/');
    if (kind === 'attempts') {
      const call = probe.calls[id];
      if (!call) return ok({ error: 'attempt_not_found' }, 404);
      if (!action) return ok(call);
      if (action === 'recordings') {
        await waiting('cleanup');
        return ok(Object.values(probe.recordings).filter((r) => r.attempt_id === id));
      }
      if (action === 'audio') {
        if (probe.audioDelay) await new Promise((resolve) => setTimeout(resolve, probe.audioDelay));
        return ok({ error: 'audio_unavailable' }, 404);
      }
      if (action === 'turn') {
        probe.turnBodies.push(JSON.stringify(body));
        await waiting('confirm');
        if (probe.failTurn) {
          probe.failTurn = false;
          return ok({ error: 'turn_in_progress' }, 409);
        }
        if (call.turn > body.turn) return ok(call);
        const exercise = exercises.find((e) => e.id === call.exercise_id);
        const node = exercise.conversation.nodes.find((n) => n.id === call.current.node);
        const move =
          body.move ??
          exercise.call.rules.find(
            (rule) =>
              rule.node === node.id &&
              rule.phrases.some((phrase) => body.transcript.toLowerCase().includes(phrase)),
          )?.move;
        const next = exercise.conversation.nodes.find(
          (n) => n.id === (node.moves.find((m) => m.id === move)?.next ?? node.fallback),
        );
        const response = { node: next.id, text: next.client_message, dynamic: false };
        const recording = probe.recordings[body.recording_id];
        recording.confirmed_transcript = body.transcript;
        recording.status = 'confirmed';
        call.turns.push({
          turn: call.turn,
          recording_id: body.recording_id,
          original_transcript: recording.original_transcript,
          confirmed_transcript: body.transcript,
          client: call.current,
          response,
          move: move ?? null,
          interpretation: body.move ? 'explicit' : move ? 'rule' : 'fallback',
        });
        call.turn++;
        call.current = response;
        call.complete = Boolean(next.end);
        call.projection = {
          ...call.projection,
          complete: call.complete,
          turns: call.turn,
          diagnosis_agreed: Boolean(next.diagnosis_agreed),
          next_step_agreed: Boolean(next.covers?.includes('next_step')),
          talk_ratio_learner: 0.3,
        };
        persist();
        return ok(call);
      }
    }
    if (kind === 'recordings') {
      if (method === 'PUT') {
        await waiting('upload');
        const local = (await probe.rows('call_recordings')).find((r) => r.recording_id === id);
        if (
          !local?.blob?.size ||
          local.checksum !== new Headers(init.headers).get('x-audio-checksum')
        )
          throw new Error('Upload preceded the local Blob checkpoint');
        const call = probe.calls[url.searchParams.get('attempt_id')];
        probe.recordings[id] ??= {
          recording_id: id,
          attempt_id: call.attempt_id,
          exercise_id: call.exercise_id,
          turn: Number(url.searchParams.get('turn')),
          mime_type: local.mime_type,
          byte_length: local.blob.size,
          checksum: local.checksum,
          duration_ms: local.duration_ms,
          retain: url.searchParams.get('retain') === 'true',
          created_at: new Date().toISOString(),
          status: 'uploaded',
          original_transcript: null,
          confirmed_transcript: null,
          deleted_at: null,
        };
        persist();
        return ok(probe.recordings[id]);
      }
      const recording = probe.recordings[id];
      if (!recording) return ok({ error: 'recording_not_found' }, 404);
      if (method === 'DELETE' || (action === 'ack' && !recording.retain)) {
        await waiting('delete');
        recording.deleted_at = new Date().toISOString();
        recording.status = 'deleted';
        recording.retain = false;
        persist();
        return ok(recording);
      }
      if (method === 'PATCH') {
        recording.retain = body.retain;
        persist();
        return ok(recording);
      }
      if (action === 'transcribe') {
        await waiting('transcribe');
        if (probe.failSTT) {
          probe.failSTT = false;
          return ok({ error: 'speech_timeout' }, 503);
        }
        recording.original_transcript ??= 'Could I ask about your coat follow-up?';
        recording.status = 'review';
        persist();
        return ok(recording);
      }
      return ok(recording);
    }
    return ok({ error: 'not_found' }, 404);
  };
}
await page.send('Page.addScriptToEvaluateOnNewDocument', {
  source: `(${fixtures.toString()})(${JSON.stringify(exercises)},${JSON.stringify(rubric)},${JSON.stringify(bundle.content_version)})`,
});
async function press(key, code = key, value) {
  await page.send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key,
    code,
    ...(key === 'Enter' ? { text: '\r' } : {}),
    ...(value ? { windowsVirtualKeyCode: value } : {}),
  });
  await page.send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key,
    code,
    ...(value ? { windowsVirtualKeyCode: value } : {}),
  });
}
async function tapSelector(selector) {
  const point = await page.evaluate(
    `(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`,
  );
  await page.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
  await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
async function activate(label, method = 'touch') {
  assert(
    await waitFor(
      page,
      `Array.from(document.querySelectorAll('button')).some(b=>b.textContent.trim()===${JSON.stringify(label)}&&!b.disabled)`,
    ),
    `${label} must be enabled`,
  );
  if (method === 'keyboard') {
    await page.evaluate(
      `Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()===${JSON.stringify(label)}).focus()`,
    );
    await press('Tab', 'Tab', 9);
    await page.send('Input.dispatchKeyEvent', {
      type: 'keyDown',
      key: 'Tab',
      code: 'Tab',
      modifiers: 8,
      windowsVirtualKeyCode: 9,
    });
    await page.send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key: 'Tab',
      code: 'Tab',
      modifiers: 8,
      windowsVirtualKeyCode: 9,
    });
    assert(
      await page.evaluate('document.activeElement.matches(":focus-visible")'),
      'Keyboard focus must be visible',
    );
    assert.equal(await page.evaluate('document.activeElement.textContent.trim()'), label);
    await press('Enter', 'Enter', 13);
  } else {
    const point = await page.evaluate(
      `(()=>{const b=Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()===${JSON.stringify(label)});b.scrollIntoView({block:'center'});const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`,
    );
    await page.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
    await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }
}
async function phase(value) {
  assert(
    await waitFor(
      page,
      `document.querySelector('[data-testid=call-room]')?.dataset.phase===${JSON.stringify(value)}`,
    ),
    `Expected phase ${value}`,
  );
}
async function requestCount(pathPart, method) {
  return page.evaluate(
    `window.__callProbe.requests.filter(r=>r.path.includes(${JSON.stringify(pathPart)})${method ? `&&r.method===${JSON.stringify(method)}` : ''}).length`,
  );
}
async function progress(label, pathPart, method, expectedCount) {
  const measure = await page.evaluate(`(()=>{
    const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(label)});
    if(!b)return null;
    const spinner=b.querySelector('[aria-hidden=true]');
    const status=[...document.querySelectorAll('[role=status]')].some(e=>e.textContent===${JSON.stringify(label)});
    b.click();b.click();
    return {label:b.textContent.trim(),disabled:b.disabled,busy:b.getAttribute('aria-busy'),spinner:!!spinner,announcement:status,animation:spinner&&getComputedStyle(spinner).animationName,opacity:getComputedStyle(b).opacity};
  })()`);
  assert(
    measure?.disabled && measure.busy === 'true' && measure.spinner && measure.announcement,
    `Immediate visible and announced progress: ${label}`,
  );
  assert.equal(measure.opacity, '1', 'Busy action stays legible');
  const reduced = await page.evaluate('matchMedia("(prefers-reduced-motion: reduce)").matches');
  if (reduced) assert.equal(measure.animation, 'none');
  else assert.notEqual(measure.animation, 'none');
  await sleep(150);
  assert(
    (await requestCount(pathPart, method)) <= expectedCount,
    `Duplicate operation during ${label}`,
  );
  report.checks.push(
    `Immediate ${label} spinner/live status; duplicate blocked; ${reduced ? 'reduced' : 'normal'} motion`,
  );
  return measure;
}
async function holdAction(label, pendingLabel, gate, pathPart, input = 'touch', method) {
  const expected = (await requestCount(pathPart, method)) + 1;
  await page.evaluate(`window.__callProbe.hold(${JSON.stringify(gate)})`);
  await activate(label, input);
  await progress(pendingLabel, pathPart, method, expected);
  assert(
    await waitFor(
      page,
      `window.__callProbe.requests.filter(r=>r.path.includes(${JSON.stringify(pathPart)})${method ? `&&r.method===${JSON.stringify(method)}` : ''}).length===${expected}`,
    ),
  );
  return expected;
}
async function speak(method = 'touch') {
  await activate('Record reply', method);
  await phase('recording');
  await sleep(800);
  await activate('Stop recording', method);
  await phase('locally_saved');
}
async function confirm(move, method = 'touch', failOnce = false) {
  const replies = {
    permission: 'Could I ask about unanswered quotes for a minute?',
    process: 'Who handles quote follow-up today, and when do they contact the customer?',
    reflect: 'So the gap is unanswered quotes, not replacing dispatch. Have I understood that?',
    next_step: 'Could we agree a short process review with Tina before deciding on a build?',
    unrelated: 'Purple umbrellas dance around the moon.',
  };
  assert(await waitFor(page, "document.querySelector('#call-transcript')?.disabled===false"));
  await typeInto(page, '#call-transcript', replies[move]);
  assert(
    await waitFor(
      page,
      `document.querySelector('#call-transcript')?.value===${JSON.stringify(replies[move])}`,
    ),
  );
  await page.evaluate(`window.__callProbe.hold('cleanup');window.__callProbe.failTurn=${failOnce}`);
  let expected = await holdAction(
    'Confirm transcript and continue',
    'Evaluating…',
    'confirm',
    '/turn',
    method,
  );
  await page.evaluate("window.__callProbe.release('confirm')");
  if (failOnce) {
    await phase('recoverable_error');
    expected = await holdAction('Retry confirmed turn', 'Evaluating…', 'confirm', '/turn', method);
    await page.evaluate("window.__callProbe.release('confirm')");
    assert(
      await page.evaluate(
        'window.__callProbe.turnBodies.at(-1)===window.__callProbe.turnBodies.at(-2)',
      ),
    );
    report.checks.push('Failed confirmation restores retry; exact saved turn resubmitted');
  }
  await phase('resolving');
  await progress('Saving turn…', '/turn', undefined, expected);
  assert.equal(
    await page.evaluate("document.querySelector('#call-transcript').value"),
    replies[move],
  );
  await screenshot(page, resolve(out, `saving-${method}.png`), undefined, false);
  await page.evaluate("window.__callProbe.release('cleanup')");
  assert(
    await waitFor(
      page,
      `Array.from(document.querySelectorAll('button')).some(b=>b.textContent.trim()==='Continue with client text'&&!b.disabled)`,
    ),
  );
}
try {
  await openPage(page, `${base}/`);
  assert(await waitFor(page, '!!window.__callProbe'));
  await page.evaluate(
    `(async()=>{await window.__callProbe.rows('device');await new Promise((resolve,reject)=>{const r=indexedDB.open('bloomlab');r.onsuccess=()=>{const db=r.result,tx=db.transaction('device','readwrite'),s=tx.objectStore('device'),q=s.getAll();q.onsuccess=()=>s.put({...q.result[0],session_token:'call-probe-session'});tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>reject(tx.error);};});})()`,
  );
  await openPage(page, `${base}/exercise/${cold.id}`);
  await setViewport(page, 390, 900, { mobile: true });
  await page.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  });
  assert.equal(await page.evaluate('window.__callProbe.microphoneRequests'), 0);
  await page.evaluate('window.__callProbe.audioDelay=2000');
  await holdAction('Start call', 'Starting call…', 'start', '/api/call/attempts', 'touch', 'POST');
  await page.evaluate("window.__callProbe.release('start')");
  await phase('tts_loading');
  await progress('Loading client audio…', '/audio', 'POST', 1);
  await activate('Continue with client text');
  await activate('Open notes');
  await typeInto(page, '#call-notes', 'Ask who owns quote follow-up.');
  await tapSelector('input[type=checkbox]');
  await speak();
  const local = await page.evaluate(
    "window.__callProbe.rows('call_recordings').then(rows=>rows.map(r=>({id:r.recording_id,bytes:r.blob.size,mime:r.mime_type,uploaded:r.uploaded})))",
  );
  assert(local[0].bytes > 0 && !local[0].uploaded);
  report.checks.push('Native MediaRecorder Blob saved before upload');
  await page.evaluate("window.__callProbe.failSTT=true;window.__callProbe.hold('transcribe')");
  await holdAction(
    'Transcribe recording',
    'Transcribing…',
    'upload',
    '/recordings/',
    'touch',
    'PUT',
  );
  await screenshot(page, resolve(out, 'transcribing-390.png'), undefined, false);
  await page.evaluate("window.__callProbe.release('upload')");
  await phase('transcribing');
  await progress('Transcribing…', '/transcribe', undefined, 1);
  await page.evaluate("window.__callProbe.release('transcribe')");
  await phase('recoverable_error');
  assert.equal(
    await page.evaluate("window.__callProbe.rows('call_recordings').then(r=>r.length)"),
    1,
  );
  const uploads = await page.evaluate(
    "window.__callProbe.requests.filter(r=>r.method==='PUT').length",
  );
  await holdAction('Retry transcription', 'Transcribing…', 'transcribe', '/transcribe');
  await page.evaluate("window.__callProbe.release('transcribe')");
  await phase('transcript_review');
  assert.equal(
    await page.evaluate("window.__callProbe.requests.filter(r=>r.method==='PUT').length"),
    uploads,
  );
  report.checks.push('STT failure preserves audio; retry sends no second upload');
  for (const width of [1440, 1024, 768, 390, 320]) {
    await setViewport(page, width, 900, { mobile: width < 768 });
    await page.evaluate('window.scrollTo(0,0)');
    await sleep(100);
    const measure = await page.evaluate(
      `({width:innerWidth,scroll:document.documentElement.scrollWidth,
        room:!!document.querySelector('[data-testid=call-room]'),notes:!!document.querySelector('#call-notes'),
        inputFonts:[...document.querySelectorAll('[data-testid=call-room] textarea,[data-testid=call-room] select,[data-testid=call-room] input:not([type=checkbox])')].map(e=>({label:e.id||e.closest('label')?.textContent.trim().slice(0,40),pixels:parseFloat(getComputedStyle(e).fontSize)}))})`,
    );
    assert(measure.scroll <= measure.width + 1, `Horizontal overflow at ${width}`);
    if (width < 768) {
      assert(measure.inputFonts.length >= 3, 'Review must include notes, transcript and move');
      assert(
        measure.inputFonts.every((input) => input.pixels >= 16),
        `Call inputs below 16px at ${width}: ${JSON.stringify(measure.inputFonts)}`,
      );
    }
    report.widths.push(measure);
    await screenshot(page, resolve(out, `call-${width}.png`), undefined, false);
  }
  await setViewport(page, 390, 900, { mobile: true });
  await confirm('permission', 'touch', true);
  await activate('Continue with client text');
  const decoding = await page.evaluate(
    `(async()=>{const row=(await window.__callProbe.rows('call_recordings'))[0];const context=new AudioContext();const decoded=await context.decodeAudioData(await row.blob.arrayBuffer());const result={seconds:decoded.duration,channels:decoded.numberOfChannels,sampleRate:decoded.sampleRate};await context.close();return result;})()`,
  );
  assert(decoding.seconds > 0);
  report.recording = decoding;
  report.requests.push(...(await page.evaluate('window.__callProbe.requests')));
  await openPage(page, `${base}/exercise/${cold.id}`);
  assert(await waitFor(page, "document.body.textContent.includes('1 confirmed turns')"));
  await activate('Open notes');
  assert.equal(
    await page.evaluate("document.querySelector('#call-notes').value"),
    'Ask who owns quote follow-up.',
  );
  await holdAction('Delete audio', 'Deleting audio…', 'delete', '/recordings/', 'touch', 'DELETE');
  await page.evaluate("window.__callProbe.release('delete')");
  assert(await waitFor(page, "window.__callProbe.rows('call_recordings').then(r=>r.length===0)"));
  assert.equal(
    await page.evaluate("window.__callProbe.rows('call_recordings').then(r=>r.length)"),
    0,
  );
  report.checks.push(
    'Reload preserves notes, confirmed transcript and retained Blob; explicit delete removes audio',
  );
  await tapSelector('input[type=checkbox]');
  for (const move of ['process', 'reflect', 'next_step']) {
    if (
      await page.evaluate(
        "Array.from(document.querySelectorAll('button')).some(b=>b.textContent.trim()==='Continue with client text')",
      )
    )
      await activate('Continue with client text');
    await speak();
    await activate('Transcribe recording');
    await phase('transcript_review');
    await confirm(move);
  }
  await activate('Continue with client text');
  await phase('complete');
  await page.evaluate('window.__callProbe.failFeedback=true');
  await holdAction('Get call feedback', 'Getting feedback…', 'feedback', '/api/ai/evaluate');
  await screenshot(page, resolve(out, 'feedback-390.png'), undefined, false);
  await page.evaluate("window.__callProbe.release('feedback')");
  await holdAction('Retry call feedback', 'Getting feedback…', 'feedback', '/api/ai/evaluate');
  await page.evaluate("window.__callProbe.release('feedback')");
  assert(await waitFor(page, "document.body.textContent.includes('CALL_PERFORMANCE_RUBRIC_V1')"));
  const evidence = await page.evaluate(
    "Promise.all([window.__callProbe.rows('exercise_attempts'),window.__callProbe.rows('sync_queue'),window.__callProbe.rows('call_recordings')]).then(([attempts,queue,audio])=>({attempts:attempts.length,dimensions:attempts[0].grade.rubric_evaluation.result.rubric_results.map(r=>r.id),queued:queue.length,rawInQueue:queue.some(r=>JSON.stringify(r).includes('audio/webm')),audio:audio.length}))",
  );
  assert.equal(evidence.dimensions.length, 8);
  assert.equal(evidence.rawInQueue, false);
  assert.equal(evidence.audio, 0);
  report.evidence = evidence;
  report.checks.push('Full four-turn call through feedback at 390px using touch');
  // A second complete call uses desktop keyboard input, including a microphone denial/retry.
  await setViewport(page, 1440, 900);
  await page.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }],
  });
  await activate('Try again', 'keyboard');
  await activate('Start call', 'keyboard');
  await activate('Continue with client text', 'keyboard');
  await page.evaluate('window.__callProbe.denyMic=true');
  await activate('Record reply', 'keyboard');
  await phase('recoverable_error');
  assert(
    await page.evaluate(
      "document.querySelector('[role=alert]')?.textContent.includes('Microphone permission')",
    ),
  );
  await activate('Record again', 'keyboard');
  await phase('recording');
  await sleep(800);
  await activate('Stop recording', 'keyboard');
  await phase('locally_saved');
  await activate('Transcribe recording', 'keyboard');
  await phase('transcript_review');
  await confirm('permission', 'keyboard');
  for (const move of ['process', 'reflect', 'next_step']) {
    await activate('Continue with client text', 'keyboard');
    await activate('Record reply', 'keyboard');
    await phase('recording');
    await sleep(800);
    await activate('Stop recording', 'keyboard');
    await phase('locally_saved');
    await activate('Transcribe recording', 'keyboard');
    await phase('transcript_review');
    await confirm(move, 'keyboard');
  }
  await activate('Continue with client text', 'keyboard');
  await phase('complete');
  await holdAction(
    'Get call feedback',
    'Getting feedback…',
    'feedback',
    '/api/ai/evaluate',
    'keyboard',
  );
  await page.evaluate("window.__callProbe.release('feedback')");
  assert(
    await waitFor(page, "window.__callProbe.rows('exercise_attempts').then(rows=>rows.length===2)"),
  );
  report.checks.push(
    'Full desktop keyboard call through feedback, visible focus and microphone denial recovery',
  );
  await activate('Try again', 'keyboard');
  await activate('Start call', 'keyboard');
  await activate('Continue with client text', 'keyboard');
  const clarify = cold.conversation.nodes.find(
    (n) =>
      n.id === cold.conversation.nodes.find((n) => n.id === cold.conversation.opening).fallback,
  );
  const expectedCue = clarify.moves.find(
    (m) => m.next !== clarify.id && ['ask', 'clarify', 'reflect'].includes(m.kind),
  ).label;
  for (let turn = 0; turn < 2; turn++) {
    await speak('keyboard');
    await activate('Transcribe recording', 'keyboard');
    await phase('transcript_review');
    await confirm('unrelated', 'keyboard');
    assert.equal(
      await page.evaluate("document.querySelector('[data-testid=call-recovery]')?.textContent"),
      `The call needs clarification. Try: ${expectedCue}.`,
    );
    await activate('Continue with client text', 'keyboard');
  }
  for (const width of [1440, 1024, 768, 390, 320]) {
    await setViewport(page, width, 900, { mobile: width < 768 });
    assert(
      await page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),
      `Recovery cue overflow at ${width}`,
    );
    await screenshot(page, resolve(out, `recovery-${width}.png`), undefined, false);
  }
  await speak();
  await activate('Transcribe recording');
  await phase('transcript_review');
  // The controlled server has no language classifier. Use the current authored move to
  // exercise real UI recovery without pretending the fixture interprets arbitrary speech.
  await page.evaluate(
    `(()=>{const select=document.querySelector('[data-testid=call-room] select');select.value=${JSON.stringify(clarify.moves.find((m) => m.next !== clarify.id && ['ask', 'clarify', 'reflect'].includes(m.kind)).id)};select.dispatchEvent(new Event('change',{bubbles:true}));})()`,
  );
  await confirm('process');
  assert.equal(
    await page.evaluate("!!document.querySelector('[data-testid=call-recovery]')"),
    false,
  );
  report.checks.push(
    'Two guided fallback turns show current authored guidance at five widths; advancing clears it',
  );
  for (const exercise of exercises.filter((e) => ['independent', 'pressure'].includes(e.mode))) {
    await openPage(page, `${base}/exercise/${exercise.id}`);
    assert.equal(
      await page.evaluate('!!document.querySelector("[data-testid=call-anchors]")'),
      false,
    );
    await activate('Start call');
    await activate('Continue with client text');
    await speak();
    await activate('Transcribe recording');
    await phase('transcript_review');
    await confirm('unrelated');
    assert.equal(
      await page.evaluate("!!document.querySelector('[data-testid=call-recovery]')"),
      false,
    );
    assert.equal(
      await page.evaluate("document.body.textContent.includes('The call needs clarification')"),
      false,
    );
  }
  report.checks.push(
    'Independent/pressure anchors and fallback coaching absent from DOM, including after off-path turns',
  );
  report.requests.push(...(await page.evaluate('window.__callProbe.requests')));
  report.browser_fetch_origins = await page.evaluate(
    "JSON.parse(sessionStorage.getItem('call-probe-origins')??'[]')",
  );
  assert.deepEqual(report.browser_fetch_origins, [new URL(base).origin]);
  assert(
    report.requests.every((r) => r.path.startsWith('/api/call/') || r.path === '/api/ai/evaluate'),
  );
  report.status = 'passed';
  writeFileSync(resolve(out, 'call-probe.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(
    JSON.stringify(
      {
        status: report.status,
        widths: report.widths.map((w) => w.width),
        checks: report.checks,
        recording: report.recording,
      },
      null,
      2,
    ),
  );
} catch (error) {
  report.status = 'failed';
  report.error = String(error);
  report.debug = await page
    .evaluate(
      "Promise.all([window.__callProbe.rows('workspace'),window.__callProbe.rows('device')]).then(([rows,devices])=>({clicks:window.__callProbe.clicks,attempts:rows.filter(r=>r.key.startsWith('exercise.attempt')).map(r=>({key:r.key,id:r.value.attempt_id,submitted:!!r.value.submitted,phase:r.value.response?.call?.phase,node:r.value.response?.call?.snapshot?.current?.node,complete:r.value.response?.call?.snapshot?.complete,turns:r.value.response?.call?.snapshot?.turns?.map(t=>({move:t.move,textLength:t.confirmed_transcript.length,node:t.client.node}))})),linked:!!devices[0]?.session_token}))",
    )
    .catch(() => null);
  writeFileSync(resolve(out, 'call-probe.json'), JSON.stringify(report, null, 2) + '\n');
  await screenshot(page, resolve(out, 'failure.png')).catch(() => {});
  throw error;
} finally {
  await close();
}
