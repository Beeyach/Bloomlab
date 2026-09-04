import type {
  PendingEvent,
  ScenarioWorkflow,
  ScenarioWorkflowNode,
  SimulatorScenario,
  SimulatorState,
} from '../../src/index.ts';
import { NOW, scenario } from '../fixtures.ts';

/**
 * Workflow definitions the Phase 12 fixtures share (WFL-006..WFL-010).
 *
 * Everything here is data the engine reads: a node is a type, a registry feature id and a config
 * record; an edge is two ids and, for a branch, the branch name. Nothing in this file executes a
 * workflow — the tests hand these to `createRun` and let the engine do that.
 */

type Node = ScenarioWorkflowNode;

let y = 0;
const at = (): { x: number; y: number } => ({ x: 0, y: (y += 120) });

export const sms = (id: string, template: string, purpose?: string): Node => ({
  id,
  type: 'action',
  ghl_feature_id: 'GHL-WF-SEND-SMS',
  label: 'Send SMS',
  config: purpose ? { template, purpose } : { template },
  position: at(),
});

export const tag = (id: string, name: string): Node => ({
  id,
  type: 'action',
  ghl_feature_id: 'GHL-WF-ADD-CONTACT-TAG',
  label: 'Add Contact Tag',
  config: { tag: name },
  position: at(),
});

export const removeFrom = (id: string, workflow: 'this' | 'all' | string): Node => ({
  id,
  type: 'action',
  ghl_feature_id: 'GHL-WF-REMOVE-FROM-WORKFLOW',
  label: 'Remove From Workflow',
  config: { workflow },
  position: at(),
});

export const wait = (id: string, config: Record<string, unknown>): Node => ({
  id,
  type: 'wait',
  ghl_feature_id: 'GHL-WF-WAIT',
  label: 'Wait',
  config,
  position: at(),
});

export const ifElse = (id: string, branches: unknown[]): Node => ({
  id,
  type: 'branch',
  ghl_feature_id: 'GHL-WF-IF-ELSE',
  label: 'If/Else',
  config: { branches },
  position: at(),
});

export const end = (id: string): Node => ({ id, type: 'end', position: at() });

export const edge = (from: string, to: string, branch?: string) =>
  branch ? { from, to, branch } : { from, to };

/** A straight line through the given nodes. */
export const chain = (...ids: string[]) =>
  ids.slice(1).map((to, index) => edge(ids[index] as string, to));

export interface WorkflowSpec {
  id: string;
  name?: string;
  trigger: ScenarioWorkflow['trigger'];
  nodes: readonly Node[];
  edges?: ScenarioWorkflow['edges'];
  settings?: ScenarioWorkflow['settings'];
}

export const workflow = (spec: WorkflowSpec): ScenarioWorkflow => ({
  id: spec.id,
  name: spec.name ?? spec.id,
  trigger: spec.trigger,
  nodes: spec.nodes,
  edges: spec.edges ?? chain(...spec.nodes.map((node) => node.id)),
  settings: { allow_reentry: false, timezone: 'America/Chicago', ...(spec.settings ?? {}) },
});

/** The test clinic with these workflows *instead of* the authored one, plus two staff users. */
export function clinicWith(
  workflows: readonly ScenarioWorkflow[],
  overrides: Partial<SimulatorScenario['initial_account_state']> = {},
): SimulatorScenario {
  const base = scenario();
  return {
    ...base,
    scheduled_events: [],
    initial_account_state: {
      ...base.initial_account_state,
      users: [
        { id: 'u-ary', name: 'Ary', role: 'admin' },
        { id: 'u-sam', name: 'Sam', role: 'user' },
      ],
      workflows,
      ...overrides,
    },
  };
}

/* ---- the workflows the fixtures reach for --------------------------------------------- */

/** A reminder that waits until an hour before the appointment, then texts. */
export const REMINDER = workflow({
  id: 'wf-reminder',
  name: 'Appointment Reminder',
  trigger: { ghl_feature_id: 'GHL-WF-CUSTOMER-BOOKED-APPOINTMENT' },
  nodes: [
    wait('w1', { wait_type: 'appointment', relative: 'before', hours: 1 }),
    sms('s1', 'See you at {{appointment.start_time}}, {{contact.first_name}}.', 'reminder_1h'),
    end('e1'),
  ],
});

/**
 * The same reminder started by the `booked` tag instead of the booking. A tag-started run is not
 * about any one appointment, so the platform does not end it when an appointment is cancelled —
 * which is how a reminder ends up going to a cancelled appointment.
 */
