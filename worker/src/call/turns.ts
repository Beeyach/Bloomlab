import { z } from 'zod';
import { CALL_LIMITS } from '@bloomlab/shared';
import { NEGOTIATION_ACTIONS } from '@bloomlab/content-schema';
import type { Session } from '../sync/auth';
import type { Provider } from '../ai/provider';
import { sha256 } from '../voice/identity';
import { CallError } from './errors';
import { advanceCall } from './engine';
import { chooseTurn, tailorResponse } from './intelligence';
import { callContent, currentState, getAttempt, getRecording } from './store';

const id = z.string().uuid();
const nullableAmount = z.number().int().min(0).max(1_000_000).nullable();
export const CallTurnInput = z.strictObject({
  turn: z.number().int().min(0).max(19),
  recording_id: id,
  transcript: z.string().trim().min(1).max(CALL_LIMITS.maxTranscript),
  move: z.string().max(80).nullable().default(null),
  negotiation: z
    .strictObject({
      action: z.enum(NEGOTIATION_ACTIONS).nullable(),
      approach: z.enum(['address', 'pitch', 'ignore', 'defensive']),
      diagnosis: z.string().max(80).nullable(),
      excluded: z.array(z.string().max(80)).max(30),
      project: nullableAmount,
      phase: z.string().max(80).nullable(),
      phase_two_project: nullableAmount,
      timeline_days: nullableAmount,
      concession: z.string().max(80).nullable(),
    })
    .optional(),
});
interface TurnRow {
  request_hash: string;
  status: 'processing' | 'complete';
  lease: string;
  updated_at: string;
  result_json: string | null;
}
export async function evaluateTurn(
  db: D1Database,
  session: Session,
  attemptId: string,
  value: unknown,
  provider?: Provider,
) {
  const parsed = CallTurnInput.safeParse(value);
  if (!parsed.success) throw new CallError('invalid_turn', 400);
  const input = parsed.data;
  const attempt = await getAttempt(db, session, attemptId);
  const hash = await sha256(JSON.stringify(input));
  const existing = await db
    .prepare('SELECT * FROM call_turns WHERE attempt_id=? AND turn=?')
    .bind(attemptId, input.turn)
    .first<TurnRow>();
  if (existing?.request_hash !== undefined && existing.request_hash !== hash)
    throw new CallError('turn_submission_conflict', 409);
  if (existing?.status === 'complete') return JSON.parse(existing.result_json!);
  const state = currentState(attempt);
  if (state.snapshot.complete || state.snapshot.turn !== input.turn)
    throw new CallError('turn_conflict', 409);
  const recording = await getRecording(db, session, input.recording_id);
  if (
    recording.attempt_id !== attemptId ||
    recording.turn !== input.turn ||
    !recording.original_transcript ||
    !['review', 'confirmed', 'deleted'].includes(recording.status)
  )
    throw new CallError('transcript_not_ready', 409);
  const { exercise, scenario } = callContent(attempt.exercise_id);
  if (
    input.move &&
    !exercise.conversation?.nodes
      .find((n) => n.id === state.snapshot.current.node)
      ?.moves.some((m) => m.id === input.move)
  )
    throw new CallError('unknown_move', 400);
  if (input.negotiation && !exercise.negotiation) throw new CallError('invalid_negotiation', 400);
  const lease = crypto.randomUUID();
  const now = new Date().toISOString();
  const stale = new Date(Date.now() - 120_000).toISOString();
  const claimed = existing
    ? await db
        .prepare(
          "UPDATE call_turns SET lease=?,updated_at=? WHERE attempt_id=? AND turn=? AND status='processing' AND updated_at<?",
        )
        .bind(lease, now, attemptId, input.turn, stale)
        .run()
    : await db
        .prepare(
          "INSERT OR IGNORE INTO call_turns (attempt_id,turn,request_hash,recording_id,status,lease,updated_at) VALUES (?,?,?,?,'processing',?,?)",
        )
        .bind(attemptId, input.turn, hash, input.recording_id, lease, now)
        .run();
  if (!claimed.meta.changes) throw new CallError('turn_in_progress', 409);
  // A stale lease recovers with authored rules only; it never repeats an uncertain AI purchase.
  const ai = existing ? undefined : provider;
  const run = `${session.learnerId}:${attemptId}:${input.turn}:${hash}`;
  const negotiation = input.negotiation
    ? { ...input.negotiation, text: input.transcript }
    : undefined;
  const choice = await chooseTurn(
    db,
    session.learnerId,
    run,
    exercise,
    state,
    input.transcript,
    input.move,
    negotiation,
    ai,
  );
  const next = advanceCall(
    state,
    exercise,
    scenario,
    { recording_id: recording.recording_id, original_transcript: recording.original_transcript },
    input.transcript,
    choice,
  );
  await tailorResponse(db, session.learnerId, run, exercise, next, input.transcript, ai);
  // Conditional batch: an expired worker can neither advance state nor overwrite a newer lease.
  await db.batch([
    db
      .prepare(
        `UPDATE call_attempts SET state_json=?,revision=revision+1,updated_at=? WHERE attempt_id=? AND revision=? AND EXISTS (SELECT 1 FROM call_turns WHERE attempt_id=? AND turn=? AND lease=? AND status='processing')`,
      )
      .bind(JSON.stringify(next), now, attemptId, input.turn, attemptId, input.turn, lease),
    db
      .prepare(
        `UPDATE call_recordings SET confirmed_transcript=?,status=CASE WHEN status IN ('deleting','deleted') THEN status ELSE 'confirmed' END,updated_at=? WHERE recording_id=? AND EXISTS (SELECT 1 FROM call_turns WHERE attempt_id=? AND turn=? AND lease=? AND status='processing')`,
      )
      .bind(input.transcript, now, recording.recording_id, attemptId, input.turn, lease),
    db
      .prepare(
        "UPDATE call_turns SET status='complete',result_json=?,updated_at=? WHERE attempt_id=? AND turn=? AND lease=? AND status='processing'",
      )
      .bind(JSON.stringify(next.snapshot), now, attemptId, input.turn, lease),
  ]);
  const result = await db
    .prepare('SELECT * FROM call_turns WHERE attempt_id=? AND turn=?')
    .bind(attemptId, input.turn)
    .first<TurnRow>();
  if (result?.status !== 'complete') throw new CallError('turn_in_progress', 409);
  return JSON.parse(result.result_json!);
}
