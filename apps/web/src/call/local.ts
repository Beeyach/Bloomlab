import type { CallMime } from '@bloomlab/shared';
import { CALL_LIMITS } from '@bloomlab/shared';
import { db, type BloomlabDatabase } from '../data/db';
import type { CapturedAudio } from './recording';

/** Local-only. This table is deliberately absent from SYNC_ENTITIES and the outbox. */
export interface LocalCallRecording {
  recording_id: string;
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
  const recording = {
    ...identity,
    mime_type: captured.mime_type,
    byte_length: bytes.byteLength,
    duration_ms: captured.duration_ms,
    checksum,
    created_at: new Date().toISOString(),
    uploaded: false,
    blob: captured.blob,
  };
  const existing = await database.call_recordings.get(identity.recording_id);
  if (existing && existing.checksum !== checksum)
    throw new Error('This recording ID already belongs to different audio.');
  await database.call_recordings.put(existing ?? recording);
  return existing ?? recording;
}
