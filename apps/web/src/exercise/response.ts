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
  /**
   * Named long-form answers, keyed by the exercise's own `written_fields` (EXR-010, D-143).
   * Optional on the type so an attempt saved before Phase 15 still reads: an old draft has no
   * `written` and resumes with none rather than failing to load.
   */
  written?: Record<string, string>;
}

export const emptyResponse = (): LearnerResponse => ({
  text: '',
  choice: null,
  prediction: {},
  written: {},
});

/** The named answers on a response, tolerating a draft saved before they existed. */
export const writtenOf = (response: LearnerResponse): Record<string, string> =>
  response.written ?? {};

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
  const named = writtenOf(response);
  // Markers are matched against everything the learner wrote, the free response and every named
  // answer together, so an exercise that moved its writing into named fields still satisfies the
  // `answer.<marker>` checks that were authored against one textarea.
  const everything = [response.text, ...exercise.written_fields.map((f) => named[f.key] ?? '')]
    .filter((part) => part.length > 0)
    .join('\n');
  const found = markersIn(everything, exercise.response_markers);
  const answer: Record<string, unknown> = { text: response.text };
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
  return {
    prediction: { ...response.prediction, text: response.text },
    decision: {
      choice: response.choice,
      reasoning: response.text,
      reasoning_mentions: found,
    },
    answer,
    written,
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
