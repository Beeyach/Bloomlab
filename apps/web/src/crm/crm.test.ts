import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  historyHash,
  instantForDay,
  replay,
  stateHash,
  type SimulatorScenario,
} from '@bloomlab/simulator-core';

import { content } from '../content/bundle';
import type { BloomlabDatabase } from '../data/db';
import { syncNow } from '../data/sync/engine';
import { FakeSyncServer } from '../data/sync/fakeServer';
import { createSyncKey, linkThisDevice } from '../data/sync/link';
import { freshDatabase } from '../data/testing';
import { loadRun, resetStoredRun, startRun, type StoredRun } from '../simulator/store';
import { activityFor, fullActivityFor } from './activity';
import {
  addNote,
  addTag,
  assignContact,
  assignOpportunity,
  createContact,
  createOpportunity,
  createTask,
  defineField,
  moveOpportunity,
  setTaskCompleted,
  updateContact,
  updatePipeline,
} from './commands';
import { ensureDevice } from '../data/device';
import { currentCrmRun, currentCrmRunId, rememberCrmRun, savedCrmRuns } from './currentRun';
import { crmExerciseRuntime } from './exerciseRuntime';
import { CRM_SCENARIO_ID } from './useCrmRun';
import { simulatorDay } from './words';

/**
 * The CRM Lab against the real authored account (CRM-001, CRM-003).
 *
 * Everything runs through the command layer and the real persistence, because the claim being
 * tested is precisely that the Lab is not a second universe: one account, one event log, one
 * history, and it all survives a reload, a replay and a second device.
 */

const scenario = (content.scenarios as unknown as SimulatorScenario[]).find(
  (row) => row.id === CRM_SCENARIO_ID,
) as SimulatorScenario;

let database: BloomlabDatabase;

beforeEach(() => {
  database = freshDatabase();
});

afterEach(() => {
  database.close();
});

const start = () => startRun(scenario, database);

/** Unwraps a command, failing loudly with the refusal rather than silently continuing. */
async function ok(
  outcome: Promise<
    { ok: true; run: StoredRun } | { ok: false; run: StoredRun; refusal: { message: string } }
  >,
): Promise<StoredRun> {
  const result = await outcome;
  if (!result.ok) throw new Error(`Refused: ${result.refusal.message}`);
  return result.run;
}

describe('the authored CRM account (CRM-001)', () => {
  it('compiles the people, the structure and the work already owed', async () => {
    const run = await start();
    const account = run.state.account;
    expect(Object.keys(account.users)).toHaveLength(2);
    expect(Object.keys(account.contacts)).toHaveLength(5);
    expect(Object.keys(account.opportunities)).toHaveLength(4);
    expect(Object.keys(account.notes)).toHaveLength(2);
    expect(Object.keys(account.tasks)).toHaveLength(2);
    expect(account.pipelines.consultations?.stages).toHaveLength(6);
  });

  it('carries the cases a learner has to notice', async () => {
    const account = (await start()).state.account;
    // No phone and nobody's, no email, and one contact on do-not-disturb.
    expect(account.contacts.aisha?.phone).toBeNull();
    expect(account.contacts.aisha?.owner_id).toBeNull();
    expect(account.contacts.theo?.email).toBeNull();
    expect(account.contacts.lena?.dnd).toBe(true);
  });

  it('seeds a note against an opportunity and resolves its contact', async () => {
    const note = (await start()).state.account.notes['note-jordan-1'];
    expect(note?.opportunity_id).toBe('opp-jordan');
    expect(note?.contact_id).toBe('jordan');
  });
});

