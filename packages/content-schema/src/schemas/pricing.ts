import { z } from 'zod';

import { requireUnique } from './common.ts';

/**
 * The authored half of pricing (spec §80, §122; PRI-001 … PRI-004, EXR-016, SAL-009, SAL-016).
 *
 * A deal is scope, and scope is hours. Everything the engine works out later — what the work
 * costs, what the floor is, what margin a quote carries, what removing a line breaks — comes from
 * numbers authored here against one scenario, never from a rate hidden in code. Two exercises can
 * therefore price two businesses differently without either of them being wrong.
 *
 * What the learner may see and what they may not is decided here too: a scope item's name,
 * description and consequence are learner-facing, and its `hours` are not until they have
 * submitted (EXR-016).
 */

const token = (what: string) =>
  z.string().regex(/^[a-z][a-z0-9_]*$/, `${what} are lower-case tokens`);

/** The thirteen scope dimensions SAL-016 names. */
export const SCOPE_DIMENSIONS = [
  'deliverables',
  'assumptions',
  'exclusions',
  'revisions',
  'dependencies',
  'locations',
  'workflow_complexity',
  'migration',
  'integration',
  'rush',
  'copy',
  'design',
  'support',
] as const;
export type ScopeDimension = (typeof SCOPE_DIMENSIONS)[number];

/** The ten pricing concepts PRI-003 names. */
export const PRICING_CONCEPTS = [
  'fixed',
  'hourly',
  'project',
  'setup',
  'recurring',
  'retainer',
  'margin',
  'complexity',
  'risk',
  'minimum_viable',
] as const;
export type PricingConcept = (typeof PRICING_CONCEPTS)[number];

/** The eight sections a proposal has (SAL-009). */
export const PROPOSAL_SECTIONS = [
  'problem',
  'recommendation',
  'scope',
  'price',
  'timeline',
  'assumptions',
  'exclusions',
  'acceptance',
] as const;
export type ProposalSection = (typeof PROPOSAL_SECTIONS)[number];

/**
 * One line of the deal (spec §80). The learner includes or excludes it, and excluding it says
 * plainly what that leaves the client with — the visible structural consequence PRI-001 asks for.
 */
export const ScopeItemSchema = z.strictObject({
  id: token('Scope ids'),
  name: z.string().trim().min(3),
  /** What it is, in the client's terms. Learner-facing. */
  description: z.string().trim().min(10),
  /** Hours of delivery. The cost basis, and hidden until the attempt is submitted. */
  hours: z.number().min(0.5).max(200),
  /** What the client is left with when this comes out. Learner-facing, and the whole point. */
  consequence: z.string().trim().min(10),
  /** Scope this line needs in order to mean anything. Excluding one leaves this one dangling. */
  requires: z.array(token('Scope ids')).default([]),
  /** The brief's own promise: it cannot be taken out. */
  locked: z.boolean().default(false),
  /** Which of SAL-016's dimensions this line makes the learner think about. */
  dimensions: z.array(z.enum(SCOPE_DIMENSIONS)).min(1),
});

export type ScopeItem = z.infer<typeof ScopeItemSchema>;

/**
 * One thing the client asked for, in their own words (PRI-001 "requirements").
 *
 * A requirement is answered by scope. Take every line that answers it out of the deal and the
 * requirement goes unanswered — which the desk says while the learner is still deciding, because
 * saying it costs nothing: it is a fact about the promise, not about the money.
 */
export const DealRequirementSchema = z.strictObject({
  id: token('Requirement ids'),
  /** What they asked for. Learner-facing, and phrased the way a client would phrase it. */
  need: z.string().trim().min(10),
  /** The scope lines that answer it. All of them out means the deal no longer does. */
  satisfied_by: z.array(token('Scope ids')).min(1),
});

export type DealRequirement = z.infer<typeof DealRequirementSchema>;

/**
 * What one hour costs and what a quote has to clear (PRI-002).
 *
 * `hourly_cost` is what delivering an hour costs this business, authored per exercise because it
 * is a policy rather than a fact about the client. Nothing in the source establishes a universal
 * rate and the engine does not invent one.
 */
const costBasis = z.strictObject({
  hourly_cost: z.number().int().min(1).max(1000),
  /** Contingency added per point of the scenario's own risk score, 1–5 (PRI-002 "risk"). */
  risk_allowance_percent_per_point: z.number().int().min(0).max(20).default(5),
});

/**
 * The margin band this business works to, measured on one-time work only. Recurring revenue is
 * never folded into it: a retainer that makes a thin build look healthy is the mistake this
 * separation exists to prevent.
 */
const marginBand = z
  .strictObject({
    /** Below this, the quote is thin. A scored check, not a gate. */
    floor_percent: z.number().int().min(0).max(95),
    /** At or above this, the quote carries the work comfortably. */
    healthy_percent: z.number().int().min(0).max(95),
  })
  .refine((band) => band.healthy_percent >= band.floor_percent, {
    message: 'A healthy margin cannot be below the thin one',
  });

/** Delivery time, and what compressing it costs (SAL-016 "rush work"). */
const timelinePolicy = z
  .strictObject({
    standard_days: z.number().int().min(1).max(365),
    /** A timeline shorter than this is rushed, and a rush fee is defensible. */
    rush_below_days: z.number().int().min(1).max(365),
    /** What rushing actually costs in hours: overtime, reordering, lost batching. */
    rush_extra_hours: z.number().min(0).max(200).default(0),
  })
  .refine((timeline) => timeline.rush_below_days <= timeline.standard_days, {
    message: 'The rush threshold has to be shorter than the standard timeline',
  });

