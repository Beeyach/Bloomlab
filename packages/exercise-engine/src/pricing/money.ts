/**
 * How Bloomlab does money (PRI-004).
 *
 * One rule, in one place: a quote is whole dollars. A project fee, a deposit, a rush fee and a
 * monthly retainer are all integers, so nothing here can drift by a cent the way repeated
 * floating-point arithmetic does, and two screens showing the same figure cannot disagree about
 * its last digit. Hours may be fractional — half an hour of work is a real thing — and the one
 * place fractions become money is `dollars`, which rounds once.
 */

/** Rounds to whole dollars, half away from zero, and never returns -0. */
export function dollars(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const rounded = value < 0 ? -Math.round(-value) : Math.round(value);
  return rounded === 0 ? 0 : rounded;
}

/**
 * A whole percentage, or null when there is nothing to divide. The same rule REP-003 set for a
 * rate over no denominator: a margin on a quote of nothing is not 0%, it is unanswerable.
 */
export function percent(part: number, whole: number): number | null {
  if (!Number.isFinite(part) || !Number.isFinite(whole) || whole === 0) return null;
  return Math.round((part / whole) * 100);
}

/** Applies a whole percentage to an amount, in whole dollars. */
export const percentOf = (amount: number, share: number): number => dollars((amount * share) / 100);

/** A number the learner typed, as whole dollars, or null when they have not typed one. */
export function money(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value))
    return value >= 0 ? dollars(value) : null;
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/[$,\s]/g, '');
  if (cleaned.length === 0) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) && parsed >= 0 ? dollars(parsed) : null;
}

/** A whole non-negative count the learner typed (revisions, days), or null. */
export function count(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value))
    return value >= 0 ? Math.round(value) : null;
  if (typeof value !== 'string') return null;
  const cleaned = value.trim();
  if (cleaned.length === 0) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : null;
}