describe('one shared account, end to end (CRM-001, SIM-001)', () => {
  it('runs a whole CRM session into one log, one account and one history', async () => {
    let run = await start();

    run = await ok(createContact(run, { first_name: 'Rowan', last_name: 'Hale' }, database));
    const rowan = Object.values(run.state.account.contacts).find((c) => c.first_name === 'Rowan');
    expect(rowan).toBeDefined();
    const contactId = rowan?.id as string;

    run = await ok(addTag(run, contactId, 'referral', database));
    run = await ok(
      defineField(
        run,
        { key: 'budget_band', label: 'Budget band', type: 'text', object: 'contact' },
        database,
      ),
    );
    run = await ok(
      updateContact(run, contactId, { custom_fields: { budget_band: 'mid' } }, database),
    );
    run = await ok(assignContact(run, contactId, 'priya', database));
    run = await ok(
      createOpportunity(
        run,
        { contact_id: contactId, pipeline_id: 'consultations', stage: 'New Lead', value: 500 },
        database,
      ),
    );
    const deal = Object.values(run.state.account.opportunities).find(
      (row) => row.contact_id === contactId,
    );
    const dealId = deal?.id as string;
    // The deal inherited the contact's owner; now they diverge, which a real sub-account allows.
    expect(deal?.owner_id).toBe('priya');
    run = await ok(assignOpportunity(run, dealId, 'dana', database));
    run = await ok(moveOpportunity(run, dealId, 'Contacted', undefined, database));
    run = await ok(addNote(run, { contact_id: contactId }, 'Called, keen.', 'priya', database));
    run = await ok(createTask(run, { contact_id: contactId, title: 'Send the quote' }, database));
    const taskId = Object.values(run.state.account.tasks).find(
      (task) => task.title === 'Send the quote',
    )?.id as string;
    run = await ok(setTaskCompleted(run, taskId, true, database));

    // 1. Every change is in the one account.
    const account = run.state.account;
    expect(account.contacts[contactId]?.owner_id).toBe('priya');
    expect(account.contacts[contactId]?.custom_fields.budget_band).toBe('mid');
    expect(account.contacts[contactId]?.tags).toContain('referral');
    expect(account.opportunities[dealId]?.owner_id).toBe('dana');
    expect(account.opportunities[dealId]?.stage).toBe('Contacted');
    expect(account.tasks[taskId]?.completed).toBe(true);

    // 2. Every change is in the one event log.
    const types = run.state.log.map((event) => event.type);
    for (const expected of [
      'CONTACT_CREATED',
      'TAG_ADDED',
      'FIELD_DEFINED',
      'CONTACT_UPDATED',
      'CONTACT_ASSIGNED',
      'OPPORTUNITY_CREATED',
      'OPPORTUNITY_ASSIGNED',
      'PIPELINE_STAGE_CHANGED',
      'NOTE_ADDED',
      'TASK_CREATED',
      'TASK_COMPLETED',
    ]) {
      expect(types, `${expected} should be in the log`).toContain(expected);
    }

    // 3. Activity resolves those facts, in the simulator's order.
    const activity = activityFor(run.state, { contact_id: contactId });
    const kinds = activity.map((entry) => entry.kind);
    expect(kinds).toContain('contact_created');
    expect(kinds).toContain('tag_added');
    expect(kinds).toContain('note_added');
    expect(kinds).toContain('task_completed');
    // Newest first, and never out of the engine's order.
    const sequences = activity.map((entry) => entry.sequence);
    expect(sequences).toEqual([...sequences].sort((a, b) => b - a));

    // 4. A reload returns the same logical run.
    const reloaded = await loadRun(run.state.run_id, database);
    expect(stateHash(reloaded?.state as never)).toBe(stateHash(run.state));

    // 5. Replay reproduces it.
    const replayed = replay(scenario, run.state.log, { run_id: run.state.run_id });
    expect(historyHash(replayed)).toBe(historyHash(run.state));

    // 6. Phase 10's snapshot and reset rules still hold: a reset run records normally, and its
    //    rows never reuse an id from the life before it (D-087).
    const before = new Set(
      (await database.sim_events.where('run_id').equals(run.state.run_id).toArray()).map(
        (row) => row.id,
      ),
    );
    let after = await resetStoredRun(scenario, run.state.run_id, database);
    expect(after.state.log).toEqual([]);
    after = await ok(addTag(after, 'maria', 'after-reset', database));
    const fresh = (await database.sim_events.where('run_id').equals(run.state.run_id).toArray())
      .filter((row) => row.generation === after.generation)
      .map((row) => row.id);
    expect(fresh.length).toBeGreaterThan(0);
    expect(fresh.filter((id) => before.has(id))).toEqual([]);
    const afterReload = await loadRun(run.state.run_id, database);
    expect(afterReload?.state.account.contacts.maria?.tags).toContain('after-reset');
  });
});

