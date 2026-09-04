import type { AccountState, Calendar } from '../state.ts';
import { instant, partsIn } from '../time.ts';

/**
 * Who hosts a booking (CAL-001, D-127).
 *
 * Deterministic and explainable, never random: the same account and the same slot always choose
 * the same person, and the choice carries the reason so the Lab can say why rather than making
 * the learner guess. Nothing here reads a clock or a random source.
 *
 * The two round-robin strategies carry HighLevel's own names because the simulated rules are
 * close to the documented ones — Optimize for Availability gives the booking to the next
 * available member, Optimize for Equal Distribution gives it to whoever has the fewest bookings
 * that month. Ties are broken by the order the learner arranged the team, then by user id, so a
 * rebuild of the same account produces the same host.
 */

export type AssignmentReason =
  'no_staff' | 'only_host' | 'requested' | 'next_available' | 'least_booked';

export interface Assignment {
  host_id: string | null;
  reason: AssignmentReason;
}

/** Where a user sits in the calendar's own team order; unknown members sort last. */
const rank = (calendar: Calendar, userId: string): number => {
  const at = calendar.staff_ids.indexOf(userId);
  return at === -1 ? Number.MAX_SAFE_INTEGER : at;
};

const byCalendarOrder =
  (calendar: Calendar) =>
  (a: string, b: string): number =>
    rank(calendar, a) - rank(calendar, b) || a.localeCompare(b);

/** The calendar month a slot falls in, read in the calendar's own zone. */
const monthOf = (startsAt: string, zone: string): string => {
  const parts = partsIn(instant(startsAt), zone);
  return `${parts.year}-${parts.month}`;
};

/**
 * Bookings this host already holds on this calendar in the slot's month. Cancelled appointments
 * do not count: a cancellation frees the host in every sense, including this one.
 */
function bookingsThatMonth(
  account: AccountState,
  calendar: Calendar,
  hostId: string,
  month: string,
  zone: string,
  ignoreAppointmentId: string | null,
): number {
  let total = 0;
  for (const appointment of Object.values(account.appointments)) {
    if (appointment.id === ignoreAppointmentId) continue;
    if (appointment.calendar_id !== calendar.id) continue;
    if (appointment.host_id !== hostId) continue;
    if (appointment.status === 'cancelled') continue;
    if (monthOf(appointment.starts_at, zone) !== month) continue;
    total += 1;
  }
  return total;
}

export interface AssignmentQuery {
  /** The host the booker asked for, when the calendar lets them choose. */
  requested_staff_id?: string | null;
  ignore_appointment_id?: string | null;
}

/**
 * Picks the host for one slot from the members who are actually free for it.
 *
 * `eligible` has already been filtered by the availability engine: everyone in it can take this
 * slot. An empty list on a calendar with a team means the slot is not bookable at all and is
 * never offered; an empty list on a calendar with no team means the calendar itself is the
 * resource, which is what a solo operator's calendar is before they add anybody.
 */
export function assignHost(
  account: AccountState,
  calendar: Calendar,
  startsAt: string,
  zone: string,
  eligible: readonly string[],
  query: AssignmentQuery = {},
): Assignment {
  if (eligible.length === 0) return { host_id: null, reason: 'no_staff' };

  const requested = query.requested_staff_id ?? null;
  if (requested && calendar.staff_selection && eligible.includes(requested)) {
    return { host_id: requested, reason: 'requested' };
  }

  const ordered = [...eligible].sort(byCalendarOrder(calendar));
  const first = ordered[0] as string;
  if (calendar.assignment === 'single' || ordered.length === 1) {
    return { host_id: first, reason: 'only_host' };
  }
  if (calendar.assignment === 'optimize_equal') {
    const month = monthOf(startsAt, zone);
    const ignore = query.ignore_appointment_id ?? null;
    let best = first;
    let bestCount = bookingsThatMonth(account, calendar, best, month, zone, ignore);
    for (const userId of ordered.slice(1)) {
      const count = bookingsThatMonth(account, calendar, userId, month, zone, ignore);
      if (count < bestCount) {
        best = userId;
        bestCount = count;
      }
    }
    return { host_id: best, reason: 'least_booked' };
  }
  return { host_id: first, reason: 'next_available' };
}
