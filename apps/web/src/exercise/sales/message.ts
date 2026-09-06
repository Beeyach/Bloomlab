import type { Exercise } from '@bloomlab/content-schema';

import type { SalesResponse } from './types';
import { answered, wordCount } from './words';

/**
 * What WRITE IT counted (EXR-014, SAL-003, SAL-013).
 *
 * Objective things only: was it written, is it inside the brief's word cap, is there one next
 * step, and is the evidence cited something the learner was actually shown. Whether the email is
 * any good is the rubric's question, and this file does not pretend to answer it.
 */
export interface MessageFieldProjection {
  answered: boolean;
  word_count: number;
  within_limit: boolean;
  /** A next step was written for this message. */
  next_step: boolean;
  citations: number;
  /** At least one cited item is something the learner observed first-hand. */
  cites_direct: boolean;
}

export interface MessageProjection {
  total: number;
  answered: number;
  all_answered: boolean;
  word_count: number;
  within_word_limit: boolean;
  over_limit: number;
  has_next_step: boolean;
  cites_direct_evidence: boolean;
  fields: Record<string, MessageFieldProjection>;
}

/**
 * The pieces of writing this exercise asked for by name. Every named field counts: a cold email,
 * a follow-up and the owner half of an explanation are all writing with a cap, a reader and
 * sometimes a next step, and there is no reason to measure them differently.
 */
export const messageFields = (exercise: Exercise) => exercise.written_fields;

export function projectMessages(
  exercise: Exercise,
  written: Record<string, string>,
  sales: SalesResponse,
): MessageProjection {
  const fields = messageFields(exercise);
  const pack = new Map(exercise.sales.evidence.map((item) => [item.id, item]));
  const rows = fields.map((field) => {
    const text = written[field.key] ?? '';
    const words = wordCount(text);
    const cited = (sales.citations[field.key] ?? [])
      .map((id) => pack.get(id))
      .filter((item) => item !== undefined);
    const row: MessageFieldProjection = {
      answered: answered(text),
      word_count: words,
      within_limit: field.max_words === undefined || words <= field.max_words,
      next_step: answered(sales.next_steps[field.key]),
      citations: cited.length,
      cites_direct: cited.some((item) => item.direct),
    };
    return [field.key, row] as const;
  });
  const byKey = Object.fromEntries(rows);
  const answeredCount = rows.filter(([, row]) => row.answered).length;
  const overLimit = rows.filter(([, row]) => !row.within_limit).length;
  return {
    total: fields.length,
    answered: answeredCount,
    all_answered: fields.length > 0 && answeredCount === fields.length,
    word_count: rows.reduce((sum, [, row]) => sum + row.word_count, 0),
    within_word_limit: overLimit === 0,
    over_limit: overLimit,
    // "Every message that was asked for one has one" — vacuously true when none was asked for.
    has_next_step: fields
      .filter((field) => field.next_step)
      .every((field) => byKey[field.key]?.next_step === true),
    cites_direct_evidence: fields
      .filter((field) => field.cites_evidence)
      .every((field) => byKey[field.key]?.cites_direct === true),
    fields: byKey,
  };
}
