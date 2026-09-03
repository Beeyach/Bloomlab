import { describe, expect, it } from 'vitest';

import { createRun } from '../src/run.ts';
import { processEvent } from '../src/run.ts';
import { replay } from '../src/replay.ts';
import { historyHash } from '../src/hash.ts';
import { SimulatorError } from '../src/errors.ts';
import type { PendingEvent } from '../src/events.ts';
import type { SimulatorScenario } from '../src/scenario.ts';
import type { SimulatorState } from '../src/state.ts';

/**
 * The CRM mutations Phase 11 added (CRM-001). Every one of them is exercised through the real
 * runner rather than by calling a reducer directly, so identity, ordering, history and the
 * refusal path are all part of what is asserted.
 */

const AT = '2026-09-03T09:00:00-05:00';

const scenario = (): SimulatorScenario => ({
  id: 'SC-crm-test',
  simulation_time: AT,
  timezone: 'America/Chicago',
  seed: 7,
  initial_account_state: {
    users: [
      { id: 'priya', name: 'Priya Raman', role: 'admin' },
      { id: 'dana', name: 'Dana Okafor' },
    ],
    contacts: [
      { id: 'maria', first_name: 'Maria', last_name: 'Delgado', owner_id: 'priya' },
      { id: 'jordan', first_name: 'Jordan' },
    ],
    custom_fields: [
      { key: 'treatment_interest', label: 'Treatment interest', type: 'text' },
      { key: 'deal_source', label: 'Deal source', type: 'text', object: 'opportunity' },
    ],
    pipelines: [{ id: 'consultations', name: 'Consultations', stages: ['New', 'Booked', 'Won'] }],
    opportunities: [
      { id: 'opp-maria', contact_id: 'maria', pipeline_id: 'consultations', stage: 'New' },
    ],
  },
});

const run = () => createRun(scenario(), { run_id: 'r1' });

const fire = (state: SimulatorState, event: Omit<PendingEvent, 'at' | 'origin'>): SimulatorState =>
  processEvent(state, { ...event, at: state.clock.now, origin: 'injected' } as PendingEvent);

/** The refusal a call produced, or null when it was accepted. */
function refusal(work: () => unknown): SimulatorError | null {
  try {
    work();
    return null;
  } catch (error) {
    if (error instanceof SimulatorError) return error;
    throw error;
  }
}

describe('ownership (CRM-001, D-089)', () => {
  it('assigns a contact to a user in the account', () => {
    const next = fire(run(), {
      type: 'CONTACT_ASSIGNED',
      payload: { contact_id: 'jordan', owner_id: 'dana' },
    });
    expect(next.account.contacts.jordan?.owner_id).toBe('dana');
  });

  it('clears an owner when told to, and says so in the record', () => {
    const next = fire(run(), {
      type: 'CONTACT_ASSIGNED',
      payload: { contact_id: 'maria', owner_id: null },
    });
    expect(next.account.contacts.maria?.owner_id).toBeNull();
    expect(next.execution.at(-1)?.data).toMatchObject({ from_owner: 'priya', to_owner: null });
  });

  it('refuses an owner the account does not have, and changes nothing', () => {
    const before = run();
    const error = refusal(() =>
      fire(before, {
        type: 'CONTACT_ASSIGNED',
        payload: { contact_id: 'maria', owner_id: 'ghost' },
      }),
    );
    expect(error?.code).toBe('UNKNOWN_ENTITY');
    expect(before.account.contacts.maria?.owner_id).toBe('priya');
  });

  it('tells "unassign" apart from "you forgot to say who"', () => {
    const error = refusal(() =>
      fire(run(), { type: 'CONTACT_ASSIGNED', payload: { contact_id: 'maria' } }),
    );
    expect(error?.code).toBe('INVALID_PAYLOAD');
  });

  it('lets a contact owner and an opportunity owner differ', () => {
    let state = run();
    state = fire(state, {
      type: 'OPPORTUNITY_ASSIGNED',
      payload: { opportunity_id: 'opp-maria', owner_id: 'dana' },
    });
    expect(state.account.contacts.maria?.owner_id).toBe('priya');
    expect(state.account.opportunities['opp-maria']?.owner_id).toBe('dana');
  });

  it('starts a new opportunity on the contact’s owner', () => {
    const next = fire(run(), {
      type: 'OPPORTUNITY_CREATED',
      payload: {
        opportunity_id: 'opp-new',
        contact_id: 'maria',
        pipeline_id: 'consultations',
        stage: 'New',
      },
    });
    expect(next.account.opportunities['opp-new']?.owner_id).toBe('priya');
  });

  it('records an assignment that changes nothing as skipped rather than done', () => {
    const next = fire(run(), {
      type: 'CONTACT_ASSIGNED',
      payload: { contact_id: 'maria', owner_id: 'priya' },
    });
    expect(next.execution.at(-1)).toMatchObject({
      kind: 'action_skipped',
      reason: 'owner_unchanged',
    });
  });
});

