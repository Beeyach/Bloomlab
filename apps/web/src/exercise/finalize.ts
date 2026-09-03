import type { Exercise } from '@bloomlab/content-schema';
import { gradeExercise, type GradeReport, type GradingContext } from '@bloomlab/exercise-engine';
import {
  assistanceFromHints,
  maxAssistance,
  type EvidenceKind,
  type EvidenceResult,
} from '@bloomlab/mastery-engine';

import { db, type BloomlabDatabase } from '../data/db';
import { recordEvidence } from '../data/learning';
import type { ExerciseAttemptRecord } from '../data/types';
import { discardAttempt, type ActiveAttempt } from './attempt';
import { learnerState } from './response';
import { availableSources, canGradeNow } from './runtime';

/**
 * Finalizing an attempt: grade what the learner did, then write it once through the Phase 6
 * evidence path. There is no second progress store — `exercise_attempts`, `skill_evidence` and
 * the derived rows the engine recomputes are the only record (D-068).
 */

/**
 * Which kind of evidence an attempt produces (spec §30, §32). The exercise's authored mode
 * decides it for a normal run; a retrieval run is review, whatever the vehicle's normal use is,
 * and never counts toward an independent demonstration (D-052).
 */
export const EVIDENCE_KIND_BY_MODE: Record<Exercise['mode'], EvidenceKind> = {
  guided: 'guided_practice',
  practice: 'deterministic_exercise',
  independent: 'independent_exercise',
  pressure: 'pressure_test',
};

export function evidenceKindFor(exercise: Exercise, run: ActiveAttempt['run']): EvidenceKind {
  return run === 'retrieval' ? 'retrieval' : EVIDENCE_KIND_BY_MODE[exercise.mode];
}

const RESULT_BY_OUTCOME: Record<GradeReport['outcome'], EvidenceResult> = {
  passed: 'passed',
  failed: 'failed',
  partial: 'partial',
};

/** The grading context the runner itself can build: what the learner chose and wrote. */
export function learnerContext(exercise: Exercise, attempt: ActiveAttempt): GradingContext {
  return {
    state: learnerState(exercise, attempt.response),
    events: [],
    references: {},
    architecture: null,
    provides: availableSources(exercise),
  };
}

export function gradeAttempt(exercise: Exercise, attempt: ActiveAttempt): GradeReport {
  // A guided exercise is guided practice whatever the hint log says; the mastery engine applies
  // the same floor to the evidence, so the report and the record agree (D-045).
  const fromHints = assistanceFromHints(attempt.hints_revealed);
  const assistance =
    attempt.run === 'normal' && exercise.mode === 'guided'
      ? maxAssistance(fromHints, 'guided')
      : fromHints;
  return gradeExercise({
    exercise,
    context: learnerContext(exercise, attempt),
    hints_used: attempt.hints_revealed,
    assistance,
  });
}

export interface FinalizedAttempt {
  attempt: ExerciseAttemptRecord;
  report: GradeReport;
  /** False when this call found the attempt already finalized and wrote nothing. */
  recorded: boolean;
}

export class NotGradableError extends Error {
  constructor(public readonly exerciseId: string) {
    super(`${exerciseId} cannot be graded yet: its checks need a runtime that does not exist`);
    this.name = 'NotGradableError';
  }
}

/**
 * Grades the attempt and records it. Idempotent by construction: the attempt row carries the id
 * the runner minted when the learner started, so a double submit, a retry after a failed write,
 * or a reload mid-save all address the same row and produce one attempt with one evidence row
 * per taught skill. A genuinely new attempt has a new id and stays a separate fact (D-068).
 */
export async function finalizeAttempt(
  exercise: Exercise,
  attempt: ActiveAttempt,
  database: BloomlabDatabase = db,
  options: { now?: Date } = {},
): Promise<FinalizedAttempt> {
  const existing = await database.exercise_attempts.get(attempt.attempt_id);
  if (existing) {
    await discardAttempt(exercise.id, database);
    return {
      attempt: existing,
      report: existing.grade ?? gradeAttempt(exercise, attempt),
      recorded: false,
    };
  }
  if (!canGradeNow(exercise)) throw new NotGradableError(exercise.id);

  const report = gradeAttempt(exercise, attempt);
  const completedAt = (options.now ?? new Date()).toISOString();
  const { attempt: row } = await recordEvidence(
    {
      skill_ids: exercise.skills,
      kind: evidenceKindFor(exercise, attempt.run),
      result: RESULT_BY_OUTCOME[report.outcome],
      source: {
        type: attempt.run === 'retrieval' ? 'retrieval' : 'exercise',
        id: exercise.id,
      },
      exercise_id: exercise.id,
      exercise_type: exercise.type,
      score: report.score,
      hints_used: attempt.hints_revealed,
      difficulty: exercise.difficulty,
      critical_failures: report.failed_critical,
      // A retrieval run carries no authored mode: it is review, not the exercise's normal use.
      mode: attempt.run === 'retrieval' ? null : exercise.mode,
      occurred_at: completedAt,
      started_at: attempt.started_at,
      attempt_id: attempt.attempt_id,
      evidence_ids: Object.fromEntries(
        exercise.skills.map((skillId) => [skillId, `ea:${attempt.attempt_id}:${skillId}`]),
      ),
      grade: report,
    },
    database,
  );
  await discardAttempt(exercise.id, database);
  if (!row) throw new Error('An exercise attempt must produce an attempt row');
  return { attempt: row, report, recorded: true };
}

/** Every finalized attempt at this exercise, newest first, for the result view and history. */
export async function attemptHistory(
  exerciseId: string,
  database: BloomlabDatabase = db,
): Promise<ExerciseAttemptRecord[]> {
  const rows = await database.exercise_attempts
    .filter((row) => row.deleted_at === null && row.exercise_id === exerciseId)
    .toArray();
  return rows.sort((a, b) => b.completed_at.localeCompare(a.completed_at));
}
