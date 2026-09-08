import { content } from '../content/bundle';
import type { CallResponse } from '@bloomlab/shared';
import type { GradeReport } from '@bloomlab/exercise-engine';
import { classifyLanguage } from '../ai/client';
import { negotiationOf } from './negotiation/context';
import { transitionNegotiation, type NegotiationAction } from './negotiation/engine';
import { economicsFor } from './pricing';
import { useLiveQuery } from 'dexie-react-hooks';

import type { Exercise } from '@bloomlab/content-schema';
import type { HintLevel } from '@bloomlab/mastery-engine';

import { db, type BloomlabDatabase } from '../data/db';
import { randomId } from '../data/envelope';
import { clearWorkspace, loadWorkspace, saveWorkspace } from '../data/workspace';
import { emptyResponse, type LearnerResponse } from './response';

/**
 * The active attempt: one logical try at an exercise, from the moment the learner starts until
 * it is finalized.
 *
 * It lives in the local workspace (TA§7 "an unfinished exercise"), so a reload resumes the same
 * attempt with the same id, the same revealed hints and the same unfinished work. This is
 * convenience state, deliberately not learner history: nothing here is mastery evidence, and
 * opening or typing in an exercise records none. Only finalizing writes to `exercise_attempts`
 * and `skill_evidence`, through the Phase 6 path (D-068).
 *
 * Active attempts stay on the device that is working: they are not synced. A half-written
 * attempt on a phone is not a fact about the learner; the finished attempt is, and that syncs.
 */
export interface ActiveAttempt {
  /** Stable from the first keystroke; becomes the `exercise_attempts` row id on finalize. */
  attempt_id: string;
  exercise_id: string;
  rubric_id?: string;
  /**
   * The capability this attempt is for. On a retrieval run it is the capability under review and
   * the only one the attempt writes evidence for (D-072); on a normal run it is merely where the
   * learner arrived from, and every skill the exercise teaches is credited.
   */
  skill_id: string | null;
  /** A retrieval run is the same exercise used as a review vehicle (spec §32). */
  run: RunMode;
  started_at: string;
  hints_revealed: HintLevel[];
  response: LearnerResponse;
  submitted?: { report: GradeReport; rubric_id: string };
}

export type RunMode = 'normal' | 'retrieval';

/**
 * What makes one attempt context distinct from another (D-072).
 *
 * The exercise is the vehicle; the run says what the learner is doing with it. A normal run and
 * a review of one capability are different pieces of work, so they keep different drafts and
 * different current results — reviewing Custom values must never resume, or be replaced by, an
 * unfinished normal attempt at the same exercise.
 */
export interface AttemptContext {
  run: RunMode;
  /** Required for a retrieval run: the capability under review. */
  skill_id: string | null;
}

export const NORMAL_RUN: AttemptContext = { run: 'normal', skill_id: null };

export const contextOf = (attempt: ActiveAttempt): AttemptContext => ({
  run: attempt.run,
  skill_id: attempt.skill_id,
});

/**
 * The workspace key for one context. A normal run keeps the plain key it always had, whatever
 * capability the learner arrived from; a retrieval run is keyed by the capability it reviews.
 */
export function attemptKey(exerciseId: string, context: AttemptContext = NORMAL_RUN): string {
  const base = `exercise.attempt.${exerciseId}`;
  return context.run === 'retrieval' ? `${base}:retrieval:${context.skill_id ?? ''}` : base;
}

/** True when this context can legitimately be run as a review of that capability. */
export const isValidRetrievalTarget = (
  exercise: Pick<Exercise, 'skills'>,
  skillId: string | null | undefined,
): skillId is string => Boolean(skillId) && exercise.skills.includes(skillId as string);

/**
 * The run context for a request. A retrieval is honoured only when it names a capability the
 * exercise actually teaches; anything else is an ordinary run of that exercise, never a review
 * of every skill it happens to touch.
 */
export function resolveRunContext(
  exercise: Pick<Exercise, 'skills'>,
  requested: { run?: string | null; skill?: string | null },
): AttemptContext {
  const skill = isValidRetrievalTarget(exercise, requested.skill)
    ? requested.skill
    : (exercise.skills[0] ?? null);
  if (requested.run === 'retrieval' && isValidRetrievalTarget(exercise, requested.skill)) {
    return { run: 'retrieval', skill_id: requested.skill };
  }
  return { run: 'normal', skill_id: skill };
}

