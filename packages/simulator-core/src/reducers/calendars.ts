import { fail } from '../errors.ts';
import { requireString, type SimulatorEvent } from '../events.ts';
import {
  ASSIGNMENT_STRATEGIES,
  CALENDAR_TYPES,
  LOCATION_KINDS,
  type AccountState,
  type AssignmentStrategy,
  type AvailabilityWindow,
  type Calendar,
  type CalendarLocation,
  type CalendarService,
  type CalendarType,
  type LocationKind,
} from '../state.ts';
import { isValidTimeZone } from '../time.ts';
import { minutesOfDay } from '../calendar/validation.ts';
import { entity, put, result, type ReducerResult } from './shared.ts';

/**
 * Calendar definitions as account events (CAL-001, D-126).
 *
 * The third feature to follow the pattern workflows established (D-107) and funnels reused
 * (D-119): the learner's configuration reaches the shared account as an event the engine
 * validates, applies, logs, versions and can replay. So Calendar Lab keeps no store of its own,
 * a saved calendar survives reload, reset, replay and sync for free, and every other Lab reads
 * the same calendar the learner just changed.
 *
 * What a save refuses is what would corrupt the account: a malformed shape, a host the account
 * does not have, a service pointing at a location that is not on the calendar, a negative buffer,
 * a zone this runtime cannot resolve, two windows or services with the same id. What a save
 * allows is unfinished work — a round robin with nobody on it yet, a service calendar with no
 * services, a week with no hours — because an editor has to be able to save halfway. That is what
 * `validateCalendar` reports, in words, while the learner keeps going.
 */

const ID = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

function whole(
  value: unknown,
  field: string,
  calendarId: string,
  eventType: string,
  { min = 0, fallback }: { min?: number; fallback?: number } = {},
): number {
  if (value === undefined || value === null) {
    if (fallback !== undefined) return fallback;
    fail('INVALID_PAYLOAD', `Calendar ${calendarId} needs ${field}`, { calendar_id: calendarId });
  }
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min) {
    fail(
      'INVALID_PAYLOAD',
      `${eventType}: calendar ${calendarId} needs ${field} as a whole number of ${min > 0 ? 'at least ' + min : '0 or more'}`,
      { calendar_id: calendarId, field, value },
    );
  }
  return value;
}

function uniqueIds(rows: readonly { id: string }[], what: string, calendarId: string): void {
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.id)) {
      fail('DUPLICATE_ENTITY', `Calendar ${calendarId} has two ${what} called ${row.id}`, {
        calendar_id: calendarId,
        id: row.id,
      });
    }
    seen.add(row.id);
  }
}

/** Turns the payload's `calendar` into a definition, refusing anything malformed. */
export function readCalendar(
  raw: unknown,
  eventType: string,
  version: number,
  account: AccountState,
): Calendar {
  if (!isRecord(raw)) fail('INVALID_PAYLOAD', `${eventType} needs a calendar object`, { raw });
  const candidate = raw;
  const id = typeof candidate.id === 'string' && ID.test(candidate.id) ? candidate.id : null;
  if (!id) fail('INVALID_PAYLOAD', `${eventType} needs a calendar id`, { id: candidate.id });
  const name = text(candidate.name);
  if (!name) fail('INVALID_PAYLOAD', `Calendar ${id} needs a name`, { calendar_id: id });

  const type = (candidate.type ?? 'personal') as string;
  if (!(CALENDAR_TYPES as readonly string[]).includes(type)) {
    fail('INVALID_PAYLOAD', `Calendar ${id} has an unknown type ${type}`, { calendar_id: id });
  }
  const timezone = typeof candidate.timezone === 'string' ? candidate.timezone : null;
  if (timezone !== null && !isValidTimeZone(timezone)) {
    fail('INVALID_TIMEZONE', `Calendar ${id} names a zone this runtime cannot resolve`, {
      calendar_id: id,
      timezone,
    });
  }

  const duration = whole(candidate.duration_minutes, 'a duration', id, eventType, { min: 1 });
  const interval = whole(candidate.slot_interval_minutes, 'a slot interval', id, eventType, {
    min: 1,
    fallback: duration,
  });

  const staffIds = readStaff(candidate.staff_ids, id, eventType, account);
  const assignment = readAssignment(candidate.assignment, type as CalendarType, id, eventType);
  const locations = readLocations(candidate.locations, id, eventType);
  uniqueIds(locations, 'locations', id);
  const services = readServices(candidate.services, id, eventType, locations);
  uniqueIds(services, 'services', id);
  const availability = readAvailability(candidate.availability, id, eventType);

  const defaultLocation =
    typeof candidate.default_location_id === 'string' ? candidate.default_location_id : null;
  if (defaultLocation !== null && !locations.some((row) => row.id === defaultLocation)) {
    fail('UNKNOWN_ENTITY', `Calendar ${id}: the default location is not on this calendar`, {
      calendar_id: id,
      location_id: defaultLocation,
    });
  }

  const booking = isRecord(candidate.booking) ? candidate.booking : {};
  const cutoffRaw = booking.change_cutoff_hours;
  const cutoff =
    cutoffRaw === undefined || cutoffRaw === null
      ? null
      : whole(cutoffRaw, 'a cancellation cutoff', id, eventType, { min: 0 });

  return {
    id,
    name,
    type: type as CalendarType,
    timezone,
    duration_minutes: duration,
    slot_interval_minutes: interval,
    pre_buffer_minutes: whole(candidate.pre_buffer_minutes, 'a pre buffer', id, eventType, {
      fallback: 0,
    }),
    post_buffer_minutes: whole(candidate.post_buffer_minutes, 'a post buffer', id, eventType, {
      fallback: 0,
    }),
    minimum_notice_minutes: whole(
      candidate.minimum_notice_minutes,
      'a minimum notice',
      id,
      eventType,
      { fallback: 0 },
    ),
    booking_window_days: whole(candidate.booking_window_days, 'a booking window', id, eventType, {
      min: 1,
      fallback: 30,
    }),
    availability,
    staff_ids: staffIds,
    assignment,
    staff_selection: candidate.staff_selection === true,
    services,
    locations,
    default_location_id: defaultLocation,
    booking: {
      cancellation_allowed: booking.cancellation_allowed !== false,
      reschedule_allowed: booking.reschedule_allowed !== false,
      change_cutoff_hours: cutoff,
    },
    version,
  };
}

