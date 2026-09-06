import {
  HIDDEN_PERCENT_KEYS,
  NEGOTIATION_ACTIONS,
  type HiddenState,
  type NegotiationActionKind,
  type NegotiationConfig,
  type NegotiationStrategy,
  type Scenario,
} from '@bloomlab/content-schema';
import { evaluatePricing } from '../pricing/evaluate';
import { includedScope, type DealEconomics } from '../pricing/deal';
import type { PricingResponse } from '../pricing/types';

/** Pure, attempt-local negotiation. No clock, persistence, browser, random source or AI. */
export interface NegotiationAction {
  action: NegotiationActionKind | null;
  text: string;
  approach: 'address' | 'pitch' | 'ignore' | 'defensive';
  diagnosis: string | null;
  excluded: string[];
  project: number | null;
  phase: string | null;
  phase_two_project: number | null;
  timeline_days: number | null;
  concession: string | null;
}
export const emptyNegotiationAction = (): NegotiationAction => ({
  action: null,
  text: '',
  approach: 'address',
  diagnosis: null,
  excluded: [],
  project: null,
  phase: null,
  phase_two_project: null,
  timeline_days: null,
  concession: null,
});
export interface Classification {
  strategy: NegotiationStrategy | null;
  confidence: number;
  source: 'explicit_move' | 'needs_interpretation';
}
export interface NegotiatedDeal {
  quote: PricingResponse;
  phase: { id: string; deferred: string[]; project: number; days: number } | null;
  concessions: string[];
  unearned_trades?: string[];
  balance_days: number;
}
export type DealStatus = 'open' | 'won' | 'lost' | 'walked_away' | 'approval_needed';
export interface NegotiationTurn {
  node: string;
  action: NegotiationAction;
  classification: Classification;
  reply: string;
  offer: NegotiatedDeal | null;
  diagnosis: boolean;
  ignored: boolean;
  fallback: boolean;
}
export interface NegotiationState {
  hidden: HiddenState;
  node: string | null;
  status: DealStatus;
  deal: NegotiatedDeal;
  turns: NegotiationTurn[];
  draft: NegotiationAction;
}
export function initialNegotiation(
  config: NegotiationConfig,
  client: HiddenState,
  overrides: Scenario['hidden_state_overrides'] = {},
): NegotiationState {
  const hidden = { ...client, ...overrides };
  for (const key of HIDDEN_PERCENT_KEYS) hidden[key] = Math.min(100, Math.max(0, hidden[key]));
  hidden.actual_budget = Math.max(0, hidden.actual_budget);
  hidden.stated_budget = Math.max(0, hidden.stated_budget);
  const start = config.starting_deal;
  return {
    hidden,
    node: config.start,
    status: 'open',
    turns: [],
    draft: emptyNegotiationAction(),
    deal: {
      quote: {
        project: start.project,
        deposit: { kind: 'percent', value: start.deposit_percent },
        recurring: start.recurring,
        rush_fee: 0,
        timeline_days: start.timeline_days,
        revisions: start.revisions,
        excluded: [],
        exclusions: [...start.exclusions],
      },
      phase: null,
      concessions: [],
      unearned_trades: [],
      balance_days: 0,
    },
  };
}
/** Explicit moves are a structured protocol, not an interpretation of the learner's prose. */
export function classifyNegotiation(
  action: NegotiationAction,
  config: NegotiationConfig,
): Classification {
  if (!action.action || !(NEGOTIATION_ACTIONS as readonly string[]).includes(action.action))
    return { strategy: null, confidence: 0, source: 'needs_interpretation' };
  const map: Record<NegotiationActionKind, NegotiationStrategy> = {
    clarify: 'clarify',
    hold_price: 'hold',
    reduce_scope: 'reduce_scope',
    phase: 'phase',
    concession:
      config.concessions.find((c) => c.id === action.concession)?.kind === 'discount'
        ? 'discount'
        : 'hold',
    walk_away: 'walk_away',
  };
  return {
    strategy: action.approach === 'defensive' ? 'defensive' : map[action.action],
    confidence: 1,
    source: 'explicit_move',
  };
}
const money = (value: number | null): value is number =>
  value !== null &&
  Number.isFinite(value) &&
  value >= 0 &&
  value <= 1000000 &&
  Number.isInteger(value);

