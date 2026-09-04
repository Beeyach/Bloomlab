import { describe, expect, it } from 'vitest';

import { isSimulatorError, type SimulatorError } from '../src/errors.ts';
import {
  assignHost,
  calendarSlots,
  createRun,
  historyHash,
  processEvent,
  replay,
  slotAt,
  slotsForCalendar,
  tryProcessEvent,
  validateCalendar,
  validateScenario,
  type AccountState,
  type Calendar,
} from '../src/index.ts';
import { initialAccount } from '../src/scenario.ts';
import { calendarScenario, event } from './fixtures.ts';

/**
 * The Calendar Lab's engine (CAL-001, CAL-003).
 *
 * Everything here asks the shared simulator the same questions the Lab asks it. There is no
 * second slot rule in these tests and no hand-written appointment: a booking is an event, a
 * cancellation is an event, and what a workflow does about either is the account's own answer.
 */

const NOW = '2026-09-08T09:00:00-05:00'; // Tuesday
const account = (): AccountState => initialAccount(calendarScenario());
const calendarOf = (state: AccountState, id: string): Calendar => state.calendars[id] as Calendar;

const starts = (state: AccountState, id: string, now = NOW, query = {}) =>
  calendarSlots(state, calendarOf(state, id), now, query).map((slot) => slot.starts_at);

/** The starts on one calendar day, which is what a readable expectation is about. */
const startsOn = (state: AccountState, id: string, day: string, now = NOW, query = {}) =>
  starts(state, id, now, query).filter((at) => at.startsWith(day));

const withCalendar = (state: AccountState, id: string, patch: Partial<Calendar>): AccountState => ({
  ...state,
  calendars: { ...state.calendars, [id]: { ...calendarOf(state, id), ...patch } },
});

const refusal = (run: () => unknown): SimulatorError => {
  try {
    run();
  } catch (error) {
    if (isSimulatorError(error)) return error;
    throw error;
  }
  throw new Error('Expected the engine to refuse');
};

/* ---- availability --------------------------------------------------------------------- */

describe('slots come from the definition, the clock and nothing else', () => {
  it('offers times inside the weekly window and none outside it', () => {
    const state = account();
    const times = starts(state, 'consultation');
    expect(times[0]).toBe('2026-09-08T09:00:00-05:00');
    // 11:00 is taken by Nadia's appointment, and the calendar closes at 17:00.
    expect(times).not.toContain('2026-09-08T11:00:00-05:00');
    expect(times).not.toContain('2026-09-08T17:00:00-05:00');
    expect(times).toContain('2026-09-08T16:30:00-05:00');
  });

  it('refuses to start an appointment that would run past closing', () => {
    const state = withCalendar(account(), 'consultation', { duration_minutes: 45 });
    const times = starts(state, 'consultation');
    expect(times).toContain('2026-09-08T16:00:00-05:00');
    expect(times).not.toContain('2026-09-08T16:30:00-05:00');
  });

  it('gives a day with no working hours no times at all, and calls that valid', () => {
    const state = withCalendar(account(), 'consultation', {
      availability: [{ day: 1, start: '09:00', end: '17:00' }],
      booking_window_days: 1,
    });
    // The run's clock is a Tuesday. Monday-only is a correct empty answer, not a broken calendar.
    expect(starts(state, 'consultation')).toEqual([]);
    expect(validateCalendar(calendarOf(state, 'consultation'), state)).not.toContainEqual(
      expect.objectContaining({ severity: 'error' }),
    );
  });

  it('rolls into the following days until the booking window runs out', () => {
    const state = withCalendar(account(), 'consultation', {
      availability: [{ day: 4, start: '09:00', end: '10:00' }],
    });
    expect(starts(state, 'consultation')[0]).toBe('2026-09-10T09:00:00-05:00');
    const narrow = withCalendar(state, 'consultation', { booking_window_days: 1 });
    expect(starts(narrow, 'consultation')).toEqual([]);
  });

  it('answers in the calendar’s own zone when it differs from the account’s', () => {
    const state = withCalendar(account(), 'consultation', { timezone: 'Europe/Paris' });
    // The run's clock is 09:00 in Chicago, which is already 16:00 in Paris — so the first
    // opening inside a Paris working day is 16:00 there, written with Paris's own offset.
    expect(starts(state, 'consultation')[0]).toBe('2026-09-08T16:00:00+02:00');
    expect(starts(state, 'consultation')[1]).toBe('2026-09-08T16:30:00+02:00');
    expect(starts(state, 'consultation')[2]).toBe('2026-09-09T09:00:00+02:00');
  });

  it('keeps the working day at nine across a daylight-saving change', () => {
    const state = withCalendar(account(), 'consultation', {
      availability: [{ day: 1, start: '09:00', end: '10:00' }],
      booking_window_days: 60,
    });
    const times = starts(state, 'consultation');
    // The US change is 1 November 2026; the Monday before is CDT, the Monday after is CST.
    expect(times).toContain('2026-10-26T09:00:00-05:00');
    expect(times).toContain('2026-11-02T09:00:00-06:00');
  });

  it('is the same answer every time it is asked', () => {
    const state = account();
    expect(starts(state, 'consultation')).toEqual(starts(state, 'consultation'));
  });
});

