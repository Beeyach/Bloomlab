import type {
  PendingEvent,
  SimulatorEventType,
  SimulatorScenario,
  TimeMachineStep,
  Workflow,
} from '@bloomlab/simulator-core';

import type { BloomlabDatabase } from '../data/db';
import { randomId } from '../data/envelope';
import { resetStoredRun, type StoredRun } from '../simulator/store';
import { execute, type ExecutionOptions, type ExecutionResult } from './execution';

/**
 * The Workflow Lab command layer (WFL-002, WFL-004, D-107, D-109).
 *
 * A screen states an intent; this module turns it into one operation for `execute`, which runs
 * it through the engine and persists the run. A workflow definition reaches the account the same
 * way a tag does — as an event (`WORKFLOW_CREATED`, `WORKFLOW_UPDATED`) the engine validates,
 * logs and replays — so the workflows a learner builds are part of the shared account, not a
 * second store beside it. A test run is an enrolment event; the engine walks the contact, and
 * every step, branch and wait it records is real.
 *
 * No business rule lives here. Whether a graph is runnable, which branch matches, when a wait
 * ends: all of that is `simulator-core`. What lives here is translation, id minting (the engine
 * forbids randomness) and the choice of which event an intent means.
 */

export type WorkflowOutcome = ExecutionResult;

/** The label the engine records for everything the Lab injects. */
export const WORKFLOW_LAB_SOURCE = 'workflow_lab';

export const newTestContactId = () => `contact-${randomId()}`;
export const newWorkflowId = () => `wf-${randomId()}`;
export const newAppointmentId = () => `appt-${randomId()}`;

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
  source: { kind: 'injector_action', id: WORKFLOW_LAB_SOURCE },
});

type Options = ExecutionOptions;

/* ---- definitions --------------------------------------------------------------------- */

/** The definition as an event payload: everything but the version, which the engine assigns. */
const asPayload = (definition: Workflow): Record<string, unknown> => {
  const { version: _version, ...rest } = definition;
  return rest;
};

/** Adds a new workflow to the account (version 1). */
export const createWorkflow = (
  run: StoredRun,
  scenario: SimulatorScenario,
  definition: Workflow,
  options?: Options,
) =>
  execute(
    run,
    scenario,
    {
      kind: 'process',
      event: injected(run, 'WORKFLOW_CREATED', { workflow: asPayload(definition) }),
    },
    options,
  );

/** Replaces an existing workflow's definition; the engine bumps the version (D-104). */
export const updateWorkflow = (
  run: StoredRun,
  scenario: SimulatorScenario,
  definition: Workflow,
  options?: Options,
) =>
  execute(
    run,
    scenario,
    {
      kind: 'process',
      event: injected(run, 'WORKFLOW_UPDATED', {
        workflow_id: definition.id,
        workflow: asPayload(definition),
      }),
    },
    options,
  );

/** Create or update, whichever the account needs. This is what "Save" means. */
export const saveWorkflow = (
  run: StoredRun,
  scenario: SimulatorScenario,
  definition: Workflow,
  options?: Options,
) =>
  run.state.account.workflows[definition.id]
    ? updateWorkflow(run, scenario, definition, options)
    : createWorkflow(run, scenario, definition, options);

/** A fresh, empty definition for the editor to start from. Not saved until the learner saves. */
export const blankWorkflow = (
  id: string = newWorkflowId(),
  name = 'Untitled workflow',
): Workflow => ({
  id,
  name,
  trigger: { ghl_feature_id: '', filters: [] },
  nodes: [],
  edges: [],
  settings: { allow_reentry: false, timezone: null, notes: null, time_window: null },
  version: 0,
});

/* ---- test contacts ------------------------------------------------------------------- */

export interface TestContactDraft {
  first_name: string;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  tags?: string[];
  source?: string | null;
  dnd?: boolean;
}

/** Generates a contact to test with; it is a real contact in the shared account from then on. */
export const createTestContact = (
  run: StoredRun,
  scenario: SimulatorScenario,
  draft: TestContactDraft,
  options?: Options,
) =>
  execute(
    run,
    scenario,
    {
      kind: 'process',
      event: injected(run, 'CONTACT_CREATED', {
        contact_id: newTestContactId(),
        ...prune({ ...draft, source: draft.source ?? 'Workflow Lab test contact' }),
      }),
    },
    options,
  );