describe('custom field definitions (CRM-001, D-090)', () => {
  it('defines a contact field and an opportunity field', () => {
    let state = run();
    state = fire(state, {
      type: 'FIELD_DEFINED',
      payload: { key: 'skin_type', label: 'Skin type', type: 'text' },
    });
    state = fire(state, {
      type: 'FIELD_DEFINED',
      payload: { key: 'deal_room', label: 'Room', type: 'text', object: 'opportunity' },
    });
    expect(state.account.custom_fields.skin_type?.object).toBe('contact');
    expect(state.account.custom_fields.deal_room?.object).toBe('opportunity');
  });

  it('refuses a duplicate key', () => {
    const error = refusal(() =>
      fire(run(), {
        type: 'FIELD_DEFINED',
        payload: { key: 'treatment_interest', label: 'Again', type: 'text' },
      }),
    );
    expect(error?.code).toBe('DUPLICATE_ENTITY');
  });

  it('refuses a type the engine cannot store', () => {
    const error = refusal(() =>
      fire(run(), { type: 'FIELD_DEFINED', payload: { key: 'x', label: 'X', type: 'signature' } }),
    );
    expect(error?.code).toBe('INVALID_PAYLOAD');
  });

  it('refuses a dropdown with no options, and options on anything else', () => {
    expect(
      refusal(() =>
        fire(run(), {
          type: 'FIELD_DEFINED',
          payload: { key: 'interest', label: 'Interest', type: 'dropdown' },
        }),
      )?.code,
    ).toBe('INVALID_PAYLOAD');
    expect(
      refusal(() =>
        fire(run(), {
          type: 'FIELD_DEFINED',
          payload: { key: 'note', label: 'Note', type: 'text', options: ['a'] },
        }),
      )?.code,
    ).toBe('INVALID_PAYLOAD');
  });

  it('keeps a dropdown’s options and refuses a repeated one', () => {
    const next = fire(run(), {
      type: 'FIELD_DEFINED',
      payload: {
        key: 'interest',
        label: 'Interest',
        type: 'dropdown',
        options: ['Facial', 'Laser'],
      },
    });
    expect(next.account.custom_fields.interest?.options).toEqual(['Facial', 'Laser']);
    expect(
      refusal(() =>
        fire(run(), {
          type: 'FIELD_DEFINED',
          payload: { key: 'dup', label: 'Dup', type: 'dropdown', options: ['A', 'A'] },
        }),
      )?.code,
    ).toBe('INVALID_PAYLOAD');
  });

  it('refuses a change of type or object once the field exists', () => {
    expect(
      refusal(() =>
        fire(run(), {
          type: 'FIELD_UPDATED',
          payload: { key: 'treatment_interest', type: 'number' },
        }),
      )?.code,
    ).toBe('INVALID_PAYLOAD');
    expect(
      refusal(() =>
        fire(run(), {
          type: 'FIELD_UPDATED',
          payload: { key: 'treatment_interest', object: 'opportunity' },
        }),
      )?.code,
    ).toBe('INVALID_PAYLOAD');
  });

  it('leaves a stored value alone when the definition is relabelled', () => {
    let state = run();
    state = fire(state, {
      type: 'CONTACT_UPDATED',
      payload: { contact_id: 'maria', custom_fields: { treatment_interest: 'Laser' } },
    });
    state = fire(state, {
      type: 'FIELD_UPDATED',
      payload: { key: 'treatment_interest', label: 'What they came for' },
    });
    expect(state.account.contacts.maria?.custom_fields.treatment_interest).toBe('Laser');
    expect(state.account.custom_fields.treatment_interest?.label).toBe('What they came for');
  });
});

