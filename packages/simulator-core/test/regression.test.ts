import { describe, expect, it } from 'vitest';

import {
  advanceTo,
  createRun,
  historyHash,
  injectAction,
  nextEvent,
  processEvent,
  replay,
  schedule,
  type SimulatorState,
} from '../src/index.ts';
import { NOW, event, scenario, withWaitBefore } from './fixtures.ts';
import { isImplemented, type RegressionFixture } from './fixtures/registry.ts';
import { WORKFLOW_FIXTURES } from './fixtures/workflow-fixtures.ts';

/**
 * The regression suite (SIM-017). Each fixture executes real simulator behaviour and is pinned by
 * a stable id; a change that breaks one fails by id, so "one fix broke three old exercises" shows
 * up here rather than in a learner's session.
 */

const only = (state: SimulatorState, kind: string) =>
  state.execution.filter((row) => row.kind === kind);

const FIXTURES: RegressionFixture[] = [
  {
    id: 'CLOCK-001',
    behaviour: 'A run starts at the scenario’s authored time, in the scenario’s zone.',
    covers: 'SIM-006',
    status: 'implemented',
    run: ({ scenario: authored }) => createRun(authored),
    expect: (state) => {
      expect(state.clock.now).toBe('2026-09-03T09:00:00-05:00');
      expect(state.clock.timezone).toBe('America/Chicago');
    },
  },
  {
    id: 'CLOCK-002',
    behaviour: 'Advancing a day keeps the wall-clock reading across a daylight-saving change.',
    covers: 'SIM-006, SIM-007',
    status: 'implemented',
    run: ({ scenario: authored }) =>
      advanceTo(
        createRun({
          ...authored,
          simulation_time: '2026-10-31T09:00:00-05:00',
          scheduled_events: [],
        }),
        '2026-11-01T09:00:00-06:00',
      ),
    expect: (state) => {
      expect(state.clock.now).toBe('2026-11-01T09:00:00-06:00');
    },
  },
  {
    id: 'QUEUE-001',
    behaviour: 'Queued events run in chronological order however the scenario authored them.',
    covers: 'SIM-008',
    status: 'implemented',
    run: ({ scenario: authored }) => nextEvent(nextEvent(createRun(authored))),
    expect: (state) => {
      expect(state.log.map((row) => row.at)).toEqual([
        '2026-09-03T10:00:00-05:00',
        '2026-09-04T15:35:00-05:00',
      ]);
      expect(state.queue).toHaveLength(0);
    },
  },
  {
    id: 'QUEUE-002',
    behaviour: 'Events sharing an instant run in the order they were queued.',
    covers: 'SIM-008',
    status: 'implemented',
    run: ({ scenario: authored }) => {
      let state = createRun({ ...authored, scheduled_events: [] });
      for (const tag of ['first', 'second', 'third']) {
        state = schedule(state, {
          at: '2026-09-03T09:30:00-05:00',
          type: 'TAG_ADDED',
          payload: { contact_id: 'maria', tag },
        });
      }
      return advanceTo(state, '2026-09-03T09:31:00-05:00');
    },
    expect: (state) => {
      expect(state.account.contacts.maria?.tags).toEqual(['meta-lead', 'first', 'second', 'third']);
    },
  },
  {
    id: 'TAG-001',
    behaviour: 'Adding a tag a contact already carries does not duplicate it.',
    covers: 'SIM-004',
    status: 'implemented',
    run: ({ scenario: authored }) => {
      const add = (state: SimulatorState) =>
        processEvent(state, event('TAG_ADDED', NOW, { contact_id: 'maria', tag: 'booked' }));
      return add(add(createRun(authored)));
    },
    expect: (state) => {
      expect(state.account.contacts.maria?.tags.filter((tag) => tag === 'booked')).toHaveLength(1);
      expect(only(state, 'action_skipped')[0]?.reason).toBe('tag_already_present');
    },
  },
  {
    id: 'FORM-001',
    behaviour: 'A form submission creates the contact it names, through the one event path.',
    covers: 'SIM-001, SIM-003',
    status: 'implemented',
    run: ({ scenario: authored }) =>
      processEvent(
        createRun(authored),
        event('FORM_SUBMITTED', NOW, {
          form_id: 'consult-request',
          contact_id: 'nina',
          values: { first_name: 'Nina', phone: '+15125550123' },
        }),
      ),
    expect: (state) => {
      expect(state.account.contacts.nina?.first_name).toBe('Nina');
      const created = state.log.find((row) => row.type === 'CONTACT_CREATED');
      expect(created?.origin).toBe('generated');
    },
  },
  {
    id: 'MSG-001',
    behaviour: 'An SMS to a contact with no phone is skipped and recorded, never silently sent.',
    covers: 'SIM-010, spec §49',
    status: 'implemented',
    run: ({ scenario: authored }) =>
      processEvent(
        createRun(authored),
        event('SMS_SENT', NOW, { contact_id: 'jordan', body: 'You are booked.' }),
      ),
    expect: (state) => {
      expect(state.account.conversations.jordan).toBeUndefined();
      expect(only(state, 'action_skipped')[0]?.reason).toBe('missing_phone');
    },
  },
  {
    id: 'MSG-002',
    behaviour: 'A contact on do-not-disturb receives nothing.',
    covers: 'SIM-010, spec §49',
    status: 'implemented',
    run: ({ scenario: authored }) =>
      processEvent(
        createRun(authored),
        event('SMS_SENT', NOW, { contact_id: 'lena', body: 'You are booked.' }),
      ),
    expect: (state) => {
      expect(only(state, 'action_skipped')[0]?.reason).toBe('dnd');
    },
  },
  {
    id: 'ENROLL-001',
    behaviour: 'A workflow with re-entry off refuses a second active enrolment of one contact.',
    covers: 'SIM-016, WFL-011',
    status: 'implemented',
    run: ({ scenario: authored }) => {
      const enrol = (state: SimulatorState) =>
        processEvent(
          state,
          event('WORKFLOW_ENROLLED', NOW, {
            workflow_id: 'wf-booking-confirmation',
            contact_id: 'maria',
          }),
        );
      // The wait keeps the first run active; without it the walk finishes in the same tick.
      return enrol(enrol(createRun(withWaitBefore(authored))));
    },
    expect: (state) => {
      expect(Object.values(state.account.workflow_runs)).toHaveLength(1);
      expect(Object.values(state.account.workflow_runs)[0]?.status).toBe('waiting');
      expect(only(state, 'exit')[0]?.reason).toBe('duplicate_enrolment');
    },
  },
  {
    id: 'REM-001',
    behaviour:
      'A cancelled appointment is cancelled in the shared account, so nothing later reads it as live.',
    covers: 'SIM-001',
    status: 'implemented',
    run: ({ scenario: authored }) => injectAction(createRun(authored), authored, 'maria-cancels'),
    expect: (state) => {
      expect(state.account.appointments['appt-maria']?.status).toBe('cancelled');
      expect(state.account.analytics.appointments_cancelled).toBe(1);
    },
  },
  {
    id: 'REPLAY-001',
    behaviour: 'Replaying a run from its scenario and event log reproduces it exactly.',
    covers: 'SIM-013, SIM-018',
    status: 'implemented',
    run: ({ scenario: authored }) => {
      const live = nextEvent(
        injectAction(
          advanceTo(createRun(authored), '2026-09-03T11:00:00-05:00'),
          authored,
          'maria-cancels',
        ),
      );
      const replayed = replay(authored, live.log, { run_id: live.run_id });
      expect(historyHash(replayed)).toBe(historyHash(live));
      return live;
    },
    expect: (state) => {
      expect(state.log.length).toBeGreaterThan(2);
    },
  },

  // ---- Reserved. The ids are claimed now so the behaviours land under their own names, but the
  // behaviour behind each belongs to the Workflow Lab in Phase 12, and none of these is asserted.
  // Workflow Lab behaviours (Phase 12) live beside their builders.
  ...WORKFLOW_FIXTURES,
];

