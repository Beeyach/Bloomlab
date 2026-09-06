import type { Exercise } from '@bloomlab/content-schema';

import { content } from '../../content/bundle';
import type { DealEconomics } from './deal';

/**
 * The economics of the scenario an exercise prices (PRI-002).
 *
 * Nine fields live on the scenario; two of them decide money. `risk` sets the contingency a quote
 * has to carry, and `estimated_labor_hours` is the estimate the exercise's own scope hours are
 * checked against at build time, so the deal and the scenario cannot drift apart.
 */
export function economicsFor(exercise: Pick<Exercise, 'scenario'>): DealEconomics | null {
  const scenario = content.scenarios.find((candidate) => candidate.id === exercise.scenario);
  if (!scenario?.economics) return null;
  return {
    risk: scenario.economics.risk,
    estimated_labor_hours: scenario.economics.estimated_labor_hours,
  };
}
