import type { PricingConfig } from '@bloomlab/content-schema';

import { dollars, percent, percentOf } from './money';
import type { DealBasis } from './deal';
import type { PricingResponse } from './types';

/**
 * The learner's own arithmetic (EXR-016, PRI-001).
 *
 * Nothing hidden goes into this: it is what they typed, added up. That is why the deal desk can
 * show all of it before submission — a learner is entitled to see their own total, what is due on
 * signature and what is left on delivery, because they set every number in it.
 *
 * Margin is the one figure that needs the hidden cost, so it lives in the evaluation rather than
 * here, and the desk does not show it until the attempt is in.
 */

export interface Quote {
  project: number | null;
  rush_fee: number | null;
  /** The one-time work: the project fee plus any rush fee. Recurring is never in here. */
  total: number | null;
  deposit: number | null;
  deposit_percent: number | null;
  due_now: number | null;
  on_delivery: number | null;
  recurring: number | null;
  recurring_annual: number | null;
  timeline_days: number | null;
  revisions: number | null;
}

export function quoteOf(response: PricingResponse): Quote {
  // Each figure the learner typed is rounded to whole dollars once, here, and every number
  // downstream is built from the rounded ones. Nothing rounds a second time.
  const project =
    response.project === null || response.project < 0 ? null : dollars(response.project);
  const rush =
    response.rush_fee === null || response.rush_fee < 0 ? null : dollars(response.rush_fee);
  const total = project === null ? null : project + (rush ?? 0);

  // One canonical deposit: whatever the learner expressed it as, it becomes dollars here and is
  // never recomputed anywhere else. A percentage of a total that does not exist yet is not a
  // number, so it stays null rather than becoming zero.
  const deposit =
    response.deposit === null || response.deposit.value < 0
      ? null
      : response.deposit.kind === 'amount'
        ? dollars(response.deposit.value)
        : response.deposit.value > 100 || total === null
          ? null
          : percentOf(total, response.deposit.value);

  const recurring =
    response.recurring === null || response.recurring < 0 ? null : dollars(response.recurring);
  const timelineDays =
    response.timeline_days === null || response.timeline_days < 1
      ? null
      : Math.round(response.timeline_days);
  const revisions =
    response.revisions === null || response.revisions < 0 ? null : Math.round(response.revisions);
  return {
    project,
    rush_fee: rush,
    total,
    deposit,
    deposit_percent: deposit === null || total === null ? null : percent(deposit, total),
    due_now: deposit,
    on_delivery: total === null ? null : total - (deposit ?? 0),
    recurring,
    recurring_annual: recurring === null ? null : recurring * 12,
    timeline_days: timelineDays,
    revisions,
  };
}

/**
 * Margin on the one-time work, as a whole percentage of what is being charged for it.
 *
 * The denominator is revenue, not cost: a $2,000 quote on $1,200 of delivery is a 40% margin, not
 * a 67% mark-up, and the two get confused often enough to be worth naming. Recurring revenue is
 * deliberately absent — a retainer that makes a thin build look healthy is exactly the mistake
 * this separation prevents.
 */
export const marginPercent = (quote: Quote, basis: DealBasis): number | null =>
  quote.total === null ? null : percent(quote.total - basis.cost, quote.total);

/** The smallest total that would clear a given margin, for the reveal after submission. */
export const totalForMargin = (basis: DealBasis, marginTarget: number): number =>
  marginTarget >= 100 ? Number.POSITIVE_INFINITY : dollars(basis.cost / (1 - marginTarget / 100));

/** Whether a rush fee is coherent with the timeline the learner chose. */
export const rushIsCoherent = (
  pricing: PricingConfig,
  response: PricingResponse,
  rushed: boolean,
): boolean => {
  if (response.rush_fee === null || response.timeline_days === null) return false;
  // Charging for a rush nobody is doing, or compressing the work for nothing, are both wrong.
  void pricing;
  return rushed ? response.rush_fee > 0 : response.rush_fee === 0;
};
