import { fail } from '../errors.ts';
import { optionalString, requireString, type SimulatorEvent } from '../events.ts';
import type { AccountState, Appointment, AppointmentStatus } from '../state.ts';
import { instant } from '../time.ts';
import { bumpAnalytics, count, entity, put, result, type ReducerResult } from './shared.ts';

/** Appointments and their status (CAL-001, spec §44). Booking events later fire workflows. */

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
  entity(account.calendars, calendarId, 'calendar', event.type);
  const startsAt = requireString(event.payload, 'starts_at', event.type);
  instant(startsAt);

  const appointment: Appointment = {
    id,
    contact_id: contactId,
    calendar_id: calendarId,
    starts_at: startsAt,
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
      data: { appointment_id: id, calendar_id: calendarId, starts_at: startsAt },
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
  const updated: Appointment = {
    ...existing,
    starts_at: startsAt,
    // Rescheduling returns a confirmed appointment to merely booked, exactly as it does in GHL.
    status: 'booked',
    updated_at: event.at,
  };
  return result({ ...account, appointments: put(account.appointments, id, updated) }, [
    {
      kind: 'step_completed',
      at: event.at,
      contact_id: existing.contact_id,
      event_id: event.id,
      data: { appointment_id: id, from: existing.starts_at, to: startsAt },
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
