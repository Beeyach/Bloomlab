import {
  triggerCapabilityFor,
  type AccountState,
  type SimulatorEventType,
  type SimulatorState,
  type Workflow,
  type WorkflowRun,
} from '@bloomlab/simulator-core';

import { newAppointmentId, newTestContactId } from './commands';

/**
 * Testing a workflow's trigger for real (WFL-004).
 *
 * The default test does not enrol anybody by hand. It makes the kind of event the configured
 * trigger listens for — a booking, a status change, a tag, a reply, a form submission — and lets
 * the engine's trigger matcher and filters decide whether the contact enrols. What this module
 * knows is only how to *produce* each event type from the smallest real context: which
 * appointment, which tag, which form. Which event types a trigger listens for comes from the
 * engine's own capability table, so a trigger the engine cannot run has no test here and says so.
 *
 * Nothing in this file decides a match. That happens in simulator-core, and the panel reads the
 * outcome back from the account: a run whose `context.trigger_event_id` is the event just made.
 */

export type TriggerField =
  | 'contact'
  | 'new_contact'
  | 'form'
  | 'survey'
  | 'calendar'
  | 'starts_at'
  | 'appointment'
  | 'status'
  | 'tag'
  | 'body'
  | 'opportunity'
  | 'stage'
  | 'opportunity_status';

export interface TriggerEventOption {
  /** The simulator event this option produces. */
  event: SimulatorEventType;
  /** How the option reads in the panel. */
  label: string;
  /** What the panel must collect to make the event real. */
  fields: TriggerField[];
}

/** How each event type a trigger can listen for is produced. Keyed by event, not by trigger. */
const PRODUCERS: Partial<Record<SimulatorEventType, Omit<TriggerEventOption, 'event'>>> = {
  FORM_SUBMITTED: { label: 'Submits a form', fields: ['contact', 'form'] },
  SURVEY_SUBMITTED: { label: 'Submits a survey', fields: ['contact', 'survey'] },
  APPOINTMENT_BOOKED: {
    label: 'Books an appointment',
    fields: ['contact', 'calendar', 'starts_at'],
  },
  APPOINTMENT_RESCHEDULED: {
    label: 'Reschedules an appointment',
    fields: ['appointment', 'starts_at'],
  },
  APPOINTMENT_STATUS_CHANGED: {
    label: 'An appointment changes status',
    fields: ['appointment', 'status'],
  },
  CONTACT_CREATED: { label: 'A new contact is created', fields: ['new_contact'] },
  TAG_ADDED: { label: 'Gets a tag', fields: ['contact', 'tag'] },
  TAG_REMOVED: { label: 'Loses a tag', fields: ['contact', 'tag'] },
  SMS_RECEIVED: { label: 'Replies by text', fields: ['contact', 'body'] },
  EMAIL_RECEIVED: { label: 'Replies by email', fields: ['contact', 'body'] },
  PIPELINE_STAGE_CHANGED: { label: 'A deal moves to a stage', fields: ['opportunity', 'stage'] },
  OPPORTUNITY_UPDATED: {
    label: 'A deal changes status',
    fields: ['opportunity', 'opportunity_status'],
  },
};

/** The events the panel can make for this workflow's trigger, or none when it cannot run. */
export function triggerTestOptions(workflow: Workflow): TriggerEventOption[] {
  const capability = triggerCapabilityFor(workflow.trigger.ghl_feature_id);
  if (!capability) return [];
  return capability.events.flatMap((event) => {
    const producer = PRODUCERS[event];
    return producer ? [{ event, ...producer }] : [];
  });
}

/** An instant one day after `iso`, keeping its offset, so a booking default is a real instant. */
export const dayAfter = (iso: string): string => {
  const match = iso.match(/([+-]\d{2}:\d{2}|Z)$/);
  const offset = match?.[1] ?? 'Z';
  const time = new Date(iso).getTime() + 24 * 60 * 60 * 1000;
  const shifted = new Date(time + offsetMinutes(offset) * 60 * 1000);
  return `${shifted.toISOString().slice(0, 19)}${offset === 'Z' ? 'Z' : offset}`;
};
const offsetMinutes = (offset: string): number => {
  if (offset === 'Z') return 0;
  const sign = offset.startsWith('-') ? -1 : 1;
  const [hours, minutes] = offset.slice(1).split(':').map(Number);
  return sign * ((hours ?? 0) * 60 + (minutes ?? 0));
};

/**
 * The smallest real context for an option when nothing was chosen: the first form, survey,
 * calendar or tag the account has, the contact's first appointment or deal, tomorrow for a
 * booking. Used by the Academy embed and as the panel's starting values.
 */
