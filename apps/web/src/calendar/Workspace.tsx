import {
  Button,
  Meta,
  IconCheck,
  IconClock,
  IconGlobe,
  IconPause,
  IconRepeat,
  StatusPill,
} from '@bloomlab/design-system';
import type { AccountState, Calendar, Slot } from '@bloomlab/simulator-core';

import { HOST_REASONS, STATUS_TONE, APPOINTMENT_STATUS_LABELS } from './words';
import { clockTime, dayLabel, dayName, duration, type Day } from './week';
import styles from './calendar.module.css';

/**
 * The scheduling workspace (CAL-001).
 *
 * The learner's mental object here is time, so time is what the screen is: a run of days, each
 * showing what is already booked and what is still open, in the calendar's own zone. Everything
 * on it came from the shared availability engine — this draws the answer, it does not compute
 * one.
 *
 * A slot is a button, so choosing a time is one keyboard step and one 44-pixel tap. What is
 * booked is stated in words as well as position, and the host and the reason for the host are
 * printed rather than implied, because "why did it pick Theo" is the question round robin exists
 * to teach.
 */

const tone = (status: string) => {
  switch (STATUS_TONE[status]) {
    case 'positive':
      return 'success' as const;
    case 'caution':
      return 'warning' as const;
    case 'critical':
      return 'error' as const;
    default:
      return 'neutral' as const;
  }
};

export function Workspace({
  days,
  account,
  calendar,
  zone,
  chosen,
  onChoose,
  selectedAppointment,
  onSelectAppointment,
}: {
  days: Day[];
  account: AccountState;
  calendar: Calendar;
  zone: string;
  chosen: Slot | null;
  onChoose: (slot: Slot) => void;
  selectedAppointment: string | null;
  onSelectAppointment: (id: string) => void;
}) {
  const total = days.reduce((count, day) => count + day.slots.length, 0);
  return (
    <div className={styles.workspace}>
      <div className={styles.summary} data-testid="calendar-summary">
        <Meta
          items={[
            { kind: 'chip', icon: <IconClock />, label: `${calendar.duration_minutes} min` },
            {
              kind: 'chip',
              icon: <IconRepeat />,
              label: `Every ${calendar.slot_interval_minutes} min`,
            },
            {
              kind: 'chip',
              icon: <IconPause />,
              label:
                calendar.pre_buffer_minutes === 0 && calendar.post_buffer_minutes === 0
                  ? 'No buffer'
                  : `${calendar.pre_buffer_minutes} before, ${calendar.post_buffer_minutes} after`,
            },
            {
              kind: 'chip',
              icon: <IconCheck />,
              label:
                calendar.minimum_notice_minutes === 0
                  ? 'Bookable now'
                  : `${duration(calendar.minimum_notice_minutes)} notice`,
            },
            { kind: 'chip', icon: <IconGlobe />, label: zone },
          ]}
        />
      </div>
      {total === 0 && (
        <p className={styles.empty} data-testid="calendar-no-slots">
          Nothing is bookable in the next {days.length} days. The working hours, the duration, the
          buffers, the minimum notice or the team are what decide that.
        </p>
      )}
      <div className={styles.weekScroll} role="region" aria-label="Seven-day schedule" tabIndex={0}>
        <ol className={styles.week} data-testid="calendar-week">
          {days.map((day) => (
            <li className={styles.day} key={day.date}>
              <h3 className={styles.dayHead}>
                <span className={styles.dayName}>{dayName(day.weekday)}</span>
                <span className={styles.dayDate}>{dayLabel(day.date)}</span>
              </h3>
              {day.appointments.length > 0 && (
                <ul className={styles.booked} data-testid={`booked-${day.date}`}>
                  {day.appointments.map((appointment) => (
                    <li key={appointment.id}>
                      <button
                        type="button"
                        className={styles.bookedRow}
                        aria-pressed={selectedAppointment === appointment.id}
                        onClick={() => onSelectAppointment(appointment.id)}
                        data-testid={`appointment-${appointment.id}`}
                      >
                        <span className={styles.bookedTime}>
                          {clockTime(appointment.starts_at, zone)}
                        </span>
                        <span className={styles.bookedWho}>
                          {account.contacts[appointment.contact_id]?.first_name ??
                            appointment.contact_id}
                        </span>
                        <span className={styles.bookedStatus}>
                          <StatusPill
                            label={
                              APPOINTMENT_STATUS_LABELS[appointment.status] ?? appointment.status
                            }
                            tone={tone(appointment.status)}
                          />
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {day.slots.length === 0 ? (
                <p className={styles.dayEmpty}>No openings</p>
              ) : (
                <ul className={styles.slots}>
                  {day.slots.map((slot) => {
                    const picked = chosen?.starts_at === slot.starts_at;
                    return (
                      <li key={slot.starts_at}>
                        <Button
                          variant={picked ? 'primary' : 'secondary'}
                          className={styles.slot}
                          aria-pressed={picked}
                          onClick={() => onChoose(slot)}
                          data-testid={`slot-${slot.starts_at}`}
                        >
                          <span className={styles.slotContent}>
                            <span className={styles.slotTime}>
                              {clockTime(slot.starts_at, zone)}
                            </span>
                            <span
                              className={styles.slotHost}
                              title={
                                slot.host_id
                                  ? (account.users[slot.host_id]?.name ?? slot.host_id)
                                  : 'No host'
                              }
                            >
                              {slot.host_id
                                ? (account.users[slot.host_id]?.name ?? slot.host_id)
                                : 'No host'}
                            </span>
                          </span>
                          {slot.seats_remaining !== undefined && (
                            <span className={styles.slotDetail}>
                              {slot.seats_remaining} seats left
                            </span>
                          )}
                          {slot.resource_id && (
                            <span className={styles.slotDetail}>
                              {account.resources?.[slot.resource_id]?.name}
                            </span>
                          )}
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          ))}
        </ol>
      </div>
      {chosen && (
        <p className={styles.chosen} data-testid="chosen-slot">
          {clockTime(chosen.starts_at, zone)} to {clockTime(chosen.ends_at, zone)},{' '}
          {duration(chosen.duration_minutes)}
          {chosen.host_id
            ? ` with ${account.users[chosen.host_id]?.name ?? chosen.host_id} — ${HOST_REASONS[chosen.host_reason]}`
            : ' — this calendar has no host'}
          {chosen.eligible_staff_ids.length > 1
            ? `. ${chosen.eligible_staff_ids.length} of the team could take it.`
            : ''}
        </p>
      )}
    </div>
  );
}
