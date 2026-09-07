import { combineRubric, objectiveReport } from '@bloomlab/exercise-engine';
import { evaluateSubmission } from '../ai/client';
import { content } from '../content/bundle';
import { checkpointSubmission } from './attempt';
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
import {
  contextOf,
  discardAttempt,
  flushAttemptWrites,
  isValidRetrievalTarget,
  loadAttempt,
  type ActiveAttempt,
  type AttemptContext,
} from './attempt';
import { learnerState } from './response';
import { availableSources, canGradeNow, runtimeFor } from './runtime';

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

/**
 * The selling families produce their own kind of evidence, whatever mode they are authored in
 * (spec §30; the mastery rules' own list). Doing the work in a sales context is what a skill's
 * `sales_use` requirement is asking for, and explaining a system to an audience is `explanation`.
 * A guided run is still guided practice: assistance decides that, not the family.
 */
export const EVIDENCE_KIND_BY_TYPE: Partial<Record<Exercise['type'], EvidenceKind>> = {
  PROSPECT_IT: 'sales_use',
  AUDIT_IT: 'sales_use',
  WRITE_IT: 'sales_use',
  SAY_IT: 'sales_use',
  PRICE_IT: 'sales_use',
  NEGOTIATE_IT: 'sales_use',
  EXPLAIN_IT: 'explanation',
};

export function evidenceKindFor(exercise: Exercise, run: ActiveAttempt['run']): EvidenceKind {
  if (run === 'retrieval') return 'retrieval';
  if (exercise.mode === 'guided') return EVIDENCE_KIND_BY_MODE.guided;
  return EVIDENCE_KIND_BY_TYPE[exercise.type] ?? EVIDENCE_KIND_BY_MODE[exercise.mode];
}

export class RetrievalTargetError extends Error {
  constructor(exerciseId: string, skillId: string | null) {
    super(
      `A retrieval of ${exerciseId} must review a capability the exercise teaches, not ${skillId ?? 'none'}`,
    );
    this.name = 'RetrievalTargetError';
  }
}

/**
 * Which capabilities this attempt is evidence for (D-072).
 *
 * A normal run credits every skill the exercise teaches. A retrieval run is a review of **one**
 * capability — the exercise is only the vehicle — so it writes evidence for that capability
 * alone. Reviewing one skill must never move another's review clock or refresh state merely
 * because the same exercise happens to teach it, so an unnamed or untaught target is refused
 * rather than widened to every skill.
 */
