import { describe, expect, it } from 'vitest';

import type { Exercise, PricingConfig } from '@bloomlab/content-schema';

import { dealBasis, includedScope, danglingScope, brokenPromises, isRushed } from './deal';
import { count, dollars, money, percent, percentOf } from './money';
import { marginPercent, quoteOf, rushIsCoherent, totalForMargin } from './quote';
import { evaluatePricing, priceState } from './evaluate';
import { emptyPricingResponse, type PricingResponse } from './types';

/**
 * The pricing math (PRI-004).
 *
 * Every number a learner is judged on comes out of these functions, so the boundaries are pinned
 * here rather than discovered on an attempt: where a quote stops clearing the floor, what a
 * deposit expressed two ways comes to, whether recurring revenue can flatter a thin build, and
 * what happens to cost when scope comes out.
 */

const config: PricingConfig = {
  currency: 'USD',
  cost: { hourly_cost: 50, risk_allowance_percent_per_point: 5 },
  margin: { floor_percent: 40, healthy_percent: 55 },
  timeline: { standard_days: 20, rush_below_days: 10, rush_extra_hours: 4 },
  revision_hours: 2,
  requirements: [
    { id: 'books', need: 'People need to be able to book.', satisfied_by: ['calendar'] },
    { id: 'history', need: 'Keep the client history.', satisfied_by: ['migration'] },
  ],
  scope: [
    {
      id: 'form',
      name: 'Form',
      description: 'The form people fill in.',
      hours: 4,
      consequence: 'Nothing to fill in.',
      requires: [],
      locked: true,
      dimensions: ['deliverables'],
    },
    {
      id: 'calendar',
      name: 'Calendar',
      description: 'Where the booking lands.',
      hours: 6,
      consequence: 'They email to arrange a time.',
      requires: ['form'],
      locked: false,
      dimensions: ['deliverables'],
    },
    {
      id: 'migration',
      name: 'Migration',
      description: 'Moving the old records across.',
      hours: 10,
      consequence: 'The old records stay where they are.',
      requires: [],
      locked: false,
      dimensions: ['migration'],
    },
  ],
  control_dimensions: ['revisions'],
  scope_training: false,
};

const exercise = { pricing: config } as Exercise;
const economics = { risk: 2, estimated_labor_hours: 20 };

const answer = (change: Partial<PricingResponse> = {}): PricingResponse => ({
  ...emptyPricingResponse(),
  project: 2000,
  rush_fee: 0,
  recurring: 100,
  deposit: { kind: 'percent', value: 50 },
  timeline_days: 20,
  revisions: 0,
  exclusions: ['Copywriting', 'Paid ads'],
  ...change,
});

describe('money rounds once, to whole dollars', () => {
  it('rounds half away from zero', () => {
    expect(dollars(1210.5)).toBe(1211);
    expect(dollars(1210.4)).toBe(1210);
    expect(dollars(-1210.5)).toBe(-1211);
  });

  it('never produces negative zero', () => {
    expect(Object.is(dollars(-0.2), 0)).toBe(true);
  });

  it('has no denominator to divide by when the total is zero', () => {
    expect(percent(100, 0)).toBeNull();
    expect(percentOf(0, 50)).toBe(0);
  });

  it('reads what a learner typed, and reads an empty box as unanswered', () => {
    expect(money('$2,000')).toBe(2000);
    expect(money('1999.6')).toBe(2000);
    expect(money('')).toBeNull();
    expect(money('not a number')).toBeNull();
    expect(money('-1')).toBeNull();
    expect(count('3')).toBe(3);
    expect(count('  ')).toBeNull();
    expect(count('-1')).toBeNull();
  });
});

