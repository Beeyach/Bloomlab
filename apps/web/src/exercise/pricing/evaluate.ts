import type { Exercise, PriceMetric } from '@bloomlab/content-schema';

import {
  brokenPromises,
  danglingScope,
  dealBasis,
  includedScope,
  isRushed,
  unansweredRequirements,
  type DealBasis,
  type DealEconomics,
} from './deal';
import { marginPercent, quoteOf, rushIsCoherent, type Quote } from './quote';
import type { PricingResponse } from './types';

/**
 * What a priced deal is worth, and whether it stands up (PRI-002, EXR-016).
 *
 * There is no target price in here. A quote is judged on whether it clears what the work costs,
 * whether it carries the risk the scenario says the work has, whether its margin is one this
 * business can work at, and whether the scope it charges for is the scope it promised. Two
 * materially different prices can satisfy all of that on the same deal, which is the point:
 * pricing is a judgement with a floor, not a number to guess.
 */

export type PriceProjection = Record<PriceMetric, number | boolean | null> & {
  /** Per-line inclusion, so an exercise can require a specific promise be kept. */
  scope: Record<string, { included: boolean }>;
};

export interface PricingEvaluation {
  quote: Quote;
  basis: DealBasis;
  projection: PriceProjection;
}

/** The eight things PRICE IT asks for. All of them set is what `complete` means. */
function isComplete(response: PricingResponse, inclusions: number): boolean {
  return (
    response.project !== null &&
    response.rush_fee !== null &&
    response.recurring !== null &&
    response.deposit !== null &&
    response.timeline_days !== null &&
    response.revisions !== null &&
    inclusions > 0 &&
    response.exclusions.filter((line) => line.trim().length > 0).length > 0
  );
}

export function evaluatePricing(
  exercise: Exercise,
  economics: DealEconomics | null,
  response: PricingResponse,
): PricingEvaluation | null {
  const pricing = exercise.pricing;
  if (!pricing) return null;

  const basis = dealBasis(pricing, economics, response);
  const quote = quoteOf(response);
  const included = includedScope(pricing, response);
  const exclusions = response.exclusions.filter((line) => line.trim().length > 0);
  const margin = marginPercent(quote, basis);
  const rushed = isRushed(pricing, response.timeline_days);
  const total = quote.total;

  const unanswered = unansweredRequirements(pricing, response);

  const projection: PriceProjection = {
    project: quote.project,
    rush_fee: quote.rush_fee,
    total,
    deposit: quote.deposit,
    deposit_percent: quote.deposit_percent,
    recurring: quote.recurring,
    recurring_annual: quote.recurring_annual,
    timeline_days: quote.timeline_days,
    revisions: quote.revisions,
    inclusions_count: included.length,
    exclusions_count: exclusions.length,
    requirements_count: pricing.requirements.length,
    requirements_answered: pricing.requirements.length - unanswered.length,
    requirements_met: unanswered.length === 0,
    due_now: quote.due_now,
    on_delivery: quote.on_delivery,
    margin_percent: margin,
    complete: isComplete(response, included.length),
    // A deposit larger than the work it is a deposit on is not a deposit.
    deposit_within_total:
      quote.deposit === null || total === null
        ? false
        : quote.deposit <= total && quote.deposit >= 0,
    rush_justified: rushIsCoherent(pricing, response, rushed),
    scope_dependencies_met: danglingScope(pricing, response).length === 0,
    locked_scope_kept: brokenPromises(pricing, response).length === 0,
    cost: basis.cost,
    floor: basis.floor,
    risk_allowance: basis.risk_allowance,
    // The gate: a quote below what delivery costs loses money on every hour of it.
    at_or_above_floor: total === null ? false : total >= basis.floor,
    covers_risk: total === null ? false : total >= basis.covered,
    margin_at_least_floor: margin !== null && margin >= pricing.margin.floor_percent,
    scope: Object.fromEntries(
      pricing.scope.map((item) => [
        item.id,
        { included: included.some((kept) => kept.id === item.id) },
      ]),
    ),
  };

  return { quote, basis, projection };
}

/** The `price` root of the grading state tree, empty for an exercise that prices nothing. */
export function priceState(
  exercise: Exercise,
  economics: DealEconomics | null,
  response: PricingResponse,
): Record<string, unknown> {
  const evaluation = evaluatePricing(exercise, economics, response);
  return evaluation ? evaluation.projection : {};
}
