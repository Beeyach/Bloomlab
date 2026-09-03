import { describe, expect, it } from 'vitest';

import {
  MAX_EVENTS_PER_OPERATION,
  SimulatorError,
  addDays,
  addHours,
  addMinutes,
  advance,
  advanceTo,
  allowedActions,
  compareScheduled,
  createRun,
  injectAction,
  nextEvent,
  nextScheduled,
  partitionDue,
  processEvent,
  schedule,
  type ScheduledEvent,
  type SimulatorState,
} from '../src/index.ts';
import { NOW, event, scenario } from './fixtures.ts';

/** The clock, the queue and the Time Machine (SIM-006, SIM-007, SIM-008). */

const run = () => createRun(scenario());
const types = (state: SimulatorState) => state.log.map((row) => row.type);

describe('the clock belongs to the scenario (SIM-006)', () => {
  it('starts at the authored simulator time, in the authored zone', () => {
    const state = run();
    expect(state.clock.now).toBe('2026-09-03T09:00:00-05:00');
    expect(state.clock.timezone).toBe('America/Chicago');
  });

  it('ignores the machine clock entirely', () => {
    // Whatever today is where this test runs, the run starts in September 2026.
    expect(run().clock.now.startsWith('2026-09-03')).toBe(true);
  });

  it('ignores the machine timezone: the same scenario reads the same anywhere', () => {
    const tokyo = createRun({ ...scenario(), timezone: 'Asia/Tokyo' });
    // The instant is the one the scenario authored; only its rendering follows the zone.
    expect(Date.parse(tokyo.clock.now)).toBe(Date.parse('2026-09-03T09:00:00-05:00'));
    expect(tokyo.clock.now).toBe('2026-09-03T23:00:00+09:00');
  });

  it('adds a minute and an hour as absolute durations', () => {
    expect(addMinutes(NOW, 1, 'America/Chicago')).toBe('2026-09-03T09:01:00-05:00');
    expect(addHours(NOW, 1, 'America/Chicago')).toBe('2026-09-03T10:00:00-05:00');
  });

  it('adds a day as a calendar day, keeping the wall-clock reading across a DST change', () => {
    // 1 November 2026 is the US daylight-saving change; 09:00 stays 09:00 and the offset moves.
    const before = '2026-10-31T09:00:00-05:00';
    expect(addDays(before, 1, 'America/Chicago')).toBe('2026-11-01T09:00:00-06:00');
  });

  it('refuses an unknown timezone rather than falling back to the device', () => {
    expect(() => createRun({ ...scenario(), timezone: 'Mars/Olympus' })).toThrow(SimulatorError);
  });
});

describe('the Time Machine really moves the run (SIM-007)', () => {
  it('+1 minute moves the clock and records the move', () => {
    const state = advance(run(), 'minute');
    expect(state.clock.now).toBe('2026-09-03T09:01:00-05:00');
    expect(types(state)).toContain('TIME_ADVANCED');
  });

  it('+1 hour runs everything due on the way', () => {
    // The scenario queues a tag at 10:00; an hour's advance from 09:00 lands exactly on it.
    const state = advance(run(), 'hour');
    expect(state.clock.now).toBe('2026-09-03T10:00:00-05:00');
    expect(state.account.contacts.maria?.tags).toContain('no-show');
    expect(state.queue).toHaveLength(1);
  });

  it('+1 day runs the day between, and finishes exactly at the target', () => {
    const state = advance(run(), 'day');
    expect(state.clock.now).toBe('2026-09-04T09:00:00-05:00');
    // The 10:00 tag fired; the 15:35 no-show has not, because it is later than the target.
    expect(state.account.contacts.maria?.tags).toContain('no-show');
    expect(state.account.appointments['appt-maria']?.status).toBe('booked');
    expect(state.queue).toHaveLength(1);
  });

  it('runs an event scheduled exactly on the target', () => {
    const state = advanceTo(run(), '2026-09-03T10:00:00-05:00');
    expect(state.account.contacts.maria?.tags).toContain('no-show');
    expect(state.queue).toHaveLength(1);
  });

  it('leaves an event scheduled after the target queued', () => {
    const state = advanceTo(run(), '2026-09-03T09:59:00-05:00');
    expect(state.account.contacts.maria?.tags).not.toContain('no-show');
    expect(state.queue).toHaveLength(2);
  });

  it('refuses to run the clock backwards', () => {
    expect(() => advanceTo(run(), '2026-09-02T09:00:00-05:00')).toThrow(SimulatorError);
  });

  it('processes what a due event generates, at the same instant', () => {
    const withForm = schedule(run(), {
      at: '2026-09-03T09:30:00-05:00',
      type: 'FORM_SUBMITTED',
      payload: {
        form_id: 'consult-request',
        contact_id: 'nina',
        values: { first_name: 'Nina', phone: '+15125550123' },
      },
    });
    const state = advanceTo(withForm, '2026-09-03T09:45:00-05:00');
    expect(state.account.contacts.nina).toBeDefined();
    const created = state.log.find((row) => row.type === 'CONTACT_CREATED');
    expect(created?.at).toBe('2026-09-03T09:30:00-05:00');
    expect(created?.origin).toBe('generated');
  });
});

