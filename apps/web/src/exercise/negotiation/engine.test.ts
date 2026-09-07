import { describe, expect, it } from 'vitest';
import {
  NEGOTIATION_ACTIONS,
  NEGOTIATION_STRATEGIES,
  OBJECTION_CATEGORIES,
  type HiddenState,
} from '@bloomlab/content-schema';
import { content } from '../../content/bundle';
import { NORMAL_RUN, startAttempt } from '../attempt';
import { gradeAttempt } from '../finalize';
import { economicsFor } from '../pricing';
import { learnerState } from '../response';
import { negotiationOf } from './context';
import {
  classifyNegotiation,
  emptyNegotiationAction,
  evaluateNegotiatedDeal,
  initialNegotiation,
  negotiationProjection,
  transitionNegotiation,
  type NegotiationAction,
  type NegotiationState,
} from './engine';
const exercise = content.exercises.find((e) => e.type === 'NEGOTIATE_IT')!;
const config = exercise.negotiation!;
const economics = economicsFor(exercise);
const initial = () => negotiationOf(exercise)!;
const action = (patch: Partial<NegotiationAction> = {}): NegotiationAction => ({
  ...emptyNegotiationAction(),
  action: 'hold_price',
  text: 'I can commit to the work and terms we have explicitly agreed.',
  ...patch,
});
const turn = (state: NegotiationState, patch: Partial<NegotiationAction> = {}) =>
  transitionNegotiation(state, action(patch), config, economics);
const diagnose = (state = initial()) => turn(state, { action: 'clarify', diagnosis: 'constraint' });
const finish = (state: NegotiationState) => {
  let next = state;
  while (next.status === 'open') next = turn(next);
  return next;
};
const projection = (s: NegotiationState) => negotiationProjection(config, economics, s);