export const TAG_REMINDER = workflow({
  id: 'wf-tag-reminder',
  name: 'Reminder (from tag)',
  trigger: {
    ghl_feature_id: 'GHL-WF-CONTACT-TAG',
    filters: [
      { field: 'change', operator: 'is', value: 'added' },
      { field: 'tag', operator: 'is', value: 'booked' },
    ],
  },
  nodes: [
    wait('w1', { wait_type: 'appointment', relative: 'before', hours: 1 }),
    sms('s1', 'See you at {{appointment.start_time}}, {{contact.first_name}}.', 'reminder_1h'),
    end('e1'),
  ],
});

/** The tag-started reminder, designed well: after the wait it checks the appointment is still on. */
export const CAREFUL_REMINDER = workflow({
  id: 'wf-tag-reminder',
  name: 'Reminder (from tag)',
  trigger: TAG_REMINDER.trigger,
  nodes: [
    wait('w1', { wait_type: 'appointment', relative: 'before', hours: 1 }),
    ifElse('b1', [
      {
        name: 'Still booked',
        groups: [
          {
            conditions: [
              { field: 'appointment.status', operator: 'is_not', value: 'cancelled' },
              { field: 'appointment.status', operator: 'is_not', value: 'no_show' },
            ],
          },
        ],
      },
    ]),
    sms('s1', 'See you at {{appointment.start_time}}, {{contact.first_name}}.', 'reminder_1h'),
    end('e1'),
    end('e2'),
  ],
  edges: [
    edge('w1', 'b1'),
    edge('b1', 's1', 'Still booked'),
    edge('s1', 'e1'),
    edge('b1', 'e2', 'None'),
  ],
});

/** A cancellation handler that pulls the contact out of the tag-started reminder. */
export const CANCELLATION = workflow({
  id: 'wf-cancellation',
  name: 'Cancellation Handler',
  trigger: {
    ghl_feature_id: 'GHL-WF-APPOINTMENT-STATUS',
    filters: [{ field: 'appointment_status', operator: 'is', value: 'cancelled' }],
  },
  nodes: [removeFrom('r1', 'wf-tag-reminder'), tag('t1', 'cancelled'), end('e1')],
});

export const tagged = (contactId: string, name: string, when: string = NOW): PendingEvent => ({
  type: 'TAG_ADDED',
  at: when,
  origin: 'injected',
  payload: { contact_id: contactId, tag: name },
});

export const rescheduled = (
  appointmentId: string,
  startsAt: string,
  when: string,
): PendingEvent => ({
  type: 'APPOINTMENT_RESCHEDULED',
  at: when,
  origin: 'injected',
  payload: { appointment_id: appointmentId, starts_at: startsAt },
});

/** Enrol a contact by hand, the way a Test Contact run does, with an optional appointment. */
export const enrol = (
  workflowId: string,
  contactId: string,
  extra: Record<string, unknown> = {},
  when: string = NOW,
): PendingEvent => ({
  type: 'WORKFLOW_ENROLLED',
  at: when,
  origin: 'injected',
  payload: { workflow_id: workflowId, contact_id: contactId, ...extra },
});

export const booked = (
  contactId: string,
  appointmentId: string,
  startsAt: string,
  when: string = NOW,
): PendingEvent => ({
  type: 'APPOINTMENT_BOOKED',
  at: when,
  origin: 'injected',
  payload: {
    appointment_id: appointmentId,
    contact_id: contactId,
    calendar_id: 'consultation',
    starts_at: startsAt,
  },
});

export const cancelled = (appointmentId: string, when: string): PendingEvent => ({
  type: 'APPOINTMENT_STATUS_CHANGED',
  at: when,
  origin: 'injected',
  payload: { appointment_id: appointmentId, status: 'cancelled' },
});

export const reply = (contactId: string, body: string, when: string): PendingEvent => ({
  type: 'SMS_RECEIVED',
  at: when,
  origin: 'injected',
  payload: { contact_id: contactId, body },
});

/* ---- reading a run back --------------------------------------------------------------- */

export const runsOf = (state: SimulatorState, workflowId?: string) =>
  Object.values(state.account.workflow_runs)
    .filter((run) => !workflowId || run.workflow_id === workflowId)
    .sort((a, b) => a.enrolled_at.localeCompare(b.enrolled_at) || a.id.localeCompare(b.id));

export const onlyRun = (state: SimulatorState, workflowId?: string) => {
  const runs = runsOf(state, workflowId);
  if (runs.length !== 1) throw new Error(`Expected one run, found ${runs.length}`);
  return runs[0]!;
};

export const messagesTo = (state: SimulatorState, contactId: string) =>
  state.account.conversations[contactId]?.messages.filter((m) => m.direction === 'outbound') ?? [];

export const records = (state: SimulatorState, kind: string, runId?: string) =>
  state.execution.filter(
    (row) => row.kind === kind && (runId === undefined || row.workflow_run_id === runId),
  );

export const eventsOf = (state: SimulatorState, type: string) =>
  state.log.filter((row) => row.type === type);
