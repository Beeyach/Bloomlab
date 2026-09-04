import type { PendingEvent, SimulatorEvent, SimulatorEventType } from '../events.ts';
import type { AccountState, SimulatorState, WorkflowTriggerFilter } from '../state.ts';
import { triggerCapabilityFor, type TriggerMatch } from './capabilities.ts';
import { compareValues, conditionHolds, type FieldValue } from './conditions.ts';
import { viewFor } from './view.ts';

/**
 * How the account reacts to an event with its workflows (WFL-010, D-101).
 *
 * After any event is applied, two questions are asked of every workflow, in a fixed order:
 * does this event fire its trigger for some contact (→ `WORKFLOW_ENROLLED`), and does it release
 * a run that is waiting for exactly this kind of thing (→ `WORKFLOW_RESUMED`)? Both answers are
 * pure functions of the event and the account, so a replay asks them again and gets the same
 * enrolments and the same wakes. Workflow-internal events never trigger workflows: a workflow
 * cannot enrol a contact because another workflow advanced.
 */

const INTERNAL: ReadonlySet<SimulatorEventType> = new Set<SimulatorEventType>([
  'WORKFLOW_ENROLLED',
  'WORKFLOW_ADVANCED',
  'WORKFLOW_RESUMED',
  'WORKFLOW_STEP_COMPLETED',
  'WORKFLOW_EXITED',
  'WORKFLOW_CREATED',
  'WORKFLOW_UPDATED',
  'TIME_ADVANCED',
  'NOTIFICATION_SENT',
  'WEBHOOK_RESPONSE',
]);

/** Filters are compared the way conditions are, against the values the trigger exposed. */
function passesFilters(filters: WorkflowTriggerFilter[], match: TriggerMatch): boolean {
  return filters.every((filter) => {
    const actual: FieldValue = match.values[filter.field] ?? null;
    return compareValues(filter.operator, actual, filter.value);
  });
}

/** Triggers whose enrolments are about one appointment, and end with it (see `appointmentExits`). */
const APPOINTMENT_TRIGGERS: ReadonlySet<string> = new Set([
  'GHL-WF-CUSTOMER-BOOKED-APPOINTMENT',
  'GHL-WF-APPOINTMENT-STATUS',
]);

/** Statuses that end an appointment-scoped run when the appointment reaches them. */
const ENDING_STATUSES: ReadonlySet<string> = new Set(['cancelled', 'invalid', 'no_show']);

/**
 * Platform behaviour, from HighLevel's "Appointment scenarios in Workflow": a contact enrolled by
 * an appointment trigger is pulled out of that workflow when the appointment is cancelled,
 * marked invalid or no-show, or rescheduled, and no further actions run. A run enrolled by any
 * other trigger (a tag, a form) is untouched — telling those two apart is what a reminder that
 * fires for a cancelled appointment teaches. The exit reason says which it was.
 */
function appointmentExits(event: SimulatorEvent, account: AccountState): PendingEvent[] {
  let reason: 'appointment_cancelled' | 'appointment_rescheduled' | null = null;
  if (event.type === 'APPOINTMENT_CANCELLED') reason = 'appointment_cancelled';
  else if (event.type === 'APPOINTMENT_RESCHEDULED') reason = 'appointment_rescheduled';
  else if (
    event.type === 'APPOINTMENT_STATUS_CHANGED' &&
    ENDING_STATUSES.has(String(event.payload.status ?? ''))
  ) {
    reason = 'appointment_cancelled';
  }
  const appointmentId =
    typeof event.payload.appointment_id === 'string' ? event.payload.appointment_id : null;
  if (!reason || !appointmentId) return [];
  const exitReason = reason;
  return Object.values(account.workflow_runs)
    .filter(
      (run) =>
        (run.status === 'active' || run.status === 'waiting') &&
        run.context.appointment_id === appointmentId &&
        APPOINTMENT_TRIGGERS.has(account.workflows[run.workflow_id]?.trigger.ghl_feature_id ?? ''),
    )
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((run) => ({
      type: 'WORKFLOW_EXITED' as const,
      at: event.at,
      origin: 'generated' as const,
      source: { kind: 'workflow_trigger' as const, id: run.workflow_id, caused_by: event.id },
      payload: {
        workflow_run_id: run.id,
        reason: exitReason,
        appointment_id: appointmentId,
        appointment_status: String(
          event.payload.status ?? account.appointments[appointmentId]?.status ?? '',
        ),
      },
    }));
}

