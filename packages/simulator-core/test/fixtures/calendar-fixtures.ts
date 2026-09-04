import { expect } from 'vitest';

import {
  calendarSlots,
  createRun,
  historyHash,
  processEvent,
  replay,
  tryProcessEvent,
  type AccountState,
  type Calendar,
  type SimulatorState,
} from '../../src/index.ts';
import { calendarScenario, event } from '../fixtures.ts';
import type { RegressionFixture } from './registry.ts';

/**
 * Calendar Lab regression fixtures (SIM-017, CAL-001, CAL-003).
 *
 * Each of these pins a scheduling rule a learner is meant to be able to reason about, by id, so a
 * later change to the engine fails by name and says which behaviour it broke. `CANCEL-001` is the
 * one Phase 14 found: cancelling an appointment could not start a workflow at all, because the
 * Appointment Status trigger never listened to `APPOINTMENT_CANCELLED` (D-131).
 */

const NOW = '2026-09-08T09:00:00-05:00'; // Tuesday, America/Chicago

const withCalendar = (state: AccountState, id: string, patch: Partial<Calendar>): AccountState => ({
  ...state,
  calendars: { ...state.calendars, [id]: { ...(state.calendars[id] as Calendar), ...patch } },
});

const times = (state: AccountState, id: string, day: string): string[] =>
  calendarSlots(state, state.calendars[id] as Calendar, NOW)
    .map((slot) => slot.starts_at)
    .filter((at) => at.startsWith(day));

const enrolled = (state: SimulatorState): string[] =>
  state.log
    .filter((row) => row.type === 'WORKFLOW_ENROLLED')
    .map((row) => String(row.payload.workflow_id));

/** One customer booking on the consultation calendar, which parks the reminder on a wait. */
const bookPriya = (): SimulatorState =>
  processEvent(
    createRun(calendarScenario()),
    event('APPOINTMENT_BOOKED', NOW, {
      appointment_id: 'appt-priya',
      contact_id: 'priya',
      calendar_id: 'consultation',
      starts_at: '2026-09-10T13:00:00-05:00',
      host_id: 'theo',
      booked_by: 'customer',
    }),
  );

