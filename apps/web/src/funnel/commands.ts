import type {
  Funnel,
  PendingEvent,
  SimulatorEventType,
  SimulatorScenario,
} from '@bloomlab/simulator-core';

import type { BloomlabDatabase } from '../data/db';
import { randomId } from '../data/envelope';
import { resetStoredRun, type StoredRun } from '../simulator/store';
import { execute, type ExecutionOptions, type ExecutionResult } from '../workflow/execution';

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

/**
 * A form submission from the funnel. The real `FORM_SUBMITTED` event, with the referenced form
 * and only the answers the visitor gave — an unknown field is refused by the reducer rather than
 * dropped, which is what makes a broken form block visible instead of silently harmless.
 */
export const submitForm = (
  run: StoredRun,
  scenario: SimulatorScenario,
  visitor: Visitor,
  formId: string,
  values: SubmissionValues,
  options?: Options,
) =>
  execute(
    run,
    scenario,
    {
      kind: 'process',
      event: injected(run, 'FORM_SUBMITTED', {
        form_id: formId,
        contact_id: visitor.contact_id,
        values,
      }),
    },
    options,
  );

export const submitSurvey = (
  run: StoredRun,
  scenario: SimulatorScenario,
  visitor: Visitor,
  surveyId: string,
  values: SubmissionValues,
  options?: Options,
) =>
  execute(
    run,
    scenario,
    {
      kind: 'process',
      event: injected(run, 'SURVEY_SUBMITTED', {
        survey_id: surveyId,
        contact_id: visitor.contact_id,
        values,
      }),
    },
    options,
  );

/**
 * A booking from a calendar block. The event is HighLevel's own Appointment Booked, so a workflow
 * triggered by Customer Booked Appointment reacts to it exactly as it would to any other booking.
 * Configuring the calendar itself — availability, buffers, notice, staff — is Phase 14's.
 */
export const bookFromFunnel = (
  run: StoredRun,
  scenario: SimulatorScenario,
  visitor: Visitor,
  calendarId: string,
  startsAt: string,
  options?: Options,
) =>
  execute(
    run,
    scenario,
    {
      kind: 'process',
      event: injected(run, 'APPOINTMENT_BOOKED', {
        appointment_id: newAppointmentId(),
        contact_id: visitor.contact_id,
        calendar_id: calendarId,
        starts_at: startsAt,
      }),
    },
    options,
  );

/**
 * A completed checkout. Phase 13 records what the account already models — one payment received
 * for the referenced product at its price — and nothing else. There is no product configuration,
 * no subscription handling, no failed-payment path and no refund here; those are the Payments Lab
 * (PAY-001) and the interface says so where a learner can see it (D-122).
 */
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
    {
      kind: 'process',
      event: injected(run, 'PAYMENT_RECEIVED', {
        payment_id: newPaymentId(),
        contact_id: visitor.contact_id,
        product_id: productId,
        amount,
      }),
    },
    options,
  );

/** Back to the scenario's authored beginning, under a new generation (D-087). */
export const resetFunnelRun = (
  scenario: SimulatorScenario,
  runId: string,
  database?: BloomlabDatabase,
): Promise<StoredRun> => resetStoredRun(scenario, runId, database);
