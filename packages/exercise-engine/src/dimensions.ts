import { DIMENSION_RULES } from './rules.ts';
import { LEARNER_STATE_ROOTS, type AssertionDefinition, type ScoringDimension } from './types.ts';

/**
 * The dimension an assertion is scored under (EXR-023, D-113): the one it names, else the one its
 * type implies. Kept apart from the evaluators and the grader so both can read it without a
 * cycle, and so the rule is one function a review can quote.
 */
export function dimensionOf(assertion: AssertionDefinition): ScoringDimension {
  if (assertion.dimension) return assertion.dimension;
  if (assertion.type === 'architecture') return DIMENSION_RULES.by_type.architecture;
  if (assertion.type === 'negative') return DIMENSION_RULES.by_type.negative;
  if (
    assertion.type === 'state' &&
    (LEARNER_STATE_ROOTS as readonly string[]).includes((assertion.path ?? '').split('.')[0] ?? '')
  ) {
    return DIMENSION_RULES.by_type.learner_state;
  }
  return DIMENSION_RULES.by_type.default;
}
