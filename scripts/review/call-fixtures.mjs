/* global window, document, location, indexedDB */
// Fictional, controlled API fixtures only. Never a live-provider acceptance claim.
export function callFixtures(exercises, rubric, version) {
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
    failDelete: false,
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
      if (method === 'DELETE') {
        await waiting('delete');
        if (probe.failDelete) {
          probe.failDelete = false;
          return ok({ error: 'call_unavailable' }, 503);
        }
        if (!recording)
          return ok({ recording_id: id, status: 'deleted', deleted_at: new Date().toISOString() });
      }
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
