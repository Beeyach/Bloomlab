import type { AccountState, Calendar, CalendarService } from '../state.ts';
import { isValidTimeZone } from '../time.ts';

/**
 * What is wrong with a calendar definition (CAL-001, D-126).
 *
 * Two different questions are kept apart here, because confusing them is how a learner ends up
 * fixing the wrong thing. An **error** is a definition that cannot produce a correct booking: a
 * duration of zero, a host the account does not have, a round robin with nobody on it. A
 * **warning** is a definition that is perfectly valid and simply has no times right now — a
 * Monday-only calendar is not broken on a Tuesday, and a window shorter than the appointment is
 * a real configuration a person can hold while they finish thinking.
 *
 * Nothing here throws. The reducer refuses what would corrupt the account (a dangling reference,
 * a negative number, a duplicate id); this reports everything else so the Lab can say it in
 * words while the learner keeps working.
 */

export type CalendarIssueCode =
  | 'NO_NAME'
  | 'INVALID_TIMEZONE'
  | 'DURATION_NOT_POSITIVE'
  | 'INTERVAL_NOT_POSITIVE'
  | 'NEGATIVE_BUFFER'
  | 'NEGATIVE_NOTICE'
  | 'BOOKING_WINDOW_NOT_POSITIVE'
  | 'NO_AVAILABILITY'
  | 'INVALID_DAY'
  | 'INVALID_TIME_OF_DAY'
  | 'EMPTY_WINDOW'
  | 'OVERLAPPING_WINDOWS'
  | 'WINDOW_SHORTER_THAN_DURATION'
  | 'UNKNOWN_STAFF'
  | 'DUPLICATE_STAFF'
  | 'PERSONAL_NEEDS_ONE_HOST'
  | 'ROUND_ROBIN_NEEDS_STAFF'
  | 'STAFF_SELECTION_WITHOUT_STAFF'
  | 'SERVICE_NEEDS_NAME'
  | 'SERVICE_DURATION_NOT_POSITIVE'
  | 'SERVICE_STAFF_NOT_ON_CALENDAR'
  | 'SERVICE_LOCATION_UNKNOWN'
  | 'SERVICE_CALENDAR_NEEDS_SERVICE'
  | 'SERVICE_CALENDAR_NEEDS_STAFF'
  | 'SERVICES_ON_A_NON_SERVICE_CALENDAR'
  | 'LOCATION_NEEDS_VALUE'
  | 'DEFAULT_LOCATION_UNKNOWN'
  | 'NEGATIVE_CUTOFF';

export interface CalendarIssue {
  code: CalendarIssueCode;
  severity: 'error' | 'warning';
  /** What the issue is about: the calendar itself, a window, a service, a location, a user. */
  subject: string | null;
  message: string;
}