export interface EnrolmentContext {
  appointment_id?: string;
  opportunity_id?: string;
}

/**
 * Starts a contact at the workflow's first step, skipping the trigger and its filters. This is
 * the diagnostic path, not the default test: the engine records the enrolment as direct and the
 * timeline says the trigger was not fired. Everything after it — steps, branches, waits,
 * messages — is still what the engine actually does.
 */
export const enrolTestContact = (
  run: StoredRun,
  scenario: SimulatorScenario,
  workflowId: string,
  contactId: string,
  context: EnrolmentContext = {},
  options?: Options,
) =>
  execute(
    run,
    scenario,
    {
      kind: 'process',
      event: injected(run, 'WORKFLOW_ENROLLED', {
        workflow_id: workflowId,
        contact_id: contactId,
        context: prune(context),
        test: true,
      }),
    },
    options,
  );

/**
 * The default test (WFL-004): something happens in the account — the kind of event the workflow's
 * trigger listens for — and the engine's trigger matcher decides whether anyone enrols. The event
 * is built by `triggerTest.ts` from the smallest real context; nothing here presumes a match.
 */
export const fireTriggerEvent = (
  run: StoredRun,
  scenario: SimulatorScenario,
  type: SimulatorEventType,
  payload: Record<string, unknown>,
  options?: Options,
) => execute(run, scenario, { kind: 'process', event: injected(run, type, payload) }, options);

/* ---- things that happen to the contact ------------------------------------------------- */

/** An inbound reply from the contact: releases reply waits and fires Customer Replied. */
export const injectReply = (
  run: StoredRun,
  scenario: SimulatorScenario,
  contactId: string,
  body: string,
  channel: 'sms' | 'email' = 'sms',
  options?: Options,
) =>
  execute(
    run,
    scenario,
    {
      kind: 'process',
      event: injected(run, channel === 'sms' ? 'SMS_RECEIVED' : 'EMAIL_RECEIVED', {
        contact_id: contactId,
        body,
      }),
    },
    options,
  );

export const bookAppointment = (
  run: StoredRun,
  scenario: SimulatorScenario,
  contactId: string,
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
        contact_id: contactId,
        calendar_id: calendarId,
        starts_at: startsAt,
      }),
    },
    options,
  );

export const changeAppointmentStatus = (
  run: StoredRun,
  scenario: SimulatorScenario,
  appointmentId: string,
  status: string,
  options?: Options,
) =>
  execute(
    run,
    scenario,
    {
      kind: 'process',
      event: injected(run, 'APPOINTMENT_STATUS_CHANGED', { appointment_id: appointmentId, status }),
    },
    options,
  );

export const addTag = (
  run: StoredRun,
  scenario: SimulatorScenario,
  contactId: string,
  tag: string,
  options?: Options,
) =>
  execute(
    run,
    scenario,
    { kind: 'process', event: injected(run, 'TAG_ADDED', { contact_id: contactId, tag }) },
    options,
  );

/** One of the scenario's authored injectable events, by id. */
export const injectScenarioAction = (
  run: StoredRun,
  scenario: SimulatorScenario,
  actionId: string,
  options?: Options,
) => execute(run, scenario, { kind: 'inject_action', action_id: actionId }, options);

/* ---- time --------------------------------------------------------------------------------- */

export const advanceTime = (
  run: StoredRun,
  scenario: SimulatorScenario,
  step: TimeMachineStep,
  options?: Options,
) => execute(run, scenario, { kind: 'advance', step }, options);

export const advanceTimeTo = (
  run: StoredRun,
  scenario: SimulatorScenario,
  at: string,
  options?: Options,
) => execute(run, scenario, { kind: 'advance_to', at }, options);

export const runNextEvent = (run: StoredRun, scenario: SimulatorScenario, options?: Options) =>
  execute(run, scenario, { kind: 'next_event' }, options);

/** Back to the scenario's authored beginning, under a new generation (D-087). */
export const resetWorkflowRun = (
  scenario: SimulatorScenario,
  runId: string,
  database?: BloomlabDatabase,
): Promise<StoredRun> => resetStoredRun(scenario, runId, database);

function prune<T extends object>(value: T): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}
