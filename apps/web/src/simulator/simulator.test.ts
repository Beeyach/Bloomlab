import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { gradeExercise, type ExerciseDefinition } from '@bloomlab/exercise-engine';
import {
  advanceTo,
  historyHash,
  injectAction,
  nextEvent,
  processEvent,
  replay,
  schedule,
  stateHash,
  type SimulatorScenario,
  type SimulatorState,
} from '@bloomlab/simulator-core';

import { content } from '../content/bundle';
import type { BloomlabDatabase } from '../data/db';
import { createSyncableStore } from '../data/stores';
import { syncNow } from '../data/sync/engine';
import { FakeSyncServer } from '../data/sync/fakeServer';
import { createSyncKey, linkThisDevice } from '../data/sync/link';
import { freshDatabase } from '../data/testing';
import type { SimEventRecord, SimSnapshotRecord } from '../data/types';
import { gradingContextFrom, gradingReferences } from './grading';
import {
  commitRun,
  listRuns,
  loadRun,
  markCheckpoint,
  resetStoredRun,
  saveRun,
  startRun,
  type StoredRun,
} from './store';

/**
 * The simulator inside the app: the bridge to Phase 9's grader, and persistence across a reload.
 * Both run against the real authored scenario from the content bundle, not a hand-built fixture,
 * so a change to the scenario that breaks the engine fails here.
 */

const scenario = (content.scenarios as unknown as SimulatorScenario[]).find(
  (candidate) => candidate.id === 'SC-glowhaus-no-show',
) as SimulatorScenario;

let database: BloomlabDatabase;

beforeEach(() => {
  database = freshDatabase();
});

afterEach(async () => {
  database.close();
});

describe('the authored scenario runs on the real engine', () => {
  it('is a scenario the engine can start', () => {
    expect(scenario).toBeDefined();
    expect(scenario.simulation_time).toBe('2026-09-03T09:00:00-05:00');
    expect(scenario.timezone).toBe('America/Chicago');
  });
});