describe('the activity history is derived, never assembled (CRM-001)', () => {
  it('gives the same log the same history, every time', async () => {
    let run = await start();
    run = await ok(addTag(run, 'maria', 'twice', database));
    const first = activityFor(run.state, { contact_id: 'maria' });
    const second = activityFor(run.state, { contact_id: 'maria' });
    expect(second).toEqual(first);
  });

  it('shows one fact once, even though a note is both an event and a record', async () => {
    let run = await start();
    run = await ok(addNote(run, { contact_id: 'maria' }, 'Only once.', null, database));
    const notes = fullActivityFor(run.state, { contact_id: 'maria' }).filter(
      (entry) => entry.kind === 'note_added',
    );
    // One note the learner just wrote, plus the one the scenario seeded. Not three.
    expect(notes).toHaveLength(2);
    expect(notes.filter((entry) => entry.data.seeded === true)).toHaveLength(1);
  });

  it('reads an opportunity change on its contact as well as on the deal', async () => {
    let run = await start();
    run = await ok(moveOpportunity(run, 'opp-maria', 'Consult Done', undefined, database));
    expect(
      activityFor(run.state, { contact_id: 'maria' }).some((e) => e.kind === 'stage_changed'),
    ).toBe(true);
    expect(
      activityFor(run.state, { opportunity_id: 'opp-maria' }).some(
        (e) => e.kind === 'stage_changed',
      ),
    ).toBe(true);
  });

  it('keeps one contact’s history out of another’s', async () => {
    let run = await start();
    run = await ok(addTag(run, 'maria', 'only-maria', database));
    const jordan = activityFor(run.state, { contact_id: 'jordan' });
    expect(jordan.some((entry) => entry.data.tag === 'only-maria')).toBe(false);
  });

  it('orders by simulator time, never by the browser clock', async () => {
    let run = await start();
    run = await ok(addTag(run, 'maria', 'a', database));
    run = await ok(addTag(run, 'maria', 'b', database));
    const entries = activityFor(run.state, { contact_id: 'maria' });
    for (const entry of entries) {
      expect(entry.at).toBe(run.state.clock.now);
    }
  });
});

describe('refusals reach the learner and change nothing (CRM-001)', () => {
  it('refuses an unknown owner and leaves the contact as it was', async () => {
    const run = await start();
    const outcome = await assignContact(run, 'maria', 'nobody', database);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.refusal.code).toBe('UNKNOWN_ENTITY');
      expect(outcome.refusal.message).toContain('user');
    }
    expect(outcome.run.state.account.contacts.maria?.owner_id).toBe('priya');
    expect(outcome.run.state.log).toHaveLength(0);
  });

  it('refuses a stage that would strand deals, and says what is in the way', async () => {
    const run = await start();
    const outcome = await updatePipeline(
      run,
      'consultations',
      { stages: ['New Lead', 'Contacted', 'Won', 'Lost'] },
      database,
    );
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.refusal.message).toContain('Consult Booked');
      expect(outcome.refusal.detail.opportunities).toEqual(['opp-maria']);
    }
    expect(outcome.run.state.account.opportunities['opp-maria']?.stage).toBe('Consult Booked');
  });

  it('accepts the same change once it says where the deals go', async () => {
    let run = await start();
    run = await ok(
      updatePipeline(
        run,
        'consultations',
        {
          stages: ['New Lead', 'Contacted', 'Booked', 'Consult Done', 'Won', 'Lost'],
          migrate: { 'Consult Booked': 'Booked' },
        },
        database,
      ),
    );
    expect(run.state.account.opportunities['opp-maria']?.stage).toBe('Booked');
  });
});

describe('poor architecture is allowed (CRM-003)', () => {
  it('lets a learner record a changing value as tags, exactly as the account already does', async () => {
    let run = await start();
    // Jordan already carries three stale interest tags. Adding a fourth is not blocked.
    run = await ok(addTag(run, 'jordan', 'wants-peel', database));
    const tags = run.state.account.contacts.jordan?.tags ?? [];
    expect(tags.filter((tag) => tag.startsWith('wants-'))).toHaveLength(4);
  });

  it('does not warn, block or correct the choice anywhere in the model', async () => {
    let run = await start();
    run = await ok(addTag(run, 'jordan', 'wants-peel', database));
    const activity = activityFor(run.state, { contact_id: 'jordan' });
    const words = JSON.stringify(activity);
    for (const nag of ['should', 'instead', 'better', 'wrong', 'prefer', 'recommend']) {
      expect(words.toLowerCase()).not.toContain(nag);
    }
  });

  it('leaves the cost visible in the data: four tags, and no single current value', async () => {
    let run = await start();
    run = await ok(addTag(run, 'jordan', 'wants-peel', database));
    const jordan = run.state.account.contacts.jordan;
    // This is the consequence a later exercise reads: the field is empty and the tags disagree.
    expect(jordan?.custom_fields.treatment_interest).toBeUndefined();
    expect((jordan?.tags ?? []).filter((tag) => tag.startsWith('wants-')).length).toBeGreaterThan(
      1,
    );
  });
});

