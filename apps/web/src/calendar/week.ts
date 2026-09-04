import {
  calendarSlots,
  calendarZone,
  instant,
  partsIn,
  type AccountState,
  type Appointment,
  type Calendar,
  type Slot,
  type SlotQuery,
} from '@bloomlab/simulator-core';

/**
 * Turning the engine's answer into something a person can look at (CAL-001).
 *
 * Presentation only. Every scheduling decision above this line has already been made by
 * `simulator-core`; this groups what came back into days, works out which days to draw, and
 * formats a time in the calendar's zone rather than the device's. No rule about availability,
 * buffers, notice or assignment lives here or anywhere else in `apps/web`.
 */

export interface Day {
  /** `YYYY-MM-DD` in the calendar's own zone. */
  date: string;
  /** ISO weekday, 1 = Monday … 7 = Sunday. */
  weekday: number;
  slots: Slot[];
  /** Appointments already on this calendar that day, earliest first. */
  appointments: Appointment[];
}

const pad = (value: number, width = 2): string => String(value).padStart(width, '0');

export const dayOf = (iso: string, zone: string): string => {
  const parts = partsIn(instant(iso), zone);
  return `${pad(parts.year, 4)}-${pad(parts.month)}-${pad(parts.day)}`;
};

export const weekdayOf = (date: string): number => {
  const [year, month, day] = date.split('-').map(Number);
  const index = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1)).getUTCDay();
  return index === 0 ? 7 : index;
};

/** How many days of schedule the workspace draws at once. */
export const VISIBLE_DAYS = 7;

/**
 * The days to draw: a run of calendar days starting at the run's own clock, each carrying the
 * openings the engine offers and the appointments already on it. A day with neither is still
 * drawn, because "nothing on Thursday" is information a learner needs to see.
 */
export function schedule(
  account: AccountState,
  calendar: Calendar,
  now: string,
  query: SlotQuery = {},
  days = VISIBLE_DAYS,
): Day[] {
  const zone = calendarZone(account, calendar);
  const slots = calendarSlots(account, calendar, now, query);
  const booked = Object.values(account.appointments)
    .filter((row) => row.calendar_id === calendar.id && row.status !== 'cancelled')
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at) || a.id.localeCompare(b.id));

  const start = dayOf(now, zone);
  const out: Day[] = [];
  let cursor = start;
  for (let index = 0; index < days; index += 1) {
    out.push({
      date: cursor,
      weekday: weekdayOf(cursor),
      slots: slots.filter((slot) => dayOf(slot.starts_at, zone) === cursor),
      appointments: booked.filter((row) => dayOf(row.starts_at, zone) === cursor),
    });
    cursor = nextDate(cursor);
  }
  return out;
}

/** The next calendar day. Plain date arithmetic: no zone, no clock, no offset involved. */
export function nextDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  const next = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, (day ?? 1) + 1));
  return `${pad(next.getUTCFullYear(), 4)}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`;
}

const TIME = new Map<string, Intl.DateTimeFormat>();

function timeFormatter(zone: string): Intl.DateTimeFormat {
  const held = TIME.get(zone);
  if (held) return held;
  const made = new Intl.DateTimeFormat('en-GB', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: zone,
  });
  TIME.set(zone, made);
  return made;
}

/** A time of day in the calendar's zone — never the device's, which is not the account's. */
export function clockTime(iso: string, zone: string): string {
  try {
    return timeFormatter(zone).format(new Date(instant(iso)));
  } catch {
    return iso;
  }
}

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const dayName = (weekday: number): string => DAY_NAMES[weekday - 1] ?? '';

export function dayLabel(date: string): string {
  const [, month, day] = date.split('-').map(Number);
  return `${day} ${MONTHS[(month ?? 1) - 1] ?? ''}`;
}

/** Minutes as a person would say them: "45 minutes", "1 hour", "1 hour 30". */
export function duration(minutes: number): string {
  if (minutes <= 0) return 'no time';
  if (minutes < 60) return `${minutes} minutes`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const head = hours === 1 ? '1 hour' : `${hours} hours`;
  return rest === 0 ? head : `${head} ${rest}`;
}