describe('duration changes what is possible, not what already happened', () => {
  it('moves the next possible time when the appointment gets longer', () => {
    const state = account();
    expect(startsOn(state, 'consultation', '2026-09-08')).toContain('2026-09-08T10:30:00-05:00');
    const longer = withCalendar(state, 'consultation', {
      duration_minutes: 60,
      slot_interval_minutes: 60,
    });
    const times = startsOn(longer, 'consultation', '2026-09-08');
    // An hour at 11:00 would run through Nadia's booking; an hour at 10:00 ends exactly as it
    // starts, which is allowed because this calendar has no buffer.
    expect(times).toContain('2026-09-08T10:00:00-05:00');
    expect(times).not.toContain('2026-09-08T11:00:00-05:00');
    expect(times).toContain('2026-09-08T12:00:00-05:00');
  });

  it('leaves an existing appointment the length it was booked for', () => {
    const state = account();
    expect(state.appointments['appt-nadia']?.duration_minutes).toBe(30);
    const longer = withCalendar(state, 'consultation', { duration_minutes: 45 });
    expect(longer.appointments['appt-nadia']?.duration_minutes).toBe(30);
  });
});

describe('minimum notice hides what is too soon and nothing else', () => {
  it('hides below the notice, offers exactly at it', () => {
    const state = withCalendar(account(), 'consultation', { minimum_notice_minutes: 120 });
    const times = starts(state, 'consultation');
    expect(times).not.toContain('2026-09-08T10:30:00-05:00');
    expect(times[0]).toBe('2026-09-08T11:30:00-05:00');
  });

  it('crosses midnight into the next working day when the notice is long enough', () => {
    const state = withCalendar(account(), 'consultation', {
      minimum_notice_minutes: 24 * 60,
    });
    expect(starts(state, 'consultation')[0]).toBe('2026-09-09T09:00:00-05:00');
  });

  it('refuses an exact instant that is inside the notice', () => {
    const state = withCalendar(account(), 'consultation', { minimum_notice_minutes: 120 });
    expect(
      slotAt(state, calendarOf(state, 'consultation'), NOW, '2026-09-08T10:00:00-05:00'),
    ).toBeNull();
    expect(
      slotAt(state, calendarOf(state, 'consultation'), NOW, '2026-09-08T11:30:00-05:00'),
    ).not.toBeNull();
  });

  it('makes exact lookup obey the slot interval and booking window too', () => {
    const state = withCalendar(account(), 'consultation', { booking_window_days: 1 });
    const calendar = calendarOf(state, 'consultation');
    expect(slotAt(state, calendar, NOW, '2026-09-08T09:15:00-05:00')).toBeNull();
    expect(slotAt(state, calendar, NOW, '2026-09-09T09:00:00-05:00')).toBeNull();
  });

  it('can preserve an existing appointment duration while finding a move', () => {
    const state = withCalendar(account(), 'consultation', {
      duration_minutes: 30,
      availability: [{ day: 2, start: '16:00', end: '17:00' }],
    });
    const calendar = calendarOf(state, 'consultation');
    expect(slotAt(state, calendar, NOW, '2026-09-08T16:30:00-05:00')).not.toBeNull();
    expect(
      slotAt(state, calendar, NOW, '2026-09-08T16:30:00-05:00', {
        duration_minutes: 45,
      }),
    ).toBeNull();
  });
});