describe('custom field values (CRM-001)', () => {
  it('sets a value on a contact and on an opportunity', () => {
    let state = run();
    state = fire(state, {
      type: 'CONTACT_UPDATED',
      payload: { contact_id: 'maria', custom_fields: { treatment_interest: 'Membership' } },
    });
    state = fire(state, {
      type: 'OPPORTUNITY_UPDATED',
      payload: { opportunity_id: 'opp-maria', custom_fields: { deal_source: 'Referral' } },
    });
    expect(state.account.contacts.maria?.custom_fields.treatment_interest).toBe('Membership');
    expect(state.account.opportunities['opp-maria']?.custom_fields.deal_source).toBe('Referral');
  });

  it('refuses a value for the wrong object', () => {
    expect(
      refusal(() =>
        fire(run(), {
          type: 'CONTACT_UPDATED',
          payload: { contact_id: 'maria', custom_fields: { deal_source: 'Referral' } },
        }),
      )?.code,
    ).toBe('INVALID_PAYLOAD');
    expect(
      refusal(() =>
        fire(run(), {
          type: 'OPPORTUNITY_UPDATED',
          payload: { opportunity_id: 'opp-maria', custom_fields: { treatment_interest: 'Laser' } },
        }),
      )?.code,
    ).toBe('INVALID_PAYLOAD');
  });

  it('refuses a field nothing defines, and a value that is not a scalar', () => {
    expect(
      refusal(() =>
        fire(run(), {
          type: 'CONTACT_UPDATED',
          payload: { contact_id: 'maria', custom_fields: { nowhere: 'x' } },
        }),
      )?.code,
    ).toBe('UNKNOWN_ENTITY');
    expect(
      refusal(() =>
        fire(run(), {
          type: 'CONTACT_UPDATED',
          payload: { contact_id: 'maria', custom_fields: { treatment_interest: { a: 1 } } },
        }),
      )?.code,
    ).toBe('INVALID_PAYLOAD');
  });
});

describe('pipelines (CRM-001, D-093)', () => {
  it('creates a pipeline with ordered stages', () => {
    const next = fire(run(), {
      type: 'PIPELINE_CREATED',
      payload: { pipeline_id: 'memberships', name: 'Memberships', stages: ['Enquiry', 'Trial'] },
    });
    expect(next.account.pipelines.memberships?.stages).toEqual(['Enquiry', 'Trial']);
  });

  it('refuses a duplicate pipeline, an empty stage list and a repeated stage', () => {
    expect(
      refusal(() =>
        fire(run(), {
          type: 'PIPELINE_CREATED',
          payload: { pipeline_id: 'consultations', name: 'Again', stages: ['New'] },
        }),
      )?.code,
    ).toBe('DUPLICATE_ENTITY');
    expect(
      refusal(() =>
        fire(run(), {
          type: 'PIPELINE_CREATED',
          payload: { pipeline_id: 'p', name: 'P', stages: [] },
        }),
      )?.code,
    ).toBe('INVALID_PAYLOAD');
    expect(
      refusal(() =>
        fire(run(), {
          type: 'PIPELINE_CREATED',
          payload: { pipeline_id: 'p', name: 'P', stages: ['A', 'A'] },
        }),
      )?.code,
    ).toBe('INVALID_PAYLOAD');
  });

  it('reorders stages freely, because nothing is stranded', () => {
    const next = fire(run(), {
      type: 'PIPELINE_UPDATED',
      payload: { pipeline_id: 'consultations', stages: ['Booked', 'New', 'Won'] },
    });
    expect(next.account.pipelines.consultations?.stages).toEqual(['Booked', 'New', 'Won']);
    expect(next.account.opportunities['opp-maria']?.stage).toBe('New');
  });

  it('drops an empty stage without ceremony', () => {
    const next = fire(run(), {
      type: 'PIPELINE_UPDATED',
      payload: { pipeline_id: 'consultations', stages: ['New', 'Booked'] },
    });
    expect(next.account.pipelines.consultations?.stages).toEqual(['New', 'Booked']);
  });

  it('refuses to strand opportunities, and names what is in the way', () => {
    const before = run();
    const error = refusal(() =>
      fire(before, {
        type: 'PIPELINE_UPDATED',
        payload: { pipeline_id: 'consultations', stages: ['Booked', 'Won'] },
      }),
    );
    expect(error?.code).toBe('INVALID_PAYLOAD');
    expect(error?.detail).toMatchObject({ stage: 'New', opportunities: ['opp-maria'] });
    expect(before.account.opportunities['opp-maria']?.stage).toBe('New');
  });

  it('migrates them when the same event says where they go', () => {
    const next = fire(run(), {
      type: 'PIPELINE_UPDATED',
      payload: {
        pipeline_id: 'consultations',
        stages: ['Enquiry', 'Booked', 'Won'],
        migrate: { New: 'Enquiry' },
      },
    });
    expect(next.account.opportunities['opp-maria']?.stage).toBe('Enquiry');
    expect(next.execution.some((row) => row.reason === 'stage_migrated')).toBe(true);
  });

  it('refuses a migration that points nowhere, or out of a stage that is staying', () => {
    expect(
      refusal(() =>
        fire(run(), {
          type: 'PIPELINE_UPDATED',
          payload: { pipeline_id: 'consultations', stages: ['Booked'], migrate: { New: 'Ghost' } },
        }),
      )?.code,
    ).toBe('INVALID_PAYLOAD');
    expect(
      refusal(() =>
        fire(run(), {
          type: 'PIPELINE_UPDATED',
          payload: {
            pipeline_id: 'consultations',
            stages: ['New', 'Booked'],
            migrate: { New: 'Booked' },
          },
        }),
      )?.code,
    ).toBe('INVALID_PAYLOAD');
  });

  it('moves an opportunity to a valid stage and refuses an invalid one', () => {
    const next = fire(run(), {
      type: 'PIPELINE_STAGE_CHANGED',
      payload: { opportunity_id: 'opp-maria', stage: 'Booked' },
    });
    expect(next.account.opportunities['opp-maria']?.stage).toBe('Booked');
    expect(
      refusal(() =>
        fire(run(), {
          type: 'PIPELINE_STAGE_CHANGED',
          payload: { opportunity_id: 'opp-maria', stage: 'Nowhere' },
        }),
      )?.code,
    ).toBe('INVALID_PAYLOAD');
  });
});

