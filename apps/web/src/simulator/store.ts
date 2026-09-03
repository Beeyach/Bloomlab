import {
  SIMULATOR_VERSION,
  checkpoint as makeCheckpoint,
  createRun,
  maybeCheckpoint,
  resetRun,
  type Checkpoint,
  type ScheduledEvent,
  type SimulatorEvent,
  type SimulatorScenario,
  type SimulatorState,
} from '@bloomlab/simulator-core';

import { db, type BloomlabDatabase } from '../data/db';
import { randomId } from '../data/envelope';
import { createSyncableStore } from '../data/stores';
import type { SimEventRecord, SimProjectRecord, SimSnapshotRecord } from '../data/types';

/**
 * Persistence for simulator runs (SIM-013, DATA-001).
 *
 * The engine knows nothing about storage; this adapter is the only place that does. It writes
 * through the same syncable store every other local-first entity uses, so a run reaches the
 * outbox, the Worker and D1 by the existing path rather than a second one built beside it.
 *
 * A run is stored the way the spec describes it: the authored scenario, an append-only event log,
 * and periodic checkpoints — plus a header row holding the account, the clock, the queue and the
 * generator's position, which is what makes a reload resume rather than replay from the start.
 *
 * The queue is saved with the header and the log is saved as processed events, so a reload
 * restores exactly what had *not* happened yet. Nothing fires twice because the page reloaded.
 */

/** Deterministic within a run, so saving the same log twice writes the same rows. */
const eventRowId = (runId: string, sequence: number) => `se:${runId}:${sequence}`;
const snapshotRowId = (runId: string, logLength: number) => `ss:${runId}:${logLength}`;

/**
 * A new run's identity. The engine forbids randomness, so the app mints this: a run is a session
 * a learner started, and two devices that each start one have genuinely started two, which the
 * append merge then keeps side by side instead of overwriting one with the other.
 */
export const newRunId = () => `sr-${randomId()}`;

export interface StoredRun {
  state: SimulatorState;
  checkpoints: Checkpoint[];
}

/** Saves whatever is new: the header every time, events and checkpoints only once each. */
export async function saveRun(
  state: SimulatorState,
  checkpoints: readonly Checkpoint[],
  database: BloomlabDatabase = db,
): Promise<void> {
  const projectStore = createSyncableStore<SimProjectRecord>('sim_projects', database);
  const eventStore = createSyncableStore<SimEventRecord>('sim_events', database);
  const snapshotStore = createSyncableStore<SimSnapshotRecord>('sim_snapshots', database);

  const header = {
    scenario_id: state.scenario_id,
    run_id: state.run_id,
    simulator_version: state.version,
    clock_now: state.clock.now,
    timezone: state.clock.timezone,
    account: state.account,
    queue: state.queue,
    random: state.random,
    sequence: state.sequence,
    queue_sequence: state.queue_sequence,
    log_length: state.log.length,
    execution: state.execution,
    diagnostics: state.diagnostics,
  };
  const existing = await projectStore.get(state.run_id);
  if (existing) await projectStore.patch(state.run_id, header);
  else await projectStore.create(header, state.run_id);

  const savedEvents = await database.sim_events.where('run_id').equals(state.run_id).primaryKeys();
  const known = new Set(savedEvents as string[]);
  for (const event of state.log) {
    const id = eventRowId(state.run_id, event.sequence);
    if (known.has(id)) continue;
    await eventStore.create({ run_id: state.run_id, sequence: event.sequence, event }, id);
  }

  const savedSnapshots = new Set(
    (await database.sim_snapshots.where('run_id').equals(state.run_id).primaryKeys()) as string[],
  );
  for (const point of checkpoints) {
    const id = snapshotRowId(state.run_id, point.log_length);
    if (savedSnapshots.has(id)) continue;
    await snapshotStore.create(
      { run_id: state.run_id, log_length: point.log_length, label: point.label, checkpoint: point },
      id,
    );
  }
}

