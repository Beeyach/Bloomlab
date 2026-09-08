// @vitest-environment node
import { Blob as NodeBlob } from 'node:buffer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CALL_LIMITS, SYNC_ENTITIES, type CallSnapshot } from '@bloomlab/shared';
import { content } from '../content/bundle';
import { freshDatabase } from '../data/testing';
import { ensureDevice } from '../data/device';
import { startAttempt, saveCall, loadAttempt, NORMAL_RUN } from '../exercise/attempt';
import { storeLocalRecording } from './local';
import { confirmTurn, cleanConfirmedAudio, transcribeSaved } from './pipeline';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
async function setup() {
  const database = freshDatabase();
  const device = await ensureDevice(database);
  await database.device.update(device.device_id, { session_token: 'test-session' });
  const exercise = content.exercises.find((e) => e.call?.mode === 'cold_call')!;
  const attempt = await startAttempt(exercise, NORMAL_RUN, {}, database);
  const id = crypto.randomUUID();
  const blob = new NodeBlob([new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 1])], {
    type: 'audio/webm;codecs=opus',
  }) as Blob;
  const identity = {
    recording_id: id,
    attempt_id: attempt.attempt_id,
    exercise_id: exercise.id,
    turn: 0,
    retain: false,
  };
  return { database, exercise, attempt, id, blob, identity };
}
describe('DATA-007/CALL-006 local audio and attempt checkpoints', () => {
  it('keeps audio outside sync, writes it before upload and saves the original transcript before any cleanup', async () => {
    const a = await setup();
    const local = await storeLocalRecording(
      a.identity,
      {
        blob: a.blob,
        mime_type: 'audio/webm;codecs=opus',
        duration_ms: 900,
        stop_reason: 'manual',
      },
      a.database,
    );
    const requests: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string, init: RequestInit) => {
        requests.push(path);
        expect((await a.database.call_recordings.get(a.id))?.checksum).toBe(local.checksum);
        expect(await a.database.sync_queue.count()).toBe(0);
        if (init.method === 'PUT') return Response.json({ recording_id: a.id, status: 'uploaded' });
        return Response.json({
          recording_id: a.id,
          original_transcript: 'A careful question.',
          confirmed_transcript: null,
        });
      }),
    );
    await transcribeSaved(a.attempt, NORMAL_RUN, a.id, a.database);
    expect(requests).toHaveLength(2);
    expect(requests[0]).toContain('recordings/');
    expect(requests[1]).toContain('/transcribe');
    expect(
      (await loadAttempt(a.exercise.id, NORMAL_RUN, a.database))?.response.call?.transcript_draft,
    ).toBe('A careful question.');
    expect(await a.database.call_recordings.count()).toBe(1); // raw recovery retained until confirmed branch checkpoint
    expect(Object.keys(SYNC_ENTITIES)).not.toContain('call_recordings');
    await a.database.delete();
  });
  it('retries uploaded audio without uploading again, keeps failures recoverable and survives database reopen', async () => {
    const a = await setup();
    await storeLocalRecording(
      a.identity,
      {
        blob: a.blob,
        mime_type: 'audio/webm;codecs=opus',
        duration_ms: 900,
        stop_reason: 'manual',
      },
      a.database,
    );
    await a.database.call_recordings.update(a.id, { uploaded: true });
    a.database.close();
    await a.database.open();
    const network = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ error: 'speech_timeout' }, { status: 503 }))
      .mockResolvedValueOnce(Response.json({ original_transcript: 'Recovered transcript.' }));
    vi.stubGlobal('fetch', network);
    await expect(transcribeSaved(a.attempt, NORMAL_RUN, a.id, a.database)).rejects.toThrow(
      'Transcription timed out',
    );
    expect((await a.database.call_recordings.get(a.id))?.blob.size).toBe(a.blob.size);
    await transcribeSaved(a.attempt, NORMAL_RUN, a.id, a.database);
    expect(network.mock.calls.every(([path]) => String(path).endsWith('/transcribe'))).toBe(true);
    await a.database.delete();
  });

  it('keeps the local Blob and unconfirmed upload status when the upload network request fails', async () => {
    const a = await setup();
    const recording = await storeLocalRecording(
      a.identity,
      {
        blob: a.blob,
        mime_type: 'audio/webm;codecs=opus',
        duration_ms: 900,
        stop_reason: 'manual',
      },
      a.database,
    );
    const network = vi.fn().mockRejectedValue(new TypeError('Network request failed'));
    vi.stubGlobal('fetch', network);
    await expect(transcribeSaved(a.attempt, NORMAL_RUN, a.id, a.database)).rejects.toThrow();
    const saved = await a.database.call_recordings.get(a.id);
    expect(saved?.uploaded).toBe(false);
    expect(saved?.checksum).toBe(recording.checksum);
    expect(saved?.blob.size).toBe(a.blob.size);
    expect(network).toHaveBeenCalledTimes(1);
    await a.database.delete();
  });
  it('serializes notes with call state and never deletes audio before the confirmed snapshot is saved', async () => {
    const a = await setup();
    await storeLocalRecording(
      a.identity,
      {
        blob: a.blob,
        mime_type: 'audio/webm;codecs=opus',
        duration_ms: 900,
        stop_reason: 'manual',
      },
      a.database,
    );
    const snapshot = {
      attempt_id: a.attempt.attempt_id,
      turn: 1,
      complete: false,
      turns: [{ turn: 0, recording_id: a.id, confirmed_transcript: 'Confirmed words.' }],
      projection: {},
    } as unknown as CallSnapshot;
    const input = {
      turn: 0,
      recording_id: a.id,
      transcript: 'Confirmed words.',
      move: 'permission',
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path.endsWith('/turn')) {
          expect(
            (await loadAttempt(a.exercise.id, NORMAL_RUN, a.database))?.response.call?.pending_turn,
          ).toEqual(input);
          return Response.json(snapshot);
        }
        expect(
          (await loadAttempt(a.exercise.id, NORMAL_RUN, a.database))?.response.call?.snapshot,
        ).toEqual(snapshot);
        if (path.endsWith('/recordings'))
          return Response.json([
            {
              turn: 0,
              recording_id: a.id,
              retain: false,
              confirmed_transcript: 'Confirmed words.',
              deleted_at: null,
            },
          ]);
        expect(await a.database.call_recordings.get(a.id)).toBeUndefined();
        return Response.json({ deleted_at: new Date().toISOString() });
      }),
    );
    await Promise.all([
      confirmTurn(a.attempt, NORMAL_RUN, input, a.database),
      saveCall(
        a.exercise.id,
        NORMAL_RUN,
        a.attempt.attempt_id,
        { notes: 'Ask about Tina.' },
        a.database,
      ),
    ]);
    expect((await loadAttempt(a.exercise.id, NORMAL_RUN, a.database))?.response.call?.notes).toBe(
      'Ask about Tina.',
    );
    expect(await a.database.call_recordings.count()).toBe(1);
    await cleanConfirmedAudio(snapshot, a.database);
    expect(await a.database.call_recordings.count()).toBe(0);
    await a.database.delete();
  });
  it('does not sync raw bytes and refuses oversize recordings before storage or network', async () => {
    const a = await setup();
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    await expect(
      storeLocalRecording(
        a.identity,
        {
          blob: new NodeBlob([new Uint8Array(CALL_LIMITS.maxBytes + 1)]) as Blob,
          mime_type: 'audio/mp4',
          duration_ms: 1000,
          stop_reason: 'manual',
        },
        a.database,
      ),
    ).rejects.toThrow('turn limit');
    expect(await a.database.call_recordings.count()).toBe(0);
    expect(fetcher).not.toHaveBeenCalled();
    await a.database.delete();
  });

  it('keeps failed and retained audio until a replacement turn is checkpointed, then deletes only superseded unretained audio', async () => {
    const a = await setup();
    const captured = {
      blob: a.blob,
      mime_type: 'audio/webm;codecs=opus' as const,
      duration_ms: 900,
      stop_reason: 'manual' as const,
    };
    await storeLocalRecording(a.identity, captured, a.database);
    const retainedId = crypto.randomUUID();
    await storeLocalRecording(
      { ...a.identity, recording_id: retainedId, retain: true },
      captured,
      a.database,
    );
    const snapshot = { attempt_id: a.attempt.attempt_id, turns: [] } as unknown as CallSnapshot;
    const network = vi.fn(async (_path: string, init: RequestInit) =>
      init.method === 'DELETE'
        ? Response.json({ deleted_at: '2026-09-08T00:00:00Z' })
        : Response.json([]),
    );
    vi.stubGlobal('fetch', network);
    await cleanConfirmedAudio(snapshot, a.database);
    expect(await a.database.call_recordings.count()).toBe(2);
    expect(network.mock.calls.some(([, init]) => init.method === 'DELETE')).toBe(false);
    snapshot.turns = [{ turn: 0, recording_id: crypto.randomUUID() }] as CallSnapshot['turns'];
    await cleanConfirmedAudio(snapshot, a.database);
    expect(await a.database.call_recordings.get(a.id)).toBeUndefined();
    expect((await a.database.call_recordings.get(retainedId))?.blob.size).toBe(a.blob.size);
    expect(
      network.mock.calls.filter(([, init]) => init.method === 'DELETE').map(([path]) => path),
    ).toEqual([`/api/call/recordings/${a.id}`]);
    await a.database.delete();
  });
});