describe('notes (CRM-001, D-091)', () => {
  it('records a note on a contact at simulator time', () => {
    const next = fire(run(), {
      type: 'NOTE_ADDED',
      payload: {
        note_id: 'n1',
        contact_id: 'maria',
        body: 'Prefers evenings.',
        author_id: 'priya',
      },
    });
    expect(next.account.notes.n1).toMatchObject({
      contact_id: 'maria',
      opportunity_id: null,
      body: 'Prefers evenings.',
      author_id: 'priya',
      at: AT,
    });
  });

  it('gives an opportunity note its deal’s contact, so it reads on both', () => {
    const next = fire(run(), {
      type: 'NOTE_ADDED',
      payload: { note_id: 'n2', opportunity_id: 'opp-maria', body: 'Quoted the package.' },
    });
    expect(next.account.notes.n2).toMatchObject({
      contact_id: 'maria',
      opportunity_id: 'opp-maria',
    });
  });

  it('refuses a note attached to nothing, to a stranger, or to a mismatched pair', () => {
    expect(
      refusal(() => fire(run(), { type: 'NOTE_ADDED', payload: { note_id: 'n', body: 'x' } }))
        ?.code,
    ).toBe('INVALID_PAYLOAD');
    expect(
      refusal(() =>
        fire(run(), {
          type: 'NOTE_ADDED',
          payload: { note_id: 'n', contact_id: 'ghost', body: 'x' },
        }),
      )?.code,
    ).toBe('UNKNOWN_ENTITY');
    expect(
      refusal(() =>
        fire(run(), {
          type: 'NOTE_ADDED',
          payload: { note_id: 'n', contact_id: 'jordan', opportunity_id: 'opp-maria', body: 'x' },
        }),
      )?.code,
    ).toBe('INVALID_PAYLOAD');
  });
});

