import type { Exercise, FrameElement, WritingAudience } from '@bloomlab/content-schema';

import { answered } from './words';

/**
 * What EXPLAIN IT counted (EXR-018, SAL-006, SAL-007).
 *
 * Two objective signals, and they are only signals. Jargon is counted against a vocabulary the
 * curriculum already keeps — the glossary — with the terms an owner genuinely uses marked
 * `owner_safe`, so "no-show" is not held against anybody and "custom value" is. Frame coverage
 * is read from the exercise's own markers: the learner never has to write the words "problem"
 * or "outcome", and nothing here judges how well either part was made (§63 of the phase brief).
 */

/** One term of the shared builder vocabulary, as the count sees it. */
export interface JargonTerm {
  id: string;
  term: string;
  /** Term plus aliases, lower-cased. */
  forms: string[];
}

export interface ExplanationProjection {
  audiences_answered: number;
  owner_jargon_count: number;
  builder_jargon_count: number;
  frame_covered: number;
  frame: Record<FrameElement, boolean>;
  /** Which terms the owner version used, for the learner's own feedback. */
  owner_jargon_terms: string[];
}

const escape = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Whole-word matching, with an optional plural. "Workflow" and "workflows" are the same term;
 * "workflowy" is not a use of it, and neither is a term inside a longer word.
 */
function usesTerm(text: string, form: string): boolean {
  const pattern = new RegExp(`(^|[^\\p{L}\\p{N}])${escape(form)}s?($|[^\\p{L}\\p{N}])`, 'iu');
  return pattern.test(text);
}

/** The distinct vocabulary terms this text uses. */
export function jargonTerms(text: string, vocabulary: readonly JargonTerm[]): string[] {
  if (!answered(text)) return [];
  return vocabulary
    .filter((entry) => entry.forms.some((form) => usesTerm(text, form)))
    .map((entry) => entry.term);
}

const answersFor = (
  exercise: Exercise,
  written: Record<string, string>,
  audience: WritingAudience,
): string[] =>
  exercise.written_fields
    .filter((field) => field.audience === audience)
    .map((field) => written[field.key] ?? '')
    .filter((text) => answered(text));

export function projectExplanation(
  exercise: Exercise,
  written: Record<string, string>,
  markersIn: (text: string) => string[],
  vocabulary: readonly JargonTerm[],
): ExplanationProjection {
  const owner = answersFor(exercise, written, 'owner');
  const builder = answersFor(exercise, written, 'builder');
  const audiences = (['owner', 'builder'] as const).filter(
    (audience) => answersFor(exercise, written, audience).length > 0,
  );
  const ownerTerms = [...new Set(owner.flatMap((text) => jargonTerms(text, vocabulary)))].sort();
  const builderTerms = [
    ...new Set(builder.flatMap((text) => jargonTerms(text, vocabulary))),
  ].sort();

  // The frame is read across everything written for an audience: an owner version that names the
  // problem and a builder version that names the system have between them covered both.
  const audienceText = [...owner, ...builder].join('\n');
  const found = new Set(answered(audienceText) ? markersIn(audienceText) : []);
  const frame = Object.fromEntries(
    (['problem', 'consequence', 'system', 'outcome'] as const).map((element) => {
      const authored = exercise.sales.frame.find((entry) => entry.element === element);
      const covered = authored?.markers.some((marker) => found.has(marker)) ?? false;
      return [element, covered];
    }),
  ) as Record<FrameElement, boolean>;

  return {
    audiences_answered: audiences.length,
    owner_jargon_count: ownerTerms.length,
    builder_jargon_count: builderTerms.length,
    frame_covered: Object.values(frame).filter(Boolean).length,
    frame,
    owner_jargon_terms: ownerTerms,
  };
}