export function workflowReactions(
  event: SimulatorEvent,
  account: AccountState,
  state: SimulatorState,
): PendingEvent[] {
  if (INTERNAL.has(event.type)) return [];
  // 0. Appointment-scoped runs the platform ends, before anything new starts from this event.
  const reactions: PendingEvent[] = appointmentExits(event, account);

  // 1. Triggers, in workflow-id order so two matching workflows always enrol in the same order.
  const workflows = Object.values(account.workflows).sort((a, b) => a.id.localeCompare(b.id));
  for (const workflow of workflows) {
    const trigger = triggerCapabilityFor(workflow.trigger.ghl_feature_id);
    if (!trigger || !trigger.events.includes(event.type)) continue;
    const match = trigger.match(event, account);
    if (!match || !account.contacts[match.contact_id]) continue;
    if (!filtersPass(workflow.trigger.filters, match)) continue;
    reactions.push({
      type: 'WORKFLOW_ENROLLED',
      at: event.at,
      origin: 'generated',
      source: { kind: 'workflow_trigger', id: workflow.id, caused_by: event.id },
      payload: {
        workflow_id: workflow.id,
        contact_id: match.contact_id,
        trigger_event_id: event.id,
        trigger_values: match.values,
        context: match.context,
      },
    });
  }

  // 2. Waits released by this event, in run-id order.
  const contactId = typeof event.payload.contact_id === 'string' ? event.payload.contact_id : null;
  const runs = Object.values(account.workflow_runs)
    .filter((run) => run.status === 'waiting' && run.wait !== null)
    .sort((a, b) => a.id.localeCompare(b.id));
  for (const run of runs) {
    const wait = run.wait!;
    if (wait.kind === 'reply') {
      if (event.type !== 'SMS_RECEIVED' && event.type !== 'EMAIL_RECEIVED') continue;
      if (contactId !== run.contact_id) continue;
      const channel = event.type === 'SMS_RECEIVED' ? 'sms' : 'email';
      if (wait.reply_channel && wait.reply_channel !== 'any' && wait.reply_channel !== channel)
        continue;
      reactions.push(resume(run.id, wait.token, event, 'event'));
    } else if (wait.kind === 'condition' && wait.condition) {
      // Any event about this contact may have changed the answer; re-evaluate.
      if (!eventTouches(event, account, run.contact_id)) continue;
      const workflow = account.workflows[run.workflow_id];
      if (!workflow) continue;
      const view = viewFor(account, workflow, run, state.clock.timezone, event.at);
      if (view && conditionHolds(wait.condition, view)) {
        reactions.push(resume(run.id, wait.token, event, 'condition'));
      }
    }
  }
  return reactions;
}

const filtersPass = (filters: WorkflowTriggerFilter[], match: TriggerMatch): boolean =>
  filters.length === 0 || passesFilters(filters, match);

const resume = (
  runId: string,
  token: string,
  event: SimulatorEvent,
  cause: 'event' | 'condition',
): PendingEvent => ({
  type: 'WORKFLOW_RESUMED',
  at: event.at,
  origin: 'generated',
  source: { kind: 'workflow_wait', id: runId, caused_by: event.id },
  payload: { workflow_run_id: runId, resume_token: token, cause, event_id: event.id },
});

/** True when the event is about this contact directly or through one of their records. */
function eventTouches(event: SimulatorEvent, account: AccountState, contactId: string): boolean {
  const payload = event.payload;
  if (payload.contact_id === contactId) return true;
  const opportunityId = typeof payload.opportunity_id === 'string' ? payload.opportunity_id : null;
  if (opportunityId && account.opportunities[opportunityId]?.contact_id === contactId) return true;
  const appointmentId = typeof payload.appointment_id === 'string' ? payload.appointment_id : null;
  if (appointmentId && account.appointments[appointmentId]?.contact_id === contactId) return true;
  return false;
}
