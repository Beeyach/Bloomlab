import { serviceDuration } from '../calendar/validation.ts';
import { fail } from '../errors.ts';
import { optionalString, requireString, type SimulatorEvent } from '../events.ts';
import type { AccountState, Appointment, AppointmentStatus, BookedBy, Calendar } from '../state.ts';
import { instant } from '../time.ts';
import { bumpAnalytics, count, entity, put, result, type ReducerResult } from './shared.ts';

/**
 * Appointments and their status (CAL-001, CAL-003, spec §44).
 *
 * A booking records what it was booked for — how long, with whom, for which service, at which
 * location — rather than reading those from the calendar later (D-128). That is what keeps
 * history honest: a learner who changes the calendar from 30 minutes to 45 has not silently made
 * yesterday's appointment 45 minutes long, and a replay rebuilds exactly the same booking.
 *
 * The host is its own reference and is never the contact's owner or the opportunity's owner
 * (D-130). They can name the same user and they answer different questions.
 */

const STATUSES: readonly AppointmentStatus[] = [
  'booked',
  'confirmed',
  'cancelled',
  'showed',
  'no_show',
];

function readStatus(value: unknown, eventType: string): AppointmentStatus {
  if (typeof value !== 'string' || !STATUSES.includes(value as AppointmentStatus)) {
    fail('INVALID_PAYLOAD', `${eventType} needs one of ${STATUSES.join(', ')}`, { status: value });
  }
  return value as AppointmentStatus;
}

/** Analytics keys a terminal status moves, so a report counts each outcome once. */
const STATUS_COUNTER = {
  cancelled: 'appointments_cancelled',
  showed: 'appointments_showed',
  no_show: 'appointments_no_show',
} as const;

/** The service a booking names, refusing one the calendar does not offer. */
function bookedService(calendar: Calendar, event: SimulatorEvent) {
  const serviceId = optionalString(event.payload, 'service_id');
  if (!serviceId) return null;
  const service = calendar.services.find((row) => row.id === serviceId);
  if (!service) {
    fail('UNKNOWN_ENTITY', `Calendar ${calendar.id} has no service ${serviceId}`, {
      calendar_id: calendar.id,
      service_id: serviceId,
    });
  }
  return service;
}

/** The host a booking names, refusing a user the account does not have. */
function bookedHost(account: AccountState, event: SimulatorEvent): string | null {
  const hostId = optionalString(event.payload, 'host_id');
  if (!hostId) return null;
  entity(account.users, hostId, 'user', event.type);
  return hostId;
}

/** The location a booking names, refusing one that is not on the calendar. */
function bookedLocation(calendar: Calendar, event: SimulatorEvent): string | null {
  const locationId = optionalString(event.payload, 'location_id');
  if (!locationId) return null;
  if (!calendar.locations.some((row) => row.id === locationId)) {
    fail('UNKNOWN_ENTITY', `Calendar ${calendar.id} has no location ${locationId}`, {
      calendar_id: calendar.id,
      location_id: locationId,
    });
  }
  return locationId;
}

function bookedBy(event: SimulatorEvent, fallback: BookedBy = 'customer'): BookedBy {
  const value = optionalString(event.payload, 'booked_by');
  if (value === undefined || value === null) return fallback;
  if (value !== 'customer' && value !== 'staff') {
    fail('INVALID_PAYLOAD', `${event.type} needs booked_by to be customer or staff`, {
      booked_by: value,
    });
  }
  return value;
}

export function appointmentBooked(account: AccountState, event: SimulatorEvent): ReducerResult {
  // A booking that names no id gets one from the event, which is deterministic and unique within
  // the run — so an authored injectable like "Jordan books 40 minutes from now" can be replayed
  // without the scenario having to invent an id for a record that does not exist yet.
  const id = optionalString(event.payload, 'appointment_id') ?? `appt-${event.id}`;
  if (account.appointments[id]) {
    fail('DUPLICATE_ENTITY', `An appointment ${id} already exists`, { appointment_id: id });
  }
  const contactId = requireString(event.payload, 'contact_id', event.type);
  const calendarId = requireString(event.payload, 'calendar_id', event.type);
  entity(account.contacts, contactId, 'contact', event.type);
  const calendar = entity(account.calendars, calendarId, 'calendar', event.type);
  const startsAt = requireString(event.payload, 'starts_at', event.type);
  instant(startsAt);

  const service = bookedService(calendar, event);
  const hostId = bookedHost(account, event);
  if (hostId && calendar.staff_ids.length > 0 && !calendar.staff_ids.includes(hostId)) {
    fail('INVALID_PAYLOAD', `${hostId} does not host on calendar ${calendarId}`, {
      calendar_id: calendarId,
      host_id: hostId,
    });
  }
  // The length is snapshotted here: what the booking asked for, else what the service or the
  // calendar says today. A later calendar edit never reaches back into it (D-128).
  const duration =
    typeof event.payload.duration_minutes === 'number'
      ? event.payload.duration_minutes
      : serviceDuration(calendar, service);
  if (!Number.isInteger(duration) || duration <= 0) {
    fail('INVALID_PAYLOAD', `${event.type} needs a duration longer than nothing`, {
      duration_minutes: duration,
    });
  }

  const appointment: Appointment = {
    id,
    contact_id: contactId,
    calendar_id: calendarId,
    starts_at: startsAt,
    duration_minutes: duration,
    host_id: hostId,
    service_id: service?.id ?? null,
    location_id:
      bookedLocation(calendar, event) ?? service?.location_id ?? calendar.default_location_id,
    booked_by: bookedBy(event),
    status: 'booked',
    created_at: event.at,
    updated_at: event.at,
  };
  const next = bumpAnalytics(
    { ...account, appointments: put(account.appointments, id, appointment) },
    count(account.analytics, 'appointments_booked'),
  );
  return result(next, [
    {
      kind: 'input',
      at: event.at,
      contact_id: contactId,
      event_id: event.id,
      data: {
        appointment_id: id,
        calendar_id: calendarId,
        starts_at: startsAt,
        duration_minutes: duration,
        host_id: hostId,
        service_id: appointment.service_id,
        location_id: appointment.location_id,
        booked_by: appointment.booked_by,
      },
    },
  ]);
}

