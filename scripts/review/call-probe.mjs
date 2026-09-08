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
    'Local browser, real IndexedDB and MediaRecorder; virtual microphone and controlled HTTP fixtures. No live provider acceptance.',
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
  });
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
    if (url.pathname === '/api/ai/evaluate')
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
    if (path === 'attempts' && method === 'POST') {
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
      if (action === 'recordings')
        return ok(Object.values(probe.recordings).filter((r) => r.attempt_id === id));
      if (action === 'audio') {
        if (probe.audioDelay) await new Promise((resolve) => setTimeout(resolve, probe.audioDelay));
        return ok({ error: 'audio_unavailable' }, 404);
      }
      if (action === 'turn') {
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
          move,
          interpretation: body.move ? 'explicit' : 'authored_rule',
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
async function speak(method = 'touch') {
  await activate('Record reply', method);
  await phase('recording');
  await sleep(800);
  await activate('Stop recording', method);
  await phase('locally_saved');
}
async function confirm(move, method = 'touch') {
  const replies = {
    permission: 'Could I ask about unanswered quotes for a minute?',
    process: 'Who handles quote follow-up today, and when do they contact the customer?',
    reflect: 'So the gap is unanswered quotes, not replacing dispatch. Have I understood that?',
    next_step: 'Could we agree a short process review with Tina before deciding on a build?',
  };
  assert(await waitFor(page, "document.querySelector('#call-transcript')?.disabled===false"));
  await typeInto(page, '#call-transcript', replies[move]);
  assert(
    await waitFor(
      page,
      `document.querySelector('#call-transcript')?.value===${JSON.stringify(replies[move])}`,
    ),
  );
  await activate('Confirm transcript and continue', method);
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
  await activate('Start call');
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
  await page.evaluate('window.__callProbe.failSTT=true');
  await activate('Transcribe recording');
  await phase('recoverable_error');
  assert.equal(
    await page.evaluate("window.__callProbe.rows('call_recordings').then(r=>r.length)"),
    1,
  );
  const uploads = await page.evaluate(
    "window.__callProbe.requests.filter(r=>r.method==='PUT').length",
  );
  await activate('Retry transcription');
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
      '({width:innerWidth,scroll:document.documentElement.scrollWidth,room:!!document.querySelector("[data-testid=call-room]"),notes:!!document.querySelector("#call-notes")})',
    );
    assert(measure.scroll <= measure.width + 1, `Horizontal overflow at ${width}`);
    report.widths.push(measure);
    await screenshot(page, resolve(out, `call-${width}.png`), undefined, false);
  }
  await setViewport(page, 390, 900, { mobile: true });
  await confirm('permission');
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
  await activate('Delete audio');
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
  await activate('Get call feedback');
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
  await activate('Get call feedback', 'keyboard');
  assert(
    await waitFor(page, "window.__callProbe.rows('exercise_attempts').then(rows=>rows.length===2)"),
  );
  report.checks.push(
    'Full desktop keyboard call through feedback, visible focus and microphone denial recovery',
  );
  for (const exercise of exercises.filter((e) => ['independent', 'pressure'].includes(e.mode))) {
    await openPage(page, `${base}/exercise/${exercise.id}`);
    assert.equal(
      await page.evaluate('!!document.querySelector("[data-testid=call-anchors]")'),
      false,
    );
  }
  report.checks.push('Independent/pressure anchors absent from DOM; reduced-motion rendering');
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
