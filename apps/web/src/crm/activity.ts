import type { AccountState, SimulatorEvent, SimulatorState } from '@bloomlab/simulator-core';

/**
 * Activity history (CRM-001, D-095).
 *
 * Derived from the run, never assembled by a screen. The input is the simulator's own log and the
 * account it produced; the output is an ordered list of structured entries. Nothing here invents
 * a fact, and nothing reads the browser clock: an entry's time is the simulator time of the event
 * that caused it, and ties are broken by the event's own sequence, which is the same order the
 * grader sees.
 *
 * Wording is kept out of the data. An entry carries a `kind`, the ids involved and the values
 * that changed; the screen turns that into a sentence. That way changing how history reads never
 * rewrites what happened, and a later exercise can assert on the entry rather than on prose.
 *
 * One fact is one entry. The log is the single source — the account's own `notes` and `tasks`
 * collections are not walked separately, because a note exists precisely because a `NOTE_ADDED`
 * event happened, and reading both would show it twice. Records the scenario seeded before the
 * run began have no event, and are surfaced by `seededActivity` so a fresh account is not empty.
 */

export type ActivityKind =
  | 'contact_created'
  | 'contact_updated'
  | 'contact_assigned'
  | 'tag_added'
  | 'tag_removed'
  | 'opportunity_created'
  | 'opportunity_updated'
  | 'opportunity_assigned'
  | 'stage_changed'
  | 'note_added'
  | 'task_created'
  | 'task_updated'
  | 'task_completed'
  | 'task_reopened'
  | 'appointment'
  | 'message'
  | 'payment'
  | 'field_defined'
  | 'pipeline_changed';

export interface ActivityEntry {
  /** Stable within a run: the event that caused it. */
  id: string;
  kind: ActivityKind;
  /** Simulator time (spec §45). */
  at: string;
  /** The simulator's own processed order; ties at one instant resolve by this. */
  sequence: number;
  contact_id: string | null;
  opportunity_id: string | null;
  /** Structured detail the screen turns into words. Never a pre-rendered sentence. */
  data: Record<string, unknown>;
}

/** Which record an entry is about, so a contact's history and a deal's can be asked for. */
export interface ActivityTarget {
  contact_id?: string | null;
  opportunity_id?: string | null;
}

const str = (value: unknown): string | null => (typeof value === 'string' && value ? value : null);

/**
 * The one event type to activity kind table. An event with no entry here is not history a CRM
 * screen has anything to say about — the clock advancing, a webhook, a workflow step — and is
 * left out rather than rendered as a mystery row.
 */
function classify(event: SimulatorEvent): ActivityKind | null {
  switch (event.type) {
    case 'CONTACT_CREATED':
      return 'contact_created';
    case 'CONTACT_UPDATED':
      return 'contact_updated';
    case 'CONTACT_ASSIGNED':
      return 'contact_assigned';
    case 'TAG_ADDED':
      return 'tag_added';
    case 'TAG_REMOVED':
      return 'tag_removed';
    case 'OPPORTUNITY_CREATED':
      return 'opportunity_created';
    case 'OPPORTUNITY_UPDATED':
      return 'opportunity_updated';
    case 'OPPORTUNITY_ASSIGNED':
      return 'opportunity_assigned';
    case 'PIPELINE_STAGE_CHANGED':
      return 'stage_changed';
    case 'NOTE_ADDED':
      return 'note_added';
    case 'TASK_CREATED':
      return 'task_created';
    case 'TASK_UPDATED':
      return 'task_updated';
    case 'TASK_COMPLETED':
      return event.payload.completed === true ? 'task_completed' : 'task_reopened';
    case 'APPOINTMENT_BOOKED':
    case 'APPOINTMENT_RESCHEDULED':
    case 'APPOINTMENT_CANCELLED':
    case 'APPOINTMENT_STATUS_CHANGED':
      return 'appointment';
    case 'SMS_SENT':
    case 'SMS_RECEIVED':
    case 'EMAIL_SENT':
    case 'EMAIL_OPENED':
      return 'message';
    case 'PAYMENT_RECEIVED':
    case 'PAYMENT_FAILED':
    case 'REFUND_ISSUED':
      return 'payment';
    case 'FIELD_DEFINED':
    case 'FIELD_UPDATED':
      return 'field_defined';
    case 'PIPELINE_CREATED':
    case 'PIPELINE_UPDATED':
      return 'pipeline_changed';
    default:
      return null;
  }
}