export function useActiveAttempt(
  exerciseId: string,
  context: AttemptContext = NORMAL_RUN,
  database: BloomlabDatabase = db,
): ActiveAttempt | null | undefined {
  const key = attemptKey(exerciseId, context);
  return useLiveQuery(
    async () => (await loadWorkspace<ActiveAttempt>(key, database)) ?? null,
    [key, database],
  );
}

export const loadAttempt = (
  exerciseId: string,
  context: AttemptContext = NORMAL_RUN,
  database: BloomlabDatabase = db,
): Promise<ActiveAttempt | undefined> =>
  loadWorkspace<ActiveAttempt>(attemptKey(exerciseId, context), database);

/**
 * The attempt to work on in this context: the one already in progress, or a new one. A reload
 * therefore resumes rather than silently starting again, which would lose the hint history the
 * grade depends on — and a retrieval never inherits a normal run's draft.
 */
export async function startAttempt(
  exercise: Pick<Exercise, 'id' | 'skills'> &
    Partial<Pick<Exercise, 'negotiation' | 'scenario' | 'grading' | 'call'>>,
  context: AttemptContext = NORMAL_RUN,
  options: { now?: Date } = {},
  database: BloomlabDatabase = db,
): Promise<ActiveAttempt> {
  if (context.run === 'retrieval' && !isValidRetrievalTarget(exercise, context.skill_id)) {
    throw new Error(
      `A retrieval of ${exercise.id} must name a capability the exercise teaches, not ${context.skill_id}`,
    );
  }
  const existing = await loadAttempt(exercise.id, context, database);
  if (existing) return existing;
  const attempt: ActiveAttempt = {
    attempt_id: randomId(),
    exercise_id: exercise.id,
    rubric_id: exercise.grading?.rubric,
    skill_id: context.skill_id,
    run: context.run,
    started_at: (options.now ?? new Date()).toISOString(),
    hints_revealed: [],
    response: emptyResponse(),
  };
  if (exercise.negotiation && exercise.scenario && !exercise.call) {
    const initial = negotiationOf({
      negotiation: exercise.negotiation,
      scenario: exercise.scenario,
    });
    if (initial) attempt.response.negotiation = initial;
  }
  await saveWorkspace(attemptKey(exercise.id, context), attempt, database);
  return attempt;
}

/**
 * One queue per attempt, so two edits in flight cannot lose one of them.
 *
 * Every keystroke saves, and a work area has many fields: typing in the message and then ticking
 * the evidence fires two read-modify-writes against the same row. Without a queue the second can
 * read the row before the first has written it and put back a copy that never had the message in
 * it. The lost edit was real and the learner would never see it happen (found by `review:sales`).
 */
const writes = new Map<string, Promise<unknown>>();

function enqueue<T>(key: string, work: () => Promise<T>, recoverPrevious = true): Promise<T> {
  // Recover from an earlier failed edit before running the next one, but keep this edit's own
  // rejection visible in the queue. Finalization can then refuse to record stale work if the
  // latest save failed instead of silently grading the previous persisted draft.
  const previous = writes.get(key) ?? Promise.resolve();
  const queued = (recoverPrevious ? previous.catch(() => undefined) : previous).then(work);
  writes.set(key, queued);
  return queued;
}

/**
 * Waits for every edit already queued for this attempt.
 *
 * Submit is a boundary, not another edit: it must see the last keystroke even when IndexedDB has
 * not finished writing it yet. Because enqueue is synchronous, a save triggered by the input
 * event is already in this queue before a later click can begin finalization.
 */
export async function flushAttemptWrites(
  exerciseId: string,
  context: AttemptContext = NORMAL_RUN,
): Promise<void> {
  const pending = writes.get(attemptKey(exerciseId, context));
  if (pending) await pending;
}

async function update(
  exerciseId: string,
  context: AttemptContext,
  change: (attempt: ActiveAttempt) => ActiveAttempt | Promise<ActiveAttempt>,
  database: BloomlabDatabase,
  recoverPrevious = true,
): Promise<ActiveAttempt | null> {
  const key = attemptKey(exerciseId, context);
  return enqueue(
    key,
    async () => {
      const current = await loadAttempt(exerciseId, context, database);
      if (!current) return null;
      if (current.submitted)
        throw new Error(
          'This work is submitted. Retry evaluation before starting another attempt.',
        );
      const next = await change(current);
      await saveWorkspace(key, next, database);
      return next;
    },
    recoverPrevious,
  );
}

export const saveResponse = (
  exerciseId: string,
  context: AttemptContext,
  response: Partial<LearnerResponse>,
  database: BloomlabDatabase = db,
): Promise<ActiveAttempt | null> =>
  update(
    exerciseId,
    context,
    (attempt) => ({ ...attempt, response: { ...attempt.response, ...response } }),
    database,
  );