describe('buffers keep the next booking away without doubling themselves', () => {
  it('leaves the slot immediately after a buffered appointment bookable', () => {
    // Nadia is 11:00–11:30. A fifteen-minute buffer leaves 11:45 free, exactly as HighLevel's own
    // example says — two paddings never have to clear each other, so it is 11:45 and not 12:00.
    const state = withCalendar(account(), 'consultation', {
      pre_buffer_minutes: 15,
      post_buffer_minutes: 15,
      slot_interval_minutes: 15,
    });
    const times = startsOn(state, 'consultation', '2026-09-08');
    expect(times).toContain('2026-09-08T11:45:00-05:00');
    expect(times).not.toContain('2026-09-08T11:30:00-05:00');
    // And on the way in: a 10:30 appointment would end at 11:00 with nothing between it and
    // Nadia, so the buffer refuses it. 10:15 is the last one that fits.
    expect(times).toContain('2026-09-08T10:15:00-05:00');
    expect(times).not.toContain('2026-09-08T10:30:00-05:00');
  });

  it('blocks only what the post buffer reaches when there is no pre buffer', () => {
    const state = withCalendar(account(), 'consultation', {
      post_buffer_minutes: 15,
      slot_interval_minutes: 15,
    });
    const times = startsOn(state, 'consultation', '2026-09-08');
    expect(times).toContain('2026-09-08T10:15:00-05:00');
    expect(times).toContain('2026-09-08T11:45:00-05:00');
    expect(times).not.toContain('2026-09-08T11:30:00-05:00');
  });

  it('allows a booking exactly adjacent when there is no buffer', () => {
    const times = startsOn(account(), 'consultation', '2026-09-08');
    expect(times).toContain('2026-09-08T10:30:00-05:00');
    expect(times).toContain('2026-09-08T11:30:00-05:00');
  });
});

describe('existing appointments occupy the calendar honestly', () => {
  it('refuses a time that overlaps one', () => {
    const state = account();
    expect(
      slotAt(state, calendarOf(state, 'consultation'), NOW, '2026-09-08T11:00:00-05:00'),
    ).toBeNull();
  });

  it('frees the time again once the appointment is cancelled', () => {
    const cancelled = processEvent(
      createRun(calendarScenario()),
      event('APPOINTMENT_CANCELLED', NOW, { appointment_id: 'appt-nadia' }),
    );
    expect(starts(cancelled.account, 'consultation')).toContain('2026-09-08T11:00:00-05:00');
  });

  it('releases the old time and occupies the new one after a reschedule', () => {
    const moved = processEvent(
      createRun(calendarScenario()),
      event('APPOINTMENT_RESCHEDULED', NOW, {
        appointment_id: 'appt-nadia',
        starts_at: '2026-09-08T14:00:00-05:00',
      }),
    );
    const times = starts(moved.account, 'consultation');
    expect(times).toContain('2026-09-08T11:00:00-05:00');
    expect(times).not.toContain('2026-09-08T14:00:00-05:00');
  });

  it('ignores the appointment being moved when it looks for a new time', () => {
    const state = account();
    expect(
      slotAt(state, calendarOf(state, 'consultation'), NOW, '2026-09-08T11:00:00-05:00', {
        ignore_appointment_id: 'appt-nadia',
      }),
    ).not.toBeNull();
  });

  it('keeps a host busy on every calendar at once', () => {
    // Theo hosts on both Consultation and Team Intro, so his 11:00 blocks both.
    const state = withCalendar(account(), 'team-intro', {
      availability: [{ day: 2, start: '09:00', end: '13:00' }],
      staff_ids: ['theo'],
      assignment: 'single',
    });
    expect(starts(state, 'team-intro')).not.toContain('2026-09-08T11:00:00-05:00');
  });
});

/* ---- staff and round robin ------------------------------------------------------------ */