describe('pure negotiation transitions', () => {
  it('inherits all eleven client fields and applies typed scenario overrides', () => {
    expect(Object.keys(initial().hidden)).toHaveLength(11);
    expect(initial().hidden).toMatchObject({
      trust: 55,
      urgency: 45,
      price_sensitivity: 75,
      decision_authority: 'sole',
      actual_budget: 3500,
      stated_budget: 1500,
    });
  });
  it('strong supported diagnosis changes trust by exactly +10', () => {
    expect(diagnose().hidden.trust - initial().hidden.trust).toBe(10);
    expect(turn(initial(), { action: 'clarify', diagnosis: 'assumption' }).hidden.trust).toBe(55);
  });
  it('a premature pitch changes trust by exactly -8', () =>
    expect(turn(initial(), { approach: 'pitch' }).hidden.trust).toBe(47));
  it('an ignored objection changes frustration by exactly +15', () =>
    expect(turn(initial(), { approach: 'ignore' }).hidden.frustration).toBe(45));
  it('a pitch after diagnosis does not incur the premature penalty', () =>
    expect(turn(diagnose(), { approach: 'pitch' }).hidden.trust).toBe(65));
  it('clamps percentage deltas at both limits', () => {
    const s = initial();
    s.hidden.trust = 97;
    s.hidden.frustration = 98;
    expect(diagnose(s).hidden.trust).toBe(100);
    s.hidden.trust = 2;
    expect(turn(s, { approach: 'defensive' }).hidden.trust).toBe(0);
    expect(turn(s, { approach: 'ignore' }).hidden.frustration).toBe(100);
  });
  it('is deterministic and does not mutate its inputs', () => {
    const s = initial(),
      snapshot = structuredClone(s);
    expect(diagnose(s)).toEqual(diagnose(s));
    expect(s).toEqual(snapshot);
  });
  it('changed trust changes the next authored response', () => {
    const listened = diagnose(),
      ignored = turn(initial(), { approach: 'pitch' });
    expect(turn(listened).turns.at(-1)!.reply).toContain('You listened');
    expect(turn(ignored).turns.at(-1)!.reply).not.toContain('You listened');
  });
  it('changed frustration affects the next response and ends an exhausted relationship', () => {
    let s = turn(initial(), { approach: 'ignore' });
    s = turn(s);
    expect(turn(s).turns.at(-1)!.reply).toContain('moving past');
    s = turn(s, { approach: 'ignore' });
    s = turn(s, { approach: 'ignore' });
    expect(s.status).toBe('lost');
  });
  it.each([
    'technical_sophistication',
    'alternative_provider_strength',
    'urgency',
    'fear',
    'previous_bad_experience',
    'price_sensitivity',
    'decision_authority',
  ] as const)('%s affects an authored reaction', (field) => {
    const n = config.nodes.find((n) =>
      Object.values(n.branches).some((b) => b.variants.some((v) => v.when.field === field)),
    )!;
    const [strategy, b] = Object.entries(n.branches).find(([, b]) =>
      b.variants.some((v) => v.when.field === field),
    )!;
    const v = b.variants[0]!;
    const s = initial();
    s.node = n.id;
    const other = structuredClone(s);
    Object.assign(s.hidden, { [field]: v.when.value });
    Object.assign(other.hidden, { [field]: field === 'decision_authority' ? 'sole' : 0 });
    const move =
      strategy === 'phase'
        ? {
            action: 'phase' as const,
            phase: 'applications_first',
            project: 1650,
            phase_two_project: 750,
          }
        : strategy === 'clarify'
          ? { action: 'clarify' as const }
          : { action: 'hold_price' as const };
    expect(turn(s, move).turns.at(-1)!.reply).toContain(v.reply);
    expect(turn(other, move).turns.at(-1)!.reply).not.toContain(v.reply);
  });
  it.each(['actual_budget', 'stated_budget'] as const)('%s affects final acceptance', (field) => {
    const s = field === 'actual_budget' ? diagnose() : initial();
    s.node = 'walking_away';
    s.hidden.price_sensitivity = field === 'stated_budget' ? 90 : 30;
    s.hidden[field] = 100;
    expect(turn(s).status).toBe('lost');
    s.hidden[field] = 10000;
    expect(turn(s).status).toBe('won');
  });
  it('shared authority produces a next step, never a fake win', () => {
    const s = diagnose();
    s.hidden.decision_authority = 'shared';
    expect(finish(s).status).toBe('approval_needed');
  });
  it('ambiguous prose takes an honest fallback with no economic or hidden change', () => {
    const s = initial();
    const next = turn(s, {
      action: null,
      text: 'Maybe we can meet halfway, but not if that means less?',
    });
    expect(next.node).toBe(s.node);
    expect(next.deal).toEqual(s.deal);
    expect(next.hidden).toEqual(s.hidden);
    expect(next.turns[0]).toMatchObject({
      fallback: true,
      classification: { confidence: 0, strategy: null, source: 'needs_interpretation' },
    });
  });
  it('fallback loops are bounded', () => {
    let s = initial();
    for (let i = 0; i < config.max_turns; i++) s = turn(s, { action: null });
    expect(s.status).toBe('lost');
    expect(s.turns.at(-1)!.reply).toContain(config.endings.exhausted);
  });
  it.each(NEGOTIATION_ACTIONS)('the %s learner action executes', (kind) => {
    const next = turn(initial(), {
      action: kind,
      diagnosis: 'constraint',
      excluded: ['typeform_migration', 'handover'],
      project: 1600,
      phase: 'applications_first',
      phase_two_project: 800,
      concession: 'revision_trade',
    });
    expect(next.turns[0]?.fallback).toBe(false);
  });
  it.each(NEGOTIATION_STRATEGIES)(
    'the %s strategy has a distinct executable authored reaction',
    (strategy) => {
      const patch: Partial<NegotiationAction> =
        strategy === 'discount'
          ? { action: 'concession', concession: 'discount_free', project: 900 }
          : strategy === 'defensive'
            ? { approach: 'defensive' }
            : strategy === 'walk_away'
              ? { action: 'walk_away' }
              : strategy === 'reduce_scope'
                ? { action: 'reduce_scope', excluded: ['handover'], project: 2400 }
                : strategy === 'phase'
                  ? {
                      action: 'phase',
                      phase: 'applications_first',
                      project: 1650,
                      phase_two_project: 750,
                    }
                  : strategy === 'clarify'
                    ? { action: 'clarify' }
                    : {};
      const next = turn(initial(), patch);
      expect(next.turns[0]?.classification).toMatchObject({ strategy, confidence: 1 });
      expect(next.turns[0]?.reply.length).toBeGreaterThan(20);
    },
  );
  it.each(OBJECTION_CATEGORIES)(
    '%s is reached by executable turns from the starting node',
    (category) => {
      let s = initial();
      while (
        s.status === 'open' &&
        config.nodes.find((n) => n.id === s.node)?.objection !== category
      )
        s = diagnose(s);
      expect(config.nodes.find((n) => n.id === s.node)?.objection).toBe(category);
      expect(turn(s).turns.at(-1)!.fallback).toBe(false);
    },
  );
  it('recognizing a strategy is not quality evidence', () => {
    expect(classifyNegotiation(action({ action: 'walk_away' }), config).confidence).toBe(1);
    expect(projection(turn(initial(), { action: 'walk_away' })).diagnosed).toBe(false);
  });
});