export function defaultTriggerInput(
  account: AccountState,
  contactId: string | null,
  now: string,
  event?: SimulatorEventType,
): TriggerTestInput {
  const appointments = Object.values(account.appointments)
    .filter((row) => row.contact_id === contactId)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const opportunities = Object.values(account.opportunities).filter(
    (row) => row.contact_id === contactId,
  );
  const contact = contactId ? account.contacts[contactId] : null;
  const tag =
    event === 'TAG_ADDED'
      ? account.tags.find((candidate) => !contact?.tags.includes(candidate))
      : event === 'TAG_REMOVED'
        ? contact?.tags[0]
        : account.tags[0];
  return {
    contact_id: contactId ?? undefined,
    form_id: Object.values(account.forms)[0]?.id,
    survey_id: Object.values(account.surveys)[0]?.id,
    calendar_id: Object.values(account.calendars)[0]?.id,
    starts_at: dayAfter(now),
    appointment_id: appointments[0]?.id,
    status: 'no_show',
    tag,
    opportunity_id: opportunities[0]?.id,
    opportunity_status: 'won',
  };
}

export interface TriggerTestInput {
  contact_id?: string;
  new_contact?: { first_name: string; phone?: string | null; email?: string | null };
  form_id?: string;
  survey_id?: string;
  calendar_id?: string;
  starts_at?: string;
  appointment_id?: string;
  status?: string;
  tag?: string;
  body?: string;
  opportunity_id?: string;
  stage?: string;
  opportunity_status?: string;
}

export interface TriggerEventDraft {
  type: SimulatorEventType;
  payload: Record<string, unknown>;
  /** The contact the event is about, so the outcome can be read back. */
  contact_id: string | null;
}

/**
 * The event to inject for one option and the values collected for it, or the reason it cannot be
 * made yet. Ids for new records are minted here (the engine forbids randomness).
 */
export function buildTriggerEvent(
  option: TriggerEventOption,
  input: TriggerTestInput,
  account: AccountState,
): { ok: true; event: TriggerEventDraft } | { ok: false; missing: string } {
  const need = (field: TriggerField, value: unknown, what: string) =>
    option.fields.includes(field) && !value ? what : null;
  const missing =
    need('contact', input.contact_id, 'a contact') ??
    need('form', input.form_id, 'a form') ??
    need('survey', input.survey_id, 'a survey') ??
    need('calendar', input.calendar_id, 'a calendar') ??
    need('starts_at', input.starts_at, 'a start time with its offset') ??
    need('appointment', input.appointment_id, 'an appointment') ??
    need('status', input.status, 'a status') ??
    need('tag', input.tag, 'a tag') ??
    need('body', input.body?.trim(), 'the reply text') ??
    need('opportunity', input.opportunity_id, 'a deal') ??
    need('stage', input.stage, 'a stage') ??
    need('opportunity_status', input.opportunity_status, 'a deal status') ??
    need('new_contact', input.new_contact?.first_name?.trim(), 'a first name');
  if (missing) return { ok: false, missing };

  const appointment = input.appointment_id ? account.appointments[input.appointment_id] : null;
  const opportunity = input.opportunity_id ? account.opportunities[input.opportunity_id] : null;
  switch (option.event) {
    case 'FORM_SUBMITTED':
      return draft(
        option.event,
        { form_id: input.form_id, contact_id: input.contact_id },
        input.contact_id,
      );
    case 'SURVEY_SUBMITTED':
      return draft(
        option.event,
        { survey_id: input.survey_id, contact_id: input.contact_id },
        input.contact_id,
      );
    case 'APPOINTMENT_BOOKED':
      return draft(
        option.event,
        {
          appointment_id: newAppointmentId(),
          contact_id: input.contact_id,
          calendar_id: input.calendar_id,
          starts_at: input.starts_at,
        },
        input.contact_id,
      );
    case 'APPOINTMENT_RESCHEDULED':
      return draft(
        option.event,
        { appointment_id: input.appointment_id, starts_at: input.starts_at },
        appointment?.contact_id ?? null,
      );
    case 'APPOINTMENT_STATUS_CHANGED':
      return draft(
        option.event,
        { appointment_id: input.appointment_id, status: input.status },
        appointment?.contact_id ?? null,
      );
    case 'CONTACT_CREATED': {
      const id = newTestContactId();
      return draft(
        option.event,
        {
          contact_id: id,
          first_name: input.new_contact?.first_name.trim(),
          phone: input.new_contact?.phone || undefined,
          email: input.new_contact?.email || undefined,
          source: 'Workflow Lab test contact',
        },
        id,
      );
    }
    case 'TAG_ADDED':
    case 'TAG_REMOVED':
      return draft(
        option.event,
        { contact_id: input.contact_id, tag: input.tag },
        input.contact_id,
      );
    case 'SMS_RECEIVED':
    case 'EMAIL_RECEIVED':
      return draft(
        option.event,
        { contact_id: input.contact_id, body: input.body?.trim() },
        input.contact_id,
      );
    case 'PIPELINE_STAGE_CHANGED':
      return draft(
        option.event,
        { opportunity_id: input.opportunity_id, stage: input.stage },
        opportunity?.contact_id ?? null,
      );
    case 'OPPORTUNITY_UPDATED':
      return draft(
        option.event,
        { opportunity_id: input.opportunity_id, status: input.opportunity_status },
        opportunity?.contact_id ?? null,
      );
    default:
      return { ok: false, missing: 'a way to make this event' };
  }
}