describe('round robin assigns a host deterministically and says why', () => {
  const teamSlots = (state: AccountState, query = {}) =>
    calendarSlots(state, calendarOf(state, 'team-intro'), NOW, query);

  it('picks the first free member in the calendar’s own order', () => {
    const slots = teamSlots(account());
    expect(slots[0]?.eligible_staff_ids).toEqual(['theo', 'ivy']);
    expect(slots[0]?.host_id).toBe('theo');
    expect(slots[0]?.host_reason).toBe('next_available');
  });

  it('skips a member who is busy and hands the slot to the other one', () => {
    const state = withCalendar(account(), 'team-intro', {
      availability: [{ day: 2, start: '11:00', end: '12:00' }],
      booking_window_days: 1,
    });
    const slots = teamSlots(state);
    expect(slots[0]?.starts_at).toBe('2026-09-08T11:00:00-05:00');
    expect(slots[0]?.eligible_staff_ids).toEqual(['ivy']);
    expect(slots[0]?.host_id).toBe('ivy');
    expect(slots[0]?.host_reason).toBe('only_host');
  });

  it('offers nothing when nobody on the team is free', () => {
    const busy = processEvent(
      createRun(calendarScenario()),
      event('APPOINTMENT_BOOKED', NOW, {
        appointment_id: 'appt-ivy',
        contact_id: 'priya',
        calendar_id: 'team-intro',
        starts_at: '2026-09-08T11:00:00-05:00',
        host_id: 'ivy',
      }),
    );
    // Ivy is now booked at 11:00 on Team Intro and Theo is with Nadia at 11:00 on Consultation,
    // so the one slot this calendar offers has nobody left to host it.
    const state = withCalendar(busy.account, 'team-intro', {
      availability: [{ day: 2, start: '11:00', end: '11:30' }],
      booking_window_days: 1,
    });
    expect(starts(state, 'team-intro')).toEqual([]);
  });

  it('offers nothing when the last team member is taken off the calendar', () => {
    const state = withCalendar(account(), 'team-intro', { staff_ids: [] });
    expect(starts(state, 'team-intro')).toEqual([]);
  });

  it('hands equal distribution to whoever has fewest that month, tie broken by order', () => {
    const state = withCalendar(account(), 'team-intro', { assignment: 'optimize_equal' });
    expect(teamSlots(state)[0]?.host_id).toBe('theo');
    expect(teamSlots(state)[0]?.host_reason).toBe('least_booked');

    const afterTheo = processEvent(
      createRun(calendarScenario()),
      event('APPOINTMENT_BOOKED', NOW, {
        appointment_id: 'appt-theo-intro',
        contact_id: 'priya',
        calendar_id: 'team-intro',
        starts_at: '2026-09-09T09:00:00-05:00',
        host_id: 'theo',
      }),
    );
    const balanced = withCalendar(afterTheo.account, 'team-intro', {
      assignment: 'optimize_equal',
    });
    expect(teamSlots(balanced)[0]?.host_id).toBe('ivy');
  });

  it('honours a booker’s chosen host only when staff selection is on', () => {
    const off = account();
    expect(teamSlots(off, { staff_id: 'ivy' })[0]?.host_id).toBe('theo');
    const on = withCalendar(off, 'team-intro', { staff_selection: true });
    const chosen = teamSlots(on, { staff_id: 'ivy' })[0];
    expect(chosen?.host_id).toBe('ivy');
    expect(chosen?.host_reason).toBe('requested');
  });

  it('gives a calendar with no team a slot with no host, rather than no slot', () => {
    const state = withCalendar(account(), 'consultation', { staff_ids: [] });
    const slots = calendarSlots(state, calendarOf(state, 'consultation'), NOW);
    expect(slots[0]?.host_id).toBeNull();
    expect(slots[0]?.host_reason).toBe('no_staff');
  });

  it('never invents a host from an empty list', () => {
    const state = account();
    expect(assignHost(state, calendarOf(state, 'team-intro'), NOW, 'America/Chicago', [])).toEqual({
      host_id: null,
      reason: 'no_staff',
    });
  });
});

/* ---- services and locations ----------------------------------------------------------- */

describe('a service changes the booking, it is not a label', () => {
  it('sets the length and narrows the eligible team', () => {
    const state = account();
    const today = withCalendar(state, 'treatments', { booking_window_days: 1 });
    const facial = calendarSlots(today, calendarOf(today, 'treatments'), NOW, {
      service_id: 'facial',
    });
    expect(facial[0]?.duration_minutes).toBe(45);
    expect(facial[0]?.eligible_staff_ids).toEqual(['ivy']);
    // The last 45-minute start inside 10:00–16:00 is 15:15.
    expect(facial.at(-1)?.starts_at).toBe('2026-09-08T15:15:00-05:00');

    const call = calendarSlots(today, calendarOf(today, 'treatments'), NOW, {
      service_id: 'consult-call',
    });
    expect(call[0]?.duration_minutes).toBe(15);
    expect(call[0]?.eligible_staff_ids).toEqual(['ivy', 'nia']);
  });

  it('carries its own location onto the appointment', () => {
    const booked = processEvent(
      createRun(calendarScenario()),
      event('APPOINTMENT_BOOKED', NOW, {
        appointment_id: 'appt-call',
        contact_id: 'priya',
        calendar_id: 'treatments',
        starts_at: '2026-09-08T10:00:00-05:00',
        service_id: 'consult-call',
        host_id: 'nia',
      }),
    );
    expect(booked.account.appointments['appt-call']).toMatchObject({
      service_id: 'consult-call',
      location_id: 'call',
      duration_minutes: 15,
      host_id: 'nia',
    });
  });

  it('falls back to the calendar’s default location when the service names none', () => {
    const booked = processEvent(
      createRun(calendarScenario()),
      event('APPOINTMENT_BOOKED', NOW, {
        appointment_id: 'appt-plain',
        contact_id: 'priya',
        calendar_id: 'consultation',
        starts_at: '2026-09-08T13:00:00-05:00',
        host_id: 'theo',
      }),
    );
    expect(booked.account.appointments['appt-plain']?.location_id).toBe('studio');
  });

  it('refuses a service or a location the calendar does not have', () => {
    const run = createRun(calendarScenario());
    expect(
      refusal(() =>
        processEvent(
          run,
          event('APPOINTMENT_BOOKED', NOW, {
            appointment_id: 'appt-bad',
            contact_id: 'priya',
            calendar_id: 'treatments',
            starts_at: '2026-09-08T10:00:00-05:00',
            service_id: 'massage',
          }),
        ),
      ).code,
    ).toBe('UNKNOWN_ENTITY');
    expect(
      refusal(() =>
        processEvent(
          run,
          event('APPOINTMENT_BOOKED', NOW, {
            appointment_id: 'appt-bad-2',
            contact_id: 'priya',
            calendar_id: 'consultation',
            starts_at: '2026-09-08T13:00:00-05:00',
            location_id: 'nowhere',
          }),
        ),
      ).code,
    ).toBe('UNKNOWN_ENTITY');
  });
});