export const PricingConfigSchema = z
  .strictObject({
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/, 'A three-letter currency code')
      .default('USD'),
    cost: costBasis,
    margin: marginBand,
    timeline: timelinePolicy,
    /** What one round of revisions costs to deliver. The learner chooses how many to include. */
    revision_hours: z.number().min(0).max(40),
    /** What the client asked for, before anyone decides what is in the deal. */
    requirements: z.array(DealRequirementSchema).min(1),
    scope: z.array(ScopeItemSchema).min(1),
    /**
     * Dimensions the exercise's own controls cover rather than its scope lines: the revisions
     * stepper, the exclusions the learner writes, the timeline they choose.
     */
    control_dimensions: z.array(z.enum(SCOPE_DIMENSIONS)).default([]),
    /** Declares this exercise as the scope training SAL-016 asks for; all thirteen must be covered. */
    scope_training: z.boolean().default(false),
  })
  .superRefine((pricing, ctx) => {
    const ids = pricing.scope.map((item) => item.id);
    requireUnique(ctx, ids, ['scope'], 'scope id');
    const known = new Set(ids);
    pricing.scope.forEach((item, index) => {
      for (const required of item.requires) {
        if (required === item.id) {
          ctx.addIssue({
            code: 'custom',
            path: ['scope', index, 'requires'],
            message: `${item.id} cannot require itself`,
          });
        } else if (!known.has(required)) {
          ctx.addIssue({
            code: 'custom',
            path: ['scope', index, 'requires'],
            message: `${required} is not one of this exercise's scope lines`,
          });
        }
      }
      // A line nobody can remove needs no consequence to warn about, but authoring one is
      // harmless; a line that *can* be removed without saying what that breaks is not, because
      // the visible consequence is the requirement (PRI-001).
      if (!item.locked && item.consequence.trim().length < 10) {
        ctx.addIssue({
          code: 'custom',
          path: ['scope', index, 'consequence'],
          message: `${item.id} can be removed, so it must say what removing it leaves behind`,
        });
      }
    });
    requireUnique(
      ctx,
      pricing.requirements.map((requirement) => requirement.id),
      ['requirements'],
      'requirement id',
    );
    pricing.requirements.forEach((requirement, index) => {
      for (const scopeId of requirement.satisfied_by) {
        if (!known.has(scopeId)) {
          ctx.addIssue({
            code: 'custom',
            path: ['requirements', index, 'satisfied_by'],
            message: `${scopeId} is not one of this exercise's scope lines`,
          });
        }
      }
    });
    // A dependency cycle would make "excluding this leaves that dangling" unanswerable.
    const cycle = findCycle(pricing.scope);
    if (cycle) {
      ctx.addIssue({
        code: 'custom',
        path: ['scope'],
        message: `Scope dependencies loop: ${cycle.join(' → ')}`,
      });
    }
    if (pricing.scope_training) {
      const covered = new Set<string>([
        ...pricing.scope.flatMap((item) => item.dimensions),
        ...pricing.control_dimensions,
      ]);
      const missing = SCOPE_DIMENSIONS.filter((dimension) => !covered.has(dimension));
      if (missing.length > 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['scope_training'],
          message: `Scope training covers all thirteen dimensions; missing ${missing.join(', ')}`,
        });
      }
    }
  });

export type PricingConfig = z.infer<typeof PricingConfigSchema>;

/** The first dependency cycle found, or null. Depth-first, so the message names the loop. */
function findCycle(scope: readonly ScopeItem[]): string[] | null {
  const edges = new Map(scope.map((item) => [item.id, item.requires]));
  const state = new Map<string, 'open' | 'done'>();
  const stack: string[] = [];

  const walk = (id: string): string[] | null => {
    if (state.get(id) === 'done') return null;
    if (state.get(id) === 'open') return [...stack.slice(stack.indexOf(id)), id];
    state.set(id, 'open');
    stack.push(id);
    for (const next of edges.get(id) ?? []) {
      if (!edges.has(next)) continue;
      const found = walk(next);
      if (found) return found;
    }
    stack.pop();
    state.set(id, 'done');
    return null;
  };

  for (const item of scope) {
    const found = walk(item.id);
    if (found) return found;
  }
  return null;
}

/**
 * The figures a priced attempt produces, and the whole vocabulary an exercise may check.
 *
 * Same contract as the Phase 16 sales roots: the work area shows these numbers and the grader
 * reads these numbers, because one function produces both. A check on a name that is not here
 * fails the content build rather than sitting in an exercise nobody can satisfy.
 */
export const PRICING_STATE_ROOTS = ['price'] as const;
export type PricingStateRoot = (typeof PRICING_STATE_ROOTS)[number];

export const PRICE_METRICS = [
  /** What the learner supplied. */
  'project',
  'rush_fee',
  'total',
  'deposit',
  'deposit_percent',
  'recurring',
  'recurring_annual',
  'timeline_days',
  'revisions',
  'inclusions_count',
  'exclusions_count',
  'requirements_count',
  'requirements_answered',
  'requirements_met',
  /** What follows from it. */
  'due_now',
  'on_delivery',
  'margin_percent',
  'complete',
  'deposit_within_total',
  'rush_justified',
  'scope_dependencies_met',
  'locked_scope_kept',
  /** What the hidden economics say about it, revealed only after submission. */
  'cost',
  'floor',
  'risk_allowance',
  'at_or_above_floor',
  'covers_risk',
  'margin_at_least_floor',
] as const;
export type PriceMetric = (typeof PRICE_METRICS)[number];