/**
 * Which contact and which opportunity an event is about.
 *
 * Most events name their contact. The ones that name only an opportunity are resolved through the
 * account, so a stage move or a deal note reads on the contact's history too — that is the whole
 * reason a learner opens a contact rather than hunting through deals.
 */
function subjectOf(
  event: SimulatorEvent,
  account: AccountState,
): { contact_id: string | null; opportunity_id: string | null } {
  const opportunityId = str(event.payload.opportunity_id);
  const direct = str(event.payload.contact_id);
  const viaOpportunity = opportunityId
    ? (account.opportunities[opportunityId]?.contact_id ?? null)
    : null;

  // A task or a note names its own id; the record it hangs off knows who it is about.
  const taskId = str(event.payload.task_id);
  const noteId = str(event.payload.note_id);
  const attached = taskId ? account.tasks[taskId] : noteId ? account.notes[noteId] : null;

  return {
    contact_id: direct ?? viaOpportunity ?? attached?.contact_id ?? null,
    opportunity_id: opportunityId ?? attached?.opportunity_id ?? null,
  };
}

/** Everything the run has done, newest last, in the simulator's own order. */
export function activityOf(state: SimulatorState): ActivityEntry[] {
  const entries: ActivityEntry[] = [];
  for (const event of state.log) {
    const kind = classify(event);
    if (!kind) continue;
    const subject = subjectOf(event, state.account);
    entries.push({
      id: event.id,
      kind,
      at: event.at,
      sequence: event.sequence,
      ...subject,
      data: { ...event.payload, event_type: event.type, origin: event.origin },
    });
  }
  // The log is already in processed order; sorting by sequence makes that explicit and keeps the
  // result stable no matter how a caller assembled the input.
  return entries.sort((a, b) => a.sequence - b.sequence);
}

/** One record's history, newest first, which is how a person reads a timeline. */
export function activityFor(state: SimulatorState, target: ActivityTarget): ActivityEntry[] {
  const contactId = target.contact_id ?? null;
  const opportunityId = target.opportunity_id ?? null;
  return activityOf(state)
    .filter((entry) => {
      if (opportunityId) return entry.opportunity_id === opportunityId;
      if (contactId) return entry.contact_id === contactId;
      return false;
    })
    .reverse();
}

/**
 * What the account already carried when the run began.
 *
 * A scenario seeds notes, tasks and appointments without any event, so a learner opening a fresh
 * contact would otherwise see an empty history for facts that are plainly on the screen beside
 * it. These are marked `seeded: true` in their data and given the run's start sequence, so they
 * sort before anything the learner did and can never be mistaken for something that happened.
 */
export function seededActivity(state: SimulatorState, target: ActivityTarget): ActivityEntry[] {
  const contactId = target.contact_id ?? null;
  const opportunityId = target.opportunity_id ?? null;
  const known = new Set(
    state.log.map((event) => str(event.payload.note_id) ?? str(event.payload.task_id)),
  );
  const entries: ActivityEntry[] = [];

  const matches = (row: { contact_id: string | null; opportunity_id: string | null }) =>
    opportunityId ? row.opportunity_id === opportunityId : row.contact_id === contactId;

  for (const note of Object.values(state.account.notes)) {
    if (known.has(note.id) || !matches(note)) continue;
    entries.push({
      id: `seed-${note.id}`,
      kind: 'note_added',
      at: note.at,
      sequence: -1,
      contact_id: note.contact_id,
      opportunity_id: note.opportunity_id,
      data: { note_id: note.id, body: note.body, author_id: note.author_id, seeded: true },
    });
  }
  for (const task of Object.values(state.account.tasks)) {
    if (known.has(task.id) || !matches(task)) continue;
    entries.push({
      id: `seed-${task.id}`,
      kind: 'task_created',
      at: task.created_at,
      sequence: -1,
      contact_id: task.contact_id,
      opportunity_id: task.opportunity_id,
      data: { task_id: task.id, title: task.title, due_at: task.due_at, seeded: true },
    });
  }
  return entries.sort((a, b) => a.at.localeCompare(b.at)).reverse();
}

/** A record's full history: what the learner did, then what the account already held. */
export const fullActivityFor = (state: SimulatorState, target: ActivityTarget): ActivityEntry[] => [
  ...activityFor(state, target),
  ...seededActivity(state, target),
];
