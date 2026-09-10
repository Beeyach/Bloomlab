import { sequenceState } from './sequence';
import { reviewState, type ReviewResponse } from './review';
import { completionMissing } from '../fieldwork/proof';
import type { FieldworkResponse } from '@bloomlab/shared';
import type { CallResponse } from '@bloomlab/shared';
import { negotiationOf } from './negotiation/context';
import { negotiationProjection, type NegotiationState } from './negotiation/engine';
import type { Exercise } from '@bloomlab/content-schema';
import { LEARNER_STATE_ROOTS, fixtureState } from '@bloomlab/exercise-engine';

import {
  economicsFor,
  emptyPricingResponse,
  priceState,
  type DealEconomics,
  type PricingResponse,
} from './pricing';
import { emptySalesResponse, salesState, type JargonTerm, type SalesResponse } from './sales';

/**
 * Turning what the learner supplied into the state tree the grader reads.
 *
 * Two kinds of thing come back from the work area: structured answers (a chosen architecture, a
 * predicted tag) and written work. Structured answers are compared directly. Written work is
 * reduced to the authored `response_markers` — and to nothing else: the marker vocabulary lives
 * in the exercise file, the text itself is preserved verbatim, and no score is ever derived from
 * prose here. Judging the argument is rubric work and belongs to Phase 19 (D-070).
 */

export interface LearnerResponse {
  review?: ReviewResponse;
  sequence?: string[];
  fieldwork?: FieldworkResponse;
  call?: CallResponse;
  /** Free written work: the reasoning, the diagnosis, the prediction in prose. */
  text: string;
  /** The structured architecture choice, when the exercise offers one. */
  choice: string | null;
  /** Structured predictions, keyed by the field name after `prediction.`. */
  prediction: Record<string, string>;
  /**
   * Immutable RUN THE LEAD boundary: the answer as committed, and the exact simulator generation
   * and event position that already existed. Finalization accepts only execution after it.
   */
  run_prediction?: RunPredictionCheckpoint;
  /**
   * Named long-form answers, keyed by the exercise's own `written_fields` (EXR-010, D-143).
   * Optional on the type so an attempt saved before Phase 15 still reads: an old draft has no
   * `written` and resumes with none rather than failing to load.
   */
  written?: Record<string, string>;
  /**
   * The selling families' structured work: the businesses judged, the findings written, the next
   * steps and citations attached to each message, and the client thread (Phase 16). Optional for
   * the same reason `written` is — a draft saved before it existed resumes without it.
   */
  sales?: SalesResponse;
  /**
   * The deal the learner priced: the scope they kept and the eight numbers they set (Phase 17).
   * Optional for the same reason `sales` is — a draft saved before it existed resumes without it.
   */
  pricing?: PricingResponse;
  negotiation?: NegotiationState;
}

export interface RunPredictionCheckpoint {
  committed_at: string;
  prediction: Record<string, string>;
  scenario_id: string;
  run_id: string | null;
  run_generation: string | null;
  through_event_index: number;
}

export const emptyResponse = (): LearnerResponse => ({
  text: '',
  choice: null,
  prediction: {},
  written: {},
  sales: emptySalesResponse(),
  pricing: emptyPricingResponse(),
});

/** The named answers on a response, tolerating a draft saved before they existed. */
export const writtenOf = (response: LearnerResponse): Record<string, string> =>
  response.written ?? {};

/** The sales half of a response, tolerating a draft saved before it existed. */
export const salesOf = (response: LearnerResponse): SalesResponse => ({
  ...emptySalesResponse(),
  ...(response.sales ?? {}),
});

/** The priced half of a response, tolerating a draft saved before it existed. */
export const pricingOf = (response: LearnerResponse): PricingResponse => ({
  ...emptyPricingResponse(),
  ...(response.pricing ?? {}),
});

/**
 * The marker keys whose phrases appear in the text, case-insensitively. Deterministic: the same
 * text and the same vocabulary always give the same keys, in the vocabulary's own order.
 */
export function markersIn(text: string, markers: Exercise['response_markers']): string[] {
  const haystack = text.toLowerCase();
  return Object.entries(markers)
    .filter(([, phrases]) => phrases.some((phrase) => haystack.includes(phrase.toLowerCase())))
    .map(([key]) => key);
}