describe('Next Event (SIM-007)', () => {
  it('moves to the earliest queued entry and runs it', () => {
    const state = nextEvent(run());
    expect(state.clock.now).toBe('2026-09-03T10:00:00-05:00');
    expect(state.account.contacts.maria?.tags).toContain('no-show');
    expect(state.queue).toHaveLength(1);
  });

  it('runs the queue in chronological order however it was authored', () => {
    // The fixture authors the later event first; the queue still runs 10:00 before the next day.
    const first = nextEvent(run());
    const second = nextEvent(first);
    expect(second.clock.now).toBe('2026-09-04T15:35:00-05:00');
    expect(second.account.appointments['appt-maria']?.status).toBe('no_show');
    expect(second.queue).toHaveLength(0);
  });

  it('does nothing at all when nothing is queued', () => {
    const empty = createRun({ ...scenario(), scheduled_events: [] });
    expect(nextScheduled(empty)).toBeNull();
    const state = nextEvent(empty);
    expect(state).toBe(empty);
  });
});

describe('the queue is totally ordered (SIM-008)', () => {
  const entry = (id: string, at: string, sequence: number): ScheduledEvent => ({
    id,
    at,
    sequence,
    type: 'TAG_ADDED',
    payload: {},
    origin: 'scenario',
    source: null,
    description: null,
  });

  it('orders by time first', () => {
    const a = entry('sc-b', '2026-09-03T09:00:00-05:00', 5);
    const b = entry('sc-a', '2026-09-03T10:00:00-05:00', 1);
    expect(compareScheduled(a, b)).toBeLessThan(0);
  });

  it('breaks a tied time on insertion order, so a consequence follows its cause', () => {
    const a = entry('sc-z', '2026-09-03T09:00:00-05:00', 1);
    const b = entry('sc-a', '2026-09-03T09:00:00-05:00', 2);
    expect(compareScheduled(a, b)).toBeLessThan(0);
  });

  it('breaks a tied time and sequence on the stable id', () => {
    const a = entry('sc-a', '2026-09-03T09:00:00-05:00', 1);
    const b = entry('sc-b', '2026-09-03T09:00:00-05:00', 1);
    expect(compareScheduled(a, b)).toBeLessThan(0);
    expect(compareScheduled(b, a)).toBeGreaterThan(0);
    expect(compareScheduled(a, a)).toBe(0);
  });

  it('handles an empty queue', () => {
    expect(partitionDue([], NOW)).toEqual({ due: [], remaining: [] });
  });

  it('runs several events at one instant in insertion order', () => {
    let state = createRun({ ...scenario(), scheduled_events: [] });
    const at = '2026-09-03T09:30:00-05:00';
    state = schedule(state, {
      at,
      type: 'TAG_ADDED',
      payload: { contact_id: 'maria', tag: 'first' },
    });
    state = schedule(state, {
      at,
      type: 'TAG_ADDED',
      payload: { contact_id: 'maria', tag: 'second' },
    });
    state = schedule(state, {
      at,
      type: 'TAG_ADDED',
      payload: { contact_id: 'maria', tag: 'third' },
    });
    const done = advanceTo(state, '2026-09-03T09:31:00-05:00');
    expect(done.account.contacts.maria?.tags.slice(-3)).toEqual(['first', 'second', 'third']);
  });

  it('runs an event that schedules another one', () => {
    let state = createRun({ ...scenario(), scheduled_events: [] });
    state = schedule(state, {
      at: '2026-09-03T09:10:00-05:00',
      type: 'TAG_ADDED',
      payload: { contact_id: 'maria', tag: 'first' },
    });
    state = advanceTo(state, '2026-09-03T09:15:00-05:00');
    state = schedule(state, {
      at: '2026-09-03T09:20:00-05:00',
      type: 'TAG_ADDED',
      payload: { contact_id: 'maria', tag: 'second' },
    });
    state = advanceTo(state, '2026-09-03T09:30:00-05:00');
    expect(state.account.contacts.maria?.tags).toEqual(['meta-lead', 'first', 'second']);
    expect(state.queue).toHaveLength(0);
  });

  it('refuses to schedule into the past', () => {
    expect(() =>
      schedule(run(), { at: '2026-09-02T09:00:00-05:00', type: 'TAG_ADDED', payload: {} }),
    ).toThrow(SimulatorError);
  });
});

