import {
  assistanceFromHints,
  type AssistanceLevel,
  type HintLevel,
} from '@bloomlab/mastery-engine';

import { evaluateAssertion, sourcesFor } from './assertions.ts';
import { EXERCISE_GRADER_VERSION, SCORING_RULES } from './rules.ts';
import {
  ASSERTION_TIERS,
  type AssertionResult,
  type AssertionTier,
  type ContextSource,
  type ExerciseDefinition,
  type GradeReport,
  type GradingContext,
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

  for (const assertion of exercise.critical_failures) {
    tiers.critical.push(evaluateAssertion(assertion, SCORING_RULES.critical_tier, context));
  }
  for (const assertion of exercise.expected_outcomes) {
    const tier: AssertionTier =
      assertion.tier && assertion.tier !== 'critical'
        ? assertion.tier
        : SCORING_RULES.default_expected_tier;
    tiers[tier].push(evaluateAssertion(assertion, tier, context));
  }

  const all = ASSERTION_TIERS.flatMap((tier) => tiers[tier]);
  const unevaluated = all.filter((result) => result.unevaluated);
  const scored = SCORING_RULES.scored_tiers.flatMap((tier) => tiers[tier]);
  const scoredPassed = scored.filter((result) => result.passed).length;
  const score = scored.length === 0 ? null : Math.round((scoredPassed / scored.length) * 100);
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
