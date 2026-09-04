import { slotAt } from '@bloomlab/simulator-core';
import type {
  Calendar,
  PendingEvent,
  SimulatorEventType,
  SimulatorScenario,
  Slot,
} from '@bloomlab/simulator-core';

import type { BloomlabDatabase } from '../data/db';
import { randomId } from '../data/envelope';
import { resetStoredRun, type StoredRun } from '../simulator/store';
import { execute, type ExecutionOptions, type ExecutionResult } from '../workflow/execution';

/**
 * The Calendar Lab command layer (CAL-001, CAL-003, D-126).
 *
 * A screen states an intent; this module turns it into one event for the **existing** execution
 * door — the same `execute` the Workflow Lab and the Funnel Lab use, on the same Worker,
 * committing to the same store. Phase 14 adds no second engine path, no second appointment
 * store, no second persistence route and no calendar-specific run preference.
 *
 * A calendar definition reaches the account the way a workflow's and a funnel's do: as an event
 * the engine validates, logs, versions and can replay (D-107, D-119, D-126). A booking, a
 * confirmation, a reschedule and a cancellation reach it as the real appointment events those
 * actions mean, so the reducers validate them and the workflow reactions see the real chain.
 *
 * No scheduling rule lives here. Which times are bookable, who can host one, whether a service
 * changes the length: all of that is `simulator-core`. What lives here is translation, id minting
 * (the engine forbids randomness) and the choice of which event an intent means.
 */

export type CalendarOutcome = ExecutionResult;

/** The label the engine records for everything the Lab injects. */
export const CALENDAR_LAB_SOURCE = 'calendar_lab';

export const newCalendarId = () => `cal-${randomId()}`;
export const newWindowId = () => `win-${randomId()}`;
export const newServiceId = () => `svc-${randomId()}`;
export const newLocationId = () => `loc-${randomId()}`;
export const newAppointmentId = () => `appt-${randomId()}`;

const injected = (
  run: StoredRun,
  type: SimulatorEventType,
  payload: Record<string, unknown>,
  at: string = run.state.clock.now,
): PendingEvent => ({
  type,
  at,
  payload,
  origin: 'injected',
  source: { kind: 'injector_action', id: CALENDAR_LAB_SOURCE },
});

type Options = ExecutionOptions;

const unavailableSlot = (
  run: StoredRun,
  calendarId: string,
  startsAt: string,
): Promise<ExecutionResult> =>
  Promise.resolve({
    ok: false,
    run,
    refusal: {
      code: 'INVALID_PAYLOAD',
      message: 'That time is no longer available. Pick a current opening and try again.',
      detail: { calendar_id: calendarId, starts_at: startsAt },
    },
  });

const sameSlot = (a: Slot, b: Slot): boolean =>
  a.starts_at === b.starts_at &&
  a.duration_minutes === b.duration_minutes &&
  a.host_id === b.host_id;

/* ---- definitions --------------------------------------------------------------------- */

/** The definition as an event payload: everything but the version, which the engine assigns. */
const asPayload = (calendar: Calendar): Record<string, unknown> => {
  const { version: _version, ...rest } = calendar;
  return rest;
};

export const createCalendar = (
  run: StoredRun,
  scenario: SimulatorScenario,
  calendar: Calendar,
  options?: Options,
) =>
  execute(
    run,
    scenario,
    {
      kind: 'process',
      event: injected(run, 'CALENDAR_CREATED', { calendar: asPayload(calendar) }),
    },
    options,
  );

/** Replaces an existing calendar; the engine bumps the version (D-104). */
export const updateCalendar = (
  run: StoredRun,
  scenario: SimulatorScenario,
  calendar: Calendar,
  options?: Options,
) =>
  execute(
    run,
    scenario,
    {
      kind: 'process',
      event: injected(run, 'CALENDAR_UPDATED', {
        calendar_id: calendar.id,
        calendar: asPayload(calendar),
      }),
    },
    options,
  );

/** Create or update, whichever the account needs. This is what "Save" means. */
export const saveCalendar = (
  run: StoredRun,
  scenario: SimulatorScenario,
  calendar: Calendar,
  options?: Options,
) =>
  run.state.account.calendars[calendar.id]
    ? updateCalendar(run, scenario, calendar, options)
    : createCalendar(run, scenario, calendar, options);

/** A fresh calendar for the editor to start from. Not in the account until the learner saves. */
export const blankCalendar = (
  id: string = newCalendarId(),
  name = 'New calendar',
  timezone: string | null = null,
): Calendar => ({
  id,
  name,
  type: 'personal',
  timezone,
  duration_minutes: 30,
  slot_interval_minutes: 30,
  pre_buffer_minutes: 0,
  post_buffer_minutes: 0,
  minimum_notice_minutes: 0,
  booking_window_days: 14,
  availability: [1, 2, 3, 4, 5].map((day) => ({ day, start: '09:00', end: '17:00' })),
  staff_ids: [],
  assignment: 'single',
  staff_selection: false,
  services: [],
  locations: [],
  default_location_id: null,
  booking: { cancellation_allowed: true, reschedule_allowed: true, change_cutoff_hours: null },
  version: 0,
});