/* ---- the host is not the owner -------------------------------------------------------- */

describe('contact owner, opportunity owner and appointment host are three things (D-130)', () => {
  it('keeps the host off the contact’s owner', () => {
    const state = account();
    expect(state.contacts.nadia?.owner_id).toBe('nia');
    expect(state.appointments['appt-nadia']?.host_id).toBe('theo');
  });

  it('refuses a host the account does not have', () => {
    expect(
      refusal(() =>
        processEvent(
          createRun(calendarScenario()),
          event('APPOINTMENT_BOOKED', NOW, {
            appointment_id: 'appt-ghost',
            contact_id: 'priya',
            calendar_id: 'consultation',
            starts_at: '2026-09-08T13:00:00-05:00',
            host_id: 'nobody',
          }),
        ),
      ).code,
    ).toBe('UNKNOWN_ENTITY');
  });

  it('refuses a host who does not work on that calendar', () => {
    expect(
      refusal(() =>
        processEvent(
          createRun(calendarScenario()),
          event('APPOINTMENT_BOOKED', NOW, {
            appointment_id: 'appt-wrong-host',
            contact_id: 'priya',
            calendar_id: 'consultation',
            starts_at: '2026-09-08T13:00:00-05:00',
            host_id: 'ivy',
          }),
        ),
      ).code,
    ).toBe('INVALID_PAYLOAD');
  });

  it('refuses a scenario whose calendar names a user that is not there', () => {
    const issues = validateScenario(
      calendarScenario({
        initial_account_state: {
          ...calendarScenario().initial_account_state,
          calendars: [
            {
              id: 'broken',
              name: 'Broken',
              duration_minutes: 30,
              staff_ids: ['ghost'],
            },
          ],
        },
      }),
    );
    expect(issues.some((issue) => issue.code === 'DANGLING_REF')).toBe(true);
  });
});

/* ---- validation ----------------------------------------------------------------------- */

