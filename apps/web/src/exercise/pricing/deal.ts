import type { DealRequirement, PricingConfig, ScopeItem } from '@bloomlab/content-schema';

import { dollars, percentOf } from './money';
import type { PricingResponse } from './types';

/**
 * What the deal costs to deliver (PRI-002).
 *
 * Every figure here comes from hours the exercise authored against one scenario, multiplied by a
 * rate that exercise also authored. Nothing in the source establishes a universal hourly cost, so
 * the engine does not carry one: two businesses can price the same hours differently and neither
 * is wrong. This is the half of the deal the learner does not see until they have submitted.
 */

export interface DealBasis {
  /** Hours of the scope still in the deal. */
  scope_hours: number;
  /** Hours the chosen revisions add. */
  revision_hours: number;
  /** Hours compressing the timeline adds. */
  rush_hours: number;
  hours: number;
  /** What those hours cost to deliver, in whole dollars. */
  cost: number;
  /** Contingency the scenario's own risk score asks for. */
  risk_allowance: number;
  /** The quote may not go below this: it is what the work costs. */
  floor: number;
  /** Cost plus contingency: what a quote has to clear to carry its own risk. */
  covered: number;
}

/** The risk score a scenario carries, 1–5 (PRI-002). Absent economics carry no contingency. */
export interface DealEconomics {
  risk: number;
  estimated_labor_hours: number;
}

/** The scope lines still in the deal, in the exercise's own order. */
export const includedScope = (
  pricing: PricingConfig,
  response: Pick<PricingResponse, 'excluded'>,
): ScopeItem[] =>
  pricing.scope.filter((item) => item.locked || !response.excluded.includes(item.id));

/** Lines that are in, but whose dependency the learner has taken out (SAL-016 "dependencies"). */
export function danglingScope(
  pricing: PricingConfig,
  response: Pick<PricingResponse, 'excluded'>,
): ScopeItem[] {
  const kept = new Set(includedScope(pricing, response).map((item) => item.id));
  return includedScope(pricing, response).filter((item) =>
    item.requires.some((required) => !kept.has(required)),
  );
}

/**
 * What the client asked for that the remaining scope no longer answers (PRI-001).
 *
 * Structural, not economic: it says a promise has gone, never what the promise was worth. That is
 * why the desk can show it while the learner is still deciding.
 */
export function unansweredRequirements(
  pricing: PricingConfig,
  response: Pick<PricingResponse, 'excluded'>,
): DealRequirement[] {
  const kept = new Set(includedScope(pricing, response).map((item) => item.id));
  return pricing.requirements.filter(
    (requirement) => !requirement.satisfied_by.some((scopeId) => kept.has(scopeId)),
  );
}

/** Locked lines the learner has somehow excluded: the brief's own promise, broken. */
export const brokenPromises = (
  pricing: PricingConfig,
  response: Pick<PricingResponse, 'excluded'>,
): ScopeItem[] =>
  pricing.scope.filter((item) => item.locked && response.excluded.includes(item.id));

/** True when the timeline the learner chose is short enough to count as rushed. */
export const isRushed = (pricing: PricingConfig, timelineDays: number | null): boolean =>
  timelineDays !== null && timelineDays >= 1 && timelineDays < pricing.timeline.rush_below_days;

/**
 * What this deal costs, at the scope and timeline the learner chose.
 *
 * Cost moves with the work: taking a line out removes its hours, adding revisions adds theirs,
 * and compressing the timeline adds the hours that compression actually costs. That is what makes
 * a lower price defensible on a smaller deal and indefensible on the full one.
 */
export function dealBasis(
  pricing: PricingConfig,
  economics: DealEconomics | null,
  response: PricingResponse,
): DealBasis {
  const scopeHours = includedScope(pricing, response).reduce((sum, item) => sum + item.hours, 0);
  // A malformed or old draft can never lower delivery cost by carrying negative revisions.
  const revisionHours = Math.max(0, Math.round(response.revisions ?? 0)) * pricing.revision_hours;
  const rushHours = isRushed(pricing, response.timeline_days)
    ? pricing.timeline.rush_extra_hours
    : 0;
  const hours = scopeHours + revisionHours + rushHours;
  const cost = dollars(hours * pricing.cost.hourly_cost);
  const riskPercent = (economics?.risk ?? 0) * pricing.cost.risk_allowance_percent_per_point;
  const riskAllowance = percentOf(cost, riskPercent);
  return {
    scope_hours: scopeHours,
    revision_hours: revisionHours,
    rush_hours: rushHours,
    hours,
    cost,
    risk_allowance: riskAllowance,
    floor: cost,
    covered: cost + riskAllowance,
  };
}