function proposedDeal(
  state: NegotiationState,
  action: NegotiationAction,
  config: NegotiationConfig,
): NegotiatedDeal | null {
  const deal = structuredClone(state.deal);
  if (action.action === 'reduce_scope') {
    if (
      deal.phase ||
      !money(action.project) ||
      action.excluded.length === 0 ||
      !action.excluded.some((id) => !deal.quote.excluded.includes(id)) ||
      !deal.quote.excluded.every((id) => action.excluded.includes(id)) ||
      new Set(action.excluded).size !== action.excluded.length ||
      action.excluded.some((id) => !config.pricing.scope.some((s) => s.id === id && !s.locked))
    )
      return null;
    deal.quote.excluded = [...action.excluded];
    deal.quote.project = action.project;
    deal.quote.exclusions = [
      ...config.starting_deal.exclusions,
      ...config.pricing.scope
        .filter((s) => action.excluded.includes(s.id))
        .map((s) => s.consequence),
    ];
  }
  if (action.action === 'phase') {
    const plan = config.phases.find((p) => p.id === action.phase);
    if (!plan || deal.phase || !money(action.project) || !money(action.phase_two_project))
      return null;
    const deferred = plan.deferred.filter((id) => !deal.quote.excluded.includes(id));
    if (deferred.length === 0) return null;
    deal.phase = {
      id: plan.id,
      deferred,
      project: action.phase_two_project,
      days: plan.phase_two_days,
    };
    deal.quote.project = action.project;
    if (action.timeline_days != null) {
      if (
        !Number.isInteger(action.timeline_days) ||
        action.timeline_days < 1 ||
        action.timeline_days > 365
      )
        return null;
      deal.quote.timeline_days = action.timeline_days;
    }
  }
  if (action.action === 'concession') {
    const concession = config.concessions.find((c) => c.id === action.concession);
    if (!concession || deal.concessions.includes(concession.id)) return null;
    if (concession.kind === 'discount') {
      if (!money(action.project) || action.project >= (deal.quote.project ?? 0)) return null;
      deal.quote.project = action.project;
    }
    if (concession.kind === 'revision')
      deal.quote.revisions = (deal.quote.revisions ?? 0) + concession.amount;
    if (concession.kind === 'payment_terms') deal.balance_days = concession.amount;
    if (concession.kind === 'deposit')
      deal.quote.deposit = { kind: 'percent', value: concession.amount };
    const priorTradeValue =
      concession.trade?.kind === 'deposit_percent'
        ? (state.deal.quote.deposit?.value ?? 0)
        : (state.deal.quote.timeline_days ?? 0);
    if (concession.trade && concession.trade.value <= priorTradeValue)
      deal.unearned_trades = [...(deal.unearned_trades ?? []), concession.id];
    if (concession.trade?.kind === 'deposit_percent')
      deal.quote.deposit = { kind: 'percent', value: concession.trade.value };
    if (concession.trade?.kind === 'timeline_days')
      deal.quote.timeline_days = concession.trade.value;
    deal.concessions.push(concession.id);
  }
  return deal;
}

