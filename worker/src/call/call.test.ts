import { env } from 'cloudflare:test';
import { describe, expect, it, vi } from 'vitest';
import content from 'virtual:bloomlab-content';
import { generateSyncKey, type CallSnapshot, type CallRecording } from '@bloomlab/shared';
import { link } from '../sync/handlers';
import { sha256 } from '../voice/identity';
import { handleCall, type CallDependencies } from './handlers';
import { CallError } from './errors';
import type { Provider } from '../ai/provider';
import { evaluate } from '../ai/handlers';
import { getRecording } from './store';
import { emptyNegotiationAction } from '@bloomlab/exercise-engine/negotiation/engine';
import { generateVoice } from '../voice/generate';

const webm = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 1, 2, 3, 4]).buffer;
const usage = {
  input_tokens: 100,
  output_tokens: 20,
  cache_read_input_tokens: 0,
  cache_creation_input_tokens: 0,
};
async function setup(mode = 'cold_call', dependencies: CallDependencies = {}) {
  const deviceId = crypto.randomUUID();
  const learner = await link(
    { secret: generateSyncKey(), device: { device_id: deviceId, label: 'Call test' } },
    env.DB,
    env.SYNC_KEY_PEPPER,
  );
  const exercise = content.exercises.find((e) => e.call?.mode === mode)!;
  const attemptId = crypto.randomUUID();
  const speech =
    dependencies.speech ?? vi.fn().mockResolvedValue('Could I ask about your quote follow-up?');
  const deps = { ...dependencies, speech };
  const request = (
    path: string,
    body?: unknown,
    method = body === undefined ? 'GET' : 'POST',
    token: string | null = learner.session_token,
  ) =>
    handleCall(
      new Request(`https://bloomlab.test/api/call/${path}`, {
        method,
        headers: {
          ...(token ? { authorization: `Bearer ${token}` } : {}),
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }),
      env,
      deps,
    );
  const started = await request('attempts', { attempt_id: attemptId, exercise_id: exercise.id });
  expect(started.status).toBe(200);
  async function upload(
    id = crypto.randomUUID(),
    bytes = webm,
    turn = 0,
    retain = false,
    extra: Record<string, string> = {},
  ) {
    return handleCall(
      new Request(
        `https://bloomlab.test/api/call/recordings/${id}?attempt_id=${attemptId}&turn=${turn}&duration_ms=1500&retain=${retain}`,
        {
          method: 'PUT',
          headers: {
            authorization: `Bearer ${learner.session_token}`,
            'content-type': 'audio/webm;codecs=opus',
            'x-audio-checksum': await sha256(bytes),
            ...extra,
          },
          body: bytes,
        },
      ),
      env,
      deps,
    );
  }
  async function ready(turn = 0, retain = false) {
    const id = crypto.randomUUID();
    expect((await upload(id, webm, turn, retain)).status).toBe(200);
    expect((await request(`recordings/${id}/transcribe`, {})).status).toBe(200);
    return id;
  }
  return { request, upload, ready, learner, deviceId, exercise, attemptId, speech, deps };
}
describe('CALL-002/006 private recording and durable recovery', () => {
  it('refuses new production calls even with preview-style vars and an injected provider', async () => {
    const a = await setup();
    const speech = vi.fn();
    const production = {
      ...env,
      BLOOMLAB_ENV: 'production',
      CALLS_ENABLED: 'true',
      GOOGLE_CLOUD_CREDENTIAL: 'test-only placeholder',
    };
    const headers = {
      authorization: `Bearer ${a.learner.session_token}`,
      'content-type': 'application/json',
    };
    const config = await handleCall(
      new Request('https://bloomlab.test/api/call/config', { headers }),
      production,
      { speech },
    );
    expect(await config.json()).toEqual({ enabled: false });
    const start = await handleCall(
      new Request('https://bloomlab.test/api/call/attempts', {
        method: 'POST',
        headers,
        body: JSON.stringify({ attempt_id: crypto.randomUUID(), exercise_id: a.exercise.id }),
      }),
      production,
      { speech },
    );
    expect(start.status).toBe(503);
    expect(await start.json()).toEqual({ error: 'calls_not_enabled' });
    expect(speech).not.toHaveBeenCalled();
  });

  it('deletes an interrupted R2-first upload even when no metadata row survived', async () => {
    const a = await setup();
    const id = crypto.randomUUID();
    await a.upload(id);
    const row = await getRecording(
      env.DB,
      { learnerId: a.learner.learner_id, deviceId: a.deviceId },
      id,
    );
    await env.DB.prepare('DELETE FROM call_recordings WHERE recording_id=?').bind(id).run();
    expect((await a.request(`recordings/${id}`, undefined, 'DELETE')).status).toBe(200);
    expect(await env.MEDIA.head(row.object_key)).toBeNull();
    expect((await a.request(`recordings/${id}/audio`)).status).toBe(410);
  });
  it('requires an authenticated authored call, checks ownership on every path, and honors revocation', async () => {
    const a = await setup(),
      b = await setup();
    const id = await a.ready();
    for (const path of [
      `attempts/${a.attemptId}`,
      `attempts/${a.attemptId}/recordings`,
      `recordings/${id}`,
      `recordings/${id}/audio`,
    ]) {
      expect((await a.request(path, undefined, 'GET', null)).status).toBe(401);
      expect((await b.request(path)).status).toBe(403);
    }
    expect((await b.request(`recordings/${id}`, undefined, 'DELETE')).status).toBe(403);
    expect(
      (
        await a.request('attempts', {
          attempt_id: crypto.randomUUID(),
          exercise_id: content.exercises.find((e) => e.type === 'WRITE_IT')!.id,
        })
      ).status,
    ).toBe(400);
    await env.DB.prepare('UPDATE devices SET revoked_at=? WHERE device_id=?')
      .bind(new Date().toISOString(), a.deviceId)
      .run();
    expect((await a.request(`recordings/${id}/transcribe`, {})).status).toBe(401);
  });
  it('writes R2 before metadata/STT, deduplicates bytes and rejects identity collisions', async () => {
    const a = await setup();
    const id = crypto.randomUUID();
    const first = (await (await a.upload(id)).json()) as CallRecording;
    expect(first.status).toBe('uploaded');
    expect(a.speech).not.toHaveBeenCalled();
    const row = await getRecording(
      env.DB,
      { learnerId: a.learner.learner_id, deviceId: a.deviceId },
      id,
    );
    expect(await (await env.MEDIA.get(row.object_key))!.arrayBuffer()).toEqual(webm);
    expect(await (await a.upload(id)).json()).toEqual(first);
    expect((await a.upload(id, new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 5]).buffer)).status).toBe(
      409,
    );
    expect((await a.upload(crypto.randomUUID(), webm, 1)).status).toBe(409);
    expect(
      (await a.upload(crypto.randomUUID(), webm, 0, false, { 'content-type': 'audio/wav' })).status,
    ).toBe(415);
    expect((await a.upload(crypto.randomUUID(), new Uint8Array([1, 2, 3]).buffer)).status).toBe(
      415,
    );
    const oversized = new Uint8Array(8 * 1024 * 1024 + 1);
    oversized.set(new Uint8Array(webm));
    expect((await a.upload(crypto.randomUUID(), oversized.buffer)).status).toBe(413);
    const columns = await env.DB.prepare('PRAGMA table_info(call_recordings)').all<{
      type: string;
    }>();
    expect(columns.results.every((c) => c.type !== 'BLOB')).toBe(true);
    expect(first).not.toHaveProperty('object_key');
    expect(first).not.toHaveProperty('learner_id');
  });
  it('recovers an R2-first write after indexing fails without replacing the bytes', async () => {
    const a = await setup();
    const id = crypto.randomUUID();
    await a.upload(id);
    const row = await getRecording(
      env.DB,
      { learnerId: a.learner.learner_id, deviceId: a.deviceId },
      id,
    );
    const etag = (await env.MEDIA.head(row.object_key))!.etag;
    await env.DB.prepare('DELETE FROM call_recordings WHERE recording_id=?').bind(id).run();
    expect((await a.upload(id)).status).toBe(200);
    expect((await env.MEDIA.head(row.object_key))!.etag).toBe(etag);
    expect(a.speech).not.toHaveBeenCalled();
  });
  it('retries STT from saved R2 audio and removes actual audio only after a checkpoint acknowledgement', async () => {
    const speech = vi
      .fn()
      .mockRejectedValueOnce(new CallError('speech_timeout'))
      .mockResolvedValue('Original mistaken transcription');
    const a = await setup('cold_call', { speech });
    const id = crypto.randomUUID();
    await a.upload(id);
    expect((await a.request(`recordings/${id}/transcribe`, {})).status).toBe(503);
    expect((await a.request(`recordings/${id}/audio`)).status).toBe(200);
    expect((await a.request(`recordings/${id}/transcribe`, {})).status).toBe(200);
    expect(speech).toHaveBeenCalledTimes(2);
    expect(speech.mock.calls[1]![0]).toEqual(webm);
    expect((await a.request(`recordings/${id}/ack`, {})).status).toBe(409);
    const confirmed = 'Could I ask about unaccepted replacement quotes?';
    const input = { turn: 0, recording_id: id, transcript: confirmed, move: 'permission' };
    const resolved = await a.request(`attempts/${a.attemptId}/turn`, input);
    expect(resolved.status).toBe(200);
    const state = (await resolved.json()) as CallSnapshot;
    expect(state.turns[0]).toMatchObject({
      original_transcript: 'Original mistaken transcription',
      confirmed_transcript: confirmed,
      interpretation: 'explicit',
    });
    expect((await a.request(`recordings/${id}/audio`)).status).toBe(200);
    const row = await getRecording(
      env.DB,
      { learnerId: a.learner.learner_id, deviceId: a.deviceId },
      id,
    );
    const deleted = (await (await a.request(`recordings/${id}/ack`, {})).json()) as CallRecording;
    expect(deleted.status).toBe('deleted');
    expect(deleted.deleted_at).not.toBeNull();
    expect(await env.MEDIA.head(row.object_key)).toBeNull();
    expect((await a.request(`recordings/${id}/audio`)).status).toBe(410);
    expect((await a.request(`recordings/${id}/transcribe`, {})).status).toBe(410);
    expect(await (await a.request(`attempts/${a.attemptId}/turn`, input)).json()).toEqual(state);
    expect(
      (
        await a.request(`attempts/${a.attemptId}/turn`, {
          ...input,
          transcript: 'Changed after confirmation',
        })
      ).status,
    ).toBe(409);
  });
  it('keeps retained audio until explicit deletion, while preserving both transcripts', async () => {
    const a = await setup();
    const id = await a.ready(0, true);
    await a.request(`attempts/${a.attemptId}/turn`, {
      turn: 0,
      recording_id: id,
      transcript: 'May I ask about quotes?',
      move: 'permission',
    });
    const kept = (await (await a.request(`recordings/${id}/ack`, {})).json()) as CallRecording;
    expect(kept.deleted_at).toBeNull();
    expect(kept.retain).toBe(true);
    expect((await a.request(`recordings/${id}`, undefined, 'DELETE')).status).toBe(200);
    const deleted = (await (await a.request(`recordings/${id}`)).json()) as CallRecording;
    expect(deleted.confirmed_transcript).toBe('May I ask about quotes?');
    expect(deleted.original_transcript).toBeTruthy();
    expect(deleted.deleted_at).toBeTruthy();
  });
});
describe('CALL-002 intelligence and VOI-003 constrained response audio', () => {
  it.each([
    ['discovery', ['agenda', 'impact', 'people', 'decision', 'reflect', 'next_step']],
    ['proposal', ['explain', 'scope', 'tradeoff', 'next_step']],
    ['explanation', ['explain', 'explain', 'handover', 'next_step']],
    ['negotiation', ['walk_away']],
  ] as const)(
    'runs the authored %s mode through its existing engine to a terminal state',
    async (mode, moves) => {
      const a = await setup(mode);
      for (const [turn, move] of moves.entries()) {
        const id = await a.ready(turn);
        const { text: _text, ...action } = emptyNegotiationAction();
        const input = {
          turn,
          recording_id: id,
          transcript: 'I will explain the reasoning and agree a responsible next step.',
          ...(mode === 'negotiation'
            ? { negotiation: { ...action, action: 'walk_away' } }
            : { move }),
        };
        const response = await a.request(`attempts/${a.attemptId}/turn`, input);
        expect(response.status).toBe(200);
      }
      const final = (await (await a.request(`attempts/${a.attemptId}`)).json()) as CallSnapshot;
      expect(final.complete).toBe(true);
      expect(final.projection.turns).toBe(moves.length);
      if (mode === 'negotiation')
        expect(final.agreement?.project).toBe(a.exercise.negotiation!.starting_deal.project);
    },
  );
  it('prefers an existing Phase 20 authored asset and never synthesizes static missing text', async () => {
    const voiceProvider = vi.fn().mockResolvedValue({
      bytes: new Uint8Array([0x49, 0x44, 0x33, 1, 2, 3]).buffer,
      requestId: null,
      billedCharacters: 50,
    });
    const a = await setup('cold_call', { voice: voiceProvider });
    const voice = content.voice_characters.find((v) => v.client === a.exercise.client)!;
    await generateVoice(voice.id, 'greeting-01', env, voiceProvider);
    voiceProvider.mockClear();
    const audio = await (await a.request(`attempts/${a.attemptId}/audio`, { turn: 0 })).json();
    expect(audio).toMatchObject({ source: 'authored', cached: true });
    const id = await a.ready();
    await a.request(`attempts/${a.attemptId}/turn`, {
      turn: 0,
      recording_id: id,
      transcript: 'May I ask about the quotes?',
      move: 'permission',
    });
    expect((await a.request(`attempts/${a.attemptId}/audio`, { turn: 1 })).status).toBe(404);
    expect(voiceProvider).not.toHaveBeenCalled();
  });
  it('has one branch and one classifier purchase across concurrent confirmation and later retries', async () => {
    let release!: () => void;
    let entered!: () => void;
    const waiting = new Promise<void>((resolve) => {
      release = resolve;
    });
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const ai = vi.fn<Provider>(async () => {
      entered();
      await waiting;
      return { value: { move: 'permission', confidence: 0.95 }, usage };
    });
    const a = await setup('cold_call', { ai });
    const id = await a.ready();
    const input = { turn: 0, recording_id: id, transcript: 'Could we discuss your process?' };
    const pending = a.request(`attempts/${a.attemptId}/turn`, input);
    await started;
    expect((await a.request(`attempts/${a.attemptId}/turn`, input)).status).toBe(409);
    release();
    const first = await (await pending).json();
    expect(await (await a.request(`attempts/${a.attemptId}/turn`, input)).json()).toEqual(first);
    expect(ai).toHaveBeenCalledTimes(1);
    const spend = await env.DB.prepare('SELECT * FROM ai_usage WHERE learner_id=?')
      .bind(a.learner.learner_id)
      .all();
    expect(spend.results).toHaveLength(1);
    expect(spend.results[0]).toMatchObject({
      purpose: 'call_feedback',
      status: 'complete',
      reserved_usd: 0,
    });
  });
  it.each(['Off', 'budget', 'failure', 'low-confidence'])(
    'uses authored fallback for %s',
    async (reason) => {
      const ai = vi
        .fn<Provider>()
        .mockResolvedValue({ value: { move: 'permission', confidence: 0.2 }, usage });
      if (reason === 'failure') ai.mockRejectedValue(new Error('sensitive upstream body'));
      const a = await setup('cold_call', { ai });
      const id = await a.ready();
      if (reason === 'Off')
        await env.DB.prepare("UPDATE learners SET ai_mode='Off' WHERE learner_id=?")
          .bind(a.learner.learner_id)
          .run();
      if (reason === 'budget')
        await env.DB.prepare('UPDATE learners SET ai_monthly_limit_usd=0 WHERE learner_id=?')
          .bind(a.learner.learner_id)
          .run();
      const response = await a.request(`attempts/${a.attemptId}/turn`, {
        turn: 0,
        recording_id: id,
        transcript: 'Let us consider this carefully.',
      });
      expect(response.status).toBe(200);
      const state = (await response.json()) as CallSnapshot;
      expect(state.current.node).toBe('clarify');
      expect(state.current.dynamic).toBe(false);
      expect(state.turns[0]!.interpretation).toBe('fallback');
      if (['Off', 'budget'].includes(reason)) expect(ai).not.toHaveBeenCalled();
    },
  );
  it('tailors only an authorized question with a verified quote; private TTS is cached and cannot accept arbitrary text', async () => {
    const ai = vi
      .fn<Provider>()
      .mockResolvedValueOnce({ value: { move: '', confidence: 0.1 }, usage })
      .mockResolvedValueOnce({ value: { quote: 'a careful sequence', confidence: 0.95 }, usage });
    const voice = vi.fn().mockResolvedValue({
      bytes: new Uint8Array([0x49, 0x44, 0x33, 1, 2, 3]).buffer,
      requestId: null,
      billedCharacters: 50,
    });
    const a = await setup('cold_call', { ai, voice });
    await env.DB.prepare("UPDATE learners SET ai_mode='Full' WHERE learner_id=?")
      .bind(a.learner.learner_id)
      .run();
    const id = await a.ready();
    const state = (await (
      await a.request(`attempts/${a.attemptId}/turn`, {
        turn: 0,
        recording_id: id,
        transcript: 'I have a careful sequence in mind.',
      })
    ).json()) as CallSnapshot;
    expect(state.current.text).toBe(
      `You mentioned “a careful sequence”. ${a.exercise.call!.open_response!.question}`,
    );
    expect(state.current.dynamic).toBe(true);
    expect(ai).toHaveBeenCalledTimes(2);
    expect(
      (
        await a.request(`attempts/${a.attemptId}/audio`, {
          turn: 1,
          text: 'Read my arbitrary words',
        })
      ).status,
    ).toBe(400);
    const first = (await (
      await a.request(`attempts/${a.attemptId}/audio`, { turn: 1 })
    ).json()) as { url: string; cached: boolean };
    expect(first.cached).toBe(false);
    expect(await (await a.request(`attempts/${a.attemptId}/audio`, { turn: 1 })).json()).toEqual({
      ...first,
      source: 'dynamic',
      cached: true,
    });
    expect(voice).toHaveBeenCalledTimes(1);
    expect(voice.mock.calls[0]![1]).toMatchObject({ text: state.current.text });
    const b = await setup();
    expect((await a.request(first.url.replace('/api/call/', ''))).status).toBe(200);
    expect((await b.request(first.url.replace('/api/call/', ''))).status).toBe(403);
    expect(JSON.stringify(ai.mock.calls)).not.toContain('GkXf'); // no raw WebM or base64 payload
    expect(JSON.stringify(voice.mock.calls)).not.toContain('original_transcript');
  });
  it('completes a real authored call and grades only confirmed text under all eight call dimensions', async () => {
    const a = await setup();
    for (const [turn, move] of ['permission', 'process', 'reflect', 'next_step'].entries()) {
      const id = await a.ready(turn);
      expect(
        (
          await a.request(`attempts/${a.attemptId}/turn`, {
            turn,
            recording_id: id,
            transcript: `Confirmed reasoning for ${move}.`,
            move,
          })
        ).status,
      ).toBe(200);
    }
    const snapshot = (await (await a.request(`attempts/${a.attemptId}`)).json()) as CallSnapshot;
    expect(snapshot.complete).toBe(true);
    const rubric = content.rubrics.find((r) => r.id === a.exercise.grading.rubric)!;
    const result = {
      score: 100,
      rubric_results: rubric.items.map((item) => ({
        id: item.id,
        passed: true,
        reason: 'Supported by the confirmed transcript and objective.',
      })),
      critical_issue: null,
      strengths: ['Relevant questions.'],
      improvements: ['Keep the next step specific.'],
      next_probe: 'Try the independent proposal call.',
      confidence: 0.9,
    };
    const provider = vi.fn<Provider>().mockResolvedValue({ value: result, usage });
    await evaluate(
      {
        attempt_id: a.attemptId,
        exercise_id: a.exercise.id,
        rubric_id: rubric.id,
        submission: 'PRIVATE_RAW_AUDIO_AND_NOTES_MUST_NOT_LEAVE',
      },
      { learnerId: a.learner.learner_id, deviceId: a.deviceId },
      env.DB,
      provider,
    );
    expect(provider.mock.calls[0]![0].submission).toContain('Confirmed reasoning');
    expect(provider.mock.calls[0]![0].submission).not.toMatch(
      /PRIVATE_RAW|original_transcript|Could I ask about your quote follow-up/,
    );
    expect(result.rubric_results.map((r) => r.id)).toEqual([
      'questions',
      'listening',
      'diagnosis',
      'clarity',
      'jargon',
      'pitch_timing',
      'objection_handling',
      'next_step',
    ]);
    const rows = await env.DB.prepare('SELECT purpose FROM ai_usage WHERE learner_id=?')
      .bind(a.learner.learner_id)
      .all<{ purpose: string }>();
    expect(rows.results.every((r) => r.purpose === 'call_feedback')).toBe(true);
  });
});
