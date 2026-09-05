import { fail } from '../errors.ts';
import { optionalString, requireString, type SimulatorEvent } from '../events.ts';
import type { AccountState, FunnelReachLevel, FunnelVisit, FunnelStepView } from '../state.ts';
import { FUNNEL_REACH_LEVELS, FUNNEL_VISIT_ENDINGS } from '../state.ts';
import { entity, put, result, type ReducerResult } from './shared.ts';

/**
 * Funnel visit telemetry (FUN-004, EXR-010, D-136).
 *
 * A visit is simulated visitor behaviour — the traffic a funnel received in the story the
 * scenario is telling — and never anything measured in the learner's own browser. These reducers
 * record only what a visit *is*: where it came from, which steps it met, how far down each it
 * got, what it started filling in, and where it stopped.
 *
 * What a visit *achieved* is deliberately not recorded twice. A submission is `FORM_SUBMITTED`, a
 * booking is `APPOINTMENT_BOOKED`, a purchase is `PAYMENT_RECEIVED`, and each of those carries
 * the `visit_id` it belongs to, so the Funnel Autopsy projection joins them from the log rather
 * than a second copy being kept here and drifting. The one thing a visit does hold is who it
 * turned out to be — `contact_id` — because identity is a fact about the visit itself, and the
 * intake reducer stamps it as part of the submission it already validates.
 */

const readReach = (value: unknown, eventType: string): FunnelReachLevel => {
  if (typeof value !== 'string' || !(FUNNEL_REACH_LEVELS as readonly string[]).includes(value)) {
    fail('INVALID_PAYLOAD', `${eventType} needs a reach of ${FUNNEL_REACH_LEVELS.join(', ')}`, {
      reach: value,
    });
  }
  return value as FunnelReachLevel;
};

const readBlocksSeen = (payload: Record<string, unknown>, eventType: string): number => {
  const value = payload.blocks_seen;
  if (value === undefined || value === null) return 1;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    fail('INVALID_PAYLOAD', `${eventType} needs blocks_seen to be a whole count`, {
      blocks_seen: value,
    });
  }
  return value as number;
};

const visitOf = (account: AccountState, id: string, eventType: string): FunnelVisit =>
  entity(account.funnel_visits, id, 'funnel visit', eventType);

/** A live visit refuses further telemetry once it has ended: history is never rewritten. */
function live(visit: FunnelVisit, eventType: string): FunnelVisit {
  if (visit.ended_at !== null) {
    fail('INVALID_PAYLOAD', `Funnel visit ${visit.id} has already ended`, {
      visit_id: visit.id,
      ended_at: visit.ended_at,
      event: eventType,
    });
  }
  return visit;
}

const save = (account: AccountState, visit: FunnelVisit): AccountState => ({
  ...account,
  funnel_visits: put(account.funnel_visits, visit.id, visit),
});

export function funnelVisitStarted(account: AccountState, event: SimulatorEvent): ReducerResult {
  const id = requireString(event.payload, 'visit_id', event.type);
  if (account.funnel_visits[id]) {
    fail('DUPLICATE_ENTITY', `A funnel visit ${id} already exists`, { visit_id: id });
  }
  const funnelId = requireString(event.payload, 'funnel_id', event.type);
  entity(account.funnels, funnelId, 'funnel', event.type);
  // An unrecorded source stays Unknown rather than being guessed from anything (D-138).
  const source = optionalString(event.payload, 'source') ?? 'Unknown';
  const visit: FunnelVisit = {
    id,
    funnel_id: funnelId,
    source,
    started_at: event.at,
    steps: [],
    forms_started: [],
    contact_id: null,
    contact_is_new: false,
    ended_at: null,
    ended_reason: null,
    last_step_id: null,
  };
  return result(save(account, visit), [
    {
      kind: 'input',
      at: event.at,
      event_id: event.id,
      data: { visit_id: id, funnel_id: funnelId, source },
    },
  ]);
}

/**
 * The visitor arrives on a step. The arrival carries its own reach, so an authored cohort can
 * say "they got to the bottom of the first step and the top of the second" in one event per step
 * instead of two; a live walk sends `top` here and a `FUNNEL_SCROLL_RECORDED` when the visitor
 * gets further.
 */
export function funnelStepViewed(account: AccountState, event: SimulatorEvent): ReducerResult {
  const visitId = requireString(event.payload, 'visit_id', event.type);
  const visit = live(visitOf(account, visitId, event.type), event.type);
  const stepId = requireString(event.payload, 'step_id', event.type);
  const funnel = entity(account.funnels, visit.funnel_id, 'funnel', event.type);
  if (!funnel.steps.some((step) => step.id === stepId)) {
    fail('UNKNOWN_ENTITY', `Funnel ${funnel.id} has no step ${stepId}`, {
      funnel_id: funnel.id,
      step_id: stepId,
    });
  }
  const reach =
    event.payload.reach === undefined ? 'top' : readReach(event.payload.reach, event.type);
  const view: FunnelStepView = {
    step_id: stepId,
    at: event.at,
    reach,
    blocks_seen: readBlocksSeen(event.payload, event.type),
  };
  const next: FunnelVisit = {
    ...visit,
    steps: [...visit.steps, view],
    last_step_id: stepId,
  };
  return result(save(account, next), [
    {
      kind: 'input',
      at: event.at,
      contact_id: visit.contact_id,
      event_id: event.id,
      data: { visit_id: visitId, step_id: stepId, reach, blocks_seen: view.blocks_seen },
    },
  ]);
}