describe('the quote is the learner’s own arithmetic', () => {
  it('adds the rush fee into the one-time total and leaves recurring out of it', () => {
    const quote = quoteOf(answer({ project: 2000, rush_fee: 400, recurring: 250 }));
    expect(quote.total).toBe(2400);
    expect(quote.recurring_annual).toBe(3000);
  });

  it('turns a percentage deposit into one canonical dollar figure', () => {
    const quote = quoteOf(
      answer({ project: 2000, rush_fee: 0, deposit: { kind: 'percent', value: 50 } }),
    );
    expect(quote.deposit).toBe(1000);
    expect(quote.due_now).toBe(1000);
    expect(quote.on_delivery).toBe(1000);
    expect(quote.deposit_percent).toBe(50);
  });

  it('reports the percentage a fixed deposit actually comes to', () => {
    const quote = quoteOf(answer({ project: 3000, deposit: { kind: 'amount', value: 900 } }));
    expect(quote.deposit).toBe(900);
    expect(quote.deposit_percent).toBe(30);
  });

  it('leaves a percentage deposit unset while there is no total to take it from', () => {
    const quote = quoteOf(answer({ project: null, deposit: { kind: 'percent', value: 50 } }));
    expect(quote.total).toBeNull();
    expect(quote.deposit).toBeNull();
    expect(quote.on_delivery).toBeNull();
  });

  it('treats an unanswered rush fee as unanswered rather than as zero', () => {
    expect(quoteOf(answer({ rush_fee: null })).total).toBe(2000);
    expect(answer({ rush_fee: null }).rush_fee).toBeNull();
  });

  it('refuses invalid negative money, revisions and non-positive timelines', () => {
    const quote = quoteOf(
      answer({
        project: -1,
        rush_fee: -1,
        recurring: -1,
        timeline_days: 0,
        revisions: -2,
        deposit: { kind: 'percent', value: 101 },
      }),
    );
    expect(quote.project).toBeNull();
    expect(quote.rush_fee).toBeNull();
    expect(quote.recurring).toBeNull();
    expect(quote.timeline_days).toBeNull();
    expect(quote.revisions).toBeNull();
    expect(quote.deposit).toBeNull();
  });
});

describe('what the deal costs moves with the scope', () => {
  it('a malformed negative revision count can never reduce delivery cost', () => {
    const basis = dealBasis(config, economics, answer({ revisions: -10 }));
    expect(basis.revision_hours).toBe(0);
    expect(basis.cost).toBe(1000);
  });

  it('counts every included line, and keeps locked lines in whatever the learner did', () => {
    const basis = dealBasis(config, economics, answer());
    expect(basis.scope_hours).toBe(20);
    expect(basis.cost).toBe(1000);
    expect(basis.risk_allowance).toBe(100);
    expect(basis.covered).toBe(1100);
    expect(includedScope(config, { excluded: ['form'] }).map((line) => line.id)).toContain('form');
    expect(brokenPromises(config, { excluded: ['form'] }).map((line) => line.id)).toEqual(['form']);
  });

  it('drops the hours of a line the learner takes out', () => {
    const basis = dealBasis(config, economics, answer({ excluded: ['migration'] }));
    expect(basis.scope_hours).toBe(10);
    expect(basis.cost).toBe(500);
  });

  it('adds the hours revisions and a compressed timeline actually cost', () => {
    const basis = dealBasis(config, economics, answer({ revisions: 2, timeline_days: 8 }));
    expect(basis.revision_hours).toBe(4);
    expect(basis.rush_hours).toBe(4);
    expect(basis.hours).toBe(28);
    expect(basis.cost).toBe(1400);
  });

  it('carries no contingency for a scenario with no economics', () => {
    const basis = dealBasis(config, null, answer());
    expect(basis.risk_allowance).toBe(0);
    expect(basis.covered).toBe(basis.cost);
  });

  it('notices a line left depending on something taken out', () => {
    expect(danglingScope(config, { excluded: [] })).toEqual([]);
    // `form` is locked, so it cannot actually be removed; `calendar` can be, and nothing needs it.
    expect(danglingScope(config, { excluded: ['calendar'] })).toEqual([]);
  });

  it('calls a timeline shorter than the rush threshold rushed, and the threshold itself not', () => {
    expect(isRushed(config, 9)).toBe(true);
    expect(isRushed(config, 10)).toBe(false);
    expect(isRushed(config, null)).toBe(false);
  });
});

describe('margin policy uses the exact threshold, not its rounded label', () => {
  it('does not turn a true 39.6% margin into a passing 40% margin', () => {
    const evaluated = evaluatePricing(exercise, economics, answer({ project: 1655 }));
    expect(evaluated?.projection.margin_percent).toBe(40);
    expect(evaluated?.projection.margin_at_least_floor).toBe(false);
  });
});