describe('validation separates impossible from merely empty', () => {
  const codes = (patch: Partial<Calendar>) => {
    const state = withCalendar(account(), 'consultation', patch);
    return validateCalendar(calendarOf(state, 'consultation'), state).map((issue) => issue.code);
  };

  it('accepts the authored calendar', () => {
    const state = account();
    expect(validateCalendar(calendarOf(state, 'consultation'), state)).toEqual([]);
  });

  it('reports impossible numbers', () => {
    expect(codes({ duration_minutes: 0 })).toContain('DURATION_NOT_POSITIVE');
    expect(codes({ slot_interval_minutes: 0 })).toContain('INTERVAL_NOT_POSITIVE');
    expect(codes({ pre_buffer_minutes: -5 })).toContain('NEGATIVE_BUFFER');
    expect(codes({ minimum_notice_minutes: -1 })).toContain('NEGATIVE_NOTICE');
    expect(codes({ booking_window_days: 0 })).toContain('BOOKING_WINDOW_NOT_POSITIVE');
    expect(
      codes({
        booking: { cancellation_allowed: true, reschedule_allowed: true, change_cutoff_hours: -2 },
      }),
    ).toContain('NEGATIVE_CUTOFF');
  });

  it('reports impossible hours', () => {
    expect(codes({ availability: [] })).toContain('NO_AVAILABILITY');
    expect(codes({ availability: [{ day: 9, start: '09:00', end: '17:00' }] })).toContain(
      'INVALID_DAY',
    );
    expect(codes({ availability: [{ day: 1, start: '9am', end: '17:00' }] })).toContain(
      'INVALID_TIME_OF_DAY',
    );
    expect(codes({ availability: [{ day: 1, start: '17:00', end: '09:00' }] })).toContain(
      'EMPTY_WINDOW',
    );
    expect(
      codes({
        availability: [
          { day: 1, start: '09:00', end: '12:00' },
          { day: 1, start: '11:00', end: '15:00' },
        ],
      }),
    ).toContain('OVERLAPPING_WINDOWS');
  });

  it('reports a window too short for the appointment as a warning, not an error', () => {
    const state = withCalendar(account(), 'consultation', {
      availability: [{ day: 1, start: '09:00', end: '09:20' }],
    });
    const issues = validateCalendar(calendarOf(state, 'consultation'), state);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.code).toBe('WINDOW_SHORTER_THAN_DURATION');
    expect(issues[0]?.severity).toBe('warning');
  });

  it('reports a team that cannot work', () => {
    expect(
      codes({ type: 'round_robin', staff_ids: [], assignment: 'optimize_availability' }),
    ).toContain('ROUND_ROBIN_NEEDS_STAFF');
    expect(codes({ staff_ids: ['theo', 'ivy'] })).toContain('PERSONAL_NEEDS_ONE_HOST');
    expect(codes({ staff_ids: ['theo', 'theo'] })).toContain('DUPLICATE_STAFF');
    expect(codes({ staff_ids: [], staff_selection: true })).toContain(
      'STAFF_SELECTION_WITHOUT_STAFF',
    );
  });

  it('reports services and locations that point at nothing', () => {
    expect(codes({ type: 'service', services: [] })).toContain('SERVICE_CALENDAR_NEEDS_SERVICE');
    expect(
      codes({
        services: [
          { id: 's1', name: 'Facial', duration_minutes: 30, staff_ids: [], location_id: null },
        ],
      }),
    ).toContain('SERVICES_ON_A_NON_SERVICE_CALENDAR');
    expect(codes({ locations: [{ id: 'l1', kind: 'address', value: null }] })).toContain(
      'LOCATION_NEEDS_VALUE',
    );
    expect(codes({ default_location_id: 'gone' })).toContain('DEFAULT_LOCATION_UNKNOWN');
  });

  it('refuses an unresolvable zone', () => {
    expect(codes({ timezone: 'Mars/Olympus' })).toContain('INVALID_TIMEZONE');
  });
});

/* ---- definitions as events ------------------------------------------------------------ */

