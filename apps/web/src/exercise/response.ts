import type { Exercise } from '@bloomlab/content-schema';
import { LEARNER_STATE_ROOTS } from '@bloomlab/exercise-engine';

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
  /** Free written work: the reasoning, the diagnosis, the prediction in prose. */
  text: string;
  /** The structured architecture choice, when the exercise offers one. */
  choice: string | null;
  /** Structured predictions, keyed by the field name after `prediction.`. */
  prediction: Record<string, string>;
}

export const emptyResponse = (): LearnerResponse => ({ text: '', choice: null, prediction: {} });

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
 * The `prediction` / `decision` / `answer` roots of the grading state tree. Every path an
 * authored assertion can read is present, so a check never fails merely because the runner did
 * not think to supply it.
 */
export function learnerState(
  exercise: Exercise,
  response: LearnerResponse,
): Record<string, unknown> {
  const found = markersIn(response.text, exercise.response_markers);
  const answer: Record<string, unknown> = { text: response.text };
  for (const key of Object.keys(exercise.response_markers)) answer[key] = found.includes(key);
  return {
    prediction: { ...response.prediction, text: response.text },
    decision: {
      choice: response.choice,
      reasoning: response.text,
      reasoning_mentions: found,
    },
    answer,
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