describe('simulator regression fixtures (SIM-017)', () => {
  it('gives every fixture a unique, stable id', () => {
    const ids = FIXTURES.map((fixture) => fixture.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[A-Z]+-\d{3}$/);
  });

  it('names an owner for every reserved fixture, and asserts nothing for it', () => {
    for (const fixture of FIXTURES.filter((candidate) => !isImplemented(candidate))) {
      expect(fixture.owner, `${fixture.id} must say which phase owns it`).toBeTruthy();
      expect(fixture.run, `${fixture.id} is reserved and must not claim to run`).toBeUndefined();
      expect(fixture.expect).toBeUndefined();
    }
  });

  it('gives every implemented fixture something to run and something to check', () => {
    for (const fixture of FIXTURES.filter(isImplemented)) {
      expect(fixture.run, `${fixture.id} must run real behaviour`).toBeTypeOf('function');
      expect(fixture.expect, `${fixture.id} must assert something`).toBeTypeOf('function');
    }
  });

  it.each(FIXTURES.filter(isImplemented).map((fixture) => [fixture.id, fixture] as const))(
    '%s executes real simulator behaviour',
    (_id, fixture) => {
      const state = (fixture.run as NonNullable<RegressionFixture['run']>)({
        scenario: scenario(),
      });
      (fixture.expect as NonNullable<RegressionFixture['expect']>)(state);
    },
  );
});

/** Exported so the review file and the harness can report the same counts. */
export const REGRESSION_FIXTURES = FIXTURES;