describe('simulator → grading adapter', () => {
  /** A real run: the scheduled no-show fires, and a cancellation is injected before it. */
  const runScenario = async (): Promise<SimulatorState> => {
    const run = await startRun(scenario, database);
    let state = run.state;
    state = processEvent(state, {
      type: 'SMS_SENT',
      at: state.clock.now,
      payload: { contact_id: 'maria', body: 'You are booked.', purpose: 'confirmation' },
      origin: 'injected',
    });
    state = processEvent(state, {
      type: 'TAG_ADDED',
      at: state.clock.now,
      payload: { contact_id: 'maria', tag: 'booked' },
      origin: 'injected',
    });
    state = advanceTo(state, '2026-09-04T16:00:00-05:00');
    return state;
  };

  it('reads state assertions out of the simulated account', async () => {
    const state = await runScenario();
    const context = gradingContextFrom(state, { subjectContactId: 'maria' });
    const exercise: ExerciseDefinition = {
      id: 'EX-bridge-state',
      type: 'RUN_THE_LEAD',
      mode: 'practice',
      expected_outcomes: [
        {
          id: 's1',
          type: 'state',
          description: 'Maria carries the booked tag.',
          path: 'contacts.maria.tags',
          operator: 'contains',
          value: 'booked',
        },
        {
          id: 's2',
          type: 'state',
          description: 'Her appointment is marked no-show.',
          path: 'appointments.appt-maria.status',
          operator: 'equals',
          value: 'no_show',
        },
      ],
      critical_failures: [],
      grading: { mode: 'deterministic', pass_threshold: 70 },
    };
    const report = gradeExercise({ exercise, context });
    expect(report.outcome).toBe('passed');
    expect(report.counts.unevaluated).toBe(0);
  });

  it('reads event assertions out of the simulator event log', async () => {
    const state = await runScenario();
    const context = gradingContextFrom(state, { subjectContactId: 'maria' });
    const exercise: ExerciseDefinition = {
      id: 'EX-bridge-events',
      type: 'RUN_THE_LEAD',
      mode: 'practice',
      expected_outcomes: [
        {
          id: 'e1',
          type: 'event',
          description: 'One confirmation text goes out.',
          event: 'sms.sent',
          count: { exactly: 1 },
          where: { contact_id: 'maria' },
        },
        {
          id: 'e2',
          type: 'sequence',
          description: 'The text goes out before the tag is added.',
          before: 'sms.sent',
          after: 'tag.added',
        },
      ],
      critical_failures: [],
      grading: { mode: 'deterministic', pass_threshold: 70 },
    };
    const report = gradeExercise({ exercise, context });
    expect(report.outcome).toBe('passed');
    expect(report.tiers.required.every((row) => row.passed)).toBe(true);
  });

  it('measures timing against instants derived from the run, not the wall clock', async () => {
    const state = await runScenario();
    const references = gradingReferences(state, 'maria');
    // Maria's appointment starts at 15:00; the scenario marks the no-show at 15:35.
    expect(references['appointment.start']).toBe('2026-09-04T15:00:00-05:00');
    expect(references['appointment.appt-maria.start']).toBe('2026-09-04T15:00:00-05:00');

    const context = gradingContextFrom(state, { subjectContactId: 'maria' });
    const exercise: ExerciseDefinition = {
      id: 'EX-bridge-timing',
      type: 'EDGE_CASE',
      mode: 'practice',
      expected_outcomes: [
        {
          id: 't1',
          type: 'timing',
          description: 'The status change lands 35 minutes after the appointment starts.',
          event: 'appointment.status_changed',
          relative_to: 'appointment.start',
          offset_minutes: 35,
          tolerance_minutes: 5,
        },
      ],
      critical_failures: [],
      grading: { mode: 'deterministic', pass_threshold: 70 },
    };
    const report = gradeExercise({ exercise, context });
    expect(report.outcome).toBe('passed');
  });

  it('orders equal-timestamp events by the simulator’s own sequence', async () => {
    const state = await runScenario();
    const context = gradingContextFrom(state);
    const sameInstant = context.events.filter((row) => row.at === state.log[0]?.at);
    expect(sameInstant.length).toBeGreaterThan(1);
    expect(sameInstant.map((row) => row.index)).toEqual(
      [...sameInstant.map((row) => row.index)].sort((a, b) => a - b),
    );
  });

  it('never claims an architecture Phase 10 did not produce', async () => {
    const state = await runScenario();
    const context = gradingContextFrom(state, { subjectContactId: 'maria' });
    expect(context.architecture).toBeNull();
    expect(context.provides).not.toContain('architecture');

    const exercise: ExerciseDefinition = {
      id: 'EX-bridge-architecture',
      type: 'BUILD_IT',
      mode: 'practice',
      expected_outcomes: [
        {
          id: 'a1',
          type: 'architecture',
          description: 'The workflow triggers on appointment status.',
          requirement: 'trigger_exists',
          ghl_feature: 'GHL-WF-APPOINTMENT-STATUS',
        },
      ],
      critical_failures: [],
      grading: { mode: 'deterministic', pass_threshold: 70 },
    };
    const report = gradeExercise({ exercise, context });
    // Not judged, and therefore never a pass — the learner is not failed for a missing phase.
    expect(report.outcome).toBe('partial');
    expect(report.reason).toBe('unevaluated_assertions');
    expect(report.tiers.required[0]?.missing_source).toBe('architecture');
  });

  it('claims the learner source only when the runner supplied one', async () => {
    const state = await runScenario();
    expect(gradingContextFrom(state).provides).not.toContain('learner');
    const withLearner = gradingContextFrom(state, { learner: { prediction: { tag: 'booked' } } });
    expect(withLearner.provides).toContain('learner');
    expect((withLearner.state.prediction as { tag: string }).tag).toBe('booked');
  });
});

