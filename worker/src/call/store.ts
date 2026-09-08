import content from 'virtual:bloomlab-content';
import version from 'virtual:bloomlab-content/version';
import type { CallRecording } from '@bloomlab/shared';
import { CALL_LIMITS, CALL_MIME_TYPES, type CallMime } from '@bloomlab/shared';
import type { Session } from '../sync/auth';
import { sha256 } from '../voice/identity';
import { boundedBody, CallError } from './errors';
import { initialCall, type CallState } from './engine';

export const CALL_ID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export interface AttemptRow {
  attempt_id: string;
  learner_id: string;
  exercise_id: string;
  content_version: string;
  revision: number;
  state_json: string;
}
export interface RecordingRow extends Omit<CallRecording, 'retain'> {
  learner_id: string;
  object_key: string;
  updated_at: string;
  retain: number;
}
export type CallStorage = { DB: D1Database; MEDIA: R2Bucket };
export function callContent(exerciseId: string) {
  const exercise = content.exercises.find(
    (e) => e.id === exerciseId && e.type === 'SAY_IT' && e.call,
  );
  const scenario = content.scenarios.find((s) => s.id === exercise?.scenario);
  const client = content.clients.find((c) => c.id === scenario?.client);
  if (!exercise || !scenario || !client) throw new CallError('unknown_call', 400);
  return { exercise, scenario, client };
}
export async function getAttempt(
  db: D1Database,
  session: Session,
  id: string,
): Promise<AttemptRow> {
  if (!CALL_ID.test(id)) throw new CallError('invalid_attempt', 400);
  const row = await db
    .prepare('SELECT * FROM call_attempts WHERE attempt_id=?')
    .bind(id)
    .first<AttemptRow>();
  if (!row) throw new CallError('attempt_not_found', 404);
  if (row.learner_id !== session.learnerId) throw new CallError('forbidden', 403);
  return row;
}
export function currentState(row: AttemptRow): CallState {
  if (row.content_version !== version.content_version)
    throw new CallError('call_content_changed', 409);
  return JSON.parse(row.state_json) as CallState;
}
export async function startCall(
  db: D1Database,
  session: Session,
  attemptId: string,
  exerciseId: string,
) {
  if (!CALL_ID.test(attemptId)) throw new CallError('invalid_attempt', 400);
  const { exercise, scenario, client } = callContent(exerciseId);
  const state = initialCall(exercise, scenario, client, attemptId, version.content_version);
  const now = new Date().toISOString();
  await db
    .prepare(
      'INSERT OR IGNORE INTO call_attempts (attempt_id,learner_id,exercise_id,content_version,state_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?)',
    )
    .bind(
      attemptId,
      session.learnerId,
      exerciseId,
      version.content_version,
      JSON.stringify(state),
      now,
      now,
    )
    .run();
  const saved = await getAttempt(db, session, attemptId);
  if (saved.exercise_id !== exerciseId) throw new CallError('attempt_conflict', 409);
  return currentState(saved).snapshot;
}
export async function getRecording(
  db: D1Database,
  session: Session,
  id: string,
): Promise<RecordingRow> {
  if (!CALL_ID.test(id)) throw new CallError('invalid_recording', 400);
  const row = await db
    .prepare('SELECT * FROM call_recordings WHERE recording_id=?')
    .bind(id)
    .first<RecordingRow>();
  if (!row) throw new CallError('recording_not_found', 404);
  if (row.learner_id !== session.learnerId) throw new CallError('forbidden', 403);
  return row;
}
export function recordingView(row: RecordingRow): CallRecording {
  const { learner_id: _learner, object_key: _key, updated_at: _updated, ...rest } = row;
  return { ...rest, retain: Boolean(row.retain) };
}
/** Validate container magic as well as the browser's negotiated MIME; never relabel unknown bytes. */
export function validContainer(bytes: ArrayBuffer, mime: CallMime): boolean {
  const b = new Uint8Array(bytes);
  if (mime.startsWith('audio/webm'))
    return b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3;
  if (mime.startsWith('audio/mp4')) return new TextDecoder().decode(b.subarray(4, 8)) === 'ftyp';
  return new TextDecoder().decode(b.subarray(0, 4)) === 'OggS';
}
export async function uploadRecording(
  request: Request,
  env: CallStorage,
  session: Session,
  id: string,
) {
  if (!CALL_ID.test(id)) throw new CallError('invalid_recording', 400);
  const query = new URL(request.url).searchParams;
  if ([...query.keys()].some((k) => !['attempt_id', 'turn', 'duration_ms', 'retain'].includes(k)))
    throw new CallError('invalid_metadata', 400);
  const attempt = await getAttempt(env.DB, session, query.get('attempt_id') ?? '');
  const state = currentState(attempt);
  callContent(attempt.exercise_id);
  const turn = Number(query.get('turn'));
  const duration = Number(query.get('duration_ms'));
  const mime = request.headers.get('content-type')?.toLowerCase() as CallMime;
  if (!CALL_MIME_TYPES.includes(mime)) throw new CallError('unsupported_audio', 415);
  if (
    !query.has('turn') ||
    !Number.isInteger(turn) ||
    turn < 0 ||
    turn >= 20 ||
    !Number.isInteger(duration) ||
    duration < 1 ||
    duration > CALL_LIMITS.maxDurationMs ||
    !['true', 'false'].includes(query.get('retain') ?? '')
  )
    throw new CallError('invalid_metadata', 400);
  const existing = await env.DB.prepare('SELECT * FROM call_recordings WHERE recording_id=?')
    .bind(id)
    .first<RecordingRow>();
  if (existing && existing.learner_id !== session.learnerId) throw new CallError('forbidden', 403);
  if (existing?.deleted_at || existing?.status === 'deleting')
    throw new CallError('recording_deleted', 410);
  const key = `call/raw/v1/${id}.audio`;
  const recoverable = existing ? null : await env.MEDIA.head(key);
  if (recoverable && recoverable.customMetadata?.learner_id !== session.learnerId)
    throw new CallError('forbidden', 403);
  if (!existing && !recoverable && (state.snapshot.complete || state.snapshot.turn !== turn))
    throw new CallError('turn_conflict', 409);
  if (Number(request.headers.get('content-length')) > CALL_LIMITS.maxBytes)
    throw new CallError('body_too_large', 413);
  const bytes = await boundedBody(request.body, CALL_LIMITS.maxBytes);
  if (!validContainer(bytes, mime)) throw new CallError('invalid_audio', 415);
  const checksum = await sha256(bytes);
  if (request.headers.get('x-audio-checksum') !== checksum)
    throw new CallError('checksum_mismatch', 409);
  if (existing) {
    if (
      existing.checksum !== checksum ||
      existing.attempt_id !== attempt.attempt_id ||
      existing.turn !== turn ||
      existing.mime_type !== mime ||
      existing.duration_ms !== duration ||
      existing.object_key !== key
    )
      throw new CallError('recording_conflict', 409);
    return recordingView(existing);
  }
  const count = await env.DB.prepare(
    'SELECT COUNT(*) AS n FROM call_recordings WHERE attempt_id=? AND turn=?',
  )
    .bind(attempt.attempt_id, turn)
    .first<{ n: number }>();
  if (!recoverable && (count?.n ?? 0) >= 5) throw new CallError('recording_limit', 429);
  const created = new Date().toISOString();
  const meta = {
    recording_id: id,
    learner_id: session.learnerId,
    attempt_id: attempt.attempt_id,
    exercise_id: attempt.exercise_id,
    turn: String(turn),
    duration_ms: String(duration),
    checksum,
    retain: query.get('retain')!,
    created_at: created,
  };
  // Conditional creation lets an interrupted R2-first write recover without overwriting bytes.
  const written = await env.MEDIA.put(key, bytes, {
    onlyIf: { etagDoesNotMatch: '*' },
    httpMetadata: { contentType: mime },
    customMetadata: meta,
  });
  const object = written ?? (await env.MEDIA.head(key));
  if (
    !object ||
    object.size !== bytes.byteLength ||
    object.httpMetadata?.contentType !== mime ||
    [
      'recording_id',
      'learner_id',
      'attempt_id',
      'exercise_id',
      'turn',
      'duration_ms',
      'checksum',
    ].some((k) => object.customMetadata?.[k] !== meta[k as keyof typeof meta])
  )
    throw new CallError('recording_conflict', 409);
  await env.DB.prepare(
    `INSERT OR IGNORE INTO call_recordings (recording_id,learner_id,attempt_id,exercise_id,turn,object_key,mime_type,byte_length,duration_ms,checksum,created_at,updated_at,status,retain) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'uploaded',?)`,
  )
    .bind(
      id,
      session.learnerId,
      attempt.attempt_id,
      attempt.exercise_id,
      turn,
      key,
      mime,
      bytes.byteLength,
      duration,
      checksum,
      object.customMetadata!.created_at!,
      created,
      object.customMetadata!.retain === 'true' ? 1 : 0,
    )
    .run();
  const indexed = await getRecording(env.DB, session, id);
  if (indexed.checksum !== checksum || indexed.object_key !== key)
    throw new CallError('recording_conflict', 409);
  return recordingView(indexed);
}
export async function deleteRecording(env: CallStorage, session: Session, id: string) {
  if (!CALL_ID.test(id)) throw new CallError('invalid_recording', 400);
  const indexed = await env.DB.prepare(
    'SELECT recording_id FROM call_recordings WHERE recording_id=?',
  )
    .bind(id)
    .first();
  if (!indexed) {
    // A DELETE must also remove an R2-first upload whose metadata write/response was interrupted.
    const object = await env.MEDIA.head(`call/raw/v1/${id}.audio`);
    if (!object)
      return { recording_id: id, status: 'deleted', deleted_at: new Date().toISOString() };
    const meta = object.customMetadata ?? {};
    if (meta.learner_id !== session.learnerId) throw new CallError('forbidden', 403);
    const attempt = await getAttempt(env.DB, session, meta.attempt_id ?? '');
    if (
      meta.recording_id !== id ||
      meta.exercise_id !== attempt.exercise_id ||
      !meta.checksum ||
      !meta.created_at ||
      !CALL_MIME_TYPES.includes(object.httpMetadata?.contentType as CallMime)
    )
      throw new CallError('recording_conflict', 409);
    await env.DB.prepare(
      `INSERT OR IGNORE INTO call_recordings (recording_id,learner_id,attempt_id,exercise_id,turn,object_key,mime_type,byte_length,duration_ms,checksum,created_at,updated_at,status,retain) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'uploaded',0)`,
    )
      .bind(
        id,
        session.learnerId,
        attempt.attempt_id,
        attempt.exercise_id,
        Number(meta.turn),
        object.key,
        object.httpMetadata!.contentType!,
        object.size,
        Number(meta.duration_ms),
        meta.checksum,
        meta.created_at,
        new Date().toISOString(),
      )
      .run();
  }
  const recording = await getRecording(env.DB, session, id);
  if (recording.deleted_at) return recordingView(recording);
  await env.DB.prepare(
    "UPDATE call_recordings SET status='deleting' WHERE recording_id=? AND deleted_at IS NULL",
  )
    .bind(id)
    .run();
  await env.MEDIA.delete(recording.object_key);
  const now = new Date().toISOString();
  await env.DB.prepare(
    "UPDATE call_recordings SET status='deleted',retain=0,deleted_at=?,updated_at=? WHERE recording_id=?",
  )
    .bind(now, now, id)
    .run();
  return recordingView(await getRecording(env.DB, session, id));
}