describe('Phase 17 economics and grading', () => {
  it('a professional lost deal scores 100 with rubric_pending', async () => {
    const s = turn(diagnose(), { action: 'walk_away' });
    const attempt = await startAttempt(exercise, NORMAL_RUN);
    const report = gradeAttempt(exercise, {
      ...attempt,
      response: { ...attempt.response, negotiation: s },
    });
    expect(s.status).toBe('walked_away');
    expect(projection(s).professional_exit).toBe(true);
    expect(report).toMatchObject({ score: 100, reason: 'rubric_pending', outcome: 'partial' });
  });
  it('a won full-scope discount below cost fails critically at any numeric score', async () => {
    let s = diagnose();
    s = turn(s, { action: 'concession', concession: 'discount_free', project: 900 });
    s = finish(s);
    expect(s.status).toBe('won');
    const attempt = await startAttempt(exercise, NORMAL_RUN);
    expect(
      gradeAttempt(exercise, { ...attempt, response: { ...attempt.response, negotiation: s } }),
    ).toMatchObject({ outcome: 'failed', reason: 'critical_failure' });
    expect(projection(s).discount_below_cost).toBe(true);
  });
  it('later walking away cannot erase a harmful offer', () => {
    const s = turn(
      turn(diagnose(), { action: 'concession', concession: 'discount_free', project: 900 }),
      { action: 'walk_away' },
    );
    expect(projection(s).discount_below_cost).toBe(true);
  });
  it('a lower price is defensible when named work really leaves the deal', () => {
    const s = turn(diagnose(), {
      action: 'reduce_scope',
      excluded: ['typeform_migration', 'handover'],
      project: 1600,
    });
    const e = evaluateNegotiatedDeal(config, economics, s.deal);
    expect(e.stages[0]!.basis.cost).toBe(935);
    expect(e.sound).toBe(true);
    expect(s.deal.quote.exclusions.join(' ')).toContain('retypes');
    expect(projection(s).structurally_sound).toBe(true);
  });
  it('removing a dependency fails even with plenty of margin', () => {
    const s = turn(initial(), {
      action: 'reduce_scope',
      excluded: ['discovery_calendar'],
      project: 2400,
    });
    expect(projection(s).structurally_sound).toBe(false);
  });
  it('phasing splits actual work and evaluates both fees separately', () => {
    const s = turn(initial(), {
      action: 'phase',
      phase: 'applications_first',
      project: 1650,
      phase_two_project: 750,
    });
    const e = evaluateNegotiatedDeal(config, economics, s.deal);
    expect(e.stages.map((s) => s.basis.scope_hours)).toEqual([15, 7]);
    expect(e.sound).toBe(true);
    expect(e.structural).toBe(true);
    expect(e.total).toBe(2400);
  });
  it('a profitable Phase 1 cannot subsidize a below-cost Phase 2', () => {
    const s = turn(initial(), {
      action: 'phase',
      phase: 'applications_first',
      project: 3000,
      phase_two_project: 1,
    });
    expect(projection(s).discount_below_cost).toBe(true);
  });
  it('concessions add cost or change real payment obligations', () => {
    const s = turn(initial(), { action: 'concession', concession: 'revision_trade' });
    expect(s.deal.quote).toMatchObject({ revisions: 1, timeline_days: 28 });
    expect(evaluateNegotiatedDeal(config, economics, s.deal).stages[0]!.basis.cost).toBe(1320);
    expect(projection(s).trades_kept).toBe(true);
    const payment = turn(initial(), { action: 'concession', concession: 'balance_later' });
    expect(payment.deal).toMatchObject({ balance_days: 30, quote: { deposit: { value: 60 } } });
  });
  it('a concession is not automatically a discount; a gift with no trade fails', () => {
    const s = turn(initial(), { action: 'concession', concession: 'revision_free' });
    expect(s.turns[0]!.classification.strategy).toBe('hold');
    expect(s.deal.quote.project).toBe(2400);
    expect(projection(s).trades_kept).toBe(false);
  });
  it.each([-1, NaN, Infinity, 1.5])(
    'malformed price %s cannot reduce cost or alter the deal',
    (project) => {
      const s = turn(initial(), { action: 'reduce_scope', excluded: ['handover'], project });
      expect(s.turns[0]!.fallback).toBe(true);
      expect(s.deal).toEqual(initial().deal);
    },
  );
  it('unknown and locked scope references are refused', () => {
    for (const id of ['unknown', 'application_form'])
      expect(
        turn(initial(), { action: 'reduce_scope', excluded: [id], project: 2400 }).turns[0]!
          .fallback,
      ).toBe(true);
  });
  it('the UI and grader use the same projection without exposing hidden state paths', () => {
    const s = diagnose();
    const response = { text: '', choice: null, prediction: {}, negotiation: s };
    expect(learnerState(exercise, response).negotiation).toEqual(projection(s));
    expect(Object.keys(projection(s))).not.toContain('hidden');
  });
  it('exact margin arithmetic does not round 39.6 up to 40', () => {
    const s = turn(initial(), {
      action: 'reduce_scope',
      excluded: ['typeform_migration', 'handover'],
      project: 1548,
    });
    expect(projection(s).economically_sound).toBe(false);
  });
  it('fresh state and old saves never inherit a finished attempt', () => {
    const finished = turn(diagnose(), { action: 'walk_away' });
    expect(negotiationOf(exercise, finished)).toEqual(finished);
    expect(negotiationOf(exercise)).toEqual(initial());
    expect(initialNegotiation(config, initial().hidden as HiddenState).turns).toEqual([]);
  });
});

