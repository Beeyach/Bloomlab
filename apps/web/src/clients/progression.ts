export const clientProgressId = (client: string) => `cp:${client}`;
import type { ClientProgressRecord, ContentBundle, Project } from '@bloomlab/content-schema';
import { isIndependentPass, isPass, validateEvidence } from '@bloomlab/mastery-engine';
import type { ExerciseAttemptRecord, SkillEvidenceRecord } from '../data/types';
import { stripEnvelope } from '../data/learning/shape';

export interface ProjectStageView {
  id: string;
  name: string;
  exercises: string[];
  missing: string[];
  consequences: string[];
  complete: boolean;
  unlocked: boolean;
}
/** A saved selection is only a reference. Its owned, canonical evidence remains the authority. */
export function eligibleProjectAttempt(
  project: Project,
  exerciseId: string,
  attempt: ExerciseAttemptRecord | undefined,
  evidence: readonly SkillEvidenceRecord[],
  learnerId: string,
  bundle: ContentBundle,
  after?: string,
): boolean {
  const exercise = bundle.exercises.find((row) => row.id === exerciseId);
  if (
    !exercise ||
    !attempt ||
    attempt.learner_id !== learnerId ||
    attempt.deleted_at ||
    attempt.exercise_id !== exerciseId ||
    attempt.result !== 'passed' ||
    attempt.critical_failures.length ||
    !attempt.completed_at ||
    !attempt.response ||
    attempt.versions.content !== bundle.content_version ||
    !['exercise', 'fieldwork'].includes(attempt.source.type) ||
    attempt.source.id !== exerciseId ||
    (after && Date.parse(attempt.started_at) < Date.parse(after))
  )
    return false;
  if (
    project.capstone &&
    (attempt.assistance !== 'independent' ||
      attempt.hints_used.length ||
      !['independent', 'pressure'].includes(attempt.mode ?? ''))
  )
    return false;
  return exercise.skills.every((skill) =>
    evidence.some((row) => {
      const canonical = stripEnvelope(row);
      return (
        !row.deleted_at &&
        row.learner_id === learnerId &&
        row.attempt_id === attempt.id &&
        row.exercise_id === exerciseId &&
        row.skill_id === skill &&
        row.versions.content === attempt.versions.content &&
        row.versions.content_hash === attempt.versions.content_hash &&
        validateEvidence(canonical).length === 0 &&
        (project.capstone ? isIndependentPass(canonical) : isPass(canonical)) &&
        (exercise.type !== 'FIELDWORK' ||
          Boolean(row.real_ghl?.provided && row.real_ghl.evidence.length))
      );
    }),
  );
}

export function projectProgress(
  project: Project,
  record: ClientProgressRecord | undefined,
  attempts: readonly ExerciseAttemptRecord[],
  evidence: readonly SkillEvidenceRecord[],
  learnerId: string,
  bundle: ContentBundle,
) {
  const engagement =
    record?.learner_id === learnerId && !record.deleted_at
      ? record.engagements[project.id]
      : undefined;
  const selections =
    engagement?.content_version === bundle.content_version ? engagement.stage_attempts : {};
  let previousComplete = true;
  let after: string | undefined;
  const stages: ProjectStageView[] = [];
  const accepted = new Map<string, ExerciseAttemptRecord>();
  for (const stage of project.stages) {
    const consequences: string[] = [];
    const exercises = [...stage.exercises];
    for (const rule of stage.conditional_exercises) {
      const source = accepted.get(`${rule.from_stage}:${rule.from_exercise}`);
      if (source?.response?.choice === rule.choice) {
        exercises.push(...rule.exercises);
        consequences.push(rule.consequence);
      }
    }
    const required = [...new Set(exercises)];
    const missing: string[] = [];
    const completed: ExerciseAttemptRecord[] = [];
    for (const id of required) {
      const attempt = attempts.find((row) => row.id === selections[stage.id]?.[id]);
      if (
        previousComplete &&
        eligibleProjectAttempt(
          project,
          id,
          attempt,
          evidence,
          learnerId,
          bundle,
          project.boss_client ? after : undefined,
        )
      ) {
        accepted.set(`${stage.id}:${id}`, attempt!);
        completed.push(attempt!);
      } else missing.push(id);
    }
    const complete: boolean = previousComplete && missing.length === 0;
    stages.push({
      id: stage.id,
      name: stage.name,
      exercises: required,
      missing,
      consequences,
      complete,
      unlocked: previousComplete,
    });
    previousComplete = complete;
    if (complete)
      after =
        completed
          .map((row) => row.completed_at)
          .sort()
          .at(-1) ?? after;
  }
  return {
    stages,
    complete: stages.length > 0 && stages.every((stage) => stage.complete),
    next: stages.find((stage) => !stage.complete) ?? null,
  };
}
