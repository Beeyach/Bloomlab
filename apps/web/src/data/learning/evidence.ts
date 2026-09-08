import {
  assistanceFromHints,
  validateEvidence,
  type AssistanceLevel,
  type EvidenceKind,
  type EvidenceResult,
  type EvidenceSource,
  type EvidenceVersions,
  type ExerciseMode,
  type HintLevel,
  type RealGhlEvidence,
} from '@bloomlab/mastery-engine';

import type { PortfolioCapture } from '@bloomlab/content-schema';
import type { GradeReport } from '@bloomlab/exercise-engine';

import type { LearnerResponse } from '../../exercise/response';

import { db, type BloomlabDatabase } from '../db';
import { nowIso } from '../envelope';
import type { ExerciseAttemptRecord, SkillEvidenceRecord } from '../types';
import { recomputeProgress, type RecomputeOptions } from './progress';
import { stripEnvelope } from './shape';
import { createLearningStores } from './stores';
import { currentVersions } from './versions';

export interface RecordEvidenceInput {
  /** Every skill the attempt demonstrated; one evidence row is written per skill. */
  skill_ids: string[];
  kind: EvidenceKind;
  result: EvidenceResult;
  source: EvidenceSource;
  exercise_id?: string | null;
  exercise_type?: string | null;
  score?: number | null;
  hints_used?: HintLevel[];
  /** Defaults to the roll-up of `hints_used`; an exercise runner may pass its own reading. */
  assistance?: AssistanceLevel;
  difficulty?: number;
  critical_failures?: string[];
  occurred_at?: string;
  real_ghl?: RealGhlEvidence | null;
  mode?: ExerciseMode | null;
  /** Exposure and quizzes have no attempt; everything else gets one (spec §30 "exercise"). */
  with_attempt?: boolean;
  /**
   * Stable evidence ids, keyed by skill, for a fact that must exist once per learner however
   * many devices record it (unit completion, D-062). Everything else omits this and keeps the
   * random id append-only sync expects.
   */
  evidence_ids?: Record<string, string>;
  /**
   * The id of the attempt row to write. The exercise runner mints it when the learner starts and
   * passes it here, so finalizing the same attempt twice cannot become two attempts (D-068).
   * Two genuinely separate attempts carry two different ids and stay two rows.
   */
  attempt_id?: string;
  /** When the learner actually began; defaults to the completion time for evidence with no runner. */
  started_at?: string;
  /** The deterministic grade, stored on the attempt row (D-069). */
  portfolio_capture?: PortfolioCapture | null;
  grade?: GradeReport | null;
  /** What the learner wrote and decided, stored on the attempt row (Phase 16). */
  response?: LearnerResponse | null;
}

export interface RecordEvidenceOptions extends RecomputeOptions {
  versions?: EvidenceVersions;
  recompute?: boolean;
}

export interface RecordedEvidence {
  attempt: ExerciseAttemptRecord | null;
  evidence: SkillEvidenceRecord[];
}

const isExposure = (kind: EvidenceKind) => kind === 'exposure' || kind === 'quiz';

/**
 * The one way learner evidence enters Bloomlab (spec §30, MAS-003, INF-013): the attempt and
 * its evidence rows are written to IndexedDB with their outbox entries in a single
 * transaction, stamped with the version triplet, validated against the evidence schema
 * (an invalid record aborts the whole write), and the derived progress is recomputed.
 */
export async function recordEvidence(
  input: RecordEvidenceInput,
  database: BloomlabDatabase = db,
  options: RecordEvidenceOptions = {},
): Promise<RecordedEvidence> {
  if (input.skill_ids.length === 0) throw new Error('Evidence needs at least one skill');
  const stores = createLearningStores(database);
  const versions = options.versions ?? currentVersions();
  const occurredAt = input.occurred_at ?? nowIso();
  const hints = input.hints_used ?? [];
  const assistance = input.assistance ?? assistanceFromHints(hints);
  const withAttempt = input.with_attempt ?? !isExposure(input.kind);

  const result = await database.transaction(
    'rw',
    [database.skill_evidence, database.exercise_attempts, database.sync_queue, database.device],
    async () => {
      let attempt: ExerciseAttemptRecord | null = null;
      if (withAttempt) {
        attempt = await stores.attempts.create(
          {
            exercise_id: input.exercise_id ?? null,
            exercise_type: input.exercise_type ?? null,
            skill_ids: [...input.skill_ids],
            source: input.source,
            started_at: input.started_at ?? occurredAt,
            completed_at: occurredAt,
            result: input.result,
            score: input.score ?? null,
            assistance,
            hints_used: hints,
            difficulty: input.difficulty ?? 3,
            critical_failures: input.critical_failures ?? [],
            mode: input.mode ?? null,
            versions,
            ...(input.portfolio_capture ? { portfolio_capture: input.portfolio_capture } : {}),
            grade: input.grade ?? null,
            response: input.response ?? null,
          },
          input.attempt_id,
        );
      }
      const evidence: SkillEvidenceRecord[] = [];
      for (const skillId of input.skill_ids) {
        const record = await stores.evidence.create(
          {
            skill_id: skillId,
            kind: input.kind,
            source: input.source,
            exercise_id: input.exercise_id ?? null,
            exercise_type: input.exercise_type ?? null,
            attempt_id: attempt?.id ?? null,
            result: input.result,
            score: input.score ?? null,
            assistance,
            hints_used: hints,
            difficulty: input.difficulty ?? 3,
            critical_failures: input.critical_failures ?? [],
            occurred_at: occurredAt,
            versions,
            real_ghl: input.real_ghl ?? null,
            mode: input.mode ?? null,
          },
          input.evidence_ids?.[skillId],
        );
        const issues = validateEvidence(stripEnvelope(record));
        if (issues.length > 0) {
          throw new Error(
            `Evidence for ${skillId} is incomplete: ${issues.map((i) => `${i.path} ${i.message}`).join('; ')}`,
          );
        }
        evidence.push(record);
      }
      return { attempt, evidence };
    },
  );

  if (options.recompute !== false) await recomputeProgress(database, options);
  return result;
}