describe('persistence across a reload (DATA-002, SIM-013)', () => {
  it('brings back the run, its history, its clock and its queue', async () => {
    const started = await startRun(scenario, database);
    let state = started.state;
    state = processEvent(state, {
      type: 'TAG_ADDED',
      at: state.clock.now,
      payload: { contact_id: 'maria', tag: 'booked' },
      origin: 'injected',
    });
    state = advanceTo(state, '2026-09-03T12:00:00-05:00');
    state = schedule(state, {
      at: '2026-09-03T18:00:00-05:00',
      type: 'TAG_ADDED',
      payload: { contact_id: 'maria', tag: 'later' },
    });
    const saved = await commitRun({ ...started, state }, database);

    // A reload is a fresh read of the same database.
    const reloaded = await loadRun(state.run_id, database);
    expect(reloaded).not.toBeNull();
    expect(stateHash(reloaded?.state as SimulatorState)).toBe(stateHash(saved.state));
    expect(reloaded?.state.clock.now).toBe('2026-09-03T12:00:00-05:00');
    expect(reloaded?.state.log.map((row) => row.id)).toEqual(state.log.map((row) => row.id));
    expect(reloaded?.state.queue.map((row) => row.id)).toEqual(state.queue.map((row) => row.id));
    expect(reloaded?.state.random).toEqual(state.random);
  });

  it('does not fire an event twice merely because the page reloaded', async () => {
    const started = await startRun(scenario, database);
    // Run past the scenario's first scheduled event, then reload and carry on.
    const advanced = advanceTo(started.state, '2026-09-04T16:00:00-05:00');
    await commitRun({ ...started, state: advanced }, database);
    const reloaded = await loadRun(advanced.run_id, database);
    const resumed = advanceTo(reloaded?.state as SimulatorState, '2026-09-05T09:00:00-05:00');

    // The scenario queues two status changes — Maria's no-show and Jordan's arrival. Each fires
    // exactly once across the reload, and neither is replayed by resuming.
    const statusChanges = resumed.log.filter((row) => row.type === 'APPOINTMENT_STATUS_CHANGED');
    expect(statusChanges).toHaveLength(2);
    expect(statusChanges.filter((row) => row.payload.appointment_id === 'appt-maria')).toHaveLength(
      1,
    );
    expect(new Set(resumed.log.map((row) => row.id)).size).toBe(resumed.log.length);
    expect(resumed.queue).toHaveLength(0);
  });

  it('replays a reloaded run to the same state the live run reached', async () => {
    const started = await startRun(scenario, database);
    let state = started.state;
    state = injectAction(state, scenario, 'maria-cancels');
    state = nextEvent(state);
    await commitRun({ ...started, state }, database);

    const reloaded = await loadRun(state.run_id, database);
    const replayed = replay(scenario, (reloaded as { state: SimulatorState }).state.log, {
      run_id: state.run_id,
    });
    expect(historyHash(replayed)).toBe(historyHash(state));
  });

  it('persists a reset, so a reload lands at the start rather than back in the old run', async () => {
    const started = await startRun(scenario, database);
    const state = advanceTo(started.state, '2026-09-04T16:00:00-05:00');
    await commitRun({ ...started, state }, database);
    expect(state.log.length).toBeGreaterThan(0);

    const reset = await resetStoredRun(scenario, state.run_id, database);
    expect(reset.state.log).toEqual([]);

    const reloaded = await loadRun(state.run_id, database);
    expect(reloaded?.state.log).toEqual([]);
    expect(reloaded?.state.clock.now).toBe('2026-09-03T09:00:00-05:00');
    expect(reloaded?.state.queue).toHaveLength(2);
    expect(reloaded?.state.account.appointments['appt-maria']?.status).toBe('booked');
  });

  it('saves the same run twice without duplicating a single history row', async () => {
    const started = await startRun(scenario, database);
    const state = advanceTo(started.state, '2026-09-03T11:00:00-05:00');
    await commitRun({ ...started, state }, database);
    await commitRun({ ...started, state }, database);
    const rows = await database.sim_events.where('run_id').equals(state.run_id).toArray();
    expect(rows).toHaveLength(state.log.length);
  });

  it('records the engine version with the run (SIM-019)', async () => {
    const started = await startRun(scenario, database);
    const project = await database.sim_projects.get(started.state.run_id);
    expect(project?.simulator_version).toBe(started.state.version);
    expect(project?.simulator_version).toMatch(/^\d{4}\.\d{2}\.\d{2}-r\d+$/);
  });

  it('queues every simulator write for sync, through the existing outbox', async () => {
    const started = await startRun(scenario, database);
    const state = advanceTo(started.state, '2026-09-03T11:00:00-05:00');
    await commitRun({ ...started, state }, database);
    const queued = await database.sync_queue.toArray();
    const entities = new Set(queued.map((operation) => operation.entity));
    expect(entities.has('sim_projects')).toBe(true);
    expect(entities.has('sim_events')).toBe(true);
  });
});