describe('margin measures the price, not the cost, and ignores the retainer', () => {
  it('divides by revenue', () => {
    const quote = quoteOf(answer({ project: 2000, rush_fee: 0 }));
    // $1,000 of delivery on a $2,000 quote is a 50% margin, not a 100% mark-up.
    expect(marginPercent(quote, dealBasis(config, economics, answer()))).toBe(50);
  });

  it('does not let recurring revenue rescue a thin build', () => {
    const thin = answer({ project: 1100, recurring: 5000 });
    const evaluation = evaluatePricing(exercise, economics, thin);
    expect(evaluation?.projection.margin_percent).toBe(9);
    expect(evaluation?.projection.margin_at_least_floor).toBe(false);
    expect(evaluation?.projection.recurring_annual).toBe(60000);
  });

  it('says what a target margin would have needed', () => {
    const basis = dealBasis(config, economics, answer());
    expect(totalForMargin(basis, 40)).toBe(1667);
    expect(totalForMargin(basis, 0)).toBe(1000);
    expect(totalForMargin(basis, 100)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('the floor is the boundary, and it is the cost of the work', () => {
  it('passes a quote exactly on the floor and fails the dollar below it', () => {
    expect(
      evaluatePricing(exercise, economics, answer({ project: 1000 }))?.projection.at_or_above_floor,
    ).toBe(true);
    expect(
      evaluatePricing(exercise, economics, answer({ project: 999 }))?.projection.at_or_above_floor,
    ).toBe(false);
  });

  it('separates clearing the cost from carrying the risk', () => {
    const onFloor = evaluatePricing(exercise, economics, answer({ project: 1050 }))?.projection;
    expect(onFloor?.at_or_above_floor).toBe(true);
    expect(onFloor?.covers_risk).toBe(false);
    expect(
      evaluatePricing(exercise, economics, answer({ project: 1100 }))?.projection.covers_risk,
    ).toBe(true);
  });

  it('fails an unpriced deal rather than treating it as free', () => {
    const nothing = evaluatePricing(exercise, economics, answer({ project: null }))?.projection;
    expect(nothing?.at_or_above_floor).toBe(false);
    expect(nothing?.covers_risk).toBe(false);
    expect(nothing?.margin_percent).toBeNull();
    expect(nothing?.complete).toBe(false);
  });
});

describe('two materially different prices can both be right', () => {
  it('passes every economic check at $2,000 and at $3,200', () => {
    for (const project of [2000, 3200]) {
      const projection = evaluatePricing(exercise, economics, answer({ project }))?.projection;
      expect(projection?.at_or_above_floor).toBe(true);
      expect(projection?.covers_risk).toBe(true);
      expect(projection?.margin_at_least_floor).toBe(true);
      expect(projection?.requirements_met).toBe(true);
    }
  });
});

describe('a rush fee has to agree with the timeline', () => {
  it('wants a fee when the work is compressed and none when it is not', () => {
    expect(rushIsCoherent(config, answer({ timeline_days: 8, rush_fee: 400 }), true)).toBe(true);
    expect(rushIsCoherent(config, answer({ timeline_days: 8, rush_fee: 0 }), true)).toBe(false);
    expect(rushIsCoherent(config, answer({ timeline_days: 20, rush_fee: 400 }), false)).toBe(false);
    expect(rushIsCoherent(config, answer({ timeline_days: 20, rush_fee: 0 }), false)).toBe(true);
  });

  it('is not satisfied by an unanswered rush fee', () => {
    expect(rushIsCoherent(config, answer({ rush_fee: null }), false)).toBe(false);
  });
});

describe('the deal has to keep the promises it was built on', () => {
  it('answers a requirement only while something in the deal covers it', () => {
    const kept = evaluatePricing(exercise, economics, answer())?.projection;
    expect(kept?.requirements_count).toBe(2);
    expect(kept?.requirements_answered).toBe(2);
    expect(kept?.requirements_met).toBe(true);

    const cut = evaluatePricing(
      exercise,
      economics,
      answer({ excluded: ['migration'] }),
    )?.projection;
    expect(cut?.requirements_answered).toBe(1);
    expect(cut?.requirements_met).toBe(false);
  });

  it('refuses a deposit larger than the work it is a deposit on', () => {
    const over = evaluatePricing(
      exercise,
      economics,
      answer({ project: 2000, deposit: { kind: 'amount', value: 2500 } }),
    )?.projection;
    expect(over?.deposit_within_total).toBe(false);
  });

  it('reports each line’s inclusion by name', () => {
    const projection = evaluatePricing(
      exercise,
      economics,
      answer({ excluded: ['calendar'] }),
    )?.projection;
    expect(projection?.scope.calendar).toEqual({ included: false });
    expect(projection?.scope.migration).toEqual({ included: true });
  });

  it('counts only exclusions that say something', () => {
    const projection = evaluatePricing(
      exercise,
      economics,
      answer({ exclusions: ['Copywriting', '   ', ''] }),
    )?.projection;
    expect(projection?.exclusions_count).toBe(1);
    expect(projection?.complete).toBe(true);
  });
});

describe('an exercise that prices nothing has no price state', () => {
  it('returns an empty root rather than a tree of nulls', () => {
    expect(priceState({ pricing: null } as Exercise, economics, answer())).toEqual({});
    expect(evaluatePricing({ pricing: null } as Exercise, economics, answer())).toBeNull();
  });
});