function readStaff(
  raw: unknown,
  calendarId: string,
  eventType: string,
  account: AccountState,
): string[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) {
    fail('INVALID_PAYLOAD', `Calendar ${calendarId} needs a list of team members`, {
      calendar_id: calendarId,
    });
  }
  return (raw as unknown[]).map((value) => {
    if (typeof value !== 'string') {
      fail('INVALID_PAYLOAD', `Calendar ${calendarId} has a team member that is not a user id`, {
        calendar_id: calendarId,
        value,
      });
    }
    // A dangling host is refused rather than reported: a calendar that assigns somebody the
    // account does not have would put a name on an appointment that means nothing (D-130).
    entity(account.users, value, 'user', eventType);
    return value;
  });
}

function readAssignment(
  raw: unknown,
  type: CalendarType,
  calendarId: string,
  eventType: string,
): AssignmentStrategy {
  if (raw === undefined || raw === null)
    return type === 'round_robin' ? 'optimize_availability' : 'single';
  if (!(ASSIGNMENT_STRATEGIES as readonly string[]).includes(raw as string)) {
    fail('INVALID_PAYLOAD', `${eventType}: calendar ${calendarId} has an unknown assignment rule`, {
      calendar_id: calendarId,
      assignment: raw,
    });
  }
  return raw as AssignmentStrategy;
}

function readAvailability(
  raw: unknown,
  calendarId: string,
  eventType: string,
): AvailabilityWindow[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) {
    fail('INVALID_PAYLOAD', `Calendar ${calendarId} needs a list of working windows`, {
      calendar_id: calendarId,
    });
  }
  return (raw as unknown[]).map((value, index) => {
    if (!isRecord(value)) {
      fail('INVALID_PAYLOAD', `Calendar ${calendarId} window ${index + 1} is not a window`, {
        calendar_id: calendarId,
      });
    }
    const day = value.day;
    if (typeof day !== 'number' || !Number.isInteger(day) || day < 1 || day > 7) {
      fail(
        'INVALID_PAYLOAD',
        `${eventType}: calendar ${calendarId} window ${index + 1} needs a day from 1 to 7`,
        { calendar_id: calendarId, day },
      );
    }
    const start = typeof value.start === 'string' ? value.start : '';
    const end = typeof value.end === 'string' ? value.end : '';
    if (minutesOfDay(start) === null || minutesOfDay(end) === null) {
      fail(
        'INVALID_PAYLOAD',
        `${eventType}: calendar ${calendarId} window ${index + 1} needs HH:MM times`,
        { calendar_id: calendarId, start, end },
      );
    }
    return { day, start, end };
  });
}

