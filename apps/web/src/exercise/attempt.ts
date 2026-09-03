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
  /** The capability the learner arrived from, when the runner was opened with one. */
  skill_id: string | null;
  /** A retrieval run is the same exercise used as a review vehicle (spec §32). */
  run: RunMode;
  started_at: string;
  hints_revealed: HintLevel[];
  response: LearnerResponse;
}

export type RunMode = 'normal' | 'retrieval';

export const attemptKey = (exerciseId: string): string => `exercise.attempt.${exerciseId}`;

export function useActiveAttempt(
  exerciseId: string,
  database: BloomlabDatabase = db,
): ActiveAttempt | null | undefined {
  return useLiveQuery(
    async () => (await loadWorkspace<ActiveAttempt>(attemptKey(exerciseId), database)) ?? null,
    [exerciseId, database],
  );
}

export const loadAttempt = (
  exerciseId: string,
  database: BloomlabDatabase = db,
): Promise<ActiveAttempt | undefined> =>
  loadWorkspace<ActiveAttempt>(attemptKey(exerciseId), database);

/**
 * The attempt to work on: the one already in progress, or a new one. A reload therefore resumes
 * rather than silently starting again, which would lose the hint history the grade depends on.
 */
export async function startAttempt(
  exercise: Pick<Exercise, 'id'>,
  options: { skill_id?: string | null; run?: RunMode; now?: Date } = {},
  database: BloomlabDatabase = db,
): Promise<ActiveAttempt> {
  const existing = await loadAttempt(exercise.id, database);
  if (existing) return existing;
  const attempt: ActiveAttempt = {
    attempt_id: randomId(),
    exercise_id: exercise.id,
    skill_id: options.skill_id ?? null,
    run: options.run ?? 'normal',
    started_at: (options.now ?? new Date()).toISOString(),
    hints_revealed: [],
    response: emptyResponse(),
  };
  await saveWorkspace(attemptKey(exercise.id), attempt, database);
  return attempt;
}

async function update(
  exerciseId: string,
  change: (attempt: ActiveAttempt) => ActiveAttempt,
  database: BloomlabDatabase,
): Promise<ActiveAttempt | null> {
  const current = await loadAttempt(exerciseId, database);
  if (!current) return null;
  const next = change(current);
  await saveWorkspace(attemptKey(exerciseId), next, database);
  return next;
}

export const saveResponse = (
  exerciseId: string,
  response: Partial<LearnerResponse>,
  database: BloomlabDatabase = db,
): Promise<ActiveAttempt | null> =>
  update(
    exerciseId,
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
  level: HintLevel,
  database: BloomlabDatabase = db,
): Promise<ActiveAttempt | null> =>
  update(
    exerciseId,
    (attempt) =>
      attempt.hints_revealed.includes(level)
        ? attempt
        : { ...attempt, hints_revealed: [...attempt.hints_revealed, level] },
    database,
  );

export const discardAttempt = (
  exerciseId: string,
  database: BloomlabDatabase = db,
): Promise<void> => clearWorkspace(attemptKey(exerciseId), database);