/**
 * How far down the current step the visitor actually got. Reach only ever goes deeper: a visitor
 * who reached the bottom and scrolled back up has still reached the bottom.
 */
export function funnelScrollRecorded(account: AccountState, event: SimulatorEvent): ReducerResult {
  const visitId = requireString(event.payload, 'visit_id', event.type);
  const visit = live(visitOf(account, visitId, event.type), event.type);
  const stepId = optionalString(event.payload, 'step_id') ?? visit.last_step_id;
  if (!stepId) {
    fail('INVALID_PAYLOAD', `${event.type} has no step to record against`, { visit_id: visitId });
  }
  const at = visit.steps.map((view) => view.step_id).lastIndexOf(stepId as string);
  if (at === -1) {
    fail('INVALID_PAYLOAD', `Funnel visit ${visitId} never viewed ${stepId}`, {
      visit_id: visitId,
      step_id: stepId,
    });
  }
  const reach = readReach(event.payload.reach, event.type);
  const blocksSeen = readBlocksSeen(event.payload, event.type);
  const existing = visit.steps[at] as FunnelStepView;
  const deeper = FUNNEL_REACH_LEVELS.indexOf(reach) > FUNNEL_REACH_LEVELS.indexOf(existing.reach);
  const view: FunnelStepView = {
    ...existing,
    reach: deeper ? reach : existing.reach,
    blocks_seen: Math.max(existing.blocks_seen, blocksSeen),
  };
  const steps = [...visit.steps];
  steps[at] = view;
  return result(save(account, { ...visit, steps }), [
    {
      kind: 'input',
      at: event.at,
      contact_id: visit.contact_id,
      event_id: event.id,
      data: {
        visit_id: visitId,
        step_id: stepId,
        reach: view.reach,
        blocks_seen: view.blocks_seen,
      },
    },
  ]);
}

/** The visitor began filling something in. Starting is not submitting, and the two never merge. */
export function funnelFormStarted(account: AccountState, event: SimulatorEvent): ReducerResult {
  const visitId = requireString(event.payload, 'visit_id', event.type);
  const visit = live(visitOf(account, visitId, event.type), event.type);
  const blockId = requireString(event.payload, 'block_id', event.type);
  if (visit.forms_started.includes(blockId)) {
    return result(account, [
      {
        kind: 'action_skipped',
        at: event.at,
        contact_id: visit.contact_id,
        event_id: event.id,
        data: { visit_id: visitId, block_id: blockId },
        reason: 'already_started',
      },
    ]);
  }
  const next: FunnelVisit = { ...visit, forms_started: [...visit.forms_started, blockId] };
  return result(save(account, next), [
    {
      kind: 'input',
      at: event.at,
      contact_id: visit.contact_id,
      event_id: event.id,
      data: { visit_id: visitId, block_id: blockId },
    },
  ]);
}

export function funnelVisitEnded(account: AccountState, event: SimulatorEvent): ReducerResult {
  const visitId = requireString(event.payload, 'visit_id', event.type);
  const visit = live(visitOf(account, visitId, event.type), event.type);
  const reason = optionalString(event.payload, 'reason') ?? 'left';
  if (!(FUNNEL_VISIT_ENDINGS as readonly string[]).includes(reason)) {
    fail('INVALID_PAYLOAD', `${event.type} needs ${FUNNEL_VISIT_ENDINGS.join(' or ')}`, { reason });
  }
  const next: FunnelVisit = {
    ...visit,
    ended_at: event.at,
    ended_reason: reason as FunnelVisit['ended_reason'],
  };
  return result(save(account, next), [
    {
      kind: 'input',
      at: event.at,
      contact_id: visit.contact_id,
      event_id: event.id,
      data: { visit_id: visitId, reason, last_step_id: visit.last_step_id },
    },
  ]);
}

/**
 * Records who a visit turned out to be. Called by the intake reducer as part of the submission it
 * already validates, so identity is stamped exactly once, by the event that established it. A
 * submission naming no visit changes nothing here, and a visit that already knows its contact
 * keeps the first one: a second form on the same visit is the same person.
 */
export function identifyVisit(
  account: AccountState,
  visitId: string | null,
  contactId: string,
  isNew: boolean,
): AccountState {
  if (!visitId) return account;
  const visit = account.funnel_visits[visitId];
  if (!visit || visit.contact_id !== null) return account;
  return save(account, { ...visit, contact_id: contactId, contact_is_new: isNew });
}