export function skillsForAttempt(
  exercise: Exercise,
  attempt: Pick<ActiveAttempt, 'run' | 'skill_id'>,
): string[] {
  if (attempt.run !== 'retrieval') return [...exercise.skills];
  if (!isValidRetrievalTarget(exercise, attempt.skill_id)) {
    throw new RetrievalTargetError(exercise.id, attempt.skill_id);
  }
  return [attempt.skill_id];
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

/**
 * Grades the attempt. `context` is what a registered runtime produced — the CRM Lab's real
 * account, for an exercise authored against it. Without one the runner can still judge what the
 * learner chose and wrote, and an assertion needing a source nothing supplied is reported
 * unevaluated rather than failed (EXR-024).
 */
export function gradeAttempt(
  exercise: Exercise,
  attempt: ActiveAttempt,
  context?: GradingContext | null,
): GradeReport {
  // A guided exercise is guided practice whatever the hint log says; the mastery engine applies
  // the same floor to the evidence, so the report and the record agree (D-045).
  const fromHints = assistanceFromHints(attempt.hints_revealed);
  const assistance =
    attempt.run === 'normal' && exercise.mode === 'guided'
      ? maxAssistance(fromHints, 'guided')
      : fromHints;
  return gradeExercise({
    exercise,
    context: context ?? learnerContext(exercise, attempt),
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
 * The runtime that owns this exercise exists but could not produce a context right now — the CRM
 * Lab has no account on this device yet, say. Refusing is the only honest answer: falling back to
 * the learner-only context would claim `state` and `events` the run never supplied and fail the
 * learner for work they were never able to do (EXR-024).
 */
export class RuntimeUnavailableError extends Error {
  constructor(
    public readonly exerciseId: string,
    public readonly runtimeId: string,
  ) {
    super(`${exerciseId} needs the ${runtimeId} runtime, which has nothing to grade yet`);
    this.name = 'RuntimeUnavailableError';
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
  const attemptContext = contextOf(attempt);
  // Every edit already triggered by the learner must cross the persistence door before submit
  // reads the attempt. Otherwise clicking Run it immediately after typing can grade and preserve
  // the older React snapshot while the last keystroke is still waiting on IndexedDB.
  await flushAttemptWrites(exercise.id, attemptContext);
  const current = (await loadAttempt(exercise.id, attemptContext, database)) ?? attempt;

  const existing = await database.exercise_attempts.get(current.attempt_id);
  if (existing) {
    await discardAttempt(exercise.id, attemptContext, database);
    return {
      attempt: existing,
      report: existing.grade ?? gradeAttempt(exercise, current),
      recorded: false,
    };
  }
  if (
    exercise.negotiation &&
    (!current.response.negotiation || current.response.negotiation.status === 'open')
  )
    throw new Error('Finish the negotiation conversation before submitting.');
  if (!canGradeNow(exercise)) throw new NotGradableError(exercise.id);
  // Refused before anything is written, so a malformed retrieval can never reach the record.
  const skillIds = skillsForAttempt(exercise, current);

  // Read the runtime's own state now, once, so the report is of the account as it stood at
  // submission and cannot drift while the evidence is being written.
  const runtime = runtimeFor(exercise);
  const context =
    runtime && !current.submitted
      ? await runtime.context(exercise, learnerState(exercise, current.response))
      : null;
  if (runtime && !context && !current.submitted)
    throw new RuntimeUnavailableError(exercise.id, runtime.id);
  let report = objectiveReport(
    current.submitted?.report ?? gradeAttempt(exercise, current, context),
  );
  if (report.reason === 'rubric_pending') {
    const rubricId = current.submitted?.rubric_id ?? current.rubric_id ?? report.rubric_pending!;
    report = { ...report, rubric_pending: rubricId };
    const rubric = content.rubrics.find((r) => r.id === rubricId);
    if (!rubric) throw new Error('The exact submitted rubric is unavailable. Your work is saved.');
    current.submitted = { report, rubric_id: rubricId };
    await checkpointSubmission(exercise.id, attemptContext, current, database);
    const evaluation = await evaluateSubmission(
      {
        attempt_id: current.attempt_id,
        exercise_id: exercise.id,
        rubric_id: rubricId,
        submission: JSON.stringify({ response: current.response, deterministic: report }),
      },
      database,
    );
    if (evaluation.rubric_id !== rubricId || evaluation.rubric_version !== rubric.version)
      throw new Error('Evaluation rubric mismatch');
    report = { ...combineRubric(report, rubric, evaluation.result), rubric_evaluation: evaluation };
  }
  const completedAt = (options.now ?? new Date()).toISOString();
  const { attempt: row } = await recordEvidence(
    {
      skill_ids: skillIds,
      kind: evidenceKindFor(exercise, current.run),
      result: RESULT_BY_OUTCOME[report.outcome],
      source: {
        type: current.run === 'retrieval' ? 'retrieval' : 'exercise',
        id: exercise.id,
      },
      exercise_id: exercise.id,
      exercise_type: exercise.type,
      score: report.score,
      hints_used: current.hints_revealed,
      difficulty: exercise.difficulty,
      critical_failures: report.failed_critical,
      // A retrieval run carries no authored mode: it is review, not the exercise's normal use.
      mode: current.run === 'retrieval' ? null : exercise.mode,
      occurred_at: completedAt,
      started_at: current.started_at,
      attempt_id: current.attempt_id,
      evidence_ids: Object.fromEntries(
        skillIds.map((skillId) => [skillId, `ea:${current.attempt_id}:${skillId}`]),
      ),
      grade: report,
      // The work itself travels with the attempt: a sales thread and the writing in it are the
      // evidence, and the draft is cleared two lines below.
      response: current.response,
    },
    database,
  );
  await discardAttempt(exercise.id, attemptContext, database);
  if (!row) throw new Error('An exercise attempt must produce an attempt row');
  return { attempt: row, report, recorded: true };
}

/** Every finalized attempt at this exercise, newest first — the complete history, unfiltered. */
export async function attemptHistory(
  exerciseId: string,
  database: BloomlabDatabase = db,
): Promise<ExerciseAttemptRecord[]> {
  const rows = await database.exercise_attempts
    .filter((row) => row.deleted_at === null && row.exercise_id === exerciseId)
    .toArray();
  return rows.sort((a, b) => b.completed_at.localeCompare(a.completed_at));
}

/**
 * True when a finalized attempt belongs to this run context. A normal run's result is any
 * ordinary attempt at the exercise; a review's result is a retrieval of that one capability. The
 * two never stand in for each other on screen, and neither is deleted or hidden from
 * `attemptHistory` (D-072).
 */
export const attemptMatchesContext = (
  row: ExerciseAttemptRecord,
  context: AttemptContext,
): boolean =>
  context.run === 'retrieval'
    ? row.source.type === 'retrieval' && row.skill_ids.includes(context.skill_id ?? '')
    : row.source.type !== 'retrieval';

/** The finalized attempts for one run context, newest first: what the runner shows as the result. */
export async function attemptsInContext(
  exerciseId: string,
  context: AttemptContext,
  database: BloomlabDatabase = db,
): Promise<ExerciseAttemptRecord[]> {
  const rows = await attemptHistory(exerciseId, database);
  return rows.filter((row) => attemptMatchesContext(row, context));
}
