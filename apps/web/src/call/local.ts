import type { CallMime } from '@bloomlab/shared';
import { CALL_LIMITS } from '@bloomlab/shared';
import { db, type BloomlabDatabase } from '../data/db';
import { currentDevice, ensureDevice } from '../data/device';
import type { CapturedAudio } from './recording';

/** Local-only. This table is deliberately absent from SYNC_ENTITIES and the outbox. */
export interface LocalCallRecording {
  recording_id: string;
  learner_id: string;
  device_id: string;
  attempt_id: string;
  exercise_id: string;
  turn: number;
  mime_type: CallMime;
  byte_length: number;
  duration_ms: number;
  checksum: string;
  created_at: string;
  uploaded: boolean;
  retain: boolean;
  blob: Blob;
}
export async function storeLocalRecording(
  identity: Pick<
    LocalCallRecording,
    'recording_id' | 'attempt_id' | 'exercise_id' | 'turn' | 'retain'
  >,
  captured: CapturedAudio,
  database: BloomlabDatabase = db,
): Promise<LocalCallRecording> {
  if (
    !captured.blob.size ||
    captured.blob.size > CALL_LIMITS.maxBytes ||
    captured.duration_ms > CALL_LIMITS.maxDurationMs
  )
    throw new Error('The recording exceeds the turn limit. Record a shorter reply.');
  const bytes = await captured.blob.arrayBuffer();
  const checksum = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
  const owner = await ensureDevice(database);
  const recording = {
    ...identity,
    learner_id: owner.learner_id,
    device_id: owner.device_id,
    mime_type: captured.mime_type,
    byte_length: bytes.byteLength,
    duration_ms: captured.duration_ms,
    checksum,
    created_at: new Date().toISOString(),
    uploaded: false,
    blob: captured.blob,
  };
  const existing = await database.call_recordings.get(identity.recording_id);
  if (existing && existing.learner_id !== owner.learner_id)
    throw new Error('This recording belongs to another learner on this device.');
  if (existing && existing.checksum !== checksum)
    throw new Error('This recording ID already belongs to different audio.');
  await database.call_recordings.put(existing ?? recording);
  return existing ?? recording;
}

export async function localRecording(
  id: string,
  database: BloomlabDatabase = db,
): Promise<LocalCallRecording | undefined> {
  const owner = await currentDevice(database);
  const row = await database.call_recordings.get(id);
  return owner && row?.learner_id === owner.learner_id ? row : undefined;
}

export async function localRecordingsForAttempt(
  attemptId: string,
  database: BloomlabDatabase = db,
): Promise<LocalCallRecording[]> {
  const owner = await currentDevice(database);
  if (!owner) return [];
  return database.call_recordings
    .where('attempt_id')
    .equals(attemptId)
    .filter((row) => row.learner_id === owner.learner_id)
    .toArray();
}