describe('the UI mutates only through the command layer (CRM-001)', () => {
  /**
   * The architecture boundary, checked at the boundary rather than with a regex over statements.
   * A screen that starts calling `processEvent`, writing `sim_projects`, or reaching into
   * `state.account` to assign would bypass every rule in simulator-core; the command layer exists
   * so there is exactly one door, and this fails if a second one is cut.
   */
  const uiFiles = () => {
    const dir = join(process.cwd(), 'apps', 'web', 'src', 'crm');
    return readdirSync(dir)
      .filter((name) => name.endsWith('.tsx') && !name.endsWith('.test.tsx'))
      .map((name) => ({ name, source: readFileSync(join(dir, name), 'utf8') }));
  };

  it.each(['processEvent', 'commitRun', 'saveRun', 'resetStoredRun'])(
    'no CRM screen calls %s directly',
    (forbidden) => {
      for (const { name, source } of uiFiles()) {
        expect(source, `${name} must go through the command layer`).not.toContain(forbidden);
      }
    },
  );

  it('no CRM screen writes to the simulator tables', () => {
    for (const { name, source } of uiFiles()) {
      expect(source, `${name} must not touch persistence`).not.toMatch(
        /sim_(projects|events|snapshots)/,
      );
      expect(source, `${name} must not import the database`).not.toMatch(/from '\.\.\/data\/db'/);
    }
  });

  it('no CRM screen assigns into the account state', () => {
    for (const { name, source } of uiFiles()) {
      expect(source, `${name} must not mutate the account`).not.toMatch(
        /account\.(contacts|opportunities|tasks|notes|pipelines|custom_fields)\s*\[[^\]]+\]\s*=/,
      );
    }
  });
});

describe('two devices share one CRM account (SYNC-008)', () => {
  it('gives the second device the same account and the same history', async () => {
    const server = new FakeSyncServer();
    const a = freshDatabase();
    const b = freshDatabase();
    try {
      const key = createSyncKey();
      await linkThisDevice(key.display, a, server);
      await linkThisDevice(key.canonical, b, server);

      let run = await startRun(scenario, a);
      run = await ok(addTag(run, 'maria', 'from-device-a', a));
      run = await ok(assignContact(run, 'aisha', 'dana', a));
      run = await ok(moveOpportunity(run, 'opp-lena', 'Contacted', undefined, a));
      await syncNow(a, server);
      await syncNow(b, server);

      const onB = await loadRun(run.state.run_id, b);
      expect(onB).not.toBeNull();
      expect(stateHash(onB?.state as never)).toBe(stateHash(run.state));
      expect(onB?.state.account.contacts.maria?.tags).toContain('from-device-a');
      expect(onB?.state.account.contacts.aisha?.owner_id).toBe('dana');
      expect(onB?.state.account.opportunities['opp-lena']?.stage).toBe('Contacted');
      // The history came across as history, not as a re-derived guess.
      expect(activityFor(onB?.state as never, { contact_id: 'maria' }).length).toBeGreaterThan(0);
    } finally {
      a.close();
      b.close();
    }
  });
});

