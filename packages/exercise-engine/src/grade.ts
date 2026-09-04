import {
  assistanceFromHints,
  type AssistanceLevel,
  type HintLevel,
} from '@bloomlab/mastery-engine';

import { evaluateAssertion, sourcesFor } from './assertions.ts';
import { dimensionOf } from './dimensions.ts';
import { EXERCISE_GRADER_VERSION, SCORING_RULES } from './rules.ts';
import {
  ASSERTION_TIERS,
  SCORING_DIMENSIONS,
  type AssertionDefinition,
  type AssertionResult,
  type AssertionTier,
  type ContextSource,
  type DimensionScore,
  type ExerciseDefinition,
  type GradeReport,
  type GradingContext,
  type ScoringDimension,
} from './types.ts';

export interface GradeInput {
  exercise: ExerciseDefinition;
  context: GradingContext;
  hints_used?: readonly HintLevel[];
  /** Overrides the roll-up from hints when a runtime knows better (guided mode floors, …). */
  assistance?: AssistanceLevel;
}

/** Every context source the exercise's assertions read. */
export function requiredSources(exercise: ExerciseDefinition): ContextSource[] {
  const sources = new Set<ContextSource>();
  for (const assertion of [...exercise.expected_outcomes, ...exercise.critical_failures]) {
    for (const source of sourcesFor(assertion)) sources.add(source);
  }
  return [...sources];
}

/**
 * True when every assertion in the exercise can actually be judged from what is on offer. The
 * runner uses this to decide whether an exercise can be submitted at all: an exercise that needs
 * the simulator is not graded from nothing (EXR-024).
 */
export function isFullyGradable(
  exercise: ExerciseDefinition,
  provides: readonly ContextSource[],
): boolean {
  return requiredSources(exercise).every((source) => provides.includes(source));
}

/**
 * The weighted score (EXR-023): each dimension's pass share, weighted, over the weights of the
 * dimensions that actually have a scored check. An exercise that authors no maintainability check
 * is not marked down for maintainability; a dimension it does check counts at its full weight.
 */
function weightedScore(
  scored: AssertionResult[],
  weights: NonNullable<ExerciseDefinition['grading']['weights']>,
): { score: number | null; dimensions: Record<ScoringDimension, DimensionScore> } {
  const dimensions = Object.fromEntries(
    SCORING_DIMENSIONS.map((dimension) => {
      const mine = scored.filter((result) => result.dimension === dimension);
      const passed = mine.filter((result) => result.passed).length;
      return [
        dimension,
        {
          weight: weights[dimension],
          total: mine.length,
          passed,
          ratio: mine.length === 0 ? null : passed / mine.length,
        },
      ];
    }),
  ) as Record<ScoringDimension, DimensionScore>;
  const present = SCORING_DIMENSIONS.filter(
    (dimension) => dimensions[dimension].ratio !== null && dimensions[dimension].weight > 0,
  );
  const weightSum = present.reduce((sum, dimension) => sum + dimensions[dimension].weight, 0);
  if (weightSum === 0) return { score: scored.length === 0 ? null : 0, dimensions };
  const weighted = present.reduce(
    (sum, dimension) => sum + dimensions[dimension].weight * (dimensions[dimension].ratio ?? 0),
    0,
  );
  return { score: Math.round((weighted / weightSum) * 100), dimensions };
}

const emptyTiers = (): Record<AssertionTier, AssertionResult[]> => ({
  critical: [],
  required: [],
  quality: [],
  bonus: [],
});

/**
 * The deterministic grader (EXR-002, EXR-003, MAS-004).
 *
 * Score: the share of scored checks that passed, where scored = required + quality. Bonus checks
 * are reported and left out of the denominator; critical checks are never scored — they are a
 * gate. A failed critical check fails the attempt at any score, including 100 (D-067).
 *
 * Pure: same exercise plus same context always produces the same report, and nothing here reads
 * the clock, the network or a random source.
 */
export function gradeExercise(input: GradeInput): GradeReport {
  const { exercise, context } = input;
  const hints = input.hints_used ?? [];
  const assistance = input.assistance ?? assistanceFromHints([...hints]);
  const tiers = emptyTiers();

  const placed = (assertion: AssertionDefinition, tier: AssertionTier): AssertionResult => ({
    ...evaluateAssertion(assertion, tier, context),
    dimension: dimensionOf(assertion),
  });
  for (const assertion of exercise.critical_failures) {
    tiers.critical.push(placed(assertion, SCORING_RULES.critical_tier));
  }
  for (const assertion of exercise.expected_outcomes) {
    const tier: AssertionTier =
      assertion.tier && assertion.tier !== 'critical'
        ? assertion.tier
        : SCORING_RULES.default_expected_tier;
    tiers[tier].push(placed(assertion, tier));
  }

  const all = ASSERTION_TIERS.flatMap((tier) => tiers[tier]);
  const unevaluated = all.filter((result) => result.unevaluated);
  const scored = SCORING_RULES.scored_tiers.flatMap((tier) => tiers[tier]);
  const scoredPassed = scored.filter((result) => result.passed).length;
  const weighted = exercise.grading.weights
    ? weightedScore(scored, exercise.grading.weights)
    : null;
  const score = weighted
    ? weighted.score
    : scored.length === 0
      ? null
      : Math.round((scoredPassed / scored.length) * 100);
  const failedCritical = tiers.critical.filter((result) => !result.passed && !result.unevaluated);
  const rubricPending =
    exercise.grading.mode === 'deterministic' ? null : (exercise.grading.rubric ?? null);

  const { outcome, reason } = ((): Pick<GradeReport, 'outcome' | 'reason'> => {
    // A dangerous failure ends it, whatever the number says (MAS-004).
    if (failedCritical.length > 0) return { outcome: 'failed', reason: 'critical_failure' };
    if (unevaluated.length > 0) return { outcome: 'partial', reason: 'unevaluated_assertions' };
    // A rubric this phase cannot evaluate is never quietly treated as passed (AI-006).
    if (rubricPending) return { outcome: 'partial', reason: 'rubric_pending' };
    if (score === null) return { outcome: 'partial', reason: 'nothing_to_grade' };
    return score >= exercise.grading.pass_threshold
      ? { outcome: 'passed', reason: 'threshold_met' }
      : { outcome: 'failed', reason: 'below_threshold' };
  })();

  return {
    exercise_id: exercise.id,
    grader_version: EXERCISE_GRADER_VERSION,
    outcome,
    reason,
    score,
    dimensions: weighted ? weighted.dimensions : null,
    pass_threshold: exercise.grading.pass_threshold,
    assistance,
    hints_used: [...hints],
    failed_critical: failedCritical.map((result) => result.id),
    tiers,
    counts: {
      scored_total: scored.length,
      scored_passed: scoredPassed,
      critical_total: tiers.critical.length,
      critical_passed: tiers.critical.filter((result) => result.passed).length,
      unevaluated: unevaluated.length,
    },
    rubric_pending: rubricPending,
  };
}
