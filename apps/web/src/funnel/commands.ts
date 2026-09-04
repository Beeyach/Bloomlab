import { slotAt } from '@bloomlab/simulator-core';
import type {
  Funnel,
  PendingEvent,
  SimulatorEventType,
  SimulatorScenario,
  Slot,
} from '@bloomlab/simulator-core';

import type { BloomlabDatabase } from '../data/db';
import { randomId } from '../data/envelope';
import { resetStoredRun, type StoredRun } from '../simulator/store';
import {
  execute,
  type EngineRefusal,
  type ExecutionOptions,
  type ExecutionResult,
} from '../workflow/execution';

/**
 * The Funnel Lab command layer (FUN-001 … FUN-003, D-119, D-120).
 *
 * A screen states an intent; this module turns it into one event for the **existing** execution
 * door — the same `execute` the Workflow Lab uses, on the same Worker, committing to the same
 * store. Phase 13 adds no second engine path, no second account and no second persistence route.
 *
 * A funnel definition reaches the account exactly as a workflow definition does: as an event the
 * engine validates, logs and can replay (D-107, D-119). A visitor's actions reach it as the real
 * account events those actions mean — `FORM_SUBMITTED`, `SURVEY_SUBMITTED`, `APPOINTMENT_BOOKED`,
 * `PAYMENT_RECEIVED` — so the intake reducers validate them, the generated `CONTACT_CREATED` or
 * `CONTACT_UPDATED` travels the ordinary path, and the workflow reaction sees the real chain.
 * Nothing here writes a contact, and nothing here injects `WORKFLOW_ENROLLED` to fake a trigger.
 *
 * No rule lives here. Which fields a form has, whether a reference resolves, where a step leads:
 * all of that is `simulator-core`. What lives here is translation, id minting (the engine forbids
 * randomness) and the choice of which event an intent means.
 */

export type FunnelOutcome = ExecutionResult;

/** The label the engine records for everything the Lab injects. */
export const FUNNEL_LAB_SOURCE = 'funnel_lab';

export const newFunnelId = () => `fn-${randomId()}`;
export const newStepId = () => `st-${randomId()}`;
export const newBlockId = () => `bl-${randomId()}`;
export const newVisitorId = () => `contact-${randomId()}`;
export const newVisitId = () => `fv-${randomId()}`;
export const newAppointmentId = () => `appt-${randomId()}`;
export const newPaymentId = () => `pay-${randomId()}`;

const injected = (
  run: StoredRun,
  type: SimulatorEventType,
  payload: Record<string, unknown>,
  at: string = run.state.clock.now,
): PendingEvent => ({
  type,
  at,
  payload,
  origin: 'injected',
  source: { kind: 'injector_action', id: FUNNEL_LAB_SOURCE },
});

type Options = ExecutionOptions;

const sameSlot = (a: Slot, b: Slot): boolean =>
  a.starts_at === b.starts_at &&
  a.duration_minutes === b.duration_minutes &&
  a.host_id === b.host_id;

/* ---- definitions --------------------------------------------------------------------- */

/** The definition as an event payload: everything but the version, which the engine assigns. */
const asPayload = (funnel: Funnel): Record<string, unknown> => {
  const { version: _version, ...rest } = funnel;
  return rest;
};

export const createFunnel = (
  run: StoredRun,
  scenario: SimulatorScenario,
  funnel: Funnel,
  options?: Options,
) =>
  execute(
    run,
    scenario,
    { kind: 'process', event: injected(run, 'FUNNEL_CREATED', { funnel: asPayload(funnel) }) },
    options,
  );

/** Replaces an existing funnel; the engine bumps the version (D-104). */
export const updateFunnel = (
  run: StoredRun,
  scenario: SimulatorScenario,
  funnel: Funnel,
  options?: Options,
) =>
  execute(
    run,
    scenario,
    {
      kind: 'process',
      event: injected(run, 'FUNNEL_UPDATED', {
        funnel_id: funnel.id,
        funnel: asPayload(funnel),
      }),
    },
    options,
  );

/** Create or update, whichever the account needs. This is what "Save" means. */
export const saveFunnel = (
  run: StoredRun,
  scenario: SimulatorScenario,
  funnel: Funnel,
  options?: Options,
) =>
  run.state.account.funnels[funnel.id]
    ? updateFunnel(run, scenario, funnel, options)
    : createFunnel(run, scenario, funnel, options);