describe('tasks (CRM-001, D-091)', () => {
  const create = (state: SimulatorState) =>
    fire(state, {
      type: 'TASK_CREATED',
      payload: {
        task_id: 't1',
        contact_id: 'maria',
        title: 'Call about the consult',
        due_at: '2026-09-04T10:00:00-05:00',
        assigned_to: 'dana',
      },
    });

  it('creates a task with a due date in simulator time and an assignee', () => {
    expect(create(run()).account.tasks.t1).toMatchObject({
      contact_id: 'maria',
      title: 'Call about the consult',
      due_at: '2026-09-04T10:00:00-05:00',
      assigned_to: 'dana',
      completed: false,
    });
  });

  it('completes and reopens, stamping and clearing the completion time', () => {
    let state = create(run());
    state = fire(state, { type: 'TASK_COMPLETED', payload: { task_id: 't1', completed: true } });
    expect(state.account.tasks.t1).toMatchObject({ completed: true, completed_at: AT });
    state = fire(state, { type: 'TASK_COMPLETED', payload: { task_id: 't1', completed: false } });
    expect(state.account.tasks.t1).toMatchObject({ completed: false, completed_at: null });
  });

  it('records completing an already-complete task as skipped', () => {
    let state = create(run());
    state = fire(state, { type: 'TASK_COMPLETED', payload: { task_id: 't1', completed: true } });
    state = fire(state, { type: 'TASK_COMPLETED', payload: { task_id: 't1', completed: true } });
    expect(state.execution.at(-1)).toMatchObject({
      kind: 'action_skipped',
      reason: 'task_already_complete',
    });
  });

  it('reassigns and retitles through TASK_UPDATED', () => {
    let state = create(run());
    state = fire(state, {
      type: 'TASK_UPDATED',
      payload: { task_id: 't1', title: 'Call today', assigned_to: 'priya' },
    });
    expect(state.account.tasks.t1).toMatchObject({ title: 'Call today', assigned_to: 'priya' });
  });

  it('refuses an unknown target, an unknown assignee and an unreadable due date', () => {
    expect(
      refusal(() =>
        fire(run(), {
          type: 'TASK_CREATED',
          payload: { task_id: 't', contact_id: 'ghost', title: 'x' },
        }),
      )?.code,
    ).toBe('UNKNOWN_ENTITY');
    expect(
      refusal(() =>
        fire(run(), {
          type: 'TASK_CREATED',
          payload: { task_id: 't', contact_id: 'maria', title: 'x', assigned_to: 'ghost' },
        }),
      )?.code,
    ).toBe('UNKNOWN_ENTITY');
    expect(
      refusal(() =>
        fire(run(), {
          type: 'TASK_CREATED',
          payload: { task_id: 't', contact_id: 'maria', title: 'x', due_at: 'next tuesday' },
        }),
      )?.code,
    ).toBe('INVALID_TIME');
  });

  it('refuses a task with no title and a completion flag that is not a flag', () => {
    expect(
      refusal(() =>
        fire(run(), { type: 'TASK_CREATED', payload: { task_id: 't', contact_id: 'maria' } }),
      )?.code,
    ).toBe('INVALID_PAYLOAD');
    const state = create(run());
    expect(
      refusal(() =>
        fire(state, { type: 'TASK_COMPLETED', payload: { task_id: 't1', completed: 'yes' } }),
      )?.code,
    ).toBe('INVALID_PAYLOAD');
  });
});

describe('the CRM mutations replay like everything else (SIM-018)', () => {
  it('reproduces a whole CRM session from its log', () => {
    let state = run();
    state = fire(state, {
      type: 'CONTACT_ASSIGNED',
      payload: { contact_id: 'jordan', owner_id: 'dana' },
    });
    state = fire(state, {
      type: 'FIELD_DEFINED',
      payload: {
        key: 'interest',
        label: 'Interest',
        type: 'dropdown',
        options: ['Facial', 'Laser'],
      },
    });
    state = fire(state, {
      type: 'CONTACT_UPDATED',
      payload: { contact_id: 'jordan', custom_fields: { interest: 'Laser' } },
    });
    state = fire(state, {
      type: 'OPPORTUNITY_CREATED',
      payload: {
        opportunity_id: 'opp-jordan',
        contact_id: 'jordan',
        pipeline_id: 'consultations',
        stage: 'New',
        name: 'Jordan — laser',
        value: 900,
      },
    });
    state = fire(state, {
      type: 'PIPELINE_STAGE_CHANGED',
      payload: { opportunity_id: 'opp-jordan', stage: 'Booked' },
    });
    state = fire(state, {
      type: 'NOTE_ADDED',
      payload: { note_id: 'n1', opportunity_id: 'opp-jordan', body: 'Booked for Friday.' },
    });
    state = fire(state, {
      type: 'TASK_CREATED',
      payload: { task_id: 't1', opportunity_id: 'opp-jordan', title: 'Confirm Friday' },
    });
    state = fire(state, { type: 'TASK_COMPLETED', payload: { task_id: 't1', completed: true } });

    const replayed = replay(scenario(), state.log, { run_id: 'r1' });
    expect(historyHash(replayed)).toBe(historyHash(state));
    expect(replayed.account.tasks.t1?.completed).toBe(true);
    expect(replayed.account.notes.n1?.contact_id).toBe('jordan');
    expect(replayed.account.opportunities['opp-jordan']?.stage).toBe('Booked');
  });
});
