import { describe, expect, it } from 'vitest';

import {
  CHECKPOINT_EVERY,
  SimulatorError,
  advance,
  advanceTo,
  assertCheckpoint,
  checkpoint,
  createRandomState,
  createRun,
  historyHash,
  injectAction,
  isAtInitialState,
  maybeCheckpoint,
  nearestCheckpoint,
  nextEvent,
  nextInt,
  nextRandom,
  processEvent,
  replay,
  replayMatches,
  resetRun,
  rootEvents,
  schedule,
  stateHash,
  type Checkpoint,
  type SimulatorState,
} from '../src/index.ts';
import { NOW, event, scenario } from './fixtures.ts';

/** Seeded randomness, snapshots, replay and reset (SIM-012, SIM-013, SIM-018). */

/** A run that exercises several domains, so the history under test is not trivial. */
function busyRun(seed = 4021): SimulatorState {
  let state = createRun({ ...scenario(), seed });
  state = processEvent(
    state,
    event('FORM_SUBMITTED', NOW, {
      form_id: 'consult-request',
      contact_id: 'nina',
      values: { first_name: 'Nina', phone: '+15125550123', treatment_interest: 'Membership' },
    }),
  );
  state = advance(state, 'hour');
  state = injectAction(state, scenario(), 'jordan-books-late');
  state = processEvent(
    state,
    event('SMS_SENT', state.clock.now, { contact_id: 'maria', body: 'You are booked.' }),
  );
  state = nextEvent(state);
  return state;
}

describe('seeded randomness (SIM-012)', () => {
  it('gives the same sequence for the same seed', () => {
    const a = createRandomState(4021);
    const b = createRandomState(4021);
    const drawsA = [0, 1, 2, 3].reduce<{ values: number[]; state: typeof a }>(
      (carry) => {
        const drawn = nextRandom(carry.state);
        return { values: [...carry.values, drawn.value], state: drawn.state };
      },
      { values: [], state: a },
    );
    const drawsB = [0, 1, 2, 3].reduce<{ values: number[]; state: typeof b }>(
      (carry) => {
        const drawn = nextRandom(carry.state);
        return { values: [...carry.values, drawn.value], state: drawn.state };
      },
      { values: [], state: b },
    );
    expect(drawsA.values).toEqual(drawsB.values);
    expect(drawsA.values.every((value) => value >= 0 && value < 1)).toBe(true);
  });

  it('gives a different sequence for a different seed', () => {
    expect(nextRandom(createRandomState(1)).value).not.toBe(nextRandom(createRandomState(2)).value);
  });

  it('keeps its position so a snapshot resumes rather than restarts', () => {
    let state = createRandomState(99);
    const straight: number[] = [];
    for (let index = 0; index < 6; index += 1) {
      const drawn = nextRandom(state);
      straight.push(drawn.value);
      state = drawn.state;
    }

    // Take the generator's word and draws after three, put them away, and carry on from there.
    let split = createRandomState(99);
    const resumed: number[] = [];
    for (let index = 0; index < 3; index += 1) {
      const drawn = nextRandom(split);
      resumed.push(drawn.value);
      split = drawn.state;
    }
    const stored = JSON.parse(JSON.stringify(split)) as typeof split;
    let restored = stored;
    for (let index = 0; index < 3; index += 1) {
      const drawn = nextRandom(restored);
      resumed.push(drawn.value);
      restored = drawn.state;
    }
    expect(resumed).toEqual(straight);
    expect(restored.draws).toBe(6);
  });

  it('draws integers inside the range it was given', () => {
    let state = createRandomState(7);
    for (let index = 0; index < 50; index += 1) {
      const drawn = nextInt(state, 1, 6);
      expect(drawn.value).toBeGreaterThanOrEqual(1);
      expect(drawn.value).toBeLessThanOrEqual(6);
      state = drawn.state;
    }
  });

  it('refuses a seed that is not a 32-bit unsigned integer', () => {
    expect(() => createRandomState(-1)).toThrow(SimulatorError);
    expect(() => createRandomState(1.5)).toThrow(SimulatorError);
  });

  it('leaves the generator untouched when a run draws nothing', () => {
    const state = busyRun();
    expect(state.random.draws).toBe(0);
    expect(state.random.seed).toBe(4021);
  });
});

describe('snapshots (SIM-013)', () => {
  it('does not checkpoint after every event', () => {
    let checkpoints: Checkpoint[] = [];
    let state = createRun({ ...scenario(), scheduled_events: [] });
    for (let index = 0; index < CHECKPOINT_EVERY - 1; index += 1) {
      state = processEvent(
        state,
        event('TAG_ADDED', NOW, { contact_id: 'maria', tag: `t${index}` }),
      );
      checkpoints = maybeCheckpoint(checkpoints, state);
    }
    expect(checkpoints).toHaveLength(0);
  });

  it('checkpoints once the policy interval has passed', () => {
    let checkpoints: Checkpoint[] = [];
    let state = createRun({ ...scenario(), scheduled_events: [] });
    for (let index = 0; index < CHECKPOINT_EVERY * 2; index += 1) {
      state = processEvent(
        state,
        event('TAG_ADDED', NOW, { contact_id: 'maria', tag: `t${index}` }),
      );
      checkpoints = maybeCheckpoint(checkpoints, state);
    }
    expect(checkpoints).toHaveLength(2);
    expect(checkpoints[0]?.log_length).toBe(CHECKPOINT_EVERY);
  });

  it('restores exactly what it stored, queue and all', () => {
    const state = busyRun();
    const saved = checkpoint(state, 'before the no-show');
    const restored = JSON.parse(JSON.stringify(saved)) as Checkpoint;
    expect(stateHash(restored.state)).toBe(stateHash(state));
    expect(restored.state.queue).toEqual(state.queue);
  });

  it('finds the nearest checkpoint at or before an index', () => {
    const state = busyRun();
    const early = { ...checkpoint(state), log_length: 2 };
    const late = { ...checkpoint(state), log_length: 9 };
    expect(nearestCheckpoint([early, late], 5)?.log_length).toBe(2);
    expect(nearestCheckpoint([early, late], 9)?.log_length).toBe(9);
    expect(nearestCheckpoint([early, late], 1)).toBeNull();
  });

  it('refuses a checkpoint from another run', () => {
    const saved = checkpoint(busyRun());
    expect(() => assertCheckpoint(saved, 'run-somewhere-else')).toThrow(SimulatorError);
  });

  it('refuses a checkpoint whose state has been tampered with', () => {
    const state = busyRun();
    const saved = checkpoint(state);
    const tampered: Checkpoint = {
      ...saved,
      state: { ...saved.state, clock: { ...saved.state.clock, now: '2030-01-01T00:00:00-05:00' } },
    };
    expect(() => assertCheckpoint(tampered, state.run_id)).toThrow(SimulatorError);
  });
});

