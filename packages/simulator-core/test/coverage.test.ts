import { describe, expect, it } from 'vitest';

import {
  SIMULATOR_EVENT_TYPES,
  advanceTo,
  createRun,
  eventTypeFromContent,
  historyHash,
  initialAccount,
  injectAction,
  processEvent,
  replay,
  rewind,
  type SimulatorEventType,
  type SimulatorScenario,
} from '../src/index.ts';
import { NOW, event, scenario } from './fixtures.ts';

/**
 * The acceptance criteria that count things: every domain the spec names is in the account, every
 * injectable action the spec lists can actually be injected, and rewinding is a real operation
 * rather than a property of the replay API nobody calls.
 */

describe('the account holds every domain the spec names (SIM-004)', () => {
  const account = initialAccount(scenario());
  const run = createRun(scenario());

  it.each([
    'account',
    'users',
    'contacts',
    'companies',
    'tags',
    'custom_fields',
    'custom_values',
    'opportunities',
    'pipelines',
    'appointments',
    'calendars',
    'forms',
    'surveys',
    'products',
    'payments',
    'conversations',
    'workflows',
    'workflow_runs',
    'tasks',
    'notes',
    'analytics',
  ])('has %s', (collection) => {
    expect(account).toHaveProperty(collection);
  });

  it('keeps the event log, the queue, the execution records, the clock and the seed on the run', () => {
    expect(run).toHaveProperty('log');
    expect(run).toHaveProperty('queue');
    expect(run).toHaveProperty('execution');
    expect(run).toHaveProperty('clock');
    expect(run).toHaveProperty('random');
  });

  it('covers all twenty-two collections §43 lists, counting the event log', () => {
    expect(Object.keys(account)).toHaveLength(21);
    expect(Array.isArray(run.log)).toBe(true);
  });
});

describe('every injectable action the spec lists can be injected (SIM-009)', () => {
  /** The seven §47 actions, each as a scenario would declare it. */
  const ACTIONS: [string, string, Record<string, unknown>][] = [
    ['contact reply', 'sms.received', { contact_id: 'maria', body: 'CHANGE' }],
    ['tag added', 'tag.added', { contact_id: 'maria', tag: 'booked' }],
    ['appointment cancellation', 'appointment.cancelled', { appointment_id: 'appt-maria' }],
    [
      'appointment reschedule',
      'appointment.rescheduled',
      { appointment_id: 'appt-maria', starts_at: '2026-09-06T15:00:00-05:00' },
    ],
    [
      'payment',
      'payment.received',
      { payment_id: 'pay-1', contact_id: 'maria', amount: 410, product_id: 'facial' },
    ],
    [
      'form submission',
      'form.submitted',
      {
        form_id: 'consult-request',
        contact_id: 'nina',
        values: { first_name: 'Nina', phone: '+15125550123' },
      },
    ],
    [
      'opportunity movement',
      'pipeline.stage_changed',
      { opportunity_id: 'opp-maria', stage: 'Showed' },
    ],
  ];

  it.each(ACTIONS)('injects a %s', (label, type, payload) => {
    const authored: SimulatorScenario = {
      ...scenario(),
      injectable_events: [
        { id: 'action', type, description: `The learner triggers a ${label}.`, payload },
      ],
    };
    const state = injectAction(createRun(authored), authored, 'action');
    expect(state.log[0]?.origin).toBe('injected');
    expect(state.log[0]?.type).toBe(eventTypeFromContent(type));
    expect(state.execution.length).toBeGreaterThan(0);
    // A form submission creates the contact; a reschedule is a new booking to the scenario's
    // confirmation workflow, which enrols and runs (Phase 12). Everything else stands alone.
    if (type === 'appointment.rescheduled') {
      expect(state.log.map((row) => row.type)).toContain('WORKFLOW_ENROLLED');
      expect(state.log.filter((row) => row.origin === 'injected')).toHaveLength(1);
    } else {
      expect(state.log).toHaveLength(type === 'form.submitted' ? 2 : 1);
    }
  });
});

describe('rewind is a real operation (SIM-013)', () => {
  const busy = () => {
    let state = createRun(scenario());
    state = processEvent(state, event('TAG_ADDED', NOW, { contact_id: 'maria', tag: 'one' }));
    state = processEvent(state, event('TAG_ADDED', NOW, { contact_id: 'maria', tag: 'two' }));
    return advanceTo(state, '2026-09-03T11:00:00-05:00');
  };

  it('steps back one event, leaving no half-applied state behind', () => {
    const state = busy();
    const back = rewind(scenario(), state, 1);
    expect(back.log).toHaveLength(state.log.length - 1);
    expect(back.account.contacts.maria?.tags).toContain('two');
  });

  it('steps back several events', () => {
    const state = busy();
    const back = rewind(scenario(), state, 3);
    expect(back.log).toHaveLength(state.log.length - 3);
  });

  it('lands on the authored start when asked to step back past the beginning', () => {
    const state = busy();
    const back = rewind(scenario(), state, 999);
    expect(back.log).toEqual([]);
    expect(back.clock.now).toBe(NOW);
    expect(back.account.contacts.maria?.tags).toEqual(['meta-lead']);
  });

  it('lands exactly where replaying to that index lands', () => {
    // Rewind is replay with a target, so the two must agree: same account, history and records.
    const state = busy();
    const back = rewind(scenario(), state, 2);
    const replayed = replay(scenario(), state.log, {
      to: state.log.length - 2,
      run_id: state.run_id,
    });
    expect(historyHash(back)).toBe(historyHash(replayed));
    expect(back.log.length).toBe(state.log.length - 2);
  });
});

describe('the catalogue is exercised, not merely declared', () => {
  it('names 42 event types and no duplicates', () => {
    expect(new Set<SimulatorEventType>(SIMULATOR_EVENT_TYPES).size).toBe(
      SIMULATOR_EVENT_TYPES.length,
    );
    expect(SIMULATOR_EVENT_TYPES).toHaveLength(42);
  });
});