function readLocations(raw: unknown, calendarId: string, eventType: string): CalendarLocation[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) {
    fail('INVALID_PAYLOAD', `Calendar ${calendarId} needs a list of locations`, {
      calendar_id: calendarId,
    });
  }
  return (raw as unknown[]).map((value, index) => {
    if (!isRecord(value) || typeof value.id !== 'string' || !ID.test(value.id)) {
      fail('INVALID_PAYLOAD', `Calendar ${calendarId} location ${index + 1} needs an id`, {
        calendar_id: calendarId,
      });
    }
    const kind = value.kind;
    if (!(LOCATION_KINDS as readonly string[]).includes(kind as string)) {
      fail('INVALID_PAYLOAD', `${eventType}: calendar ${calendarId} has an unknown location kind`, {
        calendar_id: calendarId,
        kind,
      });
    }
    return {
      id: value.id as string,
      kind: kind as LocationKind,
      value: text(value.value),
    };
  });
}

function readServices(
  raw: unknown,
  calendarId: string,
  eventType: string,
  locations: readonly CalendarLocation[],
): CalendarService[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) {
    fail('INVALID_PAYLOAD', `Calendar ${calendarId} needs a list of services`, {
      calendar_id: calendarId,
    });
  }
  const locationIds = new Set(locations.map((row) => row.id));
  return (raw as unknown[]).map((value, index) => {
    if (!isRecord(value) || typeof value.id !== 'string' || !ID.test(value.id)) {
      fail('INVALID_PAYLOAD', `Calendar ${calendarId} service ${index + 1} needs an id`, {
        calendar_id: calendarId,
      });
    }
    const shaped = value;
    const name = text(shaped.name);
    if (!name) {
      fail('INVALID_PAYLOAD', `Calendar ${calendarId} service ${shaped.id} needs a name`, {
        calendar_id: calendarId,
      });
    }
    const duration =
      shaped.duration_minutes === undefined || shaped.duration_minutes === null
        ? null
        : whole(shaped.duration_minutes, 'a service duration', calendarId, eventType, { min: 1 });
    const staff = Array.isArray(shaped.staff_ids) ? (shaped.staff_ids as unknown[]) : [];
    const locationId = typeof shaped.location_id === 'string' ? shaped.location_id : null;
    if (locationId !== null && !locationIds.has(locationId)) {
      fail(
        'UNKNOWN_ENTITY',
        `Calendar ${calendarId}: service ${shaped.id} names a location that is not here`,
        {
          calendar_id: calendarId,
          service_id: shaped.id,
          location_id: locationId,
        },
      );
    }
    return {
      id: shaped.id as string,
      name,
      duration_minutes: duration,
      staff_ids: staff.map((row) => {
        if (typeof row !== 'string') {
          fail(
            'INVALID_PAYLOAD',
            `Calendar ${calendarId} service ${shaped.id} has a bad staff id`,
            {
              calendar_id: calendarId,
            },
          );
        }
        return row;
      }),
      location_id: locationId,
    };
  });
}

const summary = (definition: Calendar) => ({
  calendar_id: definition.id,
  name: definition.name,
  type: definition.type,
  version: definition.version,
  duration_minutes: definition.duration_minutes,
  windows: definition.availability.length,
  staff: definition.staff_ids.length,
  services: definition.services.length,
});

export function calendarCreated(account: AccountState, event: SimulatorEvent): ReducerResult {
  const definition = readCalendar(event.payload.calendar, event.type, 1, account);
  if (account.calendars[definition.id]) {
    fail('DUPLICATE_ENTITY', `A calendar ${definition.id} already exists`, {
      calendar_id: definition.id,
    });
  }
  return result({ ...account, calendars: put(account.calendars, definition.id, definition) }, [
    {
      kind: 'input',
      at: event.at,
      event_id: event.id,
      data: summary(definition),
      reason: 'calendar_created',
    },
  ]);
}

export function calendarUpdated(account: AccountState, event: SimulatorEvent): ReducerResult {
  const id = requireString(event.payload, 'calendar_id', event.type);
  const existing = entity(account.calendars, id, 'calendar', event.type);
  const definition = readCalendar(
    event.payload.calendar,
    event.type,
    existing.version + 1,
    account,
  );
  if (definition.id !== id) {
    fail('INVALID_PAYLOAD', `${event.type} updates ${id} but the definition is ${definition.id}`, {
      calendar_id: id,
      definition_id: definition.id,
    });
  }
  return result({ ...account, calendars: put(account.calendars, id, definition) }, [
    {
      kind: 'input',
      at: event.at,
      event_id: event.id,
      data: summary(definition),
      reason: 'calendar_updated',
    },
  ]);
}