/** Every stage uses Phase 17's exact floor, risk and margin checks. No second cost formula. */
export function evaluateNegotiatedDeal(
  config: NegotiationConfig,
  economics: DealEconomics | null,
  deal: NegotiatedDeal,
) {
  const kept = includedScope(config.pricing, deal.quote);
  const evaluate = (scope: typeof kept, quote: PricingResponse) =>
    evaluatePricing({ pricing: { ...config.pricing, scope } }, economics, quote)!;
  const full = evaluate(config.pricing.scope, deal.quote);
  const stages = deal.phase
    ? [
        evaluate(
          kept.filter((s) => !deal.phase!.deferred.includes(s.id)),
          { ...deal.quote, excluded: [] },
        ),
        evaluate(
          kept.filter((s) => deal.phase!.deferred.includes(s.id)),
          {
            ...deal.quote,
            project: deal.phase.project,
            excluded: [],
            revisions: 0,
            rush_fee: 0,
            timeline_days: deal.phase.days,
          },
        ),
      ]
    : [full];
  const firstScope = kept.filter((s) => !deal.phase?.deferred.includes(s.id));
  const stagesValid =
    !deal.phase ||
    (firstScope.length > 0 &&
      deal.phase.deferred.length > 0 &&
      deal.phase.deferred.every((id) => kept.some((s) => s.id === id)) &&
      firstScope.every((s) => s.requires.every((id) => firstScope.some((p) => p.id === id))));
  const structural = Boolean(
    full.projection.scope_dependencies_met &&
    full.projection.locked_scope_kept &&
    stagesValid &&
    stages.every((s) => s.projection.deposit_within_total && s.projection.rush_justified) &&
    (deal.quote.timeline_days ?? 0) >= config.rules.minimum_timeline_days &&
    (!deal.phase || deal.phase.days >= config.rules.minimum_timeline_days),
  );
  const atFloor = stages.every((s) => s.projection.at_or_above_floor);
  const sound =
    stages.every(
      (s) =>
        s.projection.at_or_above_floor &&
        s.projection.covers_risk &&
        s.projection.margin_at_least_floor,
    ) &&
    (deal.balance_days === 0 || (stages[0]!.quote.deposit ?? 0) >= stages[0]!.basis.cost);
  const trades = deal.concessions.every((id) => {
    const trade = config.concessions.find((c) => c.id === id)?.trade;
    if (!trade || deal.unearned_trades?.includes(id)) return false;
    return trade.kind === 'timeline_days'
      ? (deal.quote.timeline_days ?? 0) >= trade.value
      : stages.every((stage) => (stage.quote.deposit_percent ?? 0) >= trade.value);
  });
  return {
    stages,
    structural,
    atFloor,
    sound,
    trades,
    total: stages.reduce((sum, s) => sum + (s.quote.total ?? 0), 0),
  };
}

export function negotiationProjection(
  config: NegotiationConfig,
  economics: DealEconomics | null,
  state: NegotiationState,
) {
  const offers = state.turns.flatMap((t) =>
    t.offer ? [evaluateNegotiatedDeal(config, economics, t.offer)] : [],
  );
  const current = evaluateNegotiatedDeal(config, economics, state.deal);
  const checked = offers.length ? offers : [current];
  const diagnosed = state.turns.some((t) => t.diagnosis);
  const handled =
    state.turns.some((t) => !t.fallback) &&
    state.turns.every((t) => !t.ignored && t.classification.strategy !== 'defensive');
  return {
    strategy: state.turns.at(-1)?.classification.strategy ?? null,
    complete: state.status !== 'open',
    decision_reached: state.status !== 'open' && state.turns.at(-1)?.fallback === false,
    discount_below_cost: checked.some((o) => !o.atFloor),
    economically_sound: checked.every((o) => o.sound),
    structurally_sound: checked.every((o) => o.structural),
    trades_kept: checked.every((o) => o.trades),
    diagnosed,
    professional_exit: state.status === 'walked_away' && diagnosed && handled,
    handled_objections: handled,
    status: state.status,
    turns: state.turns.length,
  };
}

