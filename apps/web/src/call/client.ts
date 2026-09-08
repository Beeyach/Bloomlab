import type { CallRecording, CallSnapshot } from '@bloomlab/shared';
import { db, type BloomlabDatabase } from '../data/db';
import type { LocalCallRecording } from './local';

const MESSAGES: Record<string, string> = {
  device_not_linked: 'Link this device with your Sync Key, then retry. Your call is saved.',
  calls_not_enabled: 'Voice calls are not enabled on this server yet.',
  call_content_changed:
    'This call was started with an older scenario. Keep its transcript and start a new attempt to use the updated scenario.',
  recording_deleted: 'This recording has been deleted. Its saved transcript remains available.',
  speech_not_configured: 'Transcription is not configured on this server. Your recording is saved.',
  speech_empty: 'No speech was recognized. Replay the recording, then retry or record again.',
  speech_timeout: 'Transcription timed out. Retry the saved recording or record again.',
  turn_in_progress:
    'This turn is still being resolved. Wait a moment, then retry the saved submission.',
  turn_submission_conflict:
    'A different transcript was already confirmed for this turn. Reload to recover the saved call.',
  transcription_in_progress:
    'This recording is still being transcribed. Wait a moment, then retry.',
};
export class CallServiceError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
  ) {
    super(
      MESSAGES[code] ?? 'The call service is unavailable. Your work is saved; retry when ready.',
    );
  }
}
export async function callFetch(
  path: string,
  init: RequestInit = {},
  database: BloomlabDatabase = db,
): Promise<Response> {
  if (!path.startsWith('/api/call/') && !path.startsWith('/api/media/voice/'))
    throw new Error('Invalid call media address.');
  const device = await database.device.toCollection().first();
  if (!device?.session_token) throw new Error(MESSAGES.device_not_linked);
  const response = await fetch(path, {
    ...init,
    signal: init.signal ?? AbortSignal.timeout(65_000),
    cache: 'no-store',
    headers: {
      ...Object.fromEntries(new Headers(init.headers)),
      authorization: `Bearer ${device.session_token}`,
    },
  });
  if (!response.ok) {
    let code = '';
    try {
      code = ((await response.json()) as { error: string }).error;
    } catch {
      /* no upstream detail */
    }
    throw new CallServiceError(code, response.status);
  }
  return response;
}
export async function callRequest<T>(
  path: string,
  body?: unknown,
  method = 'POST',
  database: BloomlabDatabase = db,
): Promise<T> {
  const response = await callFetch(
    `/api/call/${path}`,
    {
      method: body === undefined ? 'GET' : method,
      ...(body === undefined
        ? {}
        : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
    },
    database,
  );
  return response.json() as Promise<T>;
}
export const startRemoteCall = (attempt_id: string, exercise_id: string) =>
  callRequest<CallSnapshot>('attempts', { attempt_id, exercise_id });
export async function uploadLocal(
  recording: LocalCallRecording,
  database: BloomlabDatabase = db,
): Promise<CallRecording> {
  const query = new URLSearchParams({
    attempt_id: recording.attempt_id,
    turn: String(recording.turn),
    duration_ms: String(recording.duration_ms),
    retain: String(recording.retain),
  });
  const response = await callFetch(
    `/api/call/recordings/${recording.recording_id}?${query}`,
    {
      method: 'PUT',
      headers: { 'content-type': recording.mime_type, 'x-audio-checksum': recording.checksum },
      body: recording.blob,
    },
    database,
  );
  const saved = (await response.json()) as CallRecording;
  await database.call_recordings.update(recording.recording_id, { uploaded: true });
  return saved;
}