describe('a task’s due date is the account’s time on every device (D-098)', () => {
  it('persists the exact instant and reads it back after a reload', async () => {
    let run = await start();
    const zone = run.state.clock.timezone;
    expect(zone).toBe('America/Chicago');
    const due = instantForDay('2026-09-05', zone);
    expect(due).toBe('2026-09-05T09:00:00-05:00');
    run = await ok(
      createTask(run, { contact_id: 'maria', title: 'Ring Maria', due_at: due }, database),
    );
    const id = Object.values(run.state.account.tasks).find((t) => t.title === 'Ring Maria')?.id;
    expect(id).toBeDefined();

    const reloaded = await loadRun(run.state.run_id, database);
    expect(reloaded?.state.account.tasks[id as string]?.due_at).toBe('2026-09-05T09:00:00-05:00');
    expect(historyHash(reloaded?.state as never)).toBe(historyHash(run.state));
  });

  it('shows the chosen day in the account zone, not the device zone', async () => {
    const run = await start();
    const zone = run.state.clock.timezone;
    const due = instantForDay('2026-09-05', zone);
    expect(simulatorDay(due, zone)).toMatch(/5 Sept/);
    // The same instant read in Tokyo would already be the 5th at 23:00 — still the 5th here,
    // because the display uses the account's zone and never `Date`'s local view.
    expect(simulatorDay('2026-09-05T23:00:00+09:00', zone)).toMatch(/5 Sept/);
    expect(simulatorDay('2026-09-06T01:00:00+09:00', zone)).toMatch(/5 Sept/);
  });

  it('carries the same due date to a second device, byte for byte', async () => {
    const server = new FakeSyncServer();
    const a = freshDatabase();
    const b = freshDatabase();
    try {
      const key = createSyncKey();
      await linkThisDevice(key.display, a, server);
      await linkThisDevice(key.canonical, b, server);

      let run = await startRun(scenario, a);
      const due = instantForDay('2026-11-01', run.state.clock.timezone);
      run = await ok(createTask(run, { contact_id: 'lena', title: 'After DST', due_at: due }, a));
      await syncNow(a, server);
      await syncNow(b, server);

      const onB = await loadRun(run.state.run_id, b);
      const task = Object.values(onB?.state.account.tasks ?? {}).find(
        (t) => t.title === 'After DST',
      );
      expect(task?.due_at).toBe('2026-11-01T09:00:00-06:00');
      expect(stateHash(onB?.state as never)).toBe(stateHash(run.state));
    } finally {
      a.close();
      b.close();
    }
  });

  it('refuses a bare local datetime at the command door too', async () => {
    const run = await start();
    const outcome = await createTask(
      run,
      { contact_id: 'maria', title: 'Bare', due_at: '2026-09-05T09:00:00' },
      database,
    );
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.refusal.message).toContain('offset');
    expect(Object.values(outcome.run.state.account.tasks).some((t) => t.title === 'Bare')).toBe(
      false,
    );
  });
});

describe('which run the Lab and the grader work in (D-096, D-099)', () => {
  it('uses the most recently updated run until the device chooses one', async () => {
    await ensureDevice(database);
    const first = await startRun(scenario, database, 'run-first');
    const second = await startRun(scenario, database, 'run-second');
    expect((await savedCrmRuns(CRM_SCENARIO_ID, database)).map((r) => r.run_id)).toEqual([
      'run-second',
      'run-first',
    ]);
    expect(await currentCrmRunId(CRM_SCENARIO_ID, database)).toBe(second.state.run_id);

    await rememberCrmRun('run-first', database);
    expect(await currentCrmRunId(CRM_SCENARIO_ID, database)).toBe(first.state.run_id);
  });

  it('falls back to the newest run when the remembered one no longer exists', async () => {
    await ensureDevice(database);
    await startRun(scenario, database, 'run-only');
    await rememberCrmRun('run-gone', database);
    expect(await currentCrmRunId(CRM_SCENARIO_ID, database)).toBe('run-only');
  });

  it('switching touches no run: neither history changes', async () => {
    await ensureDevice(database);
    const first = await startRun(scenario, database, 'run-first');
    const second = await startRun(scenario, database, 'run-second');
    const before = [historyHash(first.state), historyHash(second.state)];
    await rememberCrmRun('run-first', database);
    const after = [
      historyHash((await loadRun('run-first', database))?.state as never),
      historyHash((await loadRun('run-second', database))?.state as never),
    ];
    expect(after).toEqual(before);
    expect((await savedCrmRuns(CRM_SCENARIO_ID, database)).length).toBe(2);
  });

  it('grades the run the learner is working in, not another that is newer', async () => {
    await ensureDevice(database);
    const chosen = await startRun(scenario, database, 'run-chosen');
    await startRun(scenario, database, 'run-newer');
    await ok(addTag(chosen, 'jordan', 'only-here', database));
    await rememberCrmRun('run-chosen', database);

    const current = await currentCrmRun(CRM_SCENARIO_ID, database);
    expect(current?.state.run_id).toBe('run-chosen');
    expect(current?.state.account.contacts.jordan?.tags).toContain('only-here');
    // The runtime reads the same rule through the default database; here the resolver is the
    // contract, and the runtime module delegates to it (see exerciseRuntime.ts).
    expect(typeof crmExerciseRuntime.context).toBe('function');
  });
});