export function appointmentRescheduled(
  account: AccountState,
  event: SimulatorEvent,
): ReducerResult {
  const id = requireString(event.payload, 'appointment_id', event.type);
  const existing = entity(account.appointments, id, 'appointment', event.type);
  const startsAt = requireString(event.payload, 'starts_at', event.type);
  instant(startsAt);
  if (existing.status === 'cancelled') {
    fail('INVALID_PAYLOAD', `Appointment ${id} was cancelled and cannot be rescheduled`, {
      appointment_id: id,
    });
  }
  const calendar = account.calendars[existing.calendar_id] ?? null;
  const hostId = optionalString(event.payload, 'host_id') ?? existing.host_id;
  if (hostId && hostId !== existing.host_id) entity(account.users, hostId, 'user', event.type);
  if (hostId && calendar && calendar.staff_ids.length > 0 && !calendar.staff_ids.includes(hostId)) {
    fail('INVALID_PAYLOAD', `${hostId} does not host on calendar ${existing.calendar_id}`, {
      calendar_id: existing.calendar_id,
      host_id: hostId,
    });
  }
  const updated: Appointment = {
    ...existing,
    starts_at: startsAt,
    // A reschedule may land on a different host; everything else the booking was made for
    // travels with it, because the appointment moved rather than became a different one.
    host_id: hostId,
    // Rescheduling returns a confirmed appointment to merely booked, exactly as it does in GHL.
    status: 'booked',
    booked_by: bookedBy(event, existing.booked_by),
    updated_at: event.at,
  };
  return result({ ...account, appointments: put(account.appointments, id, updated) }, [
    {
      kind: 'step_completed',
      at: event.at,
      contact_id: existing.contact_id,
      event_id: event.id,
      data: {
        appointment_id: id,
        from: existing.starts_at,
        to: startsAt,
        host_id: hostId,
        from_host_id: existing.host_id,
      },
    },
  ]);
}

export function appointmentCancelled(account: AccountState, event: SimulatorEvent): ReducerResult {
  const id = requireString(event.payload, 'appointment_id', event.type);
  const existing = entity(account.appointments, id, 'appointment', event.type);
  const updated: Appointment = { ...existing, status: 'cancelled', updated_at: event.at };
  const next = bumpAnalytics(
    { ...account, appointments: put(account.appointments, id, updated) },
    existing.status === 'cancelled' ? {} : count(account.analytics, 'appointments_cancelled'),
  );
  return result(next, [
    {
      kind: 'step_completed',
      at: event.at,
      contact_id: existing.contact_id,
      event_id: event.id,
      data: { appointment_id: id, from: existing.status },
      reason: optionalString(event.payload, 'reason'),
    },
  ]);
}

export function appointmentStatusChanged(
  account: AccountState,
  event: SimulatorEvent,
): ReducerResult {
  const id = requireString(event.payload, 'appointment_id', event.type);
  const existing = entity(account.appointments, id, 'appointment', event.type);
  const status = readStatus(event.payload.status, event.type);
  if (existing.status === status) {
    // Marking an appointment with the status it already has changes nothing, so it fires no
    // trigger and ends no run — the same rule as re-adding a tag a contact already carries.
    return result(account, [
      {
        kind: 'action_skipped',
        at: event.at,
        contact_id: existing.contact_id,
        event_id: event.id,
        data: { appointment_id: id, status },
        reason: 'status_unchanged',
      },
    ]);
  }
  const updated: Appointment = { ...existing, status, updated_at: event.at };
  const counter = STATUS_COUNTER[status as keyof typeof STATUS_COUNTER];
  const next = bumpAnalytics(
    { ...account, appointments: put(account.appointments, id, updated) },
    counter && existing.status !== status ? count(account.analytics, counter) : {},
  );
  return result(next, [
    {
      kind: 'step_completed',
      at: event.at,
      contact_id: existing.contact_id,
      event_id: event.id,
      data: { appointment_id: id, from: existing.status, to: status },
    },
  ]);
}
