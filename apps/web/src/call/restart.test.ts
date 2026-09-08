// @vitest-environment node
import { Blob as NodeBlob } from 'node:buffer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CallRecording, CallSnapshot } from '@bloomlab/shared';
import { content } from '../content/bundle';
import { freshDatabase } from '../data/testing';
import { ensureDevice } from '../data/device';
import {
  emptyCallResponse,
  loadAttempt,
  NORMAL_RUN,
  saveCall,
  startAttempt,
} from '../exercise/attempt';
import { storeLocalRecording } from './local';
import { restartCall } from './restart';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
async function setup() {
  const database = freshDatabase();
  const device = await ensureDevice(database);
  await database.device.update(device.device_id, { session_token: 'restart-test-token' });
  const exercise = content.exercises.find((e) => e.call?.mode === 'cold_call')!;
  const attempt = await startAttempt(exercise, NORMAL_RUN, {}, database);
  const id = crypto.randomUUID();
  const snapshot: CallSnapshot = {
    attempt_id: attempt.attempt_id,
    exercise_id: exercise.id,
    content_version: content.content_version,
    turn: 0,
    current: { node: 'opening', text: 'Authored opening.', dynamic: false },
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
  async function audio(retain = false, recordingId = id) {
    return storeLocalRecording(
      {
        recording_id: recordingId,
        attempt_id: attempt.attempt_id,
        exercise_id: exercise.id,
        turn: 0,
        retain,
      },
      {
        blob: new NodeBlob(['fictional recording']) as Blob,
        mime_type: 'audio/mp4',
        duration_ms: 1000,
        stop_reason: 'manual',
      },
      database,
    );
  }
  async function saved(turn = 0) {
    snapshot.turn = turn;
    await saveCall(
      exercise.id,
      NORMAL_RUN,
      attempt.attempt_id,
      {
        ...emptyCallResponse(),
        phase: 'locally_saved',
        snapshot,
        recording_id: id,
        notes: 'Old notes',
      },
      database,
    );
  }
  const remote: Partial<CallRecording>[] = [];
  const network = vi.fn(async (path: string, init: RequestInit) => {
    expect(init.headers).toMatchObject({ authorization: 'Bearer restart-test-token' });
    if (path.endsWith('/recordings')) return Response.json(remote);
    expect(init.method).toBe('DELETE');
    const row = remote.find((r) => path.endsWith(r.recording_id!));
    if (row) row.deleted_at = new Date().toISOString();
    return Response.json({ status: 'deleted', deleted_at: new Date().toISOString() });
  });
  vi.stubGlobal('fetch', network);
  return {
    database,
    exercise,
    attempt,
    snapshot,
    id,
    audio,
    saved,
    remote,
    network,
    restart: (confirmed = true) => restartCall(exercise, NORMAL_RUN, attempt, confirmed, database),
  };
}
describe('CALL-006 clean unfinished-call restart', () => {
  it('replaces an untouched turn-zero attempt offline, writes no evidence, and cannot resume or edit the old ID', async () => {
    const a = await setup();
    const fresh = await a.restart();
    expect(fresh.attempt_id).not.toBe(a.attempt.attempt_id);
    expect(fresh.response.call).toBeUndefined();
    expect((await startAttempt(a.exercise, NORMAL_RUN, {}, a.database)).attempt_id).toBe(
      fresh.attempt_id,
    );
    await expect(
      saveCall(
        a.exercise.id,
        NORMAL_RUN,
        a.attempt.attempt_id,
        { notes: 'Late old edit' },
        a.database,
      ),
    ).rejects.toThrow('no longer the active');
    expect(a.network).not.toHaveBeenCalled();
    for (const table of [
      a.database.exercise_attempts,
      a.database.skill_evidence,
      a.database.sync_queue,
    ])
      expect(await table.count()).toBe(0);
    await a.database.delete();
  });
  it.each(['confirmed turns', 'local unsent Blob', 'uploaded unretained audio', 'retained audio'])(
    'deletes %s only after explicit confirmation, then replaces the attempt',
    async (kind) => {
      const a = await setup();
      const local = await a.audio(kind === 'retained audio');
      await a.saved(kind === 'confirmed turns' ? 2 : 0);
      if (kind !== 'local unsent Blob') {
        a.remote.push({ recording_id: a.id, retain: local.retain, deleted_at: null });
        await a.database.call_recordings.update(a.id, { uploaded: true });
      }
      await expect(a.restart(false)).rejects.toThrow('Confirm deletion');
      expect(a.network).not.toHaveBeenCalled();
      expect((await a.database.call_recordings.get(a.id))?.blob.size).toBe(local.blob.size);
      const original = a.network.getMockImplementation()!;
      a.network.mockImplementation(async (path, init) => {
        if (init.method === 'DELETE') {
          expect(await a.database.call_recordings.get(a.id)).toBeDefined();
          expect((await loadAttempt(a.exercise.id, NORMAL_RUN, a.database))?.attempt_id).toBe(
            a.attempt.attempt_id,
          );
        }
        return original(path, init);
      });
      const fresh = await a.restart();
      expect(fresh.attempt_id).not.toBe(a.attempt.attempt_id);
      expect(fresh.response.call).toBeUndefined();
      expect(await a.database.call_recordings.count()).toBe(0);
      expect(a.network.mock.calls.filter(([, init]) => init.method === 'DELETE')).toHaveLength(1);
      expect(await a.database.exercise_attempts.count()).toBe(0);
      expect(await a.database.skill_evidence.count()).toBe(0);
      await a.database.delete();
    },
  );
  it('keeps the old attempt and remaining audio after partial cleanup failure, then retries idempotently', async () => {
    const a = await setup();
    await a.audio();
    const second = crypto.randomUUID();
    await a.audio(true, second);
    await a.saved(2);
    a.remote.push({ recording_id: a.id }, { recording_id: second, retain: true });
    const original = a.network.getMockImplementation()!;
    a.network.mockImplementation((path, init) =>
      path.endsWith(second)
        ? Promise.resolve(Response.json({ error: 'unavailable' }, { status: 503 }))
        : original(path, init),
    );
    await expect(a.restart()).rejects.toThrow('Some audio may already be deleted');
    expect((await loadAttempt(a.exercise.id, NORMAL_RUN, a.database))?.attempt_id).toBe(
      a.attempt.attempt_id,
    );
    expect(await a.database.call_recordings.get(second)).toBeDefined();
    a.network.mockImplementation(original);
    const fresh = await a.restart();
    a.database.close();
    await a.database.open();
    expect((await startAttempt(a.exercise, NORMAL_RUN, {}, a.database)).attempt_id).toBe(
      fresh.attempt_id,
    );
    expect(await a.database.call_recordings.count()).toBe(0);
    expect(await a.database.exercise_attempts.count()).toBe(0);
    await a.database.delete();
  });
  it.each([401, 403, 503])(
    'does not discard recovery state when authenticated inventory fails with %s',
    async (status) => {
      const a = await setup();
      await a.audio();
      await a.saved();
      a.network.mockResolvedValue(Response.json({ error: 'unavailable' }, { status }));
      await expect(a.restart()).rejects.toThrow('Could not check saved audio');
      expect(await a.database.call_recordings.get(a.id)).toBeDefined();
      expect((await loadAttempt(a.exercise.id, NORMAL_RUN, a.database))?.attempt_id).toBe(
        a.attempt.attempt_id,
      );
      await a.database.delete();
    },
  );
});
