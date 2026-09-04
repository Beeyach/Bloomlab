import type { AccountState, Calendar, CalendarService } from '../state.ts';
import {
  MINUTE_MS,
  formatInstant,
  instant,
  instantForDay,
  partsIn,
  type ZonedParts,
} from '../time.ts';
import { assignHost, type AssignmentReason } from './assignment.ts';
import { minutesOfDay, serviceDuration } from './validation.ts';

/**
 * The one answer to "what times can be booked" (CAL-001, D-129).
 *
 * Calendar Lab and Funnel Lab both call this. There is no second slot calculator anywhere in
 * Bloomlab, and there is no rule about availability in a React component. Everything the answer
 * depends on is data the run holds: the simulator clock, the calendar's zone, its weekly working
 * hours, its duration, its buffers, its minimum notice, the appointments already in the account
 * and who is free to host. No `Date.now()`, no `Math.random()`, no device zone.
 *
 * ## Buffers
 *
 * A buffer is a padded region around an appointment, and a slot is refused when the padding of
 * either side reaches into the other's real time. That is what makes HighLevel's own example
 * come out right: a 10:00–10:30 appointment with a 15-minute buffer leaves 10:45 bookable, not
 * 11:00, because two paddings never have to clear each other.
 *
 * ## Who is busy
 *
 * An appointment with a host occupies that person everywhere — you cannot be on two calls at
 * once, whichever calendar took the booking. An appointment with no host occupies its own
 * calendar. A cancelled appointment occupies nothing, which is what makes a cancellation free
 * the time again.
 */

export interface Slot {
  starts_at: string;
  ends_at: string;
  duration_minutes: number;
  /** Team members who could actually take this slot, in the calendar's own order. */
  eligible_staff_ids: string[];
  /** The host the calendar's assignment rule picks. Null on a calendar with no team. */
  host_id: string | null;
  host_reason: AssignmentReason;
}

export interface SlotQuery {
  /** The service being booked, when the calendar has any. */
  service_id?: string | null;
  /** A host the booker asked for, honoured only when the calendar allows staff selection. */
  staff_id?: string | null;
  /**
   * Historical duration to preserve while moving an existing appointment. New bookings omit it
   * and take the current service/calendar duration.
   */
  duration_minutes?: number | null;
  /** Stop after this many. Omit for every slot inside the booking window. */
  limit?: number;
  /** Treat this appointment as if it were not there — what a reschedule needs. */
  ignore_appointment_id?: string | null;
}

/** Days are never walked further than this, whatever a definition asks for. */
export const MAX_BOOKING_WINDOW_DAYS = 60;
/** A hard ceiling on candidates examined in one call, so a bad definition cannot hang a tab. */
const MAX_CANDIDATES = 4000;

/** The zone a calendar answers in: its own when it sets one, else the account's (SIM-006). */
export const calendarZone = (account: AccountState, calendar: Calendar): string =>
  calendar.timezone ?? account.account.timezone;

export const serviceOf = (calendar: Calendar, serviceId: string | null | undefined) =>
  serviceId ? (calendar.services.find((row) => row.id === serviceId) ?? null) : null;

/** The location a booking lands on: the service's when it names one, else the calendar's default. */
export const locationFor = (calendar: Calendar, service: CalendarService | null): string | null =>
  service?.location_id ?? calendar.default_location_id;

/* ---- who is busy ---------------------------------------------------------------------- */

interface Busy {
  from: number;
  to: number;
  padded_from: number;
  padded_to: number;
  host_id: string | null;
  calendar_id: string;
}

const overlaps = (aFrom: number, aTo: number, bFrom: number, bTo: number): boolean =>
  aFrom < bTo && bFrom < aTo;

function busyIntervals(account: AccountState, ignoreAppointmentId: string | null): Busy[] {
  const rows: Busy[] = [];
  for (const appointment of Object.values(account.appointments)) {
    if (appointment.status === 'cancelled') continue;
    if (appointment.id === ignoreAppointmentId) continue;
    const held = account.calendars[appointment.calendar_id];
    const minutes = appointment.duration_minutes || (held?.duration_minutes ?? 30);
    const from = instant(appointment.starts_at);
    const to = from + minutes * MINUTE_MS;
    rows.push({
      from,
      to,
      padded_from: from - (held?.pre_buffer_minutes ?? 0) * MINUTE_MS,
      padded_to: to + (held?.post_buffer_minutes ?? 0) * MINUTE_MS,
      host_id: appointment.host_id,
      calendar_id: appointment.calendar_id,
    });
  }
  return rows.sort((a, b) => a.from - b.from);
}

/** Whether this existing booking is in the way of a candidate on `calendar` hosted by `hostId`. */
const inTheWay = (busy: Busy, calendarId: string, hostId: string | null): boolean =>
  hostId !== null
    ? busy.host_id === hostId || (busy.host_id === null && busy.calendar_id === calendarId)
    : busy.calendar_id === calendarId;

