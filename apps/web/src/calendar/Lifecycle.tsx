import { Button, Field, Select, StatusPill } from '@bloomlab/design-system';
import type { AccountState, Appointment, Calendar, Slot } from '@bloomlab/simulator-core';

import { APPOINTMENT_STATUS_LABELS, HOST_REASONS, LOCATION_LABELS, STATUS_TONE } from './words';
import { clockTime, dayLabel, dayName, duration, weekdayOf, dayOf } from './week';
import styles from './calendar.module.css';

/**
 * Booking a test appointment and then living with it (CAL-001, CAL-003).
 *
 * The booking panel is the calendar seen from the other side: pick who, pick what, pick a time
 * the engine actually offers, and say whether the customer made this booking or somebody on the
 * team did — because HighLevel's Customer Booked Appointment trigger only fires for the first,
 * and a Lab that hid that would teach the wrong thing.
 *
 * The appointments list is where an appointment is confirmed, moved and cancelled. Every one of
 * those is a real account event; none of them is a badge that changes colour.
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

export function BookingPanel({
  account,
  calendar,
  zone,
  slot,
  contactId,
  serviceId,
  staffId,
  bookedBy,
  busy,
  onContact,
  onService,
  onStaff,
  onBookedBy,
  onBook,
}: {
  account: AccountState;
  calendar: Calendar;
  zone: string;
  slot: Slot | null;
  contactId: string;
  serviceId: string;
  staffId: string;
  bookedBy: 'customer' | 'staff';
  busy: boolean;
  onContact: (id: string) => void;
  onService: (id: string) => void;
  onStaff: (id: string) => void;
  onBookedBy: (value: 'customer' | 'staff') => void;
  onBook: () => void;
}) {
  const contacts = Object.values(account.contacts).sort((a, b) =>
    a.first_name.localeCompare(b.first_name),
  );
  const service = calendar.services.find((row) => row.id === serviceId) ?? null;
  const location = calendar.locations.find(
    (row) => row.id === (service?.location_id ?? calendar.default_location_id),
  );
  return (
    <div className={styles.booking}>
      <Field label="Who is booking" hint="A real contact in this account.">
        <Select
          value={contactId}
          onChange={(e) => onContact(e.target.value)}
          data-testid="booking-contact"
        >
          {contacts.map((contact) => (
            <option key={contact.id} value={contact.id}>
              {contact.first_name} {contact.last_name ?? ''}
            </option>
          ))}
        </Select>
      </Field>

      {calendar.services.length > 0 && (
        <Field label="Service" hint="A service can set its own length, staff and place.">
          <Select
            value={serviceId}
            onChange={(e) => onService(e.target.value)}
            data-testid="booking-service"
          >
            <option value="">No service</option>
            {calendar.services.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
                {row.duration_minutes ? ` · ${row.duration_minutes} min` : ''}
              </option>
            ))}
          </Select>
        </Field>
      )}

      {calendar.staff_selection && calendar.staff_ids.length > 0 && (
        <Field label="Preferred host" hint="Staff selection is on, so the booker may name one.">
          <Select
            value={staffId}
            onChange={(e) => onStaff(e.target.value)}
            data-testid="booking-staff"
          >
            <option value="">Let the calendar decide</option>
            {calendar.staff_ids.map((userId) => (
              <option key={userId} value={userId}>
                {account.users[userId]?.name ?? userId}
              </option>
            ))}
          </Select>
        </Field>
      )}

      <Field
        label="Who made this booking"
        hint="Customer Booked Appointment fires only for a booking the customer made."
      >
        <Select
          value={bookedBy}
          onChange={(e) => onBookedBy(e.target.value as 'customer' | 'staff')}
          data-testid="booking-made-by"
        >
          <option value="customer">The customer, from the booking page</option>
          <option value="staff">Somebody on the team, from inside the account</option>
        </Select>
      </Field>

      <p className={styles.bookingWhat} data-testid="booking-what">
        {slot
          ? `${dayName(weekdayOf(dayOf(slot.starts_at, zone)))} ${dayLabel(dayOf(slot.starts_at, zone))}, ${clockTime(slot.starts_at, zone)} · ${duration(slot.duration_minutes)}${
              slot.host_id
                ? ` · ${account.users[slot.host_id]?.name ?? slot.host_id} (${HOST_REASONS[slot.host_reason]})`
                : ' · no host'
            }${location ? ` · ${LOCATION_LABELS[location.kind]}${location.value ? ` ${location.value}` : ''}` : ''}`
          : 'Choose a time from the schedule first.'}
      </p>

      <Button onClick={onBook} disabled={busy || !slot} data-testid="booking-book">
        Book it
      </Button>
    </div>
  );
}

export function Appointments({
  account,
  calendar,
  zone,
  appointments,
  selected,
  chosen,
  busy,
  onSelect,
  onConfirm,
  onReschedule,
  onCancel,
  onStatus,
}: {
  account: AccountState;
  calendar: Calendar;
  zone: string;
  appointments: Appointment[];
  selected: string | null;
  chosen: Slot | null;
  busy: boolean;
  onSelect: (id: string) => void;
  onConfirm: (id: string) => void;
  onReschedule: (id: string) => void;
  onCancel: (id: string) => void;
  onStatus: (id: string, status: 'showed' | 'no_show') => void;
}) {
  if (appointments.length === 0) {
    return (
      <p className={styles.muted} data-testid="appointments-empty">
        Nothing is booked on this calendar yet.
      </p>
    );
  }
  return (
    <ul className={styles.appointments} data-testid="appointments">
      {appointments.map((appointment) => {
        const isSelected = selected === appointment.id;
        const service = calendar.services.find((row) => row.id === appointment.service_id);
        const location = calendar.locations.find((row) => row.id === appointment.location_id);
        return (
          <li
            key={appointment.id}
            className={
              isSelected ? `${styles.appointment} ${styles.appointmentOn}` : styles.appointment
            }
          >
            <button
              type="button"
              className={styles.appointmentHead}
              aria-pressed={isSelected}
              onClick={() => onSelect(appointment.id)}
              data-testid={`appointment-row-${appointment.id}`}
            >
              <span className={styles.appointmentWho}>
                {account.contacts[appointment.contact_id]?.first_name ?? appointment.contact_id}
              </span>
              <span className={styles.appointmentWhen}>
                {dayName(weekdayOf(dayOf(appointment.starts_at, zone)))}{' '}
                {dayLabel(dayOf(appointment.starts_at, zone))},{' '}
                {clockTime(appointment.starts_at, zone)}
              </span>
              <StatusPill
                label={APPOINTMENT_STATUS_LABELS[appointment.status] ?? appointment.status}
                tone={tone(appointment.status)}
              />
            </button>
            <p className={styles.appointmentFacts}>
              {duration(appointment.duration_minutes)}
              {appointment.host_id
                ? ` · ${account.users[appointment.host_id]?.name ?? appointment.host_id}`
                : ' · no host'}
              {service ? ` · ${service.name}` : ''}
              {location
                ? ` · ${LOCATION_LABELS[location.kind]}${location.value ? ` ${location.value}` : ''}`
                : ''}
              {appointment.booked_by === 'staff'
                ? ' · booked by the team'
                : ' · booked by the customer'}
            </p>
            {isSelected && (
              <div className={styles.appointmentActions}>
                <Button
                  variant="secondary"
                  disabled={
                    busy || appointment.status === 'cancelled' || appointment.status === 'confirmed'
                  }
                  onClick={() => onConfirm(appointment.id)}
                  data-testid={`confirm-${appointment.id}`}
                >
                  Confirm
                </Button>
                <Button
                  variant="secondary"
                  disabled={busy || appointment.status === 'cancelled' || !chosen}
                  onClick={() => onReschedule(appointment.id)}
                  data-testid={`reschedule-${appointment.id}`}
                >
                  Move to the chosen time
                </Button>
                <Button
                  variant="secondary"
                  disabled={busy || appointment.status === 'cancelled'}
                  onClick={() => onStatus(appointment.id, 'showed')}
                  data-testid={`showed-${appointment.id}`}
                >
                  Showed
                </Button>
                <Button
                  variant="secondary"
                  disabled={busy || appointment.status === 'cancelled'}
                  onClick={() => onStatus(appointment.id, 'no_show')}
                  data-testid={`no-show-${appointment.id}`}
                >
                  No-show
                </Button>
                <Button
                  variant="ghost"
                  disabled={busy || appointment.status === 'cancelled'}
                  onClick={() => onCancel(appointment.id)}
                  data-testid={`cancel-${appointment.id}`}
                >
                  Cancel
                </Button>
                {!chosen && appointment.status !== 'cancelled' && (
                  <p className={styles.rowNote}>
                    Pick a time in the schedule above to move this appointment to it.
                  </p>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
