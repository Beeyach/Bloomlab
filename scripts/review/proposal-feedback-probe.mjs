// Real Preview providers; fictional prerecorded speech and explicitly confirmed test text.
// This is not human microphone acceptance. Never reuse a human browser profile or credentials.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { probeHelpers } from './probe-lib.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const base = 'https://bloomlab-preview.cool-sunset-2169.workers.dev';
const { device, createKeyAndLink } = probeHelpers({ base });
const out = root + '.review/phase-21-feedback-reliability';
mkdirSync(out, { recursive: true });
const report = {
  started_at: new Date().toISOString(),
  head_sha: process.env.REVIEW_HEAD,
  base,
  scope:
    'Fictional prerecorded proposal through real Preview Google and Anthropic. No human microphone evidence.',
  turns: [],
  transcriptions: [],
  cleanup: [],
};
const save = () =>
  writeFileSync(
    out + '/' + (process.env.REVIEW_LABEL || 'proposal') + '.json',
    JSON.stringify(report, null, 2) + '\n',
  );
const stage = (name) => {
  report.stage = name;
  save();
  console.log(JSON.stringify({ stage: name }));
};
const query = (sql) =>
  JSON.parse(
    execFileSync(
      root + 'node_modules/.bin/wrangler',
      ['d1', 'execute', 'bloomlab-dev', '--env', 'preview', '--remote', '--json', '--command', sql],
      { cwd: root + 'worker', encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    ),
  ).flatMap((r) => r.results);
const review = await device('Proposal feedback reliability reviewer');
let linked = false;
const recordings = [];
try {
  stage('link_disposable_device');
  linked = (await createKeyAndLink(review)).linked;
  assert(linked);
  await review.page.evaluate(`window.probe = {
    async device() { return new Promise((resolve,reject) => { const r=indexedDB.open('bloomlab'); r.onerror=()=>reject(new Error('Local database unavailable')); r.onsuccess=()=>{const db=r.result,q=db.transaction('device').objectStore('device').getAll();q.onsuccess=()=>{db.close();resolve(q.result[0]);};q.onerror=()=>reject(new Error('Device unavailable'));}; }); },
    async request(path, body, method=body===undefined?'GET':'POST') { const d=await this.device(); return fetch(path,{method,headers:{authorization:'Bearer '+d.session_token,...(body===undefined?{}:{'content-type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})}); },
    async api(path,body,method) {const r=await this.request(path,body,method);return {status:r.status,body:await r.json()};}
  }`);
  report.config = await review.page.evaluate("probe.api('/api/call/config')");
  assert.equal(report.config.body.enabled, true);
  assert.equal(
    (
      await review.page.evaluate(
        "probe.api('/api/ai/settings',{mode:'Off',monthly_limit_usd:10},'PUT')",
      )
    ).status,
    200,
  );
  stage('start_proposal');
  const start = await review.page.evaluate(
    "probe.api('/api/call/attempts',{attempt_id:crypto.randomUUID(),exercise_id:'EX-SAY_IT-summit-proposal'})",
  );
  assert.equal(start.status, 200);
  const attempt = start.body.attempt_id;
  assert.match(attempt, /^[a-f0-9-]{36}$/);
  report.attempt_id = attempt;
  await review.page.evaluate(`probe.attempt=${JSON.stringify(attempt)}`);
  stage('prepare_authored_audio');
  report.source = await review.page.evaluate(`(async()=>{
    const line=await probe.api('/api/call/attempts/'+probe.attempt+'/audio',{turn:0});
    if(line.status!==200||line.body.source!=='authored')throw new Error('Authored source unavailable');
    const bytes=await (await probe.request(line.body.url)).arrayBuffer(),ctx=new AudioContext();await ctx.resume();const buffer=await ctx.decodeAudioData(bytes);
    const dest=ctx.createMediaStreamDestination(),source=ctx.createBufferSource();source.buffer=buffer;source.connect(dest);
    const chunks=[],recorder=new MediaRecorder(dest.stream,{mimeType:'audio/webm;codecs=opus'});
    const done=new Promise(resolve=>{recorder.ondataavailable=e=>chunks.push(e.data);recorder.onstop=resolve;});recorder.start();source.onended=()=>recorder.stop();source.start();await done;
    probe.blob=new Blob(chunks,{type:recorder.mimeType});probe.duration=Math.ceil(buffer.duration*1000);probe.checksum=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await probe.blob.arrayBuffer())),b=>b.toString(16).padStart(2,'0')).join('');
    dest.stream.getTracks().forEach(t=>t.stop());await ctx.close();return {mime:probe.blob.type,bytes:probe.blob.size,duration_ms:probe.duration};
  })()`);
  const turns = [
    [
      'The proposal covers qualification routing, an applicant reply, a named owner and follow-up. We will check each route against the agreed criteria with a sample application.',
      'explain',
    ],
    [
      'Let us compare what the nine-hundred quote includes before assuming it is equivalent. Our written scope must identify who owns routing checks, applicant replies and handover. I cannot promise the same result from an unknown scope.',
      'scope',
    ],
    [
      'For a smaller first phase, I propose one agreed qualification route and its applicant reply. We would postpone additional routes and follow-up sequences. We should add those only after reviewing the first route and agreeing the need in writing.',
      'tradeoff',
    ],
    [
      'Could we review the written scope together, test a sample application through each included route, check the applicant reply and confirm the named owner can take over before you sign off?',
      'next_step',
    ],
  ];
  for (const [turn, [transcript, move]] of turns.entries()) {
    stage(`upload_turn_${turn + 1}`);
    const upload = await review.page.evaluate(
      `(async()=>{const id=crypto.randomUUID(),d=await probe.device();const r=await fetch('/api/call/recordings/'+id+'?attempt_id='+probe.attempt+'&turn=${turn}&duration_ms='+probe.duration+'&retain=false',{method:'PUT',headers:{authorization:'Bearer '+d.session_token,'content-type':probe.blob.type,'x-audio-checksum':probe.checksum},body:probe.blob});return {status:r.status,body:await r.json()};})()`,
    );
    assert.equal(upload.status, 200);
    const id = upload.body.recording_id;
    recordings.push(id);
    stage(`transcribe_turn_${turn + 1}`);
    const stt = await review.page.evaluate(`probe.api('/api/call/recordings/${id}/transcribe',{})`);
    const speechFailures = new Set([
      'speech_timeout',
      'speech_rate_limited',
      'speech_unavailable',
      'speech_invalid_response',
      'speech_empty',
      'speech_auth_unavailable',
      'speech_credential_invalid',
      'speech_not_configured',
    ]);
    report.transcriptions.push({
      turn: turn + 1,
      status: stt.status,
      outcome:
        stt.status === 200
          ? 'accepted'
          : speechFailures.has(stt.body.error)
            ? stt.body.error
            : 'other_failure',
    });
    save();
    assert.equal(stt.status, 200);
    stage(`confirm_turn_${turn + 1}`);
    const input = { turn, recording_id: id, transcript, move };
    const next = await review.page.evaluate(
      `probe.api('/api/call/attempts/'+probe.attempt+'/turn',${JSON.stringify(input)})`,
    );
    assert.equal(next.status, 200);
    report.turns.push({
      turn: turn + 1,
      client_context: next.body.turns.at(-1).client.text,
      learner_confirmed: transcript,
      google_status: stt.status,
      original_present: !!stt.body.original_transcript,
    });
    const ack = await review.page.evaluate(`probe.api('/api/call/recordings/${id}/ack',{})`);
    assert.equal(ack.body.status, 'deleted');
    report.complete = next.body.complete;
    report.projection = next.body.projection;
    save();
    console.log(JSON.stringify({ turn: turn + 1, confirmed: true, raw_deleted: true }));
  }
  assert(report.complete);
  assert.equal(
    (
      await review.page.evaluate(
        "probe.api('/api/ai/settings',{mode:'Limited',monthly_limit_usd:10},'PUT')",
      )
    ).status,
    200,
  );
  const input = {
    attempt_id: attempt,
    exercise_id: 'EX-SAY_IT-summit-proposal',
    rubric_id: 'CALL_PERFORMANCE_RUBRIC_V1',
    submission: 'Browser text must not be graded',
  };
  stage('evaluate_feedback');
  report.grading = await review.page.evaluate(
    `probe.api('/api/ai/evaluate',${JSON.stringify(input)})`,
  );
  if (report.grading.status === 200) {
    stage('replay_feedback');
    assert.equal(report.grading.body.result.rubric_results.length, 8);
    const before = await review.page.evaluate("probe.api('/api/ai/settings')");
    const replay = await review.page.evaluate(
      `probe.api('/api/ai/evaluate',${JSON.stringify({ ...input, submission: 'A changed browser payload must still replay' })})`,
    );
    assert.deepEqual(replay, report.grading);
    assert.deepEqual(await review.page.evaluate("probe.api('/api/ai/settings')"), before);
    report.replay_equal = true;
    report.replay_spend_delta = 0;
  }
  report.usage = query(
    `SELECT u.created_at,u.model,u.input_tokens,u.output_tokens,u.cost_usd,u.reserved_usd,u.status,u.diagnostic_json FROM ai_usage u JOIN rubric_runs r ON u.run_id=r.run_id WHERE r.attempt_id='${attempt}' ORDER BY u.created_at`,
  );
  report.policy_after = (await review.page.evaluate("probe.api('/api/ai/settings')")).body;
  report.status =
    report.grading.status === 200
      ? 'accepted_pending_attribution_review'
      : 'grading_rejected_no_automatic_retry';
} catch {
  report.status = 'probe_incomplete';
  process.exitCode = 1;
} finally {
  if (linked) {
    for (const id of recordings) {
      const deletion = await review.page
        .evaluate(`probe.api('/api/call/recordings/${id}',undefined,'DELETE')`)
        .catch(() => ({ status: 0 }));
      report.cleanup.push({ recording_id: id, delete_status: deletion.status });
    }
    report.device_revoked = await review.page
      .evaluate(
        "(async()=>{const d=await probe.device();return (await probe.api('/api/sync/devices/revoke',{device_id:d.device_id})).status===200;})()",
      )
      .catch(() => false);
  }
  await review.close();
  report.finished_at = new Date().toISOString();
  save();
  console.log(
    JSON.stringify({
      status: report.status,
      attempt_id: report.attempt_id,
      grading_status: report.grading?.status,
      device_revoked: report.device_revoked,
      artifact: out,
    }),
  );
}