export function transitionNegotiation(
  state: NegotiationState,
  action: NegotiationAction,
  config: NegotiationConfig,
  economics: DealEconomics | null,
): NegotiationState {
  if (state.status !== 'open' || !action.text.trim()) return state;
  const node = config.nodes.find((n) => n.id === state.node);
  if (!node) throw new Error('Saved negotiation node no longer exists');
  const next = structuredClone(state);
  const classification = classifyNegotiation(action, config);
  const proposal =
    classification.strategy && action.approach !== 'defensive'
      ? proposedDeal(state, action, config)
      : null;
  const fallback =
    !classification.strategy || (!proposal && classification.strategy !== 'defensive');
  const diagnosed =
    !fallback &&
    action.action === 'clarify' &&
    action.approach === 'address' &&
    Boolean(node.diagnosis.find((d) => d.id === action.diagnosis)?.supported);
  const ignored = !fallback && action.approach === 'ignore';
  const delta = (change: NegotiationConfig['rules']['strong_diagnosis']) => {
    for (const key of HIDDEN_PERCENT_KEYS)
      next.hidden[key] = Math.max(0, Math.min(100, next.hidden[key] + (change[key] ?? 0)));
  };
  if (diagnosed) delta(config.rules.strong_diagnosis);
  if (!fallback && action.approach === 'pitch' && !state.turns.some((t) => t.diagnosis))
    delta(config.rules.premature_pitch);
  if (ignored) delta(config.rules.ignored_objection);
  if (!fallback && classification.strategy === 'defensive') delta(config.rules.defensive);
  const branch = classification.strategy ? node.branches[classification.strategy] : null;
  const variant = branch?.variants.find((v) => {
    const observed = next.hidden[v.when.field];
    return v.when.operator === 'equals'
      ? observed === v.when.value
      : typeof observed === 'number' &&
          typeof v.when.value === 'number' &&
          (v.when.operator === 'gte' ? observed >= v.when.value : observed <= v.when.value);
  });
  let reply = fallback ? node.fallback : (variant?.reply ?? branch!.reply);
  const isOffer =
    !fallback &&
    proposal &&
    action.approach !== 'defensive' &&
    ['hold_price', 'reduce_scope', 'phase', 'concession'].includes(action.action ?? '');
  if (isOffer) next.deal = proposal;
  next.node = fallback ? node.id : branch!.next;
  if (!fallback && classification.strategy === 'walk_away') next.status = 'walked_away';
  else if (next.hidden.frustration >= config.rules.rejection_frustration) next.status = 'lost';
  else if (!fallback && next.node === null) {
    const offer = evaluateNegotiatedDeal(config, economics, next.deal);
    // Stated budget is an opening anchor. A diagnosed, trusted relationship can consider the
    // actual ceiling. The learner only hears the authored decision, never either number.
    const ceiling =
      next.hidden.trust >= config.rules.acceptance_trust &&
      (next.hidden.price_sensitivity < config.rules.opening_budget_sensitivity ||
        next.turns.some((t) => t.diagnosis) ||
        diagnosed)
        ? next.hidden.actual_budget
        : Math.min(next.hidden.actual_budget, next.hidden.stated_budget);
    const acceptable = offer.total <= ceiling && next.hidden.trust >= config.rules.acceptance_trust;
    next.status = !acceptable
      ? 'lost'
      : next.hidden.decision_authority === 'sole'
        ? 'won'
        : next.hidden.decision_authority === 'shared'
          ? 'approval_needed'
          : 'lost';
  }
  if (next.status === 'open' && next.turns.length + 1 >= config.max_turns) {
    next.status = 'lost';
    reply += ' ' + config.endings.exhausted;
  } else if (next.status !== 'open') reply += ' ' + config.endings[next.status];
  if (next.status !== 'open') next.node = null;
  next.turns.push({
    node: node.id,
    action: structuredClone(action),
    classification,
    reply,
    offer: isOffer ? structuredClone(next.deal) : null,
    diagnosis: diagnosed,
    ignored,
    fallback,
  });
  next.draft = { ...emptyNegotiationAction(), excluded: [...next.deal.quote.excluded] };
  return next;
}

/** The renderable transcript contains authored copy and learner messages, never internal state. */
export function negotiationDialogue(config: NegotiationConfig, state: NegotiationState) {
  const result: { from: 'client' | 'learner'; text: string }[] = [];
  for (const turn of state.turns) {
    const node = config.nodes.find((n) => n.id === turn.node);
    if (node) result.push({ from: 'client', text: node.message });
    result.push({ from: 'learner', text: turn.action.text }, { from: 'client', text: turn.reply });
  }
  const current = config.nodes.find((n) => n.id === state.node);
  if (current) result.push({ from: 'client', text: current.message });
  return result;
}
