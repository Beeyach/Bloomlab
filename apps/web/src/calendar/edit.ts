import type {
  AssignmentStrategy,
  AvailabilityWindow,
  Calendar,
  CalendarLocation,
  CalendarService,
  CalendarType,
  LocationKind,
} from '@bloomlab/simulator-core';

import { newLocationId, newServiceId } from './commands';

/**
 * Pure edits to a calendar draft (CAL-001).
 *
 * Every function here takes a definition and returns a new one. Nothing reaches the account,
 * nothing produces an event, nothing reads a clock. The Lab holds the result as a draft until
 * the learner saves, and the save is the one event that reaches the shared run (D-126).
 *
 * A few of these keep the definition coherent rather than merely applying a field: removing a
 * location clears the services that pointed at it, changing the type resets an assignment rule
 * that no longer means anything, and removing a team member takes them off the services too.
 * The alternative is a definition the reducer would refuse, which is a worse thing to hand a
 * learner than a small tidy-up they can see.
 */

export const rename = (calendar: Calendar, name: string): Calendar => ({ ...calendar, name });

export const setDuration = (calendar: Calendar, minutes: number): Calendar => ({
  ...calendar,
  duration_minutes: minutes,
  // A slot interval that still matches the old length is following the duration, not set apart
  // from it, so it follows this change too. One the learner moved themselves is left alone.
  slot_interval_minutes:
    calendar.slot_interval_minutes === calendar.duration_minutes
      ? minutes
      : calendar.slot_interval_minutes,
});

export const setNumber = (
  calendar: Calendar,
  field:
    | 'slot_interval_minutes'
    | 'pre_buffer_minutes'
    | 'post_buffer_minutes'
    | 'minimum_notice_minutes'
    | 'booking_window_days',
  value: number,
): Calendar => ({ ...calendar, [field]: value });

export const setTimezone = (calendar: Calendar, timezone: string | null): Calendar => ({
  ...calendar,
  timezone,
});

/**
 * Changing the family changes what the other settings can mean, so the ones that no longer do
 * are put back: a personal calendar keeps one host and has no services, and round robin gets a
 * distribution rule instead of a single host.
 */
export function setType(calendar: Calendar, type: CalendarType): Calendar {
  if (type === calendar.type) return calendar;
  const staff =
    type === 'personal' || type === 'class' ? calendar.staff_ids.slice(0, 1) : calendar.staff_ids;
  return {
    ...calendar,
    type,
    ...(type === 'class' ? { seats_per_class: calendar.seats_per_class ?? 1 } : {}),
    staff_ids: staff,
    assignment: type === 'round_robin' ? 'optimize_availability' : 'single',
    staff_selection: type === 'round_robin' ? calendar.staff_selection : false,
    services: type === 'service' ? calendar.services : [],
  };
}

export const setAssignment = (calendar: Calendar, assignment: AssignmentStrategy): Calendar => ({
  ...calendar,
  assignment,
});

export const setStaffSelection = (calendar: Calendar, allowed: boolean): Calendar => ({
  ...calendar,
  staff_selection: allowed,
});

/* ---- availability --------------------------------------------------------------------- */

const byDayThenTime = (a: AvailabilityWindow, b: AvailabilityWindow): number =>
  a.day - b.day || a.start.localeCompare(b.start);

export const addWindow = (
  calendar: Calendar,
  window: AvailabilityWindow = { day: 1, start: '09:00', end: '17:00' },
): Calendar => ({
  ...calendar,
  availability: [...calendar.availability, window].sort(byDayThenTime),
});

export const editWindow = (
  calendar: Calendar,
  index: number,
  patch: Partial<AvailabilityWindow>,
): Calendar => ({
  ...calendar,
  availability: calendar.availability
    .map((row, at) => (at === index ? { ...row, ...patch } : row))
    .sort(byDayThenTime),
});

export const removeWindow = (calendar: Calendar, index: number): Calendar => ({
  ...calendar,
  availability: calendar.availability.filter((_row, at) => at !== index),
});

/** The same hours on every weekday, which is what most working calendars actually are. */
export const setWeekdays = (calendar: Calendar, start: string, end: string): Calendar => ({
  ...calendar,
  availability: [1, 2, 3, 4, 5].map((day) => ({ day, start, end })),
});

/* ---- staff ---------------------------------------------------------------------------- */

