/**
 * `@bloomlab/exercise-engine` — the deterministic exercise grader (spec §27, TA§31–§33).
 *
 * Pure TypeScript: no React, no DOM, no IndexedDB, no network, no AI, no randomness and no wall
 * clock. It takes an authored exercise plus a normalized `GradingContext` and returns a
 * `GradeReport`. A runtime (the Phase 10 simulator, or the runner's capture of what the learner
 * wrote) is responsible for producing the context; the grader never reaches for one.
 */

/** Exercise families the engine must support (spec §27). */
export const EXERCISE_TYPES = [
  'BUILD_IT',
  'FIX_IT',
  'RUN_THE_LEAD',
  'EDGE_CASE',
  'WHAT_WOULD_YOU_BUILD',
  'ARCHITECTURE_DECISION',
  'FUNNEL_AUTOPSY',
  'FUNNEL_ASSEMBLY',
  'PROSPECT_IT',
  'AUDIT_IT',
  'WRITE_IT',
  'SAY_IT',
  'PRICE_IT',
  'NEGOTIATE_IT',
  'EXPLAIN_IT',
  'REBUILD_BLIND',
  'FIELDWORK',
  'BOSS_CLIENT',
] as const;

export type ExerciseType = (typeof EXERCISE_TYPES)[number];

/** Hint levels; assistance is tracked per attempt (spec §28). */
export const HINT_LEVELS = ['nudge', 'concept_reminder', 'worked_example'] as const;

export type HintLevel = (typeof HINT_LEVELS)[number];

export {
  DIMENSION_RULES,
  EXERCISE_GRADER_VERSION,
  SCORING_RULES,
  SEQUENCE_RULES,
  TIMING_RULES,
} from './rules.ts';
export { resolvePath, describeValue, type Resolved } from './path.ts';
export { evaluateAssertion, sourcesFor } from './assertions.ts';
export { dimensionOf } from './dimensions.ts';
export { gradeExercise, isFullyGradable, requiredSources, type GradeInput } from './grade.ts';
export {
  ASSERTION_TIERS,
  CONTEXT_SOURCES,
  LEARNER_STATE_ROOTS,
  SCORING_DIMENSIONS,
  type AssertionDefinition,
  type AssertionResult,
  type AssertionTier,
  type AssertionType,
  type ContextSource,
  type DimensionScore,
  type ExerciseDefinition,
  type GradeOutcome,
  type GradeReason,
  type GradeReport,
  type GradingArchitecture,
  type GradingContext,
  type GradingEvent,
  type GradingNode,
  type GradingWeights,
  type GradingWorkflow,
  type ScoringDimension,
} from './types.ts';