describe('reset identity for append-only history (SIM-018, D-087)', () => {
  const tag = (state: SimulatorState, value: string) =>
    processEvent(state, {
      type: 'TAG_ADDED',
      at: state.clock.now,
      payload: { contact_id: 'maria', tag: value },
      origin: 'injected',
    });

  /** Everything the run has ever written, in whatever generation, tombstoned or not. */
  const allHistory = async (runId: string) => ({
    events: await database.sim_events.where('run_id').equals(runId).toArray(),
    snapshots: await database.sim_snapshots.where('run_id').equals(runId).toArray(),
  });

  /** A run with a history, a checkpoint and everything persisted: steps 1–4. */
  async function runWithHistory() {
    const started = await startRun(scenario, database);
    let state = started.state;
    for (const value of ['booked', 'reminded', 'called']) state = tag(state, value);
    state = advanceTo(state, '2026-09-04T16:00:00-05:00');
    const saved = await markCheckpoint({ ...started, state }, 'before the reset', database);
    return saved;
  }

  it('never reuses an append id, and leaves the old history exactly as it was', async () => {
    const before = await runWithHistory();
    const runId = before.state.run_id;
    expect(before.state.log.length).toBeGreaterThan(3);
    expect(before.checkpoints).toHaveLength(1);

    const old = await allHistory(runId);
    expect(old.events).toHaveLength(before.state.log.length);
    expect(old.snapshots).toHaveLength(1);
    const oldIds = new Set([...old.events, ...old.snapshots].map((row) => row.id));
    // A byte-for-byte record of the old rows, to prove nothing mutated them later.
    const oldRows = [...old.events, ...old.snapshots].map((row) => JSON.stringify(row)).sort();

    // 5. Reset lands on the authored beginning under a new generation.
    const reset = await resetStoredRun(scenario, runId, database);
    expect(reset.state.log).toEqual([]);
    expect(reset.state.run_id).toBe(runId);
    expect(reset.generation).not.toBe(before.generation);
    expect(reset.state.clock.now).toBe(scenario.simulation_time);
    expect(reset.state.account.appointments['appt-maria']?.status).toBe('booked');

    // 6–8. New activity, a new checkpoint, persisted.
    let state = tag(reset.state, 'after-the-reset');
    state = advanceTo(state, '2026-09-04T16:00:00-05:00');
    const after = await markCheckpoint({ ...reset, state }, 'after the reset', database);

    // 9–11. A reload reproduces the *new* run, its log and its checkpoint.
    const reloaded = await loadRun(runId, database);
    expect(reloaded).not.toBeNull();
    expect(reloaded?.generation).toBe(after.generation);
    expect(reloaded?.state.log.map((row) => row.id)).toEqual(state.log.map((row) => row.id));
    expect(stateHash(reloaded?.state as SimulatorState)).toBe(stateHash(after.state));
    expect(reloaded?.checkpoints).toHaveLength(1);
    expect(reloaded?.checkpoints[0]?.label).toBe('after the reset');
    expect(reloaded?.state.log.some((row) => row.type === 'TAG_ADDED')).toBe(true);

    // 12. Not one id from the first life was reused, and not one of its rows was touched.
    const now = await allHistory(runId);
    const fresh = [...now.events, ...now.snapshots].filter(
      (row) => row.generation === after.generation,
    );
    expect(fresh.length).toBeGreaterThan(0);
    expect(fresh.filter((row) => oldIds.has(row.id))).toEqual([]);
    const survivors = [...now.events, ...now.snapshots].filter((row) => oldIds.has(row.id));
    expect(survivors.map((row) => JSON.stringify(row)).sort()).toEqual(oldRows);
    expect(survivors.every((row) => row.deleted_at === null)).toBe(true);
    expect(survivors.every((row) => row.revision === 1)).toBe(true);

    // 13. The new rows are in the outbox as appends, waiting for sync.
    const queued = await database.sync_queue.toArray();
    for (const row of fresh) {
      expect(
        queued.some(
          (operation) =>
            operation.entity_id === row.id &&
            operation.op === 'upsert' &&
            (operation.entity === 'sim_events' || operation.entity === 'sim_snapshots'),
        ),
      ).toBe(true);
    }

    // 14. Saving again writes no history row and queues no further append.
    const appendsBefore = queued.filter((operation) => operation.entity !== 'sim_projects').length;
    await saveRun(after, database);
    const settled = await allHistory(runId);
    expect(settled.events).toHaveLength(now.events.length);
    expect(settled.snapshots).toHaveLength(now.snapshots.length);
    const appendsAfter = (await database.sync_queue.toArray()).filter(
      (operation) => operation.entity !== 'sim_projects',
    ).length;
    expect(appendsAfter).toBe(appendsBefore);

    // 15. The post-reset log replays to the post-reset run, and to nothing else.
    const replayed = replay(scenario, (reloaded as StoredRun).state.log, { run_id: runId });
    expect(historyHash(replayed)).toBe(historyHash(state));
    expect(historyHash(replayed)).not.toBe(historyHash(before.state));
  });

  it('mints fresh ids even where an earlier build tombstoned the first life', async () => {
    // The shipped build soft-deleted the history on reset. Those tombstones are facts too: a
    // reset must step over them, never ask for their ids back.
    const before = await runWithHistory();
    const runId = before.state.run_id;
    const eventStore = createSyncableStore<SimEventRecord>('sim_events', database);
    const snapshotStore = createSyncableStore<SimSnapshotRecord>('sim_snapshots', database);
    for (const row of (await allHistory(runId)).events) await eventStore.remove(row.id);
    for (const row of (await allHistory(runId)).snapshots) await snapshotStore.remove(row.id);
    const tombstones = await allHistory(runId);
    expect(tombstones.events.every((row) => row.deleted_at !== null)).toBe(true);
    const tombstoned = new Set([...tombstones.events, ...tombstones.snapshots].map((r) => r.id));

    const reset = await resetStoredRun(scenario, runId, database);
    let state = tag(reset.state, 'after-the-reset');
    state = advanceTo(state, '2026-09-04T16:00:00-05:00');
    const after = await markCheckpoint({ ...reset, state }, 'after the reset', database);

    const now = await allHistory(runId);
    const fresh = [...now.events, ...now.snapshots].filter(
      (row) => row.generation === after.generation,
    );
    expect(fresh.length).toBe(state.log.length + 1);
    expect(fresh.filter((row) => tombstoned.has(row.id))).toEqual([]);
    expect(fresh.every((row) => row.deleted_at === null)).toBe(true);

    // The tombstones stay tombstones, and the reload ignores both them and their generation.
    const reloaded = await loadRun(runId, database);
    expect(reloaded?.state.log.map((row) => row.id)).toEqual(state.log.map((row) => row.id));
    expect(reloaded?.checkpoints).toHaveLength(1);
  });

  it('resets in place: one run in the list, not two', async () => {
    const before = await runWithHistory();
    await resetStoredRun(scenario, before.state.run_id, database);
    const runs = await listRuns(database);
    expect(runs.filter((row) => row.scenario_id === scenario.id)).toHaveLength(1);
    expect(runs[0]?.run_id).toBe(before.state.run_id);
    expect(runs[0]?.log_length).toBe(0);
  });

  it('reads a run saved before generations existed, and resets it forward', async () => {
    // Rows the shipped build wrote carry no generation and the older three-segment id.
    const started = await startRun(scenario, database);
    const runId = started.state.run_id;
    const state = advanceTo(started.state, '2026-09-04T16:00:00-05:00');
    await commitRun({ ...started, state }, database);
    for (const row of (await allHistory(runId)).events) {
      await database.sim_events.delete(row.id);
      await database.sim_events.add({
        ...row,
        id: `se:${runId}:${row.sequence}`,
        generation: undefined as unknown as string,
      });
    }
    await database.sim_projects.update(runId, { generation: undefined });

    const legacy = await loadRun(runId, database);
    expect(legacy?.generation).toBe('0');
    expect(legacy?.state.log.map((row) => row.id)).toEqual(state.log.map((row) => row.id));

    const reset = await resetStoredRun(scenario, runId, database);
    expect(reset.generation).not.toBe('0');
    const next = tag(reset.state, 'after-the-reset');
    await commitRun({ ...reset, state: next }, database);
    const reloaded = await loadRun(runId, database);
    expect(reloaded?.state.log.map((row) => row.id)).toEqual(next.log.map((row) => row.id));
  });
});