export const CALENDAR_FIXTURES: RegressionFixture[] = [
  {
    id: 'SLOT-001',
    behaviour:
      'Slots come from the weekly window and the duration: nothing before opening, nothing that would run past closing.',
    covers: 'CAL-001',
    status: 'implemented',
    run: () => processEvent(createRun(calendarScenario()), event('TIME_ADVANCED', NOW, {})),
    expect: (state) => {
      const today = times(state.account, 'consultation', '2026-09-08');
      expect(today[0]).toBe('2026-09-08T09:00:00-05:00');
      expect(today).toContain('2026-09-08T16:30:00-05:00');
      expect(today).not.toContain('2026-09-08T17:00:00-05:00');
      const longer = withCalendar(state.account, 'consultation', { duration_minutes: 45 });
      expect(times(longer, 'consultation', '2026-09-08')).not.toContain(
        '2026-09-08T16:30:00-05:00',
      );
    },
  },
  {
    id: 'BUFFER-001',
    behaviour:
      'A buffer blocks the slots its padding reaches and leaves the one exactly outside it bookable.',
    covers: 'CAL-001',
    status: 'implemented',
    run: () => processEvent(createRun(calendarScenario()), event('TIME_ADVANCED', NOW, {})),
    expect: (state) => {
      // Nadia holds 11:00–11:30. With a fifteen-minute buffer the next opening is 11:45, not
      // 12:00: two paddings never have to clear each other, which is HighLevel's own example.
      const buffered = withCalendar(state.account, 'consultation', {
        pre_buffer_minutes: 15,
        post_buffer_minutes: 15,
        slot_interval_minutes: 15,
      });
      const today = times(buffered, 'consultation', '2026-09-08');
      expect(today).toContain('2026-09-08T11:45:00-05:00');
      expect(today).not.toContain('2026-09-08T11:30:00-05:00');
      expect(today).toContain('2026-09-08T10:15:00-05:00');
      expect(today).not.toContain('2026-09-08T10:30:00-05:00');
      // And with no buffer at all, adjacent is allowed.
      expect(times(state.account, 'consultation', '2026-09-08')).toContain(
        '2026-09-08T11:30:00-05:00',
      );
    },
  },
  {
    id: 'NOTICE-001',
    behaviour:
      'Minimum notice hides everything sooner than it and offers the instant exactly at the boundary.',
    covers: 'CAL-001',
    status: 'implemented',
    run: () => processEvent(createRun(calendarScenario()), event('TIME_ADVANCED', NOW, {})),
    expect: (state) => {
      const strict = withCalendar(state.account, 'consultation', { minimum_notice_minutes: 120 });
      const today = times(strict, 'consultation', '2026-09-08');
      expect(today).not.toContain('2026-09-08T10:30:00-05:00');
      expect(today[0]).toBe('2026-09-08T11:30:00-05:00');
      // A day of notice crosses midnight into the next working day rather than clamping.
      const day = withCalendar(state.account, 'consultation', {
        minimum_notice_minutes: 24 * 60,
      });
      expect(times(day, 'consultation', '2026-09-08')).toEqual([]);
      expect(times(day, 'consultation', '2026-09-09')[0]).toBe('2026-09-09T09:00:00-05:00');
    },
  },
  {
    id: 'ROBIN-001',
    behaviour:
      'Round robin skips a team member who is busy and assigns the host deterministically, with the reason recorded.',
    covers: 'CAL-001',
    status: 'implemented',
    run: () => processEvent(createRun(calendarScenario()), event('TIME_ADVANCED', NOW, {})),
    expect: (state) => {
      const open = calendarSlots(
        state.account,
        state.account.calendars['team-intro'] as Calendar,
        NOW,
      );
      expect(open[0]?.host_id).toBe('theo');
      expect(open[0]?.host_reason).toBe('next_available');
      // Theo is with Nadia at 11:00 on another calendar, so an 11:00 Team Intro is Ivy's.
      const narrow = withCalendar(state.account, 'team-intro', {
        availability: [{ day: 2, start: '11:00', end: '11:30' }],
        booking_window_days: 1,
      });
      const only = calendarSlots(narrow, narrow.calendars['team-intro'] as Calendar, NOW);
      expect(only).toHaveLength(1);
      expect(only[0]?.eligible_staff_ids).toEqual(['ivy']);
      expect(only[0]?.host_id).toBe('ivy');
    },
  },
  {
    id: 'ROBIN-002',
    behaviour:
      'Equal distribution hands consecutive bookings to whoever holds fewest that month, and stays stable.',
    covers: 'CAL-001',
    status: 'implemented',
    run: () => {
      let state = processEvent(
        createRun(calendarScenario()),
        event('APPOINTMENT_BOOKED', NOW, {
          appointment_id: 'appt-intro-1',
          contact_id: 'priya',
          calendar_id: 'team-intro',
          starts_at: '2026-09-09T09:00:00-05:00',
          host_id: 'theo',
        }),
      );
      state = processEvent(
        state,
        event('APPOINTMENT_BOOKED', NOW, {
          appointment_id: 'appt-intro-2',
          contact_id: 'nadia',
          calendar_id: 'team-intro',
          starts_at: '2026-09-09T09:30:00-05:00',
          host_id: 'ivy',
        }),
      );
      return state;
    },
    expect: (state) => {
      const balanced = withCalendar(state.account, 'team-intro', { assignment: 'optimize_equal' });
      const calendar = balanced.calendars['team-intro'] as Calendar;
      // One each so far, so the tie goes to the calendar's own order — Theo, then Ivy once he
      // is ahead. Asked twice, it answers the same both times.
      const first = calendarSlots(balanced, calendar, NOW)[0];
      expect(first?.host_id).toBe('theo');
      expect(first?.host_reason).toBe('least_booked');
      expect(calendarSlots(balanced, calendar, NOW)[0]?.host_id).toBe('theo');
    },
  },
  {
    id: 'RESCHED-002',
    behaviour:
      'A reschedule moves the appointment, frees the old time, ends the appointment-scoped run and re-enrols against the new instant.',
    covers: 'CAL-001, CAL-003',
    status: 'implemented',
    run: () =>
      processEvent(
        bookPriya(),
        event('APPOINTMENT_RESCHEDULED', NOW, {
          appointment_id: 'appt-priya',
          starts_at: '2026-09-11T15:00:00-05:00',
        }),
      ),
    expect: (state) => {
      expect(state.account.appointments['appt-priya']).toMatchObject({
        starts_at: '2026-09-11T15:00:00-05:00',
        status: 'booked',
        host_id: 'theo',
      });
      expect(times(state.account, 'consultation', '2026-09-10')).toContain(
        '2026-09-10T13:00:00-05:00',
      );
      const reasons = state.log
        .filter((row) => row.type === 'WORKFLOW_EXITED')
        .map((row) => String(row.payload.reason));
      expect(reasons).toContain('appointment_rescheduled');
      // The re-entry is one live run whose wait measures against the new time.
      const live = Object.values(state.account.workflow_runs).filter(
        (row) => row.workflow_id === 'wf-booking-confirmation' && row.status === 'waiting',
      );
      expect(live).toHaveLength(1);
      expect(live[0]?.wait?.wake_at).toBe('2026-09-10T15:00:00-05:00');
    },
  },
  {
    id: 'RESCHED-003',
    behaviour: 'A cancelled appointment cannot be rescheduled, and the refusal is recorded.',
    covers: 'CAL-001',
    status: 'implemented',
    run: () => {
      const cancelled = processEvent(
        bookPriya(),
        event('APPOINTMENT_CANCELLED', NOW, { appointment_id: 'appt-priya' }),
      );
      return tryProcessEvent(
        cancelled,
        event('APPOINTMENT_RESCHEDULED', NOW, {
          appointment_id: 'appt-priya',
          starts_at: '2026-09-11T15:00:00-05:00',
        }),
      ).state;
    },
    expect: (state) => {
      expect(state.account.appointments['appt-priya']?.status).toBe('cancelled');
      expect(state.diagnostics.at(-1)?.code).toBe('INVALID_PAYLOAD');
    },
  },
  {
    id: 'CANCEL-001',
    behaviour:
      'Cancelling an appointment ends the appointment-scoped run and starts the cancellation workflow, in that order.',
    covers: 'CAL-003, D-131',
    status: 'implemented',
    run: () =>
      processEvent(
        bookPriya(),
        event('APPOINTMENT_CANCELLED', NOW, { appointment_id: 'appt-priya' }),
      ),
    expect: (state) => {
      expect(state.account.appointments['appt-priya']?.status).toBe('cancelled');
      expect(enrolled(state)).toContain('wf-cancellation-recovery');
      expect(state.account.contacts.priya?.tags).toContain('win-back');
      const exit = state.log.find(
        (row) => row.type === 'WORKFLOW_EXITED' && row.payload.reason === 'appointment_cancelled',
      );
      const entry = state.log.find(
        (row) =>
          row.type === 'WORKFLOW_ENROLLED' &&
          row.payload.workflow_id === 'wf-cancellation-recovery',
      );
      expect((exit?.sequence ?? -1) >= 0).toBe(true);
      expect((exit?.sequence ?? 0) < (entry?.sequence ?? 0)).toBe(true);
      // Every enrolment was produced by a trigger. Nothing here is hand-injected.
      for (const row of state.log.filter((entryRow) => entryRow.type === 'WORKFLOW_ENROLLED')) {
        expect(row.origin).toBe('generated');
        expect(row.source?.kind).toBe('workflow_trigger');
      }
    },
  },
  {
    id: 'CANCEL-002',
    behaviour:
      'A cancellation frees the time again and leaves a run enrolled by a form trigger exactly where it was.',
    covers: 'CAL-001, CAL-003',
    status: 'implemented',
    run: () => {
      const enquired = processEvent(
        bookPriya(),
        event('FORM_SUBMITTED', NOW, {
          form_id: 'enquiry',
          contact_id: 'priya',
          values: { first_name: 'Priya' },
        }),
      );
      return processEvent(
        enquired,
        event('APPOINTMENT_CANCELLED', NOW, { appointment_id: 'appt-priya' }),
      );
    },
    expect: (state) => {
      expect(times(state.account, 'consultation', '2026-09-10')).toContain(
        '2026-09-10T13:00:00-05:00',
      );
      const nurture = Object.values(state.account.workflow_runs).find(
        (row) => row.workflow_id === 'wf-enquiry-nurture',
      );
      expect(nurture?.status).toBe('waiting');
    },
  },
  {
    id: 'STATUS-001',
    behaviour: 'Confirming an appointment fires the Appointment Status trigger for Confirmed.',
    covers: 'CAL-003',
    status: 'implemented',
    run: () =>
      processEvent(
        bookPriya(),
        event('APPOINTMENT_STATUS_CHANGED', NOW, {
          appointment_id: 'appt-priya',
          status: 'confirmed',
        }),
      ),
    expect: (state) => {
      expect(state.account.appointments['appt-priya']?.status).toBe('confirmed');
      expect(enrolled(state)).toContain('wf-confirmed-prep');
      expect(state.account.contacts.priya?.tags).toContain('confirmed-soon');
    },
  },
  {
    id: 'STATUS-002',
    behaviour: 'Setting the status an appointment already has fires nothing and ends nothing.',
    covers: 'CAL-003',
    status: 'implemented',
    run: () =>
      processEvent(
        bookPriya(),
        event('APPOINTMENT_STATUS_CHANGED', NOW, {
          appointment_id: 'appt-priya',
          status: 'booked',
        }),
      ),
    expect: (state) => {
      expect(enrolled(state)).toEqual(['wf-booking-confirmation']);
      expect(state.log.filter((row) => row.type === 'WORKFLOW_EXITED')).toHaveLength(0);
      expect(
        state.execution.filter((row) => row.reason === 'status_unchanged').length,
      ).toBeGreaterThan(0);
    },
  },
  {
    id: 'CALDEF-001',
    behaviour:
      'A saved calendar definition versions, changes what the availability engine answers, and replays exactly.',
    covers: 'CAL-001, D-126',
    status: 'implemented',
    run: () => {
      const scenario = calendarScenario();
      const definition = {
        id: 'discovery',
        name: 'Discovery Call',
        type: 'personal',
        duration_minutes: 20,
        slot_interval_minutes: 20,
        timezone: 'America/Chicago',
        availability: [{ day: 2, start: '13:00', end: '14:00' }],
        staff_ids: ['theo'],
      };
      const live = processEvent(
        processEvent(createRun(scenario), event('CALENDAR_CREATED', NOW, { calendar: definition })),
        event('CALENDAR_UPDATED', NOW, {
          calendar_id: 'discovery',
          calendar: { ...definition, duration_minutes: 30, slot_interval_minutes: 30 },
        }),
      );
      const replayed = replay(scenario, live.log, { run_id: live.run_id });
      expect(historyHash(replayed)).toBe(historyHash(live));
      expect(replayed.account.calendars.discovery).toEqual(live.account.calendars.discovery);
      return live;
    },
    expect: (state) => {
      expect(state.account.calendars.discovery?.version).toBe(2);
      expect(times(state.account, 'discovery', '2026-09-08')).toEqual([
        '2026-09-08T13:00:00-05:00',
        '2026-09-08T13:30:00-05:00',
      ]);
    },
  },
];