export function addStaff(calendar: Calendar, userId: string): Calendar {
  if (calendar.staff_ids.includes(userId)) return calendar;
  if (calendar.type === 'personal' || calendar.type === 'class')
    return { ...calendar, staff_ids: [userId] };
  return { ...calendar, staff_ids: [...calendar.staff_ids, userId] };
}

/** Taking somebody off the calendar takes them off its services too, so nothing dangles. */
export function removeStaff(calendar: Calendar, userId: string): Calendar {
  return {
    ...calendar,
    staff_ids: calendar.staff_ids.filter((id) => id !== userId),
    services: calendar.services.map((service) => ({
      ...service,
      staff_ids: service.staff_ids.filter((id) => id !== userId),
    })),
    staff_selection: calendar.staff_ids.length <= 1 ? false : calendar.staff_selection,
  };
}

/** Moves a team member up or down the order, which is what the distribution rules break ties on. */
export function moveStaff(calendar: Calendar, userId: string, by: number): Calendar {
  const from = calendar.staff_ids.indexOf(userId);
  const to = from + by;
  if (from === -1 || to < 0 || to >= calendar.staff_ids.length) return calendar;
  const next = [...calendar.staff_ids];
  next.splice(from, 1);
  next.splice(to, 0, userId);
  return { ...calendar, staff_ids: next };
}

/* ---- services and locations ------------------------------------------------------------ */

export const addService = (calendar: Calendar, name = 'New service'): Calendar => ({
  ...calendar,
  services: [
    ...calendar.services,
    { id: newServiceId(), name, duration_minutes: null, staff_ids: [], location_id: null },
  ],
});

export const editService = (
  calendar: Calendar,
  serviceId: string,
  patch: Partial<CalendarService>,
): Calendar => ({
  ...calendar,
  services: calendar.services.map((service) =>
    service.id === serviceId ? { ...service, ...patch } : service,
  ),
});

export function toggleServiceStaff(
  calendar: Calendar,
  serviceId: string,
  userId: string,
): Calendar {
  return {
    ...calendar,
    services: calendar.services.map((service) =>
      service.id === serviceId
        ? {
            ...service,
            staff_ids: service.staff_ids.includes(userId)
              ? service.staff_ids.filter((id) => id !== userId)
              : [...service.staff_ids, userId],
          }
        : service,
    ),
  };
}

export const removeService = (calendar: Calendar, serviceId: string): Calendar => ({
  ...calendar,
  services: calendar.services.filter((service) => service.id !== serviceId),
});

export const addLocation = (
  calendar: Calendar,
  kind: LocationKind = 'address',
  value: string | null = null,
): Calendar => {
  const location: CalendarLocation = { id: newLocationId(), kind, value };
  return {
    ...calendar,
    locations: [...calendar.locations, location],
    default_location_id: calendar.default_location_id ?? location.id,
  };
};

export const editLocation = (
  calendar: Calendar,
  locationId: string,
  patch: Partial<CalendarLocation>,
): Calendar => ({
  ...calendar,
  locations: calendar.locations.map((location) =>
    location.id === locationId ? { ...location, ...patch } : location,
  ),
});

/** Removing a location takes it off the services and the default, so nothing points at a ghost. */
export function removeLocation(calendar: Calendar, locationId: string): Calendar {
  const locations = calendar.locations.filter((location) => location.id !== locationId);
  return {
    ...calendar,
    locations,
    default_location_id:
      calendar.default_location_id === locationId
        ? (locations[0]?.id ?? null)
        : calendar.default_location_id,
    services: calendar.services.map((service) =>
      service.location_id === locationId ? { ...service, location_id: null } : service,
    ),
  };
}

export const setDefaultLocation = (calendar: Calendar, locationId: string | null): Calendar => ({
  ...calendar,
  default_location_id: locationId,
});

/* ---- booker controls ------------------------------------------------------------------- */

export const setBookingRule = (
  calendar: Calendar,
  patch: Partial<Calendar['booking']>,
): Calendar => ({ ...calendar, booking: { ...calendar.booking, ...patch } });

/** True when two definitions describe the same calendar; the version is not part of that. */
export const sameDefinition = (a: Calendar, b: Calendar): boolean => {
  const { version: _a, ...left } = a;
  const { version: _b, ...right } = b;
  return JSON.stringify(left) === JSON.stringify(right);
};
