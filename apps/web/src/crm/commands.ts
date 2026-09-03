import {
  isSimulatorError,
  processEvent,
  type PendingEvent,
  type SimulatorErrorCode,
  type SimulatorEventType,
} from '@bloomlab/simulator-core';

import { db, type BloomlabDatabase } from '../data/db';
import { randomId } from '../data/envelope';
import { commitRun, type StoredRun } from '../simulator/store';

/**
 * The CRM command layer (CRM-001, D-094).
 *
 * This is the only way the CRM Lab is allowed to change anything. A screen states an intent, this
 * module turns it into one valid pending simulator event, puts it through `processEvent`, and
 * persists the run — so every CRM change is an event in the same log the rest of Phase 10 writes,
 * replays with the run, and syncs by the existing path. There is no second reducer, no local
 * mirror of the account, and no place where a component can reach past this and write state.
 *
 * It deliberately holds no business rules. Whether an owner exists, whether a stage is valid,
 * whether a field accepts a value: all of that lives in `simulator-core`, where it is testable
 * without React and reusable by Phase 12's workflows. What lives here is translation, id minting
 * (the engine forbids randomness, so the app supplies it, exactly as it does for run ids), and
 * turning a refusal into something a screen can show a learner.
 */

/** What Bloomlab refused, why, and what the learner can change. */
export interface CrmRefusal {
  code: SimulatorErrorCode | 'UNEXPECTED';
  /** One sentence, in the learner's language. Never a stack trace. */
  message: string;
  /** Ids, offending values and limits — for diagnostics, not for the screen. */
  detail: Record<string, unknown>;
}

/**
 * The result of a command. The run comes back either way: on a refusal it is the run *unchanged*,
 * so a caller that renders `outcome.run` cannot accidentally show a half-applied edit.
 */
export type CrmOutcome =
  { ok: true; run: StoredRun } | { ok: false; run: StoredRun; refusal: CrmRefusal };

/** Ids the app mints, kept together so every CRM record is addressable and unique. */
export const newNoteId = () => `note-${randomId()}`;
export const newTaskId = () => `task-${randomId()}`;
export const newContactId = () => `contact-${randomId()}`;
export const newOpportunityId = () => `opp-${randomId()}`;
export const newPipelineId = () => `pipeline-${randomId()}`;

/**
 * The one path from intent to persisted run.
 *
 * Everything below is a thin wrapper around this, which is what makes the boundary checkable: a
 * component that wants to change the account has no other function to call, and a test can assert
 * that no screen imports `processEvent` directly.
 */
export async function runCommand(
  run: StoredRun,
  event: { type: SimulatorEventType; payload: Record<string, unknown> },
  database: BloomlabDatabase = db,
): Promise<CrmOutcome> {
  const pending: PendingEvent = {
    type: event.type,
    at: run.state.clock.now,
    payload: event.payload,
    origin: 'injected',
    source: { kind: 'injector_action', id: 'crm_lab' },
  };
  let next: StoredRun;
  try {
    next = { ...run, state: processEvent(run.state, pending) };
  } catch (error) {
    if (isSimulatorError(error)) {
      return {
        ok: false,
        run,
        refusal: { code: error.code, message: error.message, detail: error.detail },
      };
    }
    throw error;
  }
  const saved = await commitRun(next, database);
  return { ok: true, run: saved };
}

/* ---- contacts ---------------------------------------------------------- */

export interface NewContact {
  first_name: string;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  source?: string | null;
  owner_id?: string | null;
  dnd?: boolean;
}

export const createContact = (run: StoredRun, draft: NewContact, database?: BloomlabDatabase) =>
  runCommand(
    run,
    { type: 'CONTACT_CREATED', payload: { contact_id: newContactId(), ...prune(draft) } },
    database,
  );

/** Standard fields and custom field values. Only what the caller names is touched. */
export const updateContact = (
  run: StoredRun,
  contactId: string,
  changes: Partial<{
    first_name: string;
    last_name: string | null;
    email: string | null;
    phone: string | null;
    source: string | null;
    timezone: string | null;
    dnd: boolean;
    custom_fields: Record<string, string | number | boolean>;
  }>,
  database?: BloomlabDatabase,
) =>
  runCommand(
    run,
    { type: 'CONTACT_UPDATED', payload: { contact_id: contactId, ...changes } },
    database,
  );

export const assignContact = (
  run: StoredRun,
  contactId: string,
  ownerId: string | null,
  database?: BloomlabDatabase,
) =>
  runCommand(
    run,
    { type: 'CONTACT_ASSIGNED', payload: { contact_id: contactId, owner_id: ownerId } },
    database,
  );

export const addTag = (
  run: StoredRun,
  contactId: string,
  tag: string,
  database?: BloomlabDatabase,
) => runCommand(run, { type: 'TAG_ADDED', payload: { contact_id: contactId, tag } }, database);

export const removeTag = (
  run: StoredRun,
  contactId: string,
  tag: string,
  database?: BloomlabDatabase,
) => runCommand(run, { type: 'TAG_REMOVED', payload: { contact_id: contactId, tag } }, database);

/* ---- fields ------------------------------------------------------------ */

