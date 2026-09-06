/**
 * One word counter, for everything (§44 of the phase brief).
 *
 * A word cap the learner reads and a word cap the grade applies have to be the same number, so
 * there is exactly one definition: a word is a run of non-space characters containing at least
 * one letter or digit. "Under 120 words" then means the same thing in the composer, in the
 * report and in a test, and punctuation or double spaces never move it.
 */
export function wordCount(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter((token) => /[\p{L}\p{N}]/u.test(token)).length;
}

/** True when the text has something in it beyond whitespace. */
export const answered = (text: string | undefined): boolean => (text ?? '').trim().length > 0;

/**
 * A share as a whole percentage, or null when there is nothing to divide (REP-003's rule, kept:
 * a rate over nothing is not 0%). The figure shown and the figure judged are this one.
 */
export function sharePercent(part: number, whole: number): number | null {
  if (whole <= 0) return null;
  return Math.round((part / whole) * 100);
}
