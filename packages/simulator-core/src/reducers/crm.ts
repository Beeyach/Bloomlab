import { fail } from '../errors.ts';
import { optionalString, requireBoolean, requireString, type SimulatorEvent } from '../events.ts';
import { instant } from '../time.ts';
import type { AccountState, CrmTarget, Note, Task } from '../state.ts';
import { entity, put, result, type ReducerResult } from './shared.ts';

/**
 * Notes and tasks (CRM-001, D-091).
 *
 * Both hang off a record rather than floating in the account, and both accept a contact, an
 * opportunity, or one of each — which is how HighLevel associates them. At least one reference
 * is required: a note attached to nothing is a note nobody will ever find again, so it is refused
 * rather than stored. An opportunity reference resolves its contact when none was given, so a
 * note left on a deal still reads on the contact's history without the UI having to join.
 *
 * A task's `due_at` is simulator time. Nothing here reads the device clock, and a due date that
 * is not an instant is refused rather than stored as an unparseable string that would sort wrong
 * for the rest of the run.
 */

/** The record a note or a task is about. One reference at least; both are checked if given. */
function readTarget(account: AccountState, event: SimulatorEvent): CrmTarget {
  const opportunityId = optionalString(event.payload, 'opportunity_id');
  let contactId = optionalString(event.payload, 'contact_id');

  if (opportunityId) {
    const opportunity = entity(account.opportunities, opportunityId, 'opportunity', event.type);
    // A deal already knows whose it is. Filling the contact in keeps one fact in one place and
    // means an opportunity note reads on the contact without a join.
    contactId ??= opportunity.contact_id;
    if (contactId !== opportunity.contact_id) {
      fail('INVALID_PAYLOAD', `Opportunity ${opportunityId} does not belong to ${contactId}`, {
        opportunity_id: opportunityId,
        contact_id: contactId,
        belongs_to: opportunity.contact_id,
      });
    }
  }
  if (contactId) entity(account.contacts, contactId, 'contact', event.type);
  if (!contactId && !opportunityId) {
    fail('INVALID_PAYLOAD', `${event.type} needs a contact_id or an opportunity_id`, {
      payload: event.payload,
    });
  }
  return { contact_id: contactId ?? null, opportunity_id: opportunityId ?? null };
}

/** A user in the account, an explicit null, or nothing said at all. */
function readUser(account: AccountState, event: SimulatorEvent, field: string): string | null {
  const value = event.payload[field];
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || value.length === 0) {
    fail('INVALID_PAYLOAD', `${event.type} ${field} must be a user id`, { field, value });
  }
  entity(account.users, value, 'user', event.type);
  return value;
}

/** Simulator time or nothing. A due date that cannot be read is refused, never stored raw. */
function readDueAt(event: SimulatorEvent): string | null {
  const due = optionalString(event.payload, 'due_at');
  if (!due) return null;
  try {
    instant(due);
  } catch {
    fail('INVALID_TIME', `${event.type} due_at is not a simulator instant: ${due}`, {
      due_at: due,
    });
  }
  return due;
}

export function noteAdded(account: AccountState, event: SimulatorEvent): ReducerResult {
  const id = requireString(event.payload, 'note_id', event.type);
  if (account.notes[id]) {
    fail('DUPLICATE_ENTITY', `A note ${id} already exists`, { note_id: id });
  }
  const body = requireString(event.payload, 'body', event.type);
  const target = readTarget(account, event);
  const note: Note = {
    id,
    ...target,
    body,
    author_id: readUser(account, event, 'author_id'),
    at: event.at,
  };
  return result({ ...account, notes: put(account.notes, id, note) }, [
    {
      kind: 'input',
      at: event.at,
      contact_id: note.contact_id,
      event_id: event.id,
      data: { note_id: id, opportunity_id: note.opportunity_id, author_id: note.author_id },
    },
  ]);
}

export function taskCreated(account: AccountState, event: SimulatorEvent): ReducerResult {
  const id = requireString(event.payload, 'task_id', event.type);
  if (account.tasks[id]) {
    fail('DUPLICATE_ENTITY', `A task ${id} already exists`, { task_id: id });
  }
  const title = requireString(event.payload, 'title', event.type);
  const target = readTarget(account, event);
  const task: Task = {
    id,
    ...target,
    title,
    description: optionalString(event.payload, 'description'),
    due_at: readDueAt(event),
    completed: false,
    completed_at: null,
    assigned_to: readUser(account, event, 'assigned_to'),
    created_at: event.at,
    updated_at: event.at,
  };
  return result({ ...account, tasks: put(account.tasks, id, task) }, [
    {
      kind: 'input',
      at: event.at,
      contact_id: task.contact_id,
      event_id: event.id,
      data: {
        task_id: id,
        opportunity_id: task.opportunity_id,
        due_at: task.due_at,
        assigned_to: task.assigned_to,
      },
    },
  ]);
}

export function taskUpdated(account: AccountState, event: SimulatorEvent): ReducerResult {
  const id = requireString(event.payload, 'task_id', event.type);
  const existing = entity(account.tasks, id, 'task', event.type);
  const changed: Record<string, unknown> = {};
  const updated: Task = { ...existing, updated_at: event.at };

  if (event.payload.title !== undefined) {
    updated.title = requireString(event.payload, 'title', event.type);
    changed.title = updated.title;
  }
  if (event.payload.description !== undefined) {
    updated.description = optionalString(event.payload, 'description');
    changed.description = updated.description;
  }
  if (event.payload.due_at !== undefined) {
    updated.due_at = readDueAt(event);
    changed.due_at = updated.due_at;
  }
  if (event.payload.assigned_to !== undefined) {
    updated.assigned_to = readUser(account, event, 'assigned_to');
    changed.assigned_to = updated.assigned_to;
  }

  return result({ ...account, tasks: put(account.tasks, id, updated) }, [
    {
      kind: 'step_completed',
      at: event.at,
      contact_id: updated.contact_id,
      event_id: event.id,
      data: { task_id: id, changed },
    },
  ]);
}

/**
 * Completing and reopening are the same event with a flag, because they are the same decision
 * made twice. The record says which way it went, so history reads as work finished or work
 * reopened rather than as an opaque update.
 */
export function taskCompleted(account: AccountState, event: SimulatorEvent): ReducerResult {
  const id = requireString(event.payload, 'task_id', event.type);
  const existing = entity(account.tasks, id, 'task', event.type);
  const completed = requireBoolean(event.payload, 'completed', event.type);
  const already = existing.completed === completed;
  const tasks = already
    ? account.tasks
    : put(account.tasks, id, {
        ...existing,
        completed,
        completed_at: completed ? event.at : null,
        updated_at: event.at,
      });
  return result({ ...account, tasks }, [
    {
      kind: already ? 'action_skipped' : 'step_completed',
      at: event.at,
      contact_id: existing.contact_id,
      event_id: event.id,
      data: { task_id: id, completed },
      reason: already ? (completed ? 'task_already_complete' : 'task_already_open') : null,
    },
  ]);
}
