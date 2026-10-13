import { epochFromParts, formatInstant, offsetAt } from '@bloomlab/simulator-core';

const DAY_MS = 24 * 60 * 60 * 1000;

/** A local choice becomes an offset-bearing instant, never a browser-local Date. */
export function wallTimeInstant(
  date: string,
  time: string,
  zone: string,
  previous = '',
): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}(?::\d{2})?$/.test(time)) return null;
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute, second = 0] = time.split(':').map(Number);
  if (hour! > 23 || minute! > 59 || second > 59) return null;
  const parts = { year: year!, month: month!, day: day!, hour: hour!, minute: minute!, second };
  const epoch = epochFromParts(parts, zone);
  const wall = `${date}T${time.length === 5 ? `${time}:00` : time}`;
  const naive = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  const offsets = new Set([
    offsetAt(epoch - DAY_MS, zone),
    offsetAt(epoch, zone),
    offsetAt(epoch + DAY_MS, zone),
  ]);
  const matches = [...offsets]
    .map((offset) => naive - offset)
    .filter((candidate) => formatInstant(candidate, zone).slice(0, 19) === wall)
    .sort((a, b) => a - b);
  // A repeated autumn hour retains its existing occurrence; new choices use the earlier one.
  const priorEpoch = Date.parse(previous);
  const preferred = Number.isFinite(priorEpoch)
    ? matches.find((candidate) => offsetAt(candidate, zone) === offsetAt(priorEpoch, zone))
    : undefined;
  const chosen = preferred ?? matches[0];
  return chosen === undefined ? null : formatInstant(chosen, zone);
}

export function wallFields(value: string, zone: string): { date: string; time: string } {
  const epoch = Date.parse(value);
  if (!Number.isFinite(epoch)) return { date: '', time: '' };
  const local = formatInstant(epoch, zone);
  return { date: local.slice(0, 10), time: local.slice(11, 19) };
}
