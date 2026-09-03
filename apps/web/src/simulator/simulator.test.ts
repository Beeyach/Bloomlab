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
import { freshDatabase } from '../data/testing';
import { gradingContextFrom, gradingReferences } from './grading';
import { commitRun, loadRun, resetStoredRun, startRun } from './store';

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
