import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import {
  ExerciseSchema,
  HiddenDeltaSchema,
  HiddenStateSchema,
  NegotiationConfigSchema,
  ScenarioSchema,
  NEGOTIATION_STRATEGIES,
} from '../src/index.ts';
const root = new URL('../../../content/', import.meta.url);
const read = (path: string) => parse(readFileSync(new URL(path, root), 'utf8'));
const exercise = () => read('exercises/EX-NEGOTIATE_IT-summit-freelancer-quote.yaml');
const scenario = () => read('scenarios/SC-summit-discovery.yaml');

describe('negotiation content build contract', () => {
  it('validates the real exercise and all authored branches', () =>
    expect(ExerciseSchema.safeParse(exercise()).success).toBe(true));
  it.each(NEGOTIATION_STRATEGIES)('rejects a missing %s reaction', (strategy) => {
    const e = exercise();
    delete e.negotiation.nodes[0].branches[strategy];
    expect(ExerciseSchema.safeParse(e).success).toBe(false);
  });
  it('rejects an unknown strategy', () => {
    const e = exercise();
    e.negotiation.nodes[0].branches.agree = e.negotiation.nodes[0].branches.hold;
    expect(ExerciseSchema.safeParse(e).success).toBe(false);
  });
  it('rejects unknown reaction targets', () => {
    const e = exercise();
    e.negotiation.nodes[0].branches.hold.next = 'typo';
    expect(ExerciseSchema.safeParse(e).success).toBe(false);
  });
  it('rejects a missing fallback', () => {
    const e = exercise();
    delete e.negotiation.nodes[0].fallback;
    expect(ExerciseSchema.safeParse(e).success).toBe(false);
  });
  it('rejects unreachable nodes', () => {
    const e = exercise();
    e.negotiation.nodes[1].id = 'orphan';
    expect(ExerciseSchema.safeParse(e).success).toBe(false);
  });
  it('rejects an objection represented only by a label elsewhere', () => {
    const e = exercise();
    e.negotiation.nodes[1].objection = 'competitor_price';
    expect(ExerciseSchema.safeParse(e).success).toBe(false);
  });
  it('rejects unknown deferred scope and broken Phase 1 prerequisites', () => {
    for (const deferred of [['unknown'], ['application_form']]) {
      const e = exercise();
      e.negotiation.phases[0].deferred = deferred;
      expect(ExerciseSchema.safeParse(e).success).toBe(false);
    }
  });
  it.each(['negotiation.typo', 'negotiation.hidden.trust', 'negotiation.strategy.extra'])(
    'rejects nonexistent or hidden grading path %s',
    (path) => {
      const e = exercise();
      e.expected_outcomes[0].path = path;
      expect(ExerciseSchema.safeParse(e).success).toBe(false);
    },
  );
  it('does not make a seed runnable with just a claimed root', () => {
    const e = exercise();
    delete e.negotiation;
    expect(ExerciseSchema.safeParse(e).success).toBe(false);
  });
  it.each([
    { trust: 101 },
    { trust: -1 },
    { truts: 10 },
    { actual_budget: -1 },
    { stated_budget: -1 },
    { decision_authority: 1 },
    { decision_authority: 'boss' },
  ])('rejects invalid hidden overrides %j', (overrides) =>
    expect(
      ScenarioSchema.safeParse({ ...scenario(), hidden_state_overrides: overrides }).success,
    ).toBe(false),
  );
  it('handles shared decision authority intentionally', () =>
    expect(
      ScenarioSchema.parse({
        ...scenario(),
        hidden_state_overrides: { decision_authority: 'shared' },
      }).hidden_state_overrides.decision_authority,
    ).toBe('shared'));
  it.each([
    { truts: 10 },
    { trust: 101 },
    { trust: -101 },
    { actual_budget: 10 },
    { decision_authority: 1 },
  ])('rejects invalid hidden delta %j', (delta) =>
    expect(HiddenDeltaSchema.safeParse(delta).success).toBe(false),
  );
  it.each([-1, NaN, Infinity])('rejects malformed economic amounts %s', (amount) => {
    const e = exercise();
    e.negotiation.concessions[0].amount = amount;
    expect(NegotiationConfigSchema.safeParse(e.negotiation).success).toBe(false);
  });
  it('rejects percentage thresholds outside the hidden state domain', () => {
    const e = exercise();
    e.negotiation.nodes[0].branches.hold.variants[0].when.value = 101;
    expect(ExerciseSchema.safeParse(e).success).toBe(false);
  });
  it('keeps the eleven-field hidden source contract', () =>
    expect(Object.keys(HiddenStateSchema.shape)).toHaveLength(11));
});