export interface NewField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'checkbox' | 'dropdown' | 'phone' | 'email';
  object: 'contact' | 'opportunity';
  options?: string[];
}

export const defineField = (run: StoredRun, field: NewField, database?: BloomlabDatabase) =>
  runCommand(run, { type: 'FIELD_DEFINED', payload: { ...prune(field) } }, database);

export const updateField = (
  run: StoredRun,
  key: string,
  changes: { label?: string; options?: string[] },
  database?: BloomlabDatabase,
) => runCommand(run, { type: 'FIELD_UPDATED', payload: { key, ...changes } }, database);

/* ---- opportunities ----------------------------------------------------- */

export interface NewOpportunity {
  contact_id: string;
  pipeline_id: string;
  stage: string;
  name?: string;
  value?: number;
  owner_id?: string | null;
}

export const createOpportunity = (
  run: StoredRun,
  draft: NewOpportunity,
  database?: BloomlabDatabase,
) =>
  runCommand(
    run,
    {
      type: 'OPPORTUNITY_CREATED',
      payload: { opportunity_id: newOpportunityId(), ...prune(draft) },
    },
    database,
  );

export const updateOpportunity = (
  run: StoredRun,
  opportunityId: string,
  changes: Partial<{
    name: string;
    value: number;
    status: 'open' | 'won' | 'lost' | 'abandoned';
    custom_fields: Record<string, string | number | boolean>;
  }>,
  database?: BloomlabDatabase,
) =>
  runCommand(
    run,
    { type: 'OPPORTUNITY_UPDATED', payload: { opportunity_id: opportunityId, ...changes } },
    database,
  );

export const assignOpportunity = (
  run: StoredRun,
  opportunityId: string,
  ownerId: string | null,
  database?: BloomlabDatabase,
) =>
  runCommand(
    run,
    { type: 'OPPORTUNITY_ASSIGNED', payload: { opportunity_id: opportunityId, owner_id: ownerId } },
    database,
  );

/** A stage move is one event on drop or on choosing, never a stream of drag positions. */
export const moveOpportunity = (
  run: StoredRun,
  opportunityId: string,
  stage: string,
  pipelineId?: string,
  database?: BloomlabDatabase,
) =>
  runCommand(
    run,
    {
      type: 'PIPELINE_STAGE_CHANGED',
      payload: {
        opportunity_id: opportunityId,
        stage,
        ...(pipelineId ? { pipeline_id: pipelineId } : {}),
      },
    },
    database,
  );

/* ---- pipelines --------------------------------------------------------- */

export const createPipeline = (
  run: StoredRun,
  draft: { name: string; stages: string[] },
  database?: BloomlabDatabase,
) =>
  runCommand(
    run,
    { type: 'PIPELINE_CREATED', payload: { pipeline_id: newPipelineId(), ...draft } },
    database,
  );

/**
 * Renaming, reordering, adding and removing stages are one operation, because the engine judges
 * them together: whether a change strands opportunities depends on the whole new list, not on
 * which button was pressed. `migrate` names where a departing stage's deals go (D-093).
 */
export const updatePipeline = (
  run: StoredRun,
  pipelineId: string,
  changes: { name?: string; stages?: string[]; migrate?: Record<string, string> },
  database?: BloomlabDatabase,
) =>
  runCommand(
    run,
    { type: 'PIPELINE_UPDATED', payload: { pipeline_id: pipelineId, ...changes } },
    database,
  );

/* ---- notes and tasks --------------------------------------------------- */

export const addNote = (
  run: StoredRun,
  target: { contact_id?: string; opportunity_id?: string },
  body: string,
  authorId?: string | null,
  database?: BloomlabDatabase,
) =>
  runCommand(
    run,
    {
      type: 'NOTE_ADDED',
      payload: { note_id: newNoteId(), ...prune(target), body, author_id: authorId ?? null },
    },
    database,
  );

export interface NewTask {
  title: string;
  contact_id?: string;
  opportunity_id?: string;
  description?: string | null;
  due_at?: string | null;
  assigned_to?: string | null;
}

export const createTask = (run: StoredRun, draft: NewTask, database?: BloomlabDatabase) =>
  runCommand(
    run,
    { type: 'TASK_CREATED', payload: { task_id: newTaskId(), ...prune(draft) } },
    database,
  );

export const updateTask = (
  run: StoredRun,
  taskId: string,
  changes: Partial<{
    title: string;
    description: string | null;
    due_at: string | null;
    assigned_to: string | null;
  }>,
  database?: BloomlabDatabase,
) => runCommand(run, { type: 'TASK_UPDATED', payload: { task_id: taskId, ...changes } }, database);

export const setTaskCompleted = (
  run: StoredRun,
  taskId: string,
  completed: boolean,
  database?: BloomlabDatabase,
) => runCommand(run, { type: 'TASK_COMPLETED', payload: { task_id: taskId, completed } }, database);

/**
 * Drops keys the caller left undefined, so an untouched form field is "not mentioned" rather than
 * "set to nothing". `null` survives, because clearing a value is a real instruction.
 */
function prune<T extends object>(value: T): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}
