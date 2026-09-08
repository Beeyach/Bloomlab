import type { Exercise } from '@bloomlab/content-schema';
import type { CallRecording } from '@bloomlab/shared';
import { db, type BloomlabDatabase } from '../data/db';
import {
  flushAttemptWrites,
  loadAttempt,
  replaceUnfinishedCall,
  type ActiveAttempt,
  type AttemptContext,
} from '../exercise/attempt';
import { callFetch, callRequest, CallServiceError } from './client';

/** The confirmation explicitly includes retained recordings. A failed deletion leaves the
 * active attempt and remaining local audio available for retry; remote deletion is idempotent. */
export async function restartCall(
  exercise: Exercise,
  context: AttemptContext,
  expected: ActiveAttempt,
  deleteAllRecordingsConfirmed: boolean,
  database: BloomlabDatabase = db,
): Promise<ActiveAttempt> {
  if (!deleteAllRecordingsConfirmed) throw new Error('Confirm deletion before starting fresh.');
  await flushAttemptWrites(exercise.id, context);
  const current = await loadAttempt(exercise.id, context, database);
  if (
    !current ||
    current.attempt_id !== expected.attempt_id ||
    current.submitted ||
    current.response.call?.snapshot?.complete ||
    [
      'microphone_permission',
      'recording',
      'uploading',
      'transcribing',
      'evaluating',
      'resolving',
    ].includes(current.response.call?.phase ?? '')
  )
    throw new Error('This call has changed. Review the current call before restarting.');
  const local = await database.call_recordings
    .where('attempt_id')
    .equals(current.attempt_id)
    .toArray();
  const call = current.response.call;
  const ids = new Set(local.map((row) => row.recording_id));
  if (call?.recording_id) ids.add(call.recording_id);
  // An untouched local attempt has never sent a start request. Failed starts may have reached
  // the server, so they still require an authenticated inventory check.
  if (call?.snapshot || (call && call.phase !== 'ready') || ids.size) {
    try {
      const remote = await callRequest<CallRecording[]>(
        `attempts/${current.attempt_id}/recordings`,
        undefined,
        'GET',
        database,
      );
      for (const row of remote) if (!row.deleted_at) ids.add(row.recording_id);
    } catch (error) {
      if (!(
        error instanceof CallServiceError &&
        error.code === 'attempt_not_found' &&
        error.status === 404
      ))
        throw new Error(
          'Could not check saved audio. This call is still here; reconnect and retry restart.',
          { cause: error },
        );
    }
  }
  for (const id of ids) {
    try {
      // Even an unacknowledged upload can have private R2 bytes without a metadata row.
      await callFetch(`/api/call/recordings/${id}`, { method: 'DELETE' }, database);
      await database.call_recordings.delete(id);
    } catch (error) {
      throw new Error(
        'Audio cleanup did not finish. This call and any remaining recordings are still available. Some audio may already be deleted; retry to finish starting fresh.',
        { cause: error },
      );
    }
  }
  return replaceUnfinishedCall(exercise, context, current.attempt_id, database);
}
