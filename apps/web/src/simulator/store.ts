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
 * Persistence for simulator runs (SIM-013, SIM-018, DATA-001).
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
 *
 * ## Reset identity (D-087)
 *
 * `sim_events` and `sim_snapshots` are `append` entities: a row is written once, is addressed by
 * its id, and is never rewritten — two devices' rows merge to the union, and the server answers
 * `superseded` for an id it already holds. A reset returns the run to the scenario's beginning
 * and the engine's sequence to zero, so without a further rule the run's second life would ask
 * for the same ids its first life already used, and those rows would be dropped as duplicates of
 * facts that are no longer true.
 *
 * So a run carries a **generation**: a token this module mints when the run starts and mints
 * again, freshly random, at every reset. It is part of every append id — `se:<run>:<gen>:<seq>`
 * and `ss:<run>:<gen>:<log length>` — and it is a column on every append row, so a generation's
 * history is exactly the rows carrying its token. Because a generation token is never reused, a
 * reset can never mint an id an earlier generation already used.
 *
 * Reset therefore touches no history row at all. The old events and checkpoints stay exactly as
 * written: immutable facts that other devices may already hold, and that any device can still
 * replay. What changes is the run's header (`sim_projects`, a `snapshot` entity, one row per run,
 * patched and never recreated), which names the generation that is current. A load reads that
 * generation and takes only the rows carrying it, so the old lives are inert rather than erased.
 */

/**
 * A reset generation. Minted when a run starts and again at every reset, and never reused, which
 * is what keeps two lives of one run from competing for a single append-only id.
 */
export const newGeneration = () => `g-${randomId()}`;

/**
 * Rows written before generations existed carry none, and read as the run's first generation, so
 * a run saved by the earlier build still loads and still resumes. Nothing new is ever written
 * without a generation.
 */
const FIRST_GENERATION = '0';

const generationOf = (row: { generation?: string }): string => row.generation ?? FIRST_GENERATION;

/** Deterministic within a generation, so saving the same log twice writes the same rows. */
const eventRowId = (runId: string, generation: string, sequence: number) =>
  `se:${runId}:${generation}:${sequence}`;
const snapshotRowId = (runId: string, generation: string, logLength: number) =>
  `ss:${runId}:${generation}:${logLength}`;

/**
 * A new run's identity. The engine forbids randomness, so the app mints this: a run is a session
 * a learner started, and two devices that each start one have genuinely started two, which the
 * append merge then keeps side by side instead of overwriting one with the other.
 */
export const newRunId = () => `sr-${randomId()}`;

export interface StoredRun {
  state: SimulatorState;
  checkpoints: Checkpoint[];
  /** Which life of this run the history rows belong to (D-087). */
  generation: string;
}

/** The live rows of one generation: what the run's current life has actually written. */
async function historyOf(runId: string, generation: string, database: BloomlabDatabase) {
  const [events, snapshots] = await Promise.all([
    database.sim_events.where('run_id').equals(runId).toArray(),
    database.sim_snapshots.where('run_id').equals(runId).toArray(),
  ]);
  const mine = <T extends { generation?: string; deleted_at: string | null }>(rows: T[]) =>
    rows.filter((row) => generationOf(row) === generation && row.deleted_at === null);
  return { events: mine(events), snapshots: mine(snapshots) };
}

/** Saves whatever is new: the header every time, events and checkpoints only once each. */
export async function saveRun(run: StoredRun, database: BloomlabDatabase = db): Promise<void> {
  const { state, checkpoints, generation } = run;
  const projectStore = createSyncableStore<SimProjectRecord>('sim_projects', database);
  const eventStore = createSyncableStore<SimEventRecord>('sim_events', database);
  const snapshotStore = createSyncableStore<SimSnapshotRecord>('sim_snapshots', database);

  const header = {
    scenario_id: state.scenario_id,
    run_id: state.run_id,
    generation,
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

  // What this generation has already written, by position rather than by primary key: a row from
  // an earlier generation is a different fact with a different id and must not stand in for one
  // this generation still owes.
  const saved = await historyOf(state.run_id, generation, database);
  const savedEvents = new Set(saved.events.map((row) => row.sequence));
  for (const event of state.log) {
    if (savedEvents.has(event.sequence)) continue;
    await eventStore.create(
      { run_id: state.run_id, generation, sequence: event.sequence, event },
      eventRowId(state.run_id, generation, event.sequence),
    );
  }

  const savedSnapshots = new Set(saved.snapshots.map((row) => row.log_length));
  for (const point of checkpoints) {
    if (savedSnapshots.has(point.log_length)) continue;
    await snapshotStore.create(
      {
        run_id: state.run_id,
        generation,
        log_length: point.log_length,
        label: point.label,
        checkpoint: point,
      },
      snapshotRowId(state.run_id, generation, point.log_length),
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

  const generation = generationOf(project);
  const history = await historyOf(runId, generation, database);
  const log = history.events
    .map((row) => row.event as SimulatorEvent)
    .sort((a, b) => a.sequence - b.sequence);

  return {
    generation,
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
    checkpoints: history.snapshots
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
  const run: StoredRun = {
    state: createRun(scenario, { run_id: runId }),
    checkpoints: [],
    generation: newGeneration(),
  };
  await saveRun(run, database);
  return run;
}

/**
 * Advances a saved run: whatever the caller did to the state is persisted, and a checkpoint is
 * taken if the policy calls for one.
 */
export async function commitRun(
  run: StoredRun,
  database: BloomlabDatabase = db,
): Promise<StoredRun> {
  const next: StoredRun = { ...run, checkpoints: maybeCheckpoint(run.checkpoints, run.state) };
  await saveRun(next, database);
  return next;
}

/**
 * Resets a run to the scenario's authored beginning and persists that (SIM-018).
 *
 * The run keeps its identity — it is the same run the learner is sitting in front of, and the
 * header is patched rather than replaced, so no second run appears in the list. What it takes is
 * a new generation, and every row the reset run writes is addressed under that token. The old
 * generation's events and checkpoints are left exactly as they are: append-only history is a
 * record of what happened, and it did happen. Nothing is deleted, rewritten or resurrected.
 */
export async function resetStoredRun(
  scenario: SimulatorScenario,
  runId: string,
  database: BloomlabDatabase = db,
): Promise<StoredRun> {
  const run: StoredRun = {
    state: resetRun(scenario, runId),
    checkpoints: [],
    generation: newGeneration(),
  };
  await saveRun(run, database);
  return run;
}

/** Takes a checkpoint the learner asked for, rather than one the policy produced. */
export async function markCheckpoint(
  run: StoredRun,
  label: string,
  database: BloomlabDatabase = db,
): Promise<StoredRun> {
  const next: StoredRun = {
    ...run,
    checkpoints: [...run.checkpoints, makeCheckpoint(run.state, label)],
  };
  await saveRun(next, database);
  return next;
}

/** The engine a saved run was produced by, for the harness and for evidence (SIM-019). */
export const runSimulatorVersion = (run: StoredRun): string =>
  run.state.version || SIMULATOR_VERSION;