/**
 * Reveals the next hint the exercise offers and records it on the attempt, because assistance is
 * part of what the attempt means (EXR-022, MAS-011). Revealing the same level twice is not two
 * uses; the levels are ordered, and a learner who took a worked example took it once.
 */
export const revealHint = (
  exerciseId: string,
  context: AttemptContext,
  level: HintLevel,
  database: BloomlabDatabase = db,
): Promise<ActiveAttempt | null> =>
  update(
    exerciseId,
    context,
    (attempt) =>
      attempt.hints_revealed.includes(level)
        ? attempt
        : { ...attempt, hints_revealed: [...attempt.hints_revealed, level] },
    database,
  );

export const discardAttempt = (
  exerciseId: string,
  context: AttemptContext = NORMAL_RUN,
  database: BloomlabDatabase = db,
): Promise<void> => clearWorkspace(attemptKey(exerciseId, context), database);

/** Negotiation edits and turns share the original per-attempt queue. A turn reads the persisted
 * draft inside that queue, so an immediate Send includes the latest field and move edits. */
export const saveNegotiationDraft = (
  exercise: Exercise,
  context: AttemptContext,
  patch: Partial<NegotiationAction>,
  database: BloomlabDatabase = db,
) =>
  update(
    exercise.id,
    context,
    (attempt) => {
      const state = negotiationOf(exercise, attempt.response.negotiation);
      if (!state || state.status !== 'open') return attempt;
      return {
        ...attempt,
        response: {
          ...attempt.response,
          negotiation: { ...state, draft: { ...state.draft, ...patch } },
        },
      };
    },
    database,
  );

export const sendNegotiationTurn = (
  exercise: Exercise,
  context: AttemptContext,
  database: BloomlabDatabase = db,
) =>
  update(
    exercise.id,
    context,
    async (attempt) => {
      const state = negotiationOf(exercise, attempt.response.negotiation);
      if (!state || !exercise.negotiation) return attempt;
      const interpretation = state.draft.action
        ? null
        : await classifyLanguage(
            exercise.id,
            `${attempt.attempt_id}:${state.turns.length}`,
            state.draft.text,
            database,
          );
      return {
        ...attempt,
        response: {
          ...attempt.response,
          negotiation: transitionNegotiation(
            state,
            state.draft,
            exercise.negotiation,
            economicsFor(exercise),
            interpretation,
          ),
        },
      };
    },
    database,
    false,
  );

/** Submission checkpoint shares the edit queue and refuses an edit that arrived during grading. */
export async function checkpointSubmission(
  exerciseId: string,
  context: AttemptContext,
  expected: ActiveAttempt,
  database: BloomlabDatabase = db,
): Promise<void> {
  await enqueue(
    attemptKey(exerciseId, context),
    async () => {
      const latest = await loadAttempt(exerciseId, context, database);
      if (
        !latest ||
        latest.attempt_id !== expected.attempt_id ||
        JSON.stringify(latest.response) !== JSON.stringify(expected.response) ||
        JSON.stringify(latest.hints_revealed) !== JSON.stringify(expected.hints_revealed)
      )
        throw new Error(
          'Your work changed during submission. Submit again to evaluate the latest saved work.',
        );
      await saveWorkspace(attemptKey(exerciseId, context), expected, database);
    },
    false,
  );
}

export const emptyCallResponse = (): CallResponse => ({
  version: 1,
  phase: 'ready',
  notes: '',
  retain_audio: false,
  elapsed_ms: 0,
  recording_id: null,
  transcript_draft: '',
  snapshot: null,
});
/** Call edits use the same queue as notes, hints and final submission. */
export async function saveCall(
  exerciseId: string,
  context: AttemptContext,
  attemptId: string,
  patch: Partial<CallResponse>,
  database: BloomlabDatabase = db,
): Promise<CallResponse> {
  const saved = await update(
    exerciseId,
    context,
    (current) => {
      if (current.attempt_id !== attemptId)
        throw new Error('This call is no longer the active attempt.');
      return {
        ...current,
        ...(!current.response.call
          ? {
              rubric_id:
                content.exercises.find((e) => e.id === exerciseId)?.grading.rubric ??
                current.rubric_id,
            }
          : {}),
        response: {
          ...current.response,
          call: { ...emptyCallResponse(), ...current.response.call, ...patch },
        },
      };
    },
    database,
  );
  if (!saved?.response.call)
    throw new Error('This call could not be checkpointed. Keep this page open and retry.');
  return saved.response.call;
}
