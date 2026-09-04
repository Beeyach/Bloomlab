import type { TimeWindow } from '../state.ts';
import { epochFromParts, formatInstant, instant, partsIn } from '../time.ts';

/**
 * Business hours (WFL-008, D-102).
 *
 * HighLevel restricts a workflow's actions to a window of days and hours through the workflow's
 * own settings rather than through a named Wait type; an action that falls outside the window
 * is held until the window next opens. Bloomlab models exactly that as `settings.time_window`,
 * evaluated in the workflow's zone, and applies it to outbound messages. Nothing here reads the
 * device: the window is data and the instant is the simulator's.
 */

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function readTimeWindow(raw: unknown): {
  timeWindow: TimeWindow | null;
  problems: string[];
} {
  if (raw === null || raw === undefined) return { timeWindow: null, problems: [] };
  const problems: string[] = [];
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return { timeWindow: null, problems: ['time_window must be an object'] };
  }
  const candidate = raw as Record<string, unknown>;
  const days = Array.isArray(candidate.days)
    ? candidate.days.filter((day): day is number => Number.isInteger(day) && day >= 1 && day <= 7)
    : [];
  if (
    !Array.isArray(candidate.days) ||
    days.length !== candidate.days.length ||
    days.length === 0
  ) {
    problems.push('time_window.days must list days as 1 (Monday) to 7 (Sunday)');
  }
  const start =
    typeof candidate.start === 'string' && HHMM.test(candidate.start) ? candidate.start : null;
  const end = typeof candidate.end === 'string' && HHMM.test(candidate.end) ? candidate.end : null;
  if (!start || !end) problems.push('time_window.start and end must be HH:MM');
  else if (start >= end) problems.push('time_window must end after it starts');
  if (problems.length > 0 || !start || !end) return { timeWindow: null, problems };
  return { timeWindow: { days: [...new Set(days)].sort((a, b) => a - b), start, end }, problems };
}

/** ISO weekday, 1 = Monday … 7 = Sunday, of an instant read in a zone. */
function isoWeekday(epochMs: number, zone: string): number {
  const parts = partsIn(epochMs, zone);
  // Day of week from the civil date (Zeller-style), independent of the host zone.
  const day = new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
  return day === 0 ? 7 : day;
}

const minutesOf = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

/** True when the instant falls inside the window, in the window's zone. */
export function withinWindow(iso: string, hours: TimeWindow, zone: string): boolean {
  const epoch = instant(iso);
  if (!hours.days.includes(isoWeekday(epoch, zone))) return false;
  const parts = partsIn(epoch, zone);
  const minute = parts.hour * 60 + parts.minute;
  return minute >= minutesOf(hours.start) && minute < minutesOf(hours.end);
}

/**
 * The next instant at or after `iso` when the window is open — `iso` itself when it already is.
 * Walks day by day in the zone, so a daylight-saving change on the way is the zone's problem and
 * not the caller's.
 */
export function nextWindowOpening(iso: string, hours: TimeWindow, zone: string): string {
  if (withinWindow(iso, hours, zone)) return iso;
  const epoch = instant(iso);
  const [startHour, startMinute] = hours.start.split(':').map(Number) as [number, number];
  for (let offset = 0; offset < 14; offset += 1) {
    const dayParts = partsIn(epoch + offset * 86_400_000, zone);
    const candidate = epochFromParts(
      {
        year: dayParts.year,
        month: dayParts.month,
        day: dayParts.day,
        hour: startHour,
        minute: startMinute,
        second: 0,
      },
      zone,
    );
    if (candidate > epoch && hours.days.includes(isoWeekday(candidate, zone))) {
      return formatInstant(candidate, zone);
    }
  }
  // A window with at least one day always opens within a fortnight; this is unreachable for a
  // validated window and kept only so the function is total.
  return iso;
}