const draft = (
  type: SimulatorEventType,
  payload: Record<string, unknown>,
  contactId: string | null | undefined,
): { ok: true; event: TriggerEventDraft } => ({
  ok: true,
  event: {
    type,
    payload: Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined)),
    contact_id: contactId ?? null,
  },
});

/**
 * What the event did for this workflow, read from the account after the engine ran: the runs
 * that did not exist before and were enrolled by a trigger reaction (not directly). The panel
 * phrases it; it does not decide it.
 */
export function enrolledByEvent(
  before: Record<string, WorkflowRun>,
  after: Record<string, WorkflowRun>,
  workflowId: string,
): WorkflowRun[] {
  return Object.values(after)
    .filter(
      (run) =>
        !before[run.id] &&
        run.workflow_id === workflowId &&
        typeof run.context.trigger_event_id === 'string',
    )
    .sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * What the exact root event made the tested workflow do.
 *
 * This is stricter than looking for "some new run": one engine operation may cascade through
 * several workflows. A test only counts as a direct trigger match when the WORKFLOW_ENROLLED
 * event names the root event the panel just injected. If that match is refused because the
 * contact already has a live run and re-entry is off, that is reported separately from a filter
 * miss (WFL-004, WFL-010).
 */
export type TriggerFireOutcome =
  | { kind: 'enrolled'; run: WorkflowRun; root_event_id: string }
  | { kind: 'blocked_reentry'; existing_run_id: string | null; root_event_id: string }
  | { kind: 'event_noop'; reason: string | null; root_event_id: string }
  | { kind: 'not_matched'; root_event_id: string | null };

export function triggerOutcomeFor(
  beforeLogLength: number,
  after: SimulatorState,
  workflowId: string,
): TriggerFireOutcome {
  const root = after.log[beforeLogLength] ?? null;
  if (!root) return { kind: 'not_matched', root_event_id: null };

  const enrolment = after.log.slice(beforeLogLength + 1).find(
    (event) =>
      event.type === 'WORKFLOW_ENROLLED' &&
      event.payload.workflow_id === workflowId &&
      event.payload.trigger_event_id === root.id &&
      event.source?.caused_by === root.id,
  );
  if (!enrolment) {
    const rootRecords = after.execution.filter((record) => record.event_id === root.id);
    if (
      rootRecords.length > 0 &&
      rootRecords.every((record) => record.kind === 'action_skipped')
    ) {
      return {
        kind: 'event_noop',
        reason: rootRecords.find((record) => record.reason)?.reason ?? null,
        root_event_id: root.id,
      };
    }
    return { kind: 'not_matched', root_event_id: root.id };
  }

  const run = Object.values(after.account.workflow_runs).find(
    (candidate) =>
      candidate.workflow_id === workflowId && candidate.context.trigger_event_id === root.id,
  );
  if (run) return { kind: 'enrolled', run, root_event_id: root.id };

  const refusal = after.execution.find(
    (record) => record.event_id === enrolment.id && record.reason === 'duplicate_enrolment',
  );
  return {
    kind: 'blocked_reentry',
    existing_run_id:
      typeof refusal?.data.existing_run_id === 'string' ? refusal.data.existing_run_id : null,
    root_event_id: root.id,
  };
}

/** The direct diagnostic path either creates one new run or is refused by the re-entry rule. */
export type DirectStartOutcome =
  | { kind: 'started'; run: WorkflowRun }
  | { kind: 'blocked_reentry'; existing_run_id: string | null };

export function directStartOutcome(
  beforeRunIds: ReadonlySet<string>,
  beforeLogLength: number,
  after: SimulatorState,
  workflowId: string,
  contactId: string,
): DirectStartOutcome {
  const run = Object.values(after.account.workflow_runs).find(
    (candidate) =>
      !beforeRunIds.has(candidate.id) &&
      candidate.workflow_id === workflowId &&
      candidate.contact_id === contactId &&
      candidate.context.trigger_event_id === null,
  );
  if (run) return { kind: 'started', run };

  const root = after.log[beforeLogLength] ?? null;
  const refusal = root
    ? after.execution.find(
        (record) => record.event_id === root.id && record.reason === 'duplicate_enrolment',
      )
    : null;
  return {
    kind: 'blocked_reentry',
    existing_run_id:
      typeof refusal?.data.existing_run_id === 'string' ? refusal.data.existing_run_id : null,
  };
}