describe('a calendar definition travels as an account event (D-126)', () => {
  const definition = {
    id: 'discovery',
    name: 'Discovery Call',
    type: 'personal',
    duration_minutes: 20,
    slot_interval_minutes: 20,
    timezone: 'America/Chicago',
    availability: [{ day: 2, start: '13:00', end: '15:00' }],
    staff_ids: ['theo'],
  };

  it('creates, versions and updates through the shared engine', () => {
    const created = processEvent(
      createRun(calendarScenario()),
      event('CALENDAR_CREATED', NOW, { calendar: definition }),
    );
    expect(created.account.calendars.discovery?.version).toBe(1);
    expect(created.account.calendars.discovery?.duration_minutes).toBe(20);

    const updated = processEvent(
      created,
      event('CALENDAR_UPDATED', NOW, {
        calendar_id: 'discovery',
        calendar: { ...definition, duration_minutes: 40, slot_interval_minutes: 40 },
      }),
    );
    expect(updated.account.calendars.discovery?.version).toBe(2);
    expect(updated.account.calendars.discovery?.duration_minutes).toBe(40);
  });

  it('changes what the availability engine answers', () => {
    const created = processEvent(
      createRun(calendarScenario()),
      event('CALENDAR_CREATED', NOW, { calendar: definition }),
    );
    expect(
      slotsForCalendar(created.account, 'discovery', NOW, { limit: 6 }).map((row) => row.starts_at),
    ).toEqual([
      '2026-09-08T13:00:00-05:00',
      '2026-09-08T13:20:00-05:00',
      '2026-09-08T13:40:00-05:00',
      '2026-09-08T14:00:00-05:00',
      '2026-09-08T14:20:00-05:00',
      '2026-09-08T14:40:00-05:00',
    ]);
  });

  it('refuses a definition that would corrupt the account', () => {
    const run = createRun(calendarScenario());
    expect(
      refusal(() =>
        processEvent(
          run,
          event('CALENDAR_CREATED', NOW, {
            calendar: { ...definition, id: 'nope', staff_ids: ['ghost'] },
          }),
        ),
      ).code,
    ).toBe('UNKNOWN_ENTITY');
    expect(
      refusal(() =>
        processEvent(
          run,
          event('CALENDAR_CREATED', NOW, {
            calendar: { ...definition, id: 'nope', duration_minutes: 0 },
          }),
        ),
      ).code,
    ).toBe('INVALID_PAYLOAD');
    expect(
      refusal(() =>
        processEvent(
          run,
          event('CALENDAR_CREATED', NOW, {
            calendar: { ...definition, id: 'nope', timezone: 'Mars/Olympus' },
          }),
        ),
      ).code,
    ).toBe('INVALID_TIMEZONE');
    const created = processEvent(run, event('CALENDAR_CREATED', NOW, { calendar: definition }));
    expect(
      refusal(() => processEvent(created, event('CALENDAR_CREATED', NOW, { calendar: definition })))
        .code,
    ).toBe('DUPLICATE_ENTITY');
    expect(
      refusal(() =>
        processEvent(
          run,
          event('CALENDAR_UPDATED', NOW, { calendar_id: 'ghost-calendar', calendar: definition }),
        ),
      ).code,
    ).toBe('UNKNOWN_ENTITY');
  });

  it('saves an unfinished calendar and lets validation say what is missing', () => {
    const created = processEvent(
      createRun(calendarScenario()),
      event('CALENDAR_CREATED', NOW, {
        calendar: {
          id: 'half',
          name: 'Half built',
          type: 'round_robin',
          duration_minutes: 30,
          availability: [],
          staff_ids: [],
        },
      }),
    );
    const half = created.account.calendars.half as Calendar;
    expect(half.version).toBe(1);
    const codes = validateCalendar(half, created.account).map((issue) => issue.code);
    expect(codes).toContain('ROUND_ROBIN_NEEDS_STAFF');
    expect(codes).toContain('NO_AVAILABILITY');
  });

  it('replays to exactly the same account', () => {
    const scenario = calendarScenario();
    const live = processEvent(
      processEvent(createRun(scenario), event('CALENDAR_CREATED', NOW, { calendar: definition })),
      event('APPOINTMENT_BOOKED', NOW, {
        appointment_id: 'appt-discovery',
        contact_id: 'priya',
        calendar_id: 'discovery',
        starts_at: '2026-09-08T13:00:00-05:00',
        host_id: 'theo',
      }),
    );
    const replayed = replay(scenario, live.log, { run_id: live.run_id });
    expect(historyHash(replayed)).toBe(historyHash(live));
    expect(replayed.account.calendars.discovery).toEqual(live.account.calendars.discovery);
    expect(replayed.account.appointments['appt-discovery']).toEqual(
      live.account.appointments['appt-discovery'],
    );
  });

  it('does not fire a workflow trigger', () => {
    const created = processEvent(
      createRun(calendarScenario()),
      event('CALENDAR_CREATED', NOW, { calendar: definition }),
    );
    expect(created.log.filter((row) => row.type === 'WORKFLOW_ENROLLED')).toHaveLength(0);
  });
});

/* ---- CAL-003: the lifecycle reaches workflows ----------------------------------------- */

const enrolments = (state: {
  log: readonly { type: string; payload: Record<string, unknown> }[];
}) =>
  state.log
    .filter((row) => row.type === 'WORKFLOW_ENROLLED')
    .map((row) => String(row.payload.workflow_id));

const exits = (state: { log: readonly { type: string; payload: Record<string, unknown> }[] }) =>
  state.log
    .filter((row) => row.type === 'WORKFLOW_EXITED')
    .map((row) => String(row.payload.reason));

const booked = () =>
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