/** Rebuilds a saved run exactly as it stood, without re-running a single event. */
export async function loadRun(
  runId: string,
  database: BloomlabDatabase = db,
): Promise<StoredRun | null> {
  const project = await createSyncableStore<SimProjectRecord>('sim_projects', database).get(runId);
  if (!project || project.deleted_at !== null) return null;

  const rows = await database.sim_events.where('run_id').equals(runId).toArray();
  const log = rows
    .filter((row) => row.deleted_at === null)
    .map((row) => row.event as SimulatorEvent)
    .sort((a, b) => a.sequence - b.sequence);

  const points = await database.sim_snapshots.where('run_id').equals(runId).toArray();

  return {
    state: {
      version: project.simulator_version,
      run_id: project.run_id,
      scenario_id: project.scenario_id,
      clock: { now: project.clock_now, timezone: project.timezone },
      account: project.account as SimulatorState['account'],
      queue: project.queue as ScheduledEvent[],
      log,
      execution: project.execution as SimulatorState['execution'],
      random: project.random as SimulatorState['random'],
      sequence: project.sequence,
      queue_sequence: project.queue_sequence,
      diagnostics: project.diagnostics as SimulatorState['diagnostics'],
    },
    checkpoints: points
      .filter((row) => row.deleted_at === null)
      .map((row) => row.checkpoint as Checkpoint)
      .sort((a, b) => a.log_length - b.log_length),
  };
}

/** Every saved run, newest first, for the harness's run list. */
export async function listRuns(database: BloomlabDatabase = db): Promise<SimProjectRecord[]> {
  return createSyncableStore<SimProjectRecord>('sim_projects', database).list();
}

/** Starts a run and saves it, so a reload finds it even before anything has happened. */
export async function startRun(
  scenario: SimulatorScenario,
  database: BloomlabDatabase = db,
  runId: string = newRunId(),
): Promise<StoredRun> {
  const state = createRun(scenario, { run_id: runId });
  const stored: StoredRun = { state, checkpoints: [] };
  await saveRun(state, [], database);
  return stored;
}

/**
 * Advances a saved run: whatever the caller did to the state is persisted, and a checkpoint is
 * taken if the policy calls for one.
 */
export async function commitRun(
  run: StoredRun,
  database: BloomlabDatabase = db,
): Promise<StoredRun> {
  const checkpoints = maybeCheckpoint(run.checkpoints, run.state);
  await saveRun(run.state, checkpoints, database);
  return { state: run.state, checkpoints };
}

/**
 * Resets a run to the scenario's authored beginning and persists that. The history rows are
 * soft-deleted rather than erased, because they are append-only records that other devices may
 * already hold; the reset run starts a clean log from sequence zero.
 */
export async function resetStoredRun(
  scenario: SimulatorScenario,
  runId: string,
  database: BloomlabDatabase = db,
): Promise<StoredRun> {
  const eventStore = createSyncableStore<SimEventRecord>('sim_events', database);
  const snapshotStore = createSyncableStore<SimSnapshotRecord>('sim_snapshots', database);
  const existingEvents = await database.sim_events.where('run_id').equals(runId).toArray();
  for (const row of existingEvents) {
    if (row.deleted_at === null) await eventStore.remove(row.id);
  }
  const existingSnapshots = await database.sim_snapshots.where('run_id').equals(runId).toArray();
  for (const row of existingSnapshots) {
    if (row.deleted_at === null) await snapshotStore.remove(row.id);
  }
  const state = resetRun(scenario, runId);
  await saveRun(state, [], database);
  return { state, checkpoints: [] };
}

/** Takes a checkpoint the learner asked for, rather than one the policy produced. */
export async function markCheckpoint(
  run: StoredRun,
  label: string,
  database: BloomlabDatabase = db,
): Promise<StoredRun> {
  const checkpoints = [...run.checkpoints, makeCheckpoint(run.state, label)];
  await saveRun(run.state, checkpoints, database);
  return { state: run.state, checkpoints };
}

/** The engine a saved run was produced by, for the harness and for evidence (SIM-019). */
export const runSimulatorVersion = (run: StoredRun): string =>
  run.state.version || SIMULATOR_VERSION;
