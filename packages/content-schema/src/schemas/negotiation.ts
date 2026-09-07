import { z } from 'zod';
import { PricingConfigSchema } from './pricing.ts';
import { requireUnique } from './common.ts';

export const NEGOTIATION_ACTIONS = [
  'clarify',
  'hold_price',
  'reduce_scope',
  'phase',
  'concession',
  'walk_away',
] as const;
export const NEGOTIATION_STRATEGIES = [
  'discount',
  'hold',
  'clarify',
  'reduce_scope',
  'phase',
  'walk_away',
  'defensive',
] as const;
export const OBJECTION_CATEGORIES = [
  'budget',
  'competitor_price',
  'discount_request',
  'scope_reduction',
  'phased_project',
  'payment_terms',
  'deposit',
  'concessions',
  'silence',
  'walking_away',
] as const;
export const HIDDEN_PERCENT_KEYS = [
  'trust',
  'urgency',
  'price_sensitivity',
  'frustration',
  'technical_sophistication',
  'fear',
  'previous_bad_experience',
  'alternative_provider_strength',
] as const;
export const NEGOTIATION_METRICS = [
  'strategy',
  'complete',
  'decision_reached',
  'discount_below_cost',
  'economically_sound',
  'structurally_sound',
  'trades_kept',
  'diagnosed',
  'professional_exit',
  'handled_objections',
  'status',
  'turns',
] as const;
export type NegotiationActionKind = (typeof NEGOTIATION_ACTIONS)[number];
export type NegotiationStrategy = (typeof NEGOTIATION_STRATEGIES)[number];
const token = z.string().regex(/^[a-z][a-z0-9_]*$/);
const copy = z.string().trim().min(10);
const money = z.number().min(0).max(1000000);
export const HiddenDeltaSchema = z.strictObject(
  Object.fromEntries(
    HIDDEN_PERCENT_KEYS.map((k) => [k, z.number().min(-100).max(100).optional()]),
  ) as Record<(typeof HIDDEN_PERCENT_KEYS)[number], z.ZodOptional<z.ZodNumber>>,
);
const condition = z.discriminatedUnion('field', [
  z.strictObject({
    field: z.enum([...HIDDEN_PERCENT_KEYS, 'actual_budget', 'stated_budget']),
    operator: z.enum(['gte', 'lte']),
    value: z.number().min(0),
  }),
  z.strictObject({
    field: z.literal('decision_authority'),
    operator: z.literal('equals'),
    value: z.enum(['sole', 'shared', 'none']),
  }),
]);
const branch = z.strictObject({
  reply: copy,
  next: token.nullable(),
  variants: z.array(z.strictObject({ when: condition, reply: copy })).default([]),
});
const node = z.strictObject({
  id: token,
  objection: z.enum(OBJECTION_CATEGORIES),
  message: copy,
  diagnosis: z.array(z.strictObject({ id: token, label: copy, supported: z.boolean() })).min(2),
  branches: z.record(z.enum(NEGOTIATION_STRATEGIES), branch),
  fallback: copy,
});
export const NegotiationConfigSchema = z
  .strictObject({
    subject: copy,
    starting_deal: z.strictObject({
      project: money,
      deposit_percent: z.number().min(0).max(100),
      recurring: money,
      timeline_days: z.number().int().min(1).max(365),
      revisions: z.number().int().min(0).max(50),
      exclusions: z.array(copy).min(1),
    }),
    pricing: PricingConfigSchema,
    start: token,
    max_turns: z.number().int().min(10).max(50),
    rules: z.strictObject({
      strong_diagnosis: HiddenDeltaSchema,
      premature_pitch: HiddenDeltaSchema,
      ignored_objection: HiddenDeltaSchema,
      defensive: HiddenDeltaSchema,
      acceptance_trust: z.number().min(0).max(100),
      opening_budget_sensitivity: z.number().min(0).max(100),
      rejection_frustration: z.number().min(0).max(100),
      minimum_timeline_days: z.number().int().min(1),
    }),
    phases: z
      .array(
        z.strictObject({
          id: token,
          label: copy,
          deferred: z.array(token).min(1),
          consequence: copy,
          phase_two_days: z.number().int().min(1).max(365),
        }),
      )
      .min(1),
    concessions: z
      .array(
        z.strictObject({
          id: token,
          label: copy,
          kind: z.enum(['discount', 'revision', 'payment_terms', 'deposit']),
          amount: money,
          trade: z
            .strictObject({
              kind: z.enum(['deposit_percent', 'timeline_days']),
              value: z.number().int().min(1).max(100),
              label: copy,
            })
            .nullable(),
          consequence: copy,
        }),
      )
      .min(1),
    endings: z.strictObject({
      won: copy,
      lost: copy,
      walked_away: copy,
      approval_needed: copy,
      exhausted: copy,
    }),
    nodes: z.array(node).min(10),
  })
  .superRefine((config, ctx) => {
    const issue = (message: string) => ctx.addIssue({ code: 'custom', message });
    requireUnique(
      ctx,
      config.nodes.map((n) => n.id),
      ['nodes'],
      'node',
    );
    requireUnique(
      ctx,
      config.phases.map((n) => n.id),
      ['phases'],
      'phase',
    );
    requireUnique(
      ctx,
      config.concessions.map((n) => n.id),
      ['concessions'],
      'concession',
    );
    const ids = new Set(config.nodes.map((n) => n.id));
    if (!ids.has(config.start)) issue('Unknown starting node');
    for (const n of config.nodes) {
      requireUnique(
        ctx,
        n.diagnosis.map((d) => d.id),
        ['nodes', n.id, 'diagnosis'],
        'diagnosis',
      );
      if (!n.diagnosis.some((d) => d.supported) || !n.diagnosis.some((d) => !d.supported))
        issue('Diagnosis needs supported and unsupported interpretations');
      for (const [strategy, b] of Object.entries(n.branches)) {
        if (b.next !== null && !ids.has(b.next)) issue('Unknown reaction target');
        if (strategy === 'walk_away' && b.next !== null)
          issue('Walking away must end the conversation');
        for (const v of b.variants)
          if (
            (HIDDEN_PERCENT_KEYS as readonly string[]).includes(v.when.field) &&
            typeof v.when.value === 'number' &&
            v.when.value > 100
          )
            issue('Invalid hidden percentage threshold');
      }
    }
    const reachable = new Set<string>();
    const visit = (id: string) => {
      if (reachable.has(id)) return;
      reachable.add(id);
      const n = config.nodes.find((n) => n.id === id);
      if (n) for (const b of Object.values(n.branches)) if (b.next) visit(b.next);
    };
    visit(config.start);
    if (config.nodes.some((n) => !reachable.has(n.id))) issue('Unreachable negotiation node');
    for (const category of OBJECTION_CATEGORIES)
      if (!config.nodes.some((n) => reachable.has(n.id) && n.objection === category))
        issue(`Missing executable objection: ${category}`);
    const canEnd = new Set(
      config.nodes
        .filter((n) => Object.values(n.branches).some((b) => b.next === null))
        .map((n) => n.id),
    );
    for (let i = 0; i < config.nodes.length; i++)
      for (const n of config.nodes)
        if (Object.values(n.branches).some((b) => b.next && canEnd.has(b.next))) canEnd.add(n.id);
    if (config.nodes.some((n) => !canEnd.has(n.id))) issue('Negotiation graph has a dead end');
    const scope = config.pricing.scope;
    for (const p of config.phases) {
      requireUnique(ctx, p.deferred, ['phases', p.id], 'deferred scope');
      if (p.deferred.some((id) => !scope.some((s) => s.id === id))) issue('Unknown deferred scope');
      if (p.deferred.length === scope.length) issue('Phase 1 cannot be empty');
      if (
        scope.some(
          (s) => !p.deferred.includes(s.id) && s.requires.some((id) => p.deferred.includes(id)),
        )
      )
        issue('Phase 1 depends on deferred work');
    }
    for (const c of config.concessions) {
      if (c.kind === 'deposit' && c.amount > 100) issue('Deposit concession must be a percentage');
      if (
        (c.kind === 'revision' || c.kind === 'payment_terms') &&
        (!Number.isInteger(c.amount) || c.amount < 1 || c.amount > 90)
      )
        issue('Invalid concession units');
      if (c.kind === 'discount' && c.amount > config.starting_deal.project)
        issue('Discount exceeds starting fee');
    }
  });
export type NegotiationConfig = z.infer<typeof NegotiationConfigSchema>;
