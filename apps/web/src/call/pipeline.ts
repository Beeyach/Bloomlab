import type { CallRecording, CallSnapshot, CallTurnSubmission, CallPhase } from '@bloomlab/shared';
import { db, type BloomlabDatabase } from '../data/db';
import { saveCall, type ActiveAttempt, type AttemptContext } from '../exercise/attempt';
import { callFetch, callRequest, uploadLocal } from './client';
import { localRecording, localRecordingsForAttempt } from './local';

export async function transcribeSaved(
  attempt: ActiveAttempt,
  context: AttemptContext,
  id: string,
  database: BloomlabDatabase = db,
  onPhase?: (phase: CallPhase) => Promise<void>,
): Promise<CallRecording> {
  const checkpoint = (patch: Parameters<typeof saveCall>[3]) =>
    saveCall(attempt.exercise_id, context, attempt.attempt_id, patch, database);
  const local = await localRecording(id, database);
  if (local && !local.uploaded) {
    await checkpoint({ phase: 'uploading' });
    await onPhase?.('uploading');
    await uploadLocal(local, database);
  }
  await checkpoint({ phase: 'transcribing' });
  await onPhase?.('transcribing');
  const recording = await callRequest<CallRecording>(
    `recordings/${id}/transcribe`,
    {},
    'POST',
    database,
  );
  if (!recording.original_transcript)
    throw new Error('No transcript was returned. Your recording is saved; retry or record again.');
  await checkpoint({
    phase: 'transcript_review',
    recording_id: id,
    transcript_draft: recording.confirmed_transcript ?? recording.original_transcript,
  });
  return recording;
}
export async function confirmTurn(
  attempt: ActiveAttempt,
  context: AttemptContext,
  input: CallTurnSubmission,
  database: BloomlabDatabase = db,
): Promise<CallSnapshot> {
  // Persist exact retry identity before calling the Worker. Corrections cannot drift on a retry.
  await saveCall(
    attempt.exercise_id,
    context,
    attempt.attempt_id,
    { phase: 'evaluating', pending_turn: input },
    database,
  );
  const snapshot = await callRequest<CallSnapshot>(
    `attempts/${attempt.attempt_id}/turn`,
    input,
    'POST',
    database,
  );
  await saveCall(
    attempt.exercise_id,
    context,
    attempt.attempt_id,
    {
      phase: 'resolving',
      snapshot,
      pending_turn: null,
      transcript_draft: '',
      move: null,
      negotiation: undefined,
      recording_id: null,
    },
    database,
  );
  return snapshot;
}
/** Call only after the confirmed transcript and branch crossed the attempt checkpoint. */
export async function cleanConfirmedAudio(
  snapshot: CallSnapshot,
  database: BloomlabDatabase = db,
): Promise<void> {
  const recordings = await callRequest<CallRecording[]>(
    `attempts/${snapshot.attempt_id}/recordings`,
    undefined,
    'GET',
    database,
  );
  for (const recording of recordings) {
    const committed = snapshot.turns.find((turn) => turn.turn === recording.turn);
    if (!committed || recording.retain) continue;
    const superseded = committed.recording_id !== recording.recording_id;
    if (!superseded && committed.confirmed_transcript !== recording.confirmed_transcript) continue;
    await database.call_recordings.delete(recording.recording_id);
    if (!recording.deleted_at) {
      if (superseded)
        await callFetch(
          `/api/call/recordings/${recording.recording_id}`,
          { method: 'DELETE' },
          database,
        );
      else await callRequest(`recordings/${recording.recording_id}/ack`, {}, 'POST', database);
    }
  }
  // A re-record may supersede audio that was never uploaded or whose upload response was lost.
  const local = await localRecordingsForAttempt(snapshot.attempt_id, database);
  for (const recording of local) {
    if (recording.retain || !snapshot.turns.some((turn) => turn.turn === recording.turn)) continue;
    await callFetch(
      `/api/call/recordings/${recording.recording_id}`,
      { method: 'DELETE' },
      database,
    );
    await database.call_recordings.delete(recording.recording_id);
  }
}