describe('a reset across two devices (SYNC-008, D-087)', () => {
  it('gives the second device the new life and leaves the first one on the server', async () => {
    const server = new FakeSyncServer();
    const a = freshDatabase();
    const b = freshDatabase();
    try {
      const key = createSyncKey();
      await linkThisDevice(key.display, a, server);
      await linkThisDevice(key.canonical, b, server);

      // Device A runs, and device B picks the run up.
      const started = await startRun(scenario, a);
      const runId = started.state.run_id;
      const first = advanceTo(started.state, '2026-09-04T16:00:00-05:00');
      await commitRun({ ...started, state: first }, a);
      await syncNow(a, server);
      await syncNow(b, server);
      const onB = await loadRun(runId, b);
      expect(onB?.state.log.map((row) => row.id)).toEqual(first.log.map((row) => row.id));

      const firstIds = (await a.sim_events.where('run_id').equals(runId).toArray()).map(
        (row) => row.id,
      );
      expect(firstIds.length).toBeGreaterThan(0);

      // A resets and runs again.
      const reset = await resetStoredRun(scenario, runId, a);
      const second = advanceTo(reset.state, '2026-09-04T16:00:00-05:00');
      await commitRun({ ...reset, state: second }, a);
      await syncNow(a, server);

      // Every append row A wrote after the reset was accepted — none was mistaken for a row the
      // server already held, which is what an id collision with the first life would have caused.
      const held = [...server.records.values()].flatMap((byId) => [...byId.entries()]);
      const events = held.filter(([slug]) => slug.startsWith('sim_events:'));
      expect(events).toHaveLength(firstIds.length + second.log.length);
      for (const id of firstIds) {
        const row = events.find(([slug]) => slug === `sim_events:${id}`)?.[1];
        // The first life is still on the server exactly as written: never deleted, never rewritten.
        expect(row).toBeDefined();
        expect(row?.deleted_at).toBeNull();
        expect(row?.revision).toBe(1);
      }

      // B pulls and lands in the new life, with the old one inert rather than mixed in.
      await syncNow(b, server);
      const afterReset = await loadRun(runId, b);
      expect(afterReset?.generation).toBe(reset.generation);
      expect(afterReset?.state.log.map((row) => row.id)).toEqual(second.log.map((row) => row.id));
      expect(stateHash(afterReset?.state as SimulatorState)).toBe(stateHash(second));
      expect(await b.sim_events.where('run_id').equals(runId).count()).toBe(
        firstIds.length + second.log.length,
      );
      expect(await listRuns(b)).toHaveLength(1);
    } finally {
      a.close();
      b.close();
    }
  });
});