/** A fresh funnel for the editor to start from. Not in the account until the learner saves. */
export const blankFunnel = (id: string = newFunnelId(), name = 'Untitled funnel'): Funnel => ({
  id,
  name,
  steps: [],
  version: 0,
});

/* ---- the visitor --------------------------------------------------------------------- */

/**
 * Who is walking the funnel. A visitor is either someone the account already knows — a contact
 * the learner picked, so the update path can be exercised — or a new person, in which case the
 * submission itself creates the contact through the intake reducer's generated event. The Lab
 * never creates the contact directly.
 */
export interface Visitor {
  contact_id: string;
  /** True when the account has no such contact yet, so the first submission will create it. */
  is_new: boolean;
}

export const newVisitor = (): Visitor => ({ contact_id: newVisitorId(), is_new: true });

export type SubmissionValues = Record<string, string | number | boolean>;

/* ---- what the visit itself did ---------------------------------------------------------- */

/**
 * Funnel visit telemetry (FUN-004, EXR-010, D-136).
 *
 * A walk through SIMULATE is traffic, so the Lab records it as traffic: the visit began, it met a
 * step, somebody started filling a form in, it ended. These are the same events an authored
 * cohort uses, through the same door, so the Autopsy reads a live walk and three weeks of
 * authored history the same way and there is no second telemetry path.
 *
 * The Lab renders a whole step at once — there is no scrolling model here and there is not going
 * to be one — so the reach it can honestly record is the whole step. Varied reach depth comes
 * from authored history, and `KNOWN_LIMITATIONS.md` says exactly that.
 */
export interface VisitTelemetry {
  visit_id: string;
  funnel_id: string;
  source: string;
}

export const visitStarted = (run: StoredRun, visit: VisitTelemetry): PendingEvent =>
  injected(run, 'FUNNEL_VISIT_STARTED', { ...visit });

export const stepViewed = (
  run: StoredRun,
  visitId: string,
  stepId: string,
  blocks: number,
): PendingEvent =>
  injected(run, 'FUNNEL_STEP_VIEWED', {
    visit_id: visitId,
    step_id: stepId,
    reach: 'bottom',
    blocks_seen: Math.max(1, blocks),
  });

export const formStarted = (run: StoredRun, visitId: string, blockId: string): PendingEvent =>
  injected(run, 'FUNNEL_FORM_STARTED', { visit_id: visitId, block_id: blockId });

export const visitEnded = (
  run: StoredRun,
  visitId: string,
  reason: 'left' | 'completed',
): PendingEvent => injected(run, 'FUNNEL_VISIT_ENDED', { visit_id: visitId, reason });

/** The sources a learner can walk a funnel as. Authored traffic may name any source it likes. */
export const VISIT_SOURCES = ['meta-ads', 'google-search', 'instagram-bio', 'Unknown'] as const;

/**
 * A form submission from the funnel. The real `FORM_SUBMITTED` event, with the referenced form
 * and only the answers the visitor gave — an unknown field is refused by the reducer rather than
 * dropped, which is what makes a broken form block visible instead of silently harmless.
 */
export const formSubmission = (
  run: StoredRun,
  visitor: Visitor,
  formId: string,
  values: SubmissionValues,
  visitId?: string | null,
): PendingEvent =>
  injected(run, 'FORM_SUBMITTED', {
    form_id: formId,
    contact_id: visitor.contact_id,
    values,
    ...(visitId ? { visit_id: visitId } : {}),
  });

export const submitForm = (
  run: StoredRun,
  scenario: SimulatorScenario,
  visitor: Visitor,
  formId: string,
  values: SubmissionValues,
  options?: Options,
  visitId?: string | null,
) =>
  execute(
    run,
    scenario,
    { kind: 'process', event: formSubmission(run, visitor, formId, values, visitId) },
    options,
  );

export const surveySubmission = (
  run: StoredRun,
  visitor: Visitor,
  surveyId: string,
  values: SubmissionValues,
  visitId?: string | null,
): PendingEvent =>
  injected(run, 'SURVEY_SUBMITTED', {
    survey_id: surveyId,
    contact_id: visitor.contact_id,
    values,
    ...(visitId ? { visit_id: visitId } : {}),
  });

