import { fail } from './errors.ts';

/**
 * Simulator time (spec §45, SIM-006). Every instant in a run comes from the scenario's own clock,
 * never from the machine: there is no `Date.now()` here, and no code reads the user's timezone.
 * The zone is data the scenario supplies, so the same run grades identically in Austin and Tokyo.
 *
 * Instants are stored as ISO 8601 strings carrying their offset (`2026-09-04T15:00:00-05:00`),
 * which stays readable in an event log and a snapshot, and every comparison goes through
 * `instant()` so the offset — not the text — decides order.
 */

/** Milliseconds since the epoch for an ISO 8601 instant. */
export function instant(iso: string): number {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) fail('INVALID_TIME', `Not an ISO 8601 instant: ${iso}`, { value: iso });
  return ms;
}

export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;

const FORMATTERS = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  const cached = FORMATTERS.get(timeZone);
  if (cached) return cached;
  let created: Intl.DateTimeFormat;
  try {
    created = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return fail('INVALID_TIMEZONE', `Not a timezone this runtime knows: ${timeZone}`, { timeZone });
  }
  FORMATTERS.set(timeZone, created);
  return created;
}

/** True when the runtime can resolve the zone. Timezones are data, so they are validated. */
export function isValidTimeZone(timeZone: unknown): timeZone is string {
  if (typeof timeZone !== 'string' || timeZone.length === 0) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

export interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/** The wall-clock reading a person in `timeZone` would see at this instant. */
export function partsIn(epochMs: number, timeZone: string): ZonedParts {
  const parts = formatter(timeZone).formatToParts(new Date(epochMs));
  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const found = parts.find((part) => part.type === type);
    return found ? Number(found.value) : 0;
  };
  // `hour12: false` renders midnight as 24 in some ICU versions.
  const hour = read('hour');
  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: hour === 24 ? 0 : hour,
    minute: read('minute'),
    second: read('second'),
  };
}

/** The zone's offset from UTC, in milliseconds, at a given instant. */
export function offsetAt(epochMs: number, timeZone: string): number {
  const parts = partsIn(epochMs, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return asUtc - Math.floor(epochMs / 1000) * 1000;
}

/**
 * The instant at which a zone shows this wall-clock reading. Two passes, because the offset
 * depends on the answer: guess with the offset at the naive instant, then correct once if the
 * guess landed on the other side of a daylight-saving change.
 */
export function epochFromParts(parts: ZonedParts, timeZone: string): number {
  const naive = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  const firstOffset = offsetAt(naive, timeZone);
  const guess = naive - firstOffset;
  const secondOffset = offsetAt(guess, timeZone);
  return secondOffset === firstOffset ? guess : naive - secondOffset;
}

const pad = (value: number, width = 2) => String(value).padStart(width, '0');

/** An ISO 8601 instant that says where it is: a full date-time with `Z` or a `±HH:MM` offset. */
const OFFSET_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/;

/**
 * True only for an instant carrying its offset. `Date.parse` accepts `2026-09-05T09:00:00` and
 * reads it in the host's zone, which is exactly the dependence on the machine the simulator
 * forbids, so anything a learner or a scenario supplies as an instant is checked here first.
 */
export const hasOffset = (iso: string): boolean => OFFSET_INSTANT.test(iso);

/** Milliseconds for an instant that must carry its offset; an offset-less one is refused. */
export function offsetInstant(iso: string): number {
  if (!hasOffset(iso)) {
    fail('INVALID_TIME', `Not a simulator instant (no offset): ${iso}`, { value: iso });
  }
  return instant(iso);
}

const CALENDAR_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * A calendar day and a time of day in the scenario's zone, as a canonical instant (D-098).
 *
 * This is how a date-only choice — a task due "on the 5th" — becomes simulator time: 09:00 on
 * that day *in the account's zone*, written with that zone's offset on that day, so a device in
 * Tokyo and a device in Austin store the same string for the same choice, and a daylight-saving
 * change on the day is resolved by the zone rather than by whoever happened to click.
 */
export function instantForDay(day: string, timeZone: string, hour = 9, minute = 0): string {
  const match = CALENDAR_DAY.exec(day);
  if (!match) fail('INVALID_TIME', `Not a calendar day (YYYY-MM-DD): ${day}`, { value: day });
  const [, year, month, date] = match;
  const parts: ZonedParts = {
    year: Number(year),
    month: Number(month),
    day: Number(date),
    hour,
    minute,
    second: 0,
  };
  if (parts.month < 1 || parts.month > 12 || parts.day < 1 || parts.day > 31) {
    fail('INVALID_TIME', `Not a calendar day: ${day}`, { value: day });
  }
  const epoch = epochFromParts(parts, timeZone);
  const check = partsIn(epoch, timeZone);
  if (check.year !== parts.year || check.month !== parts.month || check.day !== parts.day) {
    fail('INVALID_TIME', `No such day in the calendar: ${day}`, { value: day });
  }
  return formatInstant(epoch, timeZone);
}

/** An ISO 8601 instant written with the zone's offset, e.g. `2026-09-04T15:00:00-05:00`. */
export function formatInstant(epochMs: number, timeZone: string): string {
  const parts = partsIn(epochMs, timeZone);
  const offset = offsetAt(epochMs, timeZone);
  const sign = offset >= 0 ? '+' : '-';
  const absolute = Math.abs(offset);
  const hours = Math.floor(absolute / HOUR_MS);
  const minutes = Math.floor((absolute % HOUR_MS) / MINUTE_MS);
  return (
    `${pad(parts.year, 4)}-${pad(parts.month)}-${pad(parts.day)}` +
    `T${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}` +
    `${sign}${pad(hours)}:${pad(minutes)}`
  );
}

/**
 * Absolute durations. A minute and an hour are the same length wherever the scenario is, so they
 * are plain arithmetic on the instant.
 */
export const addMinutes = (iso: string, minutes: number, timeZone: string): string =>
  formatInstant(instant(iso) + minutes * MINUTE_MS, timeZone);

export const addHours = (iso: string, hours: number, timeZone: string): string =>
  formatInstant(instant(iso) + hours * HOUR_MS, timeZone);

/**
 * A calendar day, not 24 hours. Advancing a day keeps the wall-clock reading the scenario's zone
 * shows, so 09:00 stays 09:00 across a daylight-saving change — which is how a person running a
 * business experiences "tomorrow", and how GoHighLevel's own day-based waits behave.
 */
export function addDays(iso: string, days: number, timeZone: string): string {
  const parts = partsIn(instant(iso), timeZone);
  return formatInstant(epochFromParts({ ...parts, day: parts.day + days }, timeZone), timeZone);
}

/** Normalizes an authored instant into the run's own zone without moving it in absolute time. */
export const toZone = (iso: string, timeZone: string): string =>
  formatInstant(instant(iso), timeZone);

export const isBeforeOrAt = (a: string, b: string): boolean => instant(a) <= instant(b);
export const isAfter = (a: string, b: string): boolean => instant(a) > instant(b);

/** Whole minutes from `from` to `to`; negative when `to` is earlier. */
export const minutesBetween = (from: string, to: string): number =>
  Math.round((instant(to) - instant(from)) / MINUTE_MS);
