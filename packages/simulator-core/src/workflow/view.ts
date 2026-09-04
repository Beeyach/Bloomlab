import type {
  AccountState,
  Appointment,
  Contact,
  Message,
  Opportunity,
  Workflow,
  WorkflowRun,
} from '../state.ts';

/**
 * What a running workflow can see (WFL-009, D-103).
 *
 * Conditions, merge values and appointment-relative waits all read the same view: the contact,
 * the appointment and opportunity the run is about, the account's custom values, and — while an
 * event is being reacted to — that event's message. Nothing else is addressable, so a condition
 * can never reach into another contact's record or the device, and a merge value can never name
 * something the account does not hold.
 */
export interface RunView {
  account: AccountState;
  workflow: Workflow;
  contact: Contact;
  appointment: Appointment | null;
  opportunity: Opportunity | null;
  message: Message | null;
  /** The zone waits and merge times are expressed in: the workflow's override, else the account's. */
  zone: string;
  /** Simulator now, for `exists`-style questions about time and for the time window. */
  now: string;
}

/** The workflow's zone when it names one, else the run's. Never the device's (SIM-006). */
export const workflowZone = (workflow: Workflow, runZone: string): string =>
  workflow.settings.timezone ?? runZone;

/**
 * The appointment a run is about: the one that enrolled it when the trigger carried one, else
 * the contact's earliest appointment that is still live. A cancelled appointment stays the
 * subject when it was the trigger's — that is exactly the case WAIT-004 needs to be honest about.
 */
export function subjectAppointment(
  account: AccountState,
  contactId: string,
  contextId: string | null,
): Appointment | null {
  if (contextId) return account.appointments[contextId] ?? null;
  const live = Object.values(account.appointments)
    .filter((row) => row.contact_id === contactId && row.status !== 'cancelled')
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at) || a.id.localeCompare(b.id));
  return live[0] ?? null;
}

/** The opportunity a run is about: the trigger's, else the contact's first open one. */
export function subjectOpportunity(
  account: AccountState,
  contactId: string,
  contextId: string | null,
): Opportunity | null {
  if (contextId) return account.opportunities[contextId] ?? null;
  const open = Object.values(account.opportunities)
    .filter((row) => row.contact_id === contactId && row.status === 'open')
    .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
  return open[0] ?? null;
}

/** The message that enrolled the contact (Customer Replied), looked up in their conversation. */
export function subjectMessage(
  account: AccountState,
  contactId: string,
  messageId: string | null,
): Message | null {
  if (!messageId) return null;
  return account.conversations[contactId]?.messages.find((row) => row.id === messageId) ?? null;
}

export function viewFor(
  account: AccountState,
  workflow: Workflow,
  run: WorkflowRun,
  runZone: string,
  now: string,
  message: Message | null = null,
): RunView | null {
  const contact = account.contacts[run.contact_id];
  if (!contact) return null;
  return {
    account,
    workflow,
    contact,
    appointment: subjectAppointment(account, run.contact_id, run.context.appointment_id),
    opportunity: subjectOpportunity(account, run.contact_id, run.context.opportunity_id),
    message: message ?? subjectMessage(account, run.contact_id, run.context.message_id),
    zone: workflowZone(workflow, runZone),
    now,
  };
}