function isFree(
  busy: readonly Busy[],
  calendar: Calendar,
  hostId: string | null,
  from: number,
  to: number,
): boolean {
  const paddedFrom = from - calendar.pre_buffer_minutes * MINUTE_MS;
  const paddedTo = to + calendar.post_buffer_minutes * MINUTE_MS;
  for (const row of busy) {
    if (!inTheWay(row, calendar.id, hostId)) continue;
    if (overlaps(paddedFrom, paddedTo, row.from, row.to)) return false;
    if (overlaps(from, to, row.padded_from, row.padded_to)) return false;
  }
  return true;
}

/* ---- working hours -------------------------------------------------------------------- */

/** ISO weekday for a wall-clock date: 1 = Monday … 7 = Sunday. */
export function isoWeekday(parts: ZonedParts): number {
  const day = new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
  return day === 0 ? 7 : day;
}

const pad = (value: number, width = 2): string => String(value).padStart(width, '0');

export const calendarDay = (parts: ZonedParts): string =>
  `${pad(parts.year, 4)}-${pad(parts.month)}-${pad(parts.day)}`;

interface DayWindow {
  from: number;
  to: number;
}

/**
 * The working windows for one calendar day, as instants, merged so overlapping definitions can
 * never offer the same time twice. A definition with overlaps is reported as an error by
 * `validateCalendar`; merging here means it still cannot corrupt an answer in the meantime.
 */
function windowsOn(calendar: Calendar, day: string, zone: string): DayWindow[] {
  const parts = partsIn(instant(instantForDay(day, zone, 12, 0)), zone);
  const weekday = isoWeekday(parts);
  const spans: DayWindow[] = [];
  for (const hours of calendar.availability) {
    if (hours.day !== weekday) continue;
    const start = minutesOfDay(hours.start);
    const end = minutesOfDay(hours.end);
    if (start === null || end === null || end <= start) continue;
    spans.push({
      from: instant(instantForDay(day, zone, Math.floor(start / 60), start % 60)),
      to: instant(instantForDay(day, zone, Math.floor(end / 60), end % 60)),
    });
  }
  spans.sort((a, b) => a.from - b.from);
  const merged: DayWindow[] = [];
  for (const span of spans) {
    const last = merged[merged.length - 1];
    if (last && span.from <= last.to) last.to = Math.max(last.to, span.to);
    else merged.push({ ...span });
  }
  return merged;
}

/* ---- slots ---------------------------------------------------------------------------- */

/** The team members who may take this service at all, before availability is considered. */
export function candidateStaff(calendar: Calendar, service: CalendarService | null): string[] {
  if (calendar.staff_ids.length === 0) return [];
  if (!service || service.staff_ids.length === 0) return [...calendar.staff_ids];
  return calendar.staff_ids.filter((id) => service.staff_ids.includes(id));
}

/**
 * Whether the calendar itself can be the resource when no team member is on it.
 *
 * A personal calendar with nobody assigned is a solo operator's calendar and still books. Round
 * robin has nothing to distribute, and HighLevel will not show a service's staff in the booking
 * flow until somebody is assigned to it — so both of those offer nothing rather than quietly
 * booking a meeting with no one in it.
 */
export const booksWithoutStaff = (calendar: Calendar): boolean => calendar.type === 'personal';

/** The earliest instant a booking made now may start: the clock plus the minimum notice. */
export const earliestStart = (calendar: Calendar, now: string): number =>
  instant(now) + Math.max(0, calendar.minimum_notice_minutes) * MINUTE_MS;

function slotFrom(
  account: AccountState,
  calendar: Calendar,
  zone: string,
  busy: readonly Busy[],
  from: number,
  minutes: number,
  staff: readonly string[],
  query: SlotQuery,
): Slot | null {
  const to = from + minutes * MINUTE_MS;
  const startsAt = formatInstant(from, zone);
  const requested = query.staff_id ?? null;
  const considered =
    requested && calendar.staff_selection && staff.includes(requested) ? [requested] : staff;

  if (staff.length === 0) {
    if (!isFree(busy, calendar, null, from, to)) return null;
    return {
      starts_at: startsAt,
      ends_at: formatInstant(to, zone),
      duration_minutes: minutes,
      eligible_staff_ids: [],
      host_id: null,
      host_reason: 'no_staff',
    };
  }

  const eligible = considered.filter((userId) => isFree(busy, calendar, userId, from, to));
  if (eligible.length === 0) return null;
  const assignment = assignHost(account, calendar, startsAt, zone, eligible, {
    requested_staff_id: requested,
    ignore_appointment_id: query.ignore_appointment_id ?? null,
  });
  return {
    starts_at: startsAt,
    ends_at: formatInstant(to, zone),
    duration_minutes: minutes,
    eligible_staff_ids: eligible,
    host_id: assignment.host_id,
    host_reason: assignment.reason,
  };
}

/**
 * Every time this calendar can currently be booked, earliest first.
 *
 * The walk is bounded twice over: by the calendar's own booking window, capped at
 * `MAX_BOOKING_WINDOW_DAYS`, and by a hard candidate ceiling. A definition that offers nothing
 * returns an empty list rather than spinning — a Monday-only calendar asked on a Tuesday is a
 * correct empty answer, not an error.
 */