export const submitSurvey = (
  run: StoredRun,
  scenario: SimulatorScenario,
  visitor: Visitor,
  surveyId: string,
  values: SubmissionValues,
  options?: Options,
  visitId?: string | null,
) =>
  execute(
    run,
    scenario,
    { kind: 'process', event: surveySubmission(run, visitor, surveyId, values, visitId) },
    options,
  );

/**
 * A booking from a calendar block. The event is HighLevel's own Appointment Booked, so a workflow
 * triggered by Customer Booked Appointment reacts to it exactly as it would to any other booking.
 *
 * The slot comes from the shared availability engine, so what the visitor books carries the host
 * that engine assigned and the length the calendar was configured for (D-129). A funnel visitor
 * is a customer, which is the distinction Customer Booked Appointment turns on.
 */
/**
 * The slot the visitor picked, revalidated against the engine now (D-133). Returns the booking
 * event, or the refusal to show instead: a time that was offered a moment ago and has since been
 * taken is refused rather than booked over.
 */
export const funnelBooking = (
  run: StoredRun,
  visitor: Visitor,
  calendarId: string,
  slot: Slot,
): { event: PendingEvent } | { refusal: EngineRefusal } => {
  const calendar = run.state.account.calendars[calendarId];
  if (calendar) {
    const current = slotAt(run.state.account, calendar, run.state.clock.now, slot.starts_at);
    if (!current || !sameSlot(current, slot)) {
      return {
        refusal: {
          code: 'INVALID_PAYLOAD',
          message: 'That time is no longer available. Choose another opening.',
          detail: { calendar_id: calendarId, starts_at: slot.starts_at },
        },
      };
    }
  }
  return {
    event: injected(run, 'APPOINTMENT_BOOKED', {
      appointment_id: newAppointmentId(),
      contact_id: visitor.contact_id,
      calendar_id: calendarId,
      starts_at: slot.starts_at,
      duration_minutes: slot.duration_minutes,
      host_id: slot.host_id,
      booked_by: 'customer',
    }),
  };
};

export const bookFromFunnel = (
  run: StoredRun,
  scenario: SimulatorScenario,
  visitor: Visitor,
  calendarId: string,
  slot: Slot,
  options?: Options,
) => {
  const outcome = funnelBooking(run, visitor, calendarId, slot);
  if ('refusal' in outcome) {
    return Promise.resolve<ExecutionResult>({ ok: false, run, refusal: outcome.refusal });
  }
  return execute(run, scenario, { kind: 'process', event: outcome.event }, options);
};

/**
 * A completed checkout. Phase 13 records what the account already models — one payment received
 * for the referenced product at its price — and nothing else. There is no product configuration,
 * no subscription handling, no failed-payment path and no refund here; those are the Payments Lab
 * (PAY-001) and the interface says so where a learner can see it (D-122).
 */
export const funnelPayment = (
  run: StoredRun,
  visitor: Visitor,
  productId: string,
  amount: number,
): PendingEvent =>
  injected(run, 'PAYMENT_RECEIVED', {
    payment_id: newPaymentId(),
    contact_id: visitor.contact_id,
    product_id: productId,
    amount,
  });

export const payFromFunnel = (
  run: StoredRun,
  scenario: SimulatorScenario,
  visitor: Visitor,
  productId: string,
  amount: number,
  options?: Options,
) =>
  execute(
    run,
    scenario,
    { kind: 'process', event: funnelPayment(run, visitor, productId, amount) },
    options,
  );

/**
 * Several events as one commit. Telemetry travels beside the thing it describes — a form
 * submission and the step view that follows it are one action from the visitor, so they are one
 * unit here: either all of it happened or none of it did, and the Autopsy never sees half a walk.
 */
export const performEvents = (
  run: StoredRun,
  scenario: SimulatorScenario,
  events: PendingEvent[],
  options?: Options,
): Promise<ExecutionResult> =>
  execute(
    run,
    scenario,
    { kind: 'batch', ops: events.map((event) => ({ kind: 'process' as const, event })) },
    options,
  );

/** Back to the scenario's authored beginning, under a new generation (D-087). */
export const resetFunnelRun = (
  scenario: SimulatorScenario,
  runId: string,
  database?: BloomlabDatabase,
): Promise<StoredRun> => resetStoredRun(scenario, runId, database);