it('a later concession cannot remove an earlier reciprocal commitment', () => {
  const discounted = turn(initial(), {
    action: 'concession',
    concession: 'discount_trade',
    project: 2300,
  });
  expect(projection(discounted).trades_kept).toBe(true);
  const cancelled = turn(discounted, { action: 'concession', concession: 'deposit_lower' });
  expect(projection(cancelled).trades_kept).toBe(false);
});
it('required negotiation constraints cannot average away against quality points', async () => {
  const gifted = turn(diagnose(), { action: 'concession', concession: 'revision_free' });
  const ended = turn(gifted, { action: 'walk_away' });
  const attempt = await startAttempt(exercise, NORMAL_RUN);
  const report = gradeAttempt(exercise, {
    ...attempt,
    response: { ...attempt.response, negotiation: ended },
  });
  expect(report.score).toBeGreaterThanOrEqual(70);
  expect(report).toMatchObject({ reason: 'required_failure', outcome: 'failed' });
});

it('a client can accept an impossible timeline while the learner fails the structural gate', async () => {
  const rushed = turn(diagnose(), {
    action: 'phase',
    phase: 'applications_first',
    project: 2400,
    phase_two_project: 700,
    timeline_days: 1,
  });
  const ended = finish(rushed);
  expect(ended.status).toBe('won');
  expect(projection(ended).structurally_sound).toBe(false);
  const attempt = await startAttempt(exercise, NORMAL_RUN);
  expect(
    gradeAttempt(exercise, { ...attempt, response: { ...attempt.response, negotiation: ended } }),
  ).toMatchObject({ reason: 'required_failure', outcome: 'failed' });
});

it('uninterpreted fallback exhaustion cannot earn a successful deterministic grade', async () => {
  let s = diagnose();
  while (s.status === 'open') s = turn(s, { action: null, text: 'Perhaps. Maybe not.' });
  expect(projection(s)).toMatchObject({ complete: true, decision_reached: false });
  const attempt = await startAttempt(exercise, NORMAL_RUN);
  expect(
    gradeAttempt(exercise, { ...attempt, response: { ...attempt.response, negotiation: s } }),
  ).toMatchObject({ outcome: 'failed', reason: 'required_failure' });
});
it('a reduced-scope move must remove new work and cannot silently restore exclusions', () => {
  const reduced = turn(initial(), {
    action: 'reduce_scope',
    excluded: ['handover'],
    project: 2400,
  });
  expect(reduced.draft.excluded).toEqual(['handover']);
  for (const excluded of [['handover'], ['typeform_migration']]) {
    const next = turn(reduced, { action: 'reduce_scope', excluded, project: 1600 });
    expect(next.turns.at(-1)?.fallback).toBe(true);
    expect(next.deal).toEqual(reduced.deal);
  }
  const smaller = turn(reduced, {
    action: 'reduce_scope',
    excluded: ['handover', 'typeform_migration'],
    project: 1600,
  });
  expect(smaller.deal.quote.excluded).toHaveLength(2);
});
it('a term already granted cannot count again as a new reciprocal concession trade', () => {
  const extended = turn(initial(), { action: 'concession', concession: 'revision_trade' });
  const smallerDeposit = turn(extended, { action: 'concession', concession: 'deposit_lower' });
  expect(smallerDeposit.deal.quote.timeline_days).toBe(28);
  expect(projection(smallerDeposit).trades_kept).toBe(false);
});