describe('every appointment event reaches workflows through the shared engine (CAL-003)', () => {
  it('enrols on a customer booking and not on a staff one', () => {
    expect(enrolments(booked())).toContain('wf-booking-confirmation');
    const byStaff = processEvent(
      createRun(calendarScenario()),
      event('APPOINTMENT_BOOKED', NOW, {
        appointment_id: 'appt-staff',
        contact_id: 'priya',
        calendar_id: 'consultation',
        starts_at: '2026-09-10T13:00:00-05:00',
        host_id: 'theo',
        booked_by: 'staff',
      }),
    );
    expect(enrolments(byStaff)).not.toContain('wf-booking-confirmation');
  });

  it('enrols the confirmed workflow when the status changes', () => {
    const confirmed = processEvent(
      booked(),
      event('APPOINTMENT_STATUS_CHANGED', NOW, {
        appointment_id: 'appt-priya',
        status: 'confirmed',
      }),
    );
    expect(enrolments(confirmed)).toContain('wf-confirmed-prep');
    expect(confirmed.account.contacts.priya?.tags).toContain('confirmed-soon');
  });

  it('fires no trigger when the status does not actually change', () => {
    const again = processEvent(
      booked(),
      event('APPOINTMENT_STATUS_CHANGED', NOW, {
        appointment_id: 'appt-priya',
        status: 'booked',
      }),
    );
    expect(enrolments(again)).toEqual(enrolments(booked()));
    expect(again.log.filter((row) => row.type === 'WORKFLOW_EXITED')).toHaveLength(0);
  });

  it('enrols the cancellation workflow on APPOINTMENT_CANCELLED and exits the reminder', () => {
    const cancelled = processEvent(
      booked(),
      event('APPOINTMENT_CANCELLED', NOW, { appointment_id: 'appt-priya' }),
    );
    // The exit is logged before the new enrolment: the platform pulls the contact out of the
    // reminder first, and only then does the recovery workflow start.
    const exitedReminder = cancelled.log.find(
      (row) => row.type === 'WORKFLOW_EXITED' && row.payload.reason === 'appointment_cancelled',
    );
    const enrolledRecovery = cancelled.log.find(
      (row) =>
        row.type === 'WORKFLOW_ENROLLED' && row.payload.workflow_id === 'wf-cancellation-recovery',
    );
    expect(exitedReminder).toBeTruthy();
    expect(enrolledRecovery).toBeTruthy();
    expect((exitedReminder?.sequence ?? 0) < (enrolledRecovery?.sequence ?? 0)).toBe(true);
    expect(exits(cancelled)).toContain('appointment_cancelled');
    expect(enrolments(cancelled)).toContain('wf-cancellation-recovery');
    expect(cancelled.account.contacts.priya?.tags).toContain('win-back');
    expect(cancelled.account.appointments['appt-priya']?.status).toBe('cancelled');
    // No enrolment was hand-written: every one of them came from a trigger.
    for (const row of cancelled.log.filter((entry) => entry.type === 'WORKFLOW_ENROLLED')) {
      expect(row.origin).toBe('generated');
      expect(row.source?.kind).toBe('workflow_trigger');
    }
  });

  it('leaves a run enrolled by a form trigger alone when an appointment is cancelled', () => {
    const enquired = processEvent(
      booked(),
      event('FORM_SUBMITTED', NOW, {
        form_id: 'enquiry',
        contact_id: 'priya',
        values: { first_name: 'Priya' },
      }),
    );
    expect(enrolments(enquired)).toContain('wf-enquiry-nurture');
    const cancelled = processEvent(
      enquired,
      event('APPOINTMENT_CANCELLED', NOW, { appointment_id: 'appt-priya' }),
    );
    const nurture = Object.values(cancelled.account.workflow_runs).find(
      (row) => row.workflow_id === 'wf-enquiry-nurture',
    );
    expect(nurture?.status).toBe('waiting');
  });

  it('moves the reminder onto the new time after a reschedule', () => {
    const moved = processEvent(
      booked(),
      event('APPOINTMENT_RESCHEDULED', NOW, {
        appointment_id: 'appt-priya',
        starts_at: '2026-09-11T15:00:00-05:00',
      }),
    );
    expect(exits(moved)).toContain('appointment_rescheduled');
    // The re-entry is a fresh run, and its wait measures against the new instant.
    const live = Object.values(moved.account.workflow_runs).filter(
      (row) => row.workflow_id === 'wf-booking-confirmation' && row.status === 'waiting',
    );
    expect(live).toHaveLength(1);
    expect(live[0]?.wait?.wake_at).toBe('2026-09-10T15:00:00-05:00');
  });

  it('refuses to reschedule an appointment that was cancelled', () => {
    const cancelled = processEvent(
      booked(),
      event('APPOINTMENT_CANCELLED', NOW, { appointment_id: 'appt-priya' }),
    );
    const outcome = tryProcessEvent(
      cancelled,
      event('APPOINTMENT_RESCHEDULED', NOW, {
        appointment_id: 'appt-priya',
        starts_at: '2026-09-11T15:00:00-05:00',
      }),
    );
    expect(outcome.error?.code).toBe('INVALID_PAYLOAD');
  });

  it('keeps a staff booking a staff booking through a reschedule', () => {
    const byStaff = processEvent(
      createRun(calendarScenario()),
      event('APPOINTMENT_BOOKED', NOW, {
        appointment_id: 'appt-staff',
        contact_id: 'priya',
        calendar_id: 'consultation',
        starts_at: '2026-09-10T13:00:00-05:00',
        host_id: 'theo',
        booked_by: 'staff',
      }),
    );
    const moved = processEvent(
      byStaff,
      event('APPOINTMENT_RESCHEDULED', NOW, {
        appointment_id: 'appt-staff',
        starts_at: '2026-09-11T13:00:00-05:00',
      }),
    );
    expect(moved.account.appointments['appt-staff']?.booked_by).toBe('staff');
    expect(enrolments(moved)).not.toContain('wf-booking-confirmation');
  });
});