/* ---- the appointment lifecycle -------------------------------------------------------- */

export interface BookingIntent {
  contact_id: string;
  calendar_id: string;
  slot: Slot;
  service_id: string | null;
  location_id: string | null;
  /** Whether the customer made this booking or somebody on the team did. */
  booked_by: 'customer' | 'staff';
}

/**
 * A test booking. The slot came from the shared availability engine, so the host, the length and
 * the location on the appointment are the ones the calendar's own configuration produced.
 *
 * `booked_by` is honest rather than convenient: HighLevel's Customer Booked Appointment trigger
 * fires only for bookings a customer made, and a staff booking that claimed otherwise would teach
 * the wrong thing about which workflow runs.
 */
export const bookAppointment = (
  run: StoredRun,
  scenario: SimulatorScenario,
  intent: BookingIntent,
  options?: Options,
) => {
  const calendar = run.state.account.calendars[intent.calendar_id];
  if (calendar) {
    const current = slotAt(
      run.state.account,
      calendar,
      run.state.clock.now,
      intent.slot.starts_at,
      {
        service_id: intent.service_id,
        staff_id: intent.slot.host_reason === 'requested' ? intent.slot.host_id : null,
      },
    );
    if (!current || !sameSlot(current, intent.slot)) {
      return unavailableSlot(run, intent.calendar_id, intent.slot.starts_at);
    }
  }
  return execute(
    run,
    scenario,
    {
      kind: 'process',
      event: injected(run, 'APPOINTMENT_BOOKED', {
        appointment_id: newAppointmentId(),
        contact_id: intent.contact_id,
        calendar_id: intent.calendar_id,
        starts_at: intent.slot.starts_at,
        duration_minutes: intent.slot.duration_minutes,
        host_id: intent.slot.host_id,
        service_id: intent.service_id,
        location_id: intent.location_id,
        booked_by: intent.booked_by,
      }),
    },
    options,
  );
};

/** A status change. Confirming is this event with `confirmed`; so are Showed and No-show. */
export const setAppointmentStatus = (
  run: StoredRun,
  scenario: SimulatorScenario,
  appointmentId: string,
  status: 'booked' | 'confirmed' | 'showed' | 'no_show' | 'cancelled',
  options?: Options,
) =>
  execute(
    run,
    scenario,
    {
      kind: 'process',
      event: injected(run, 'APPOINTMENT_STATUS_CHANGED', {
        appointment_id: appointmentId,
        status,
      }),
    },
    options,
  );

/** A move to a new slot the same engine produced. The appointment keeps its identity. */
export const rescheduleAppointment = (
  run: StoredRun,
  scenario: SimulatorScenario,
  appointmentId: string,
  slot: Slot,
  options?: Options,
) => {
  const appointment = run.state.account.appointments[appointmentId];
  const calendar = appointment ? run.state.account.calendars[appointment.calendar_id] : null;
  if (appointment && calendar) {
    const current = slotAt(run.state.account, calendar, run.state.clock.now, slot.starts_at, {
      service_id: appointment.service_id,
      duration_minutes: appointment.duration_minutes,
      staff_id: slot.host_reason === 'requested' ? slot.host_id : null,
      ignore_appointment_id: appointment.id,
    });
    if (!current || !sameSlot(current, slot)) {
      return unavailableSlot(run, appointment.calendar_id, slot.starts_at);
    }
  }
  return execute(
    run,
    scenario,
    {
      kind: 'process',
      event: injected(run, 'APPOINTMENT_RESCHEDULED', {
        appointment_id: appointmentId,
        starts_at: slot.starts_at,
        host_id: slot.host_id,
      }),
    },
    options,
  );
};

/**
 * A cancellation. `APPOINTMENT_CANCELLED` rather than a status change, because that is the event
 * the account's own history should carry — and since Phase 14 it reaches the Appointment Status
 * trigger too, so a cancellation can start a recovery workflow (D-131).
 */
export const cancelAppointment = (
  run: StoredRun,
  scenario: SimulatorScenario,
  appointmentId: string,
  reason: string | null = null,
  options?: Options,
) =>
  execute(
    run,
    scenario,
    {
      kind: 'process',
      event: injected(run, 'APPOINTMENT_CANCELLED', {
        appointment_id: appointmentId,
        ...(reason ? { reason } : {}),
      }),
    },
    options,
  );

/** Back to the scenario's authored beginning, under a new generation (D-087). */
export const resetCalendarRun = (
  scenario: SimulatorScenario,
  runId: string,
  database?: BloomlabDatabase,
): Promise<StoredRun> => resetStoredRun(scenario, runId, database);