describe('replay (SIM-013, SIM-018)', () => {
  it('reconstructs the same run from the scenario and the event log', () => {
    const live = busyRun();
    const replayed = replay(scenario(), live.log, { run_id: live.run_id });
    expect(replayMatches(live, replayed)).toBe(true);
    expect(replayed.account).toEqual(live.account);
  });

  it('replays only root events and regenerates the rest, so nothing is duplicated', () => {
    const live = busyRun();
    const generated = live.log.filter((row) => row.origin === 'generated');
    expect(generated.length).toBeGreaterThan(0);
    expect(rootEvents(live.log).length).toBeLessThan(live.log.length);

    const replayed = replay(scenario(), live.log, { run_id: live.run_id });
    expect(replayed.log).toHaveLength(live.log.length);
    expect(new Set(replayed.log.map((row) => row.id)).size).toBe(replayed.log.length);
    expect(replayed.log.map((row) => row.id)).toEqual(live.log.map((row) => row.id));
  });

  it('never appends to the run it is reproducing', () => {
    const live = busyRun();
    const before = stateHash(live);
    replay(scenario(), live.log, { run_id: live.run_id });
    expect(stateHash(live)).toBe(before);
  });

  it('replays to an earlier index', () => {
    const live = busyRun();
    const partial = replay(scenario(), live.log, { to: 3, run_id: live.run_id });
    expect(partial.log).toHaveLength(3);
    expect(partial.log.map((row) => row.id)).toEqual(live.log.slice(0, 3).map((row) => row.id));
  });

  it('replays from a checkpoint to the same place as a full replay', () => {
    const live = busyRun();
    const mid = replay(scenario(), live.log, { to: 4, run_id: live.run_id });
    const saved = checkpoint(mid);
    const full = replay(scenario(), live.log, { run_id: live.run_id });
    const fromCheckpoint = replay(scenario(), live.log, {
      run_id: live.run_id,
      checkpoints: [saved],
    });
    expect(historyHash(fromCheckpoint)).toBe(historyHash(full));
  });

  it('keeps a seeded outcome stable across a replay', () => {
    const live = busyRun(12345);
    const replayed = replay({ ...scenario(), seed: 12345 }, live.log, { run_id: live.run_id });
    expect(replayed.random).toEqual(live.random);
    expect(historyHash(replayed)).toBe(historyHash(live));
  });

  it('reports a replay it cannot reproduce rather than inventing one', () => {
    const live = busyRun();
    // A scenario missing the form the log submits cannot reproduce that history.
    const broken = { ...scenario() };
    broken.initial_account_state = { ...broken.initial_account_state, forms: [] };
    try {
      replay(broken, live.log, { run_id: live.run_id });
      throw new Error('Expected replay to refuse');
    } catch (caught) {
      expect((caught as SimulatorError).code).toBe('REPLAY_FAILED');
    }
  });
});

describe('reset (SIM-018)', () => {
  it('restores the authored initial state exactly', () => {
    const live = busyRun();
    const fresh = resetRun(scenario(), live.run_id);
    expect(stateHash(fresh)).toBe(stateHash(createRun(scenario())));
    expect(isAtInitialState(fresh)).toBe(true);
  });

  it('clears the history, the execution records and the generated state', () => {
    const fresh = resetRun(scenario(), busyRun().run_id);
    expect(fresh.log).toEqual([]);
    expect(fresh.execution).toEqual([]);
    expect(fresh.account.contacts.nina).toBeUndefined();
    expect(fresh.account.appointments['appt-jordan']).toBeUndefined();
    expect(fresh.account.conversations).toEqual({});
  });

  it('restores the authored queue and the seed at position zero', () => {
    const fresh = resetRun(scenario(), 'run-x');
    expect(fresh.queue).toHaveLength(2);
    expect(fresh.random).toEqual({ seed: 4021, word: 4021, draws: 0 });
    expect(fresh.clock.now).toBe(NOW);
  });

  it('leaves the content object untouched', () => {
    const authored = scenario();
    const before = JSON.stringify(authored);
    const state = advanceTo(
      schedule(createRun(authored), {
        at: '2026-09-03T09:30:00-05:00',
        type: 'TAG_ADDED',
        payload: { contact_id: 'maria', tag: 'x' },
      }),
      '2026-09-03T11:00:00-05:00',
    );
    resetRun(authored, state.run_id);
    expect(JSON.stringify(authored)).toBe(before);
  });
});