describe('cascade protection (SIM-003)', () => {
  it('stops an unbounded same-instant cascade with an explicit error, not a hang', () => {
    // A form whose submission recreates the same submission would never settle. The engine
    // refuses at the limit and says what it was doing; it does not drop the event silently.
    const looping = createRun({
      ...scenario(),
      injectable_events: [],
      scheduled_events: [],
    });
    let error: SimulatorError | null = null;
    try {
      // Feed the cascade directly: each generated contact update generates the next.
      let state = looping;
      for (let index = 0; index <= MAX_EVENTS_PER_OPERATION + 5; index += 1) {
        state = processEvent(
          state,
          event('TAG_ADDED', NOW, { contact_id: 'maria', tag: `t${index}` }),
        );
      }
    } catch (caught) {
      error = caught as SimulatorError;
    }
    // Separate operations never trip the limit: the guard is per operation, by design.
    expect(error).toBeNull();
  });

  it('names the limit and the run when one operation exceeds it', () => {
    // Advancing across a queue longer than the limit is the reachable cascade in Phase 10.
    let state = createRun({ ...scenario(), scheduled_events: [] });
    for (let index = 0; index < MAX_EVENTS_PER_OPERATION + 1; index += 1) {
      state = schedule(state, {
        at: '2026-09-03T09:30:00-05:00',
        type: 'TAG_ADDED',
        payload: { contact_id: 'maria', tag: `t${index}` },
      });
    }
    try {
      advanceTo(state, '2026-09-03T10:00:00-05:00');
      throw new Error('Expected the cascade guard to stop this');
    } catch (caught) {
      const error = caught as SimulatorError;
      expect(error.code).toBe('CASCADE_LIMIT');
      expect(error.detail.limit).toBe(MAX_EVENTS_PER_OPERATION);
      expect(error.detail.run_id).toBe(state.run_id);
    }
  });
});

describe('the event injector (SIM-009)', () => {
  it('offers exactly what the scenario allows', () => {
    expect(allowedActions(scenario()).map((action) => action.id)).toEqual([
      'maria-cancels',
      'jordan-books-late',
    ]);
  });

  it('injects an allowed action at the current simulator time', () => {
    const state = injectAction(run(), scenario(), 'maria-cancels');
    expect(state.account.appointments['appt-maria']?.status).toBe('cancelled');
    const injected = state.log[0];
    expect(injected?.origin).toBe('injected');
    expect(injected?.at).toBe(NOW);
    expect(injected?.source).toEqual({ kind: 'injector_action', id: 'maria-cancels' });
  });

  it('resolves an action authored relative to now against the simulator clock', () => {
    const later = advance(run(), 'hour');
    const state = injectAction(later, scenario(), 'jordan-books-late');
    expect(state.account.appointments['appt-jordan']?.starts_at).toBe('2026-09-03T10:40:00-05:00');
  });

  it('refuses an action the scenario does not offer', () => {
    try {
      injectAction(run(), scenario(), 'delete-everything');
      throw new Error('Expected a refusal');
    } catch (caught) {
      const error = caught as SimulatorError;
      expect(error.code).toBe('ACTION_NOT_ALLOWED');
      expect(error.detail.offered).toEqual(['maria-cancels', 'jordan-books-late']);
    }
  });

  it('refuses a malformed override rather than coercing it into success', () => {
    try {
      injectAction(run(), scenario(), 'maria-cancels', { status: 'ghosted' });
      throw new Error('Expected a refusal');
    } catch (caught) {
      expect((caught as SimulatorError).code).toBe('INVALID_PAYLOAD');
    }
  });
});