export function bookableSlots(
  account: AccountState,
  calendar: Calendar,
  now: string,
  query: SlotQuery = {},
): Slot[] {
  const zone = calendarZone(account, calendar);
  const service = serviceOf(calendar, query.service_id);
  const minutes = query.duration_minutes ?? serviceDuration(calendar, service);
  if (!Number.isInteger(minutes) || minutes <= 0 || calendar.slot_interval_minutes <= 0) return [];

  const staff = candidateStaff(calendar, service);
  if (staff.length === 0 && !booksWithoutStaff(calendar)) return [];
  const requested = query.staff_id ?? null;
  if (requested && calendar.staff_selection && !staff.includes(requested)) return [];

  const busy = busyIntervals(account, query.ignore_appointment_id ?? null);
  const earliest = earliestStart(calendar, now);
  const days = Math.min(Math.max(1, calendar.booking_window_days), MAX_BOOKING_WINDOW_DAYS);
  const limit = query.limit ?? Number.MAX_SAFE_INTEGER;
  const durationMs = minutes * MINUTE_MS;
  const intervalMs = calendar.slot_interval_minutes * MINUTE_MS;

  const slots: Slot[] = [];
  let examined = 0;
  const startParts = partsIn(earliest, zone);
  let cursorDay = calendarDay(startParts);
  for (let dayIndex = 0; dayIndex < days && slots.length < limit; dayIndex += 1) {
    for (const open of windowsOn(calendar, cursorDay, zone)) {
      for (let from = open.from; from + durationMs <= open.to; from += intervalMs) {
        if (from < earliest) continue;
        examined += 1;
        if (examined > MAX_CANDIDATES) return slots;
        const slot = slotFrom(account, calendar, zone, busy, from, minutes, staff, query);
        if (slot) slots.push(slot);
        if (slots.length >= limit) break;
      }
      if (slots.length >= limit) break;
    }
    cursorDay = nextDay(cursorDay, zone);
  }
  return slots;
}

/** The calendar day after this one, in the calendar's zone. Midday avoids every DST edge. */
function nextDay(day: string, zone: string): string {
  const noon = instant(instantForDay(day, zone, 12, 0));
  return calendarDay(partsIn(noon + 24 * 60 * MINUTE_MS, zone));
}

/**
 * The slot that starts at exactly this instant, or null when the calendar does not offer it.
 *
 * This is what a booking and a reschedule are checked against, so an instant a learner types, an
 * old link, or a slot that was taken while they were deciding is refused by the same rule that
 * produced the list — there is no second, looser check anywhere.
 */
export function slotAt(
  account: AccountState,
  calendar: Calendar,
  now: string,
  startsAt: string,
  query: SlotQuery = {},
): Slot | null {
  const target = instant(startsAt);
  const earliest = earliestStart(calendar, now);
  if (target < earliest) return null;
  const zone = calendarZone(account, calendar);
  const service = serviceOf(calendar, query.service_id);
  const minutes = query.duration_minutes ?? serviceDuration(calendar, service);
  if (!Number.isInteger(minutes) || minutes <= 0 || calendar.slot_interval_minutes <= 0)
    return null;
  const staff = candidateStaff(calendar, service);
  if (staff.length === 0 && !booksWithoutStaff(calendar)) return null;
  const requested = query.staff_id ?? null;
  if (requested && calendar.staff_selection && !staff.includes(requested)) return null;

  // An exact lookup has the same booking horizon as the list. Otherwise an old/deep link could
  // name a perfectly shaped time months beyond the calendar's configured booking window and pass
  // a looser check than the slot picker itself.
  const day = calendarDay(partsIn(target, zone));
  const days = Math.min(Math.max(1, calendar.booking_window_days), MAX_BOOKING_WINDOW_DAYS);
  let cursorDay = calendarDay(partsIn(earliest, zone));
  let insideBookingWindow = false;
  for (let index = 0; index < days; index += 1) {
    if (cursorDay === day) {
      insideBookingWindow = true;
      break;
    }
    cursorDay = nextDay(cursorDay, zone);
  }
  if (!insideBookingWindow) return null;

  // The instant must be one of the starts the calendar would actually offer, not merely anywhere
  // inside a working window. The interval is anchored to each availability window's opening.
  const intervalMs = calendar.slot_interval_minutes * MINUTE_MS;
  const fits = windowsOn(calendar, day, zone).some(
    (open) =>
      target >= open.from &&
      target + minutes * MINUTE_MS <= open.to &&
      (target - open.from) % intervalMs === 0,
  );
  if (!fits) return null;

  const busy = busyIntervals(account, query.ignore_appointment_id ?? null);
  return slotFrom(account, calendar, zone, busy, target, minutes, staff, query);
}

/** Slots for a calendar named by id — what the Funnel Lab's calendar block asks for. */
export function slotsForCalendar(
  account: AccountState,
  calendarId: string,
  now: string,
  query: SlotQuery = {},
): Slot[] {
  const calendar = account.calendars[calendarId];
  return calendar ? bookableSlots(account, calendar, now, query) : [];
}