const TIME_OF_DAY = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Minutes from midnight for an `HH:MM` wall-clock time, or null when it is not one. */
export function minutesOfDay(value: string): number | null {
  const match = TIME_OF_DAY.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

const error = (
  code: CalendarIssueCode,
  message: string,
  subject: string | null = null,
): CalendarIssue => ({ code, severity: 'error', subject, message });

const warning = (
  code: CalendarIssueCode,
  message: string,
  subject: string | null = null,
): CalendarIssue => ({ code, severity: 'warning', subject, message });

/** The duration a service actually books for, falling back to the calendar's own. */
export const serviceDuration = (calendar: Calendar, service: CalendarService | null): number =>
  service?.duration_minutes ?? calendar.duration_minutes;

export function validateCalendar(calendar: Calendar, account: AccountState): CalendarIssue[] {
  const issues: CalendarIssue[] = [];

  if (!calendar.name.trim()) issues.push(error('NO_NAME', 'This calendar needs a name.'));
  if (calendar.timezone !== null && !isValidTimeZone(calendar.timezone)) {
    issues.push(
      error('INVALID_TIMEZONE', `${calendar.timezone} is not a time zone this runtime knows.`),
    );
  }
  if (calendar.duration_minutes <= 0) {
    issues.push(error('DURATION_NOT_POSITIVE', 'An appointment has to last longer than nothing.'));
  }
  if (calendar.slot_interval_minutes <= 0) {
    issues.push(error('INTERVAL_NOT_POSITIVE', 'Offered times need a gap between them.'));
  }
  if (calendar.pre_buffer_minutes < 0 || calendar.post_buffer_minutes < 0) {
    issues.push(error('NEGATIVE_BUFFER', 'A buffer cannot be negative.'));
  }
  if (calendar.minimum_notice_minutes < 0) {
    issues.push(error('NEGATIVE_NOTICE', 'Minimum notice cannot be negative.'));
  }
  if (calendar.booking_window_days <= 0) {
    issues.push(
      error('BOOKING_WINDOW_NOT_POSITIVE', 'The calendar has to offer at least one day ahead.'),
    );
  }
  if (calendar.booking.change_cutoff_hours !== null && calendar.booking.change_cutoff_hours < 0) {
    issues.push(error('NEGATIVE_CUTOFF', 'A cancellation cutoff cannot be negative.'));
  }

  issues.push(...availabilityIssues(calendar));
  issues.push(...staffIssues(calendar, account));
  issues.push(...serviceIssues(calendar));
  issues.push(...locationIssues(calendar));

  return issues;
}

function availabilityIssues(calendar: Calendar): CalendarIssue[] {
  const issues: CalendarIssue[] = [];
  if (calendar.availability.length === 0) {
    issues.push(error('NO_AVAILABILITY', 'Nobody can book a calendar with no working hours.'));
    return issues;
  }
  const spans: { day: number; from: number; to: number; subject: string }[] = [];
  calendar.availability.forEach((hours, index) => {
    const subject = `availability.${index}`;
    if (!Number.isInteger(hours.day) || hours.day < 1 || hours.day > 7) {
      issues.push(
        error('INVALID_DAY', `${hours.day} is not a day of the week (1 = Monday).`, subject),
      );
      return;
    }
    const from = minutesOfDay(hours.start);
    const to = minutesOfDay(hours.end);
    if (from === null || to === null) {
      issues.push(
        error('INVALID_TIME_OF_DAY', `${hours.start}–${hours.end} is not a time of day.`, subject),
      );
      return;
    }
    if (to <= from) {
      issues.push(error('EMPTY_WINDOW', 'A working window has to end after it starts.', subject));
      return;
    }
    spans.push({ day: hours.day, from, to, subject });
  });

  const byDay = new Map<number, typeof spans>();
  for (const span of spans) {
    const held = byDay.get(span.day) ?? [];
    held.push(span);
    byDay.set(span.day, held);
  }
  for (const day of [...byDay.keys()].sort((a, b) => a - b)) {
    const ordered = [...(byDay.get(day) ?? [])].sort((a, b) => a.from - b.from);
    for (let index = 1; index < ordered.length; index += 1) {
      const current = ordered[index];
      const previous = ordered[index - 1];
      if (current && previous && current.from < previous.to) {
        issues.push(
          error(
            'OVERLAPPING_WINDOWS',
            'Two working windows on the same day overlap. Merge them into one.',
            current.subject,
          ),
        );
      }
    }
  }

  // Valid, but it produces nothing: the appointment does not fit inside the hours. Said as a
  // warning because the fix is a judgement — shorten the appointment or lengthen the day.
  const shortest = Math.min(...spans.map((span) => span.to - span.from));
  if (spans.length > 0 && calendar.duration_minutes > 0 && shortest < calendar.duration_minutes) {
    issues.push(
      warning(
        'WINDOW_SHORTER_THAN_DURATION',
        `A ${calendar.duration_minutes}-minute appointment does not fit in every one of these working hours.`,
      ),
    );
  }
  return issues;
}

function staffIssues(calendar: Calendar, account: AccountState): CalendarIssue[] {
  const issues: CalendarIssue[] = [];
  const seen = new Set<string>();
  for (const userId of calendar.staff_ids) {
    if (!account.users[userId]) {
      issues.push(error('UNKNOWN_STAFF', `${userId} is not a user in this account.`, userId));
    }
    if (seen.has(userId)) {
      issues.push(
        error('DUPLICATE_STAFF', 'The same team member is on this calendar twice.', userId),
      );
    }
    seen.add(userId);
  }
  if (calendar.type === 'personal' && calendar.staff_ids.length > 1) {
    issues.push(
      error(
        'PERSONAL_NEEDS_ONE_HOST',
        'A personal calendar has one host. Use round robin for a team.',
      ),
    );
  }
  if (calendar.type === 'round_robin' && calendar.staff_ids.length === 0) {
    issues.push(
      error('ROUND_ROBIN_NEEDS_STAFF', 'Round robin has nobody to distribute bookings between.'),
    );
  }
  if (calendar.type === 'service' && calendar.staff_ids.length === 0) {
    issues.push(
      error(
        'SERVICE_CALENDAR_NEEDS_STAFF',
        'A service needs somebody assigned to it before anyone can book it.',
      ),
    );
  }
  if (calendar.staff_selection && calendar.staff_ids.length === 0) {
    issues.push(
      error('STAFF_SELECTION_WITHOUT_STAFF', 'The booker cannot choose from an empty team.'),
    );
  }
  return issues;
}

function serviceIssues(calendar: Calendar): CalendarIssue[] {
  const issues: CalendarIssue[] = [];
  if (calendar.type === 'service' && calendar.services.length === 0) {
    issues.push(
      error('SERVICE_CALENDAR_NEEDS_SERVICE', 'A service calendar needs at least one service.'),
    );
  }
  if (calendar.type !== 'service' && calendar.services.length > 0) {
    issues.push(
      error(
        'SERVICES_ON_A_NON_SERVICE_CALENDAR',
        'Services belong to a service calendar. Change the type or remove them.',
      ),
    );
  }
  const locationIds = new Set(calendar.locations.map((row) => row.id));
  const staff = new Set(calendar.staff_ids);
  for (const service of calendar.services) {
    if (!service.name.trim()) {
      issues.push(error('SERVICE_NEEDS_NAME', 'A service needs a name.', service.id));
    }
    if (service.duration_minutes !== null && service.duration_minutes <= 0) {
      issues.push(
        error(
          'SERVICE_DURATION_NOT_POSITIVE',
          'A service that sets its own length has to last longer than nothing.',
          service.id,
        ),
      );
    }
    for (const userId of service.staff_ids) {
      if (!staff.has(userId)) {
        issues.push(
          error(
            'SERVICE_STAFF_NOT_ON_CALENDAR',
            'This service names somebody who is not on the calendar.',
            service.id,
          ),
        );
      }
    }
    if (service.location_id !== null && !locationIds.has(service.location_id)) {
      issues.push(
        error(
          'SERVICE_LOCATION_UNKNOWN',
          'This service points at a location that is gone.',
          service.id,
        ),
      );
    }
  }
  return issues;
}

function locationIssues(calendar: Calendar): CalendarIssue[] {
  const issues: CalendarIssue[] = [];
  for (const location of calendar.locations) {
    if (location.kind !== 'ask_booker' && !location.value?.trim()) {
      issues.push(
        error('LOCATION_NEEDS_VALUE', 'This location has nothing to give the booker.', location.id),
      );
    }
  }
  if (
    calendar.default_location_id !== null &&
    !calendar.locations.some((row) => row.id === calendar.default_location_id)
  ) {
    issues.push(
      error('DEFAULT_LOCATION_UNKNOWN', 'The default location is not on this calendar any more.'),
    );
  }
  return issues;
}

/** True when nothing is an error. A warning is a calendar that works and has no times today. */
export const isBookableDefinition = (issues: readonly CalendarIssue[]): boolean =>
  !issues.some((issue) => issue.severity === 'error');