/**
 * The learner-supplied roots of the grading state tree: `prediction`, `decision`, `answer`,
 * `written`, and the five sales projections. Every path an authored assertion can read is
 * present, so a check never fails merely because the runner did not think to supply it.
 */
export function learnerState(
  exercise: Exercise,
  response: LearnerResponse,
  options: { vocabulary?: readonly JargonTerm[]; economics?: DealEconomics | null } = {},
): Record<string, unknown> {
  const named = writtenOf(response);
  // Markers are matched against everything the learner wrote, the free response and every named
  // answer together, so an exercise that moved its writing into named fields still satisfies the
  // `answer.<marker>` checks that were authored against one textarea.
  const everything = [response.text, ...exercise.written_fields.map((f) => named[f.key] ?? '')]
    .filter((part) => part.length > 0)
    .join('\n');
  const found = markersIn(everything, exercise.response_markers);
  const answer: Record<string, unknown> = { text: response.text };
  if (exercise.type === 'FIELDWORK')
    answer.fieldwork_complete = Boolean(
      response.fieldwork && completionMissing(exercise, response.fieldwork).length === 0,
    );
  for (const key of Object.keys(exercise.response_markers)) answer[key] = found.includes(key);
  // Each named answer is graded on its own: which markers appear *in it*, and whether it was
  // answered at all. That is what lets a check say the hypothesis names the booking step without
  // being satisfied by the problem statement mentioning it.
  const written: Record<string, unknown> = {};
  for (const field of exercise.written_fields) {
    const value = named[field.key] ?? '';
    written[field.key] = value;
    written[`${field.key}_mentions`] = markersIn(value, exercise.response_markers);
    written[`${field.key}_answered`] = value.trim().length > 0;
  }
  // The five sales roots, from the same response, computed by the same functions the work area
  // shows its own feedback from (Phase 16). An exercise that is not a sales family carries them
  // empty, exactly as `written` has always been empty for an exercise with no named answers.
  const sales = salesState({
    exercise,
    written: named,
    sales: salesOf(response),
    markersIn: (text) => markersIn(text, exercise.response_markers),
    vocabulary: options.vocabulary,
  });
  // The deal, from the same response and the scenario's own economics (Phase 17). An exercise
  // that prices nothing carries an empty `price`, exactly as it carries an empty `written`.
  const price = priceState(
    exercise,
    options.economics === undefined ? economicsFor(exercise) : options.economics,
    pricingOf(response),
  );
  const negotiation = exercise.call ? null : negotiationOf(exercise, response.negotiation);
  return {
    fixture: fixtureState(exercise.fixture_checks, named),
    sequence: sequenceState(exercise.sequence_steps, response.sequence),
    review: reviewState(exercise.review_checks, response.review),
    call: response.call?.snapshot?.projection ?? {},
    negotiation:
      negotiation && exercise.negotiation
        ? negotiationProjection(
            exercise.negotiation,
            options.economics === undefined ? economicsFor(exercise) : options.economics,
            negotiation,
          )
        : {},
    prediction: { ...response.prediction, text: response.text },
    decision: {
      choice: response.choice,
      reasoning: response.text,
      reasoning_mentions: found,
    },
    answer,
    written,
    ...sales,
    price,
  };
}

/**
 * The structured prediction fields this exercise actually grades, taken from its own assertions.
 * The label is derived from the path alone — never from the assertion's description or expected
 * value, which would hand the learner the answer.
 */
export function predictionFields(exercise: Exercise): { key: string; label: string }[] {
  const keys = new Set<string>();
  for (const assertion of [...exercise.expected_outcomes, ...exercise.critical_failures]) {
    if (assertion.type !== 'state') continue;
    const [root, ...rest] = assertion.path.split('.');
    if (root !== 'prediction' || rest.length === 0) continue;
    const key = rest.join('.');
    if (key !== 'text') keys.add(key);
  }
  return [...keys].sort().map((key) => ({ key, label: humanize(key) }));
}

const humanize = (key: string): string => {
  const words = key.replace(/[._]/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/** True when the exercise reads anything the learner writes or chooses. */
export const readsLearnerWork = (exercise: Exercise): boolean =>
  [...exercise.expected_outcomes, ...exercise.critical_failures].some(
    (assertion) =>
      assertion.type === 'state' &&
      (LEARNER_STATE_ROOTS as readonly string[]).includes(assertion.path.split('.')[0] ?? ''),
  );
