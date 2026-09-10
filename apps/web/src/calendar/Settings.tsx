import { Button, Field, Input, Select, Stack } from '@bloomlab/design-system';
import {
  ASSIGNMENT_STRATEGIES,
  CALENDAR_TYPES,
  LOCATION_KINDS,
  type AccountState,
  type Calendar,
  type CalendarType,
  type LocationKind,
} from '@bloomlab/simulator-core';

import * as edit from './edit';
import {
  ASSIGNMENT_HELP,
  ASSIGNMENT_LABELS,
  CALENDAR_TYPE_HELP,
  CALENDAR_TYPE_LABELS,
  LOCATION_HELP,
  LOCATION_LABELS,
  OMISSIONS,
  type Group,
} from './words';
import { dayName } from './week';
import styles from './calendar.module.css';

/**
 * The configuration side of the Calendar Lab (CAL-001).
 *
 * Five groups rather than one long form, because the questions are different questions: what the
 * appointment is, when it can happen, who takes it, what is being booked, and what the booker may
 * do afterwards. Every control is a real setting with a real consequence — change one and the
 * schedule beside it changes.
 *
 * Every group is plain form controls: labelled, keyboard-operable, and readable at 320 px. There
 * is no drag-only editing anywhere here.
 */

const DAYS = [1, 2, 3, 4, 5, 6, 7];

export function Settings({
  group,
  draft,
  account,
  onChange,
}: {
  group: Group;
  draft: Calendar;
  account: AccountState;
  onChange: (next: Calendar) => void;
}) {
  const users = Object.values(account.users).sort((a, b) => a.name.localeCompare(b.name));
  switch (group) {
    case 'basics':
      return <Basics draft={draft} account={account} onChange={onChange} />;
    case 'availability':
      return <Availability draft={draft} onChange={onChange} />;
    case 'staff':
      return <Staff draft={draft} account={account} users={users} onChange={onChange} />;
    case 'service':
      return (
        <ServiceAndLocation draft={draft} account={account} users={users} onChange={onChange} />
      );
    case 'rules':
      return <Rules draft={draft} onChange={onChange} />;
  }
}

function number(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function Basics({
  draft,
  account,
  onChange,
}: {
  draft: Calendar;
  account: AccountState;
  onChange: (next: Calendar) => void;
}) {
  return (
    <Stack gap={4}>
      <Field label="Calendar name">
        <Input
          value={draft.name}
          onChange={(e) => onChange(edit.rename(draft, e.target.value))}
          data-testid="calendar-name"
        />
      </Field>
      <Field label="Calendar type" hint={CALENDAR_TYPE_HELP[draft.type]}>
        <Select
          value={draft.type}
          onChange={(e) => onChange(edit.setType(draft, e.target.value as CalendarType))}
          data-testid="calendar-type"
        >
          {CALENDAR_TYPES.map((type) => (
            <option key={type} value={type}>
              {CALENDAR_TYPE_LABELS[type]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Appointment duration" hint="Minutes. A service can set its own instead.">
        <Input
          type="number"
          inputMode="numeric"
          min={5}
          step={5}
          value={String(draft.duration_minutes)}
          onChange={(e) => onChange(edit.setDuration(draft, number(e.target.value, 30)))}
          data-testid="calendar-duration"
        />
      </Field>
      {draft.type === 'class' && (
        <Field
          label="Seats per class"
          hint="Every overlapping attendee booking consumes one seat. A class has exactly one host."
        >
          <Input
            type="number"
            min={1}
            step={1}
            value={draft.seats_per_class ?? 1}
            onChange={(e) => onChange({ ...draft, seats_per_class: number(e.target.value, 1) })}
            data-testid="class-capacity"
          />
        </Field>
      )}
      <Field
        label="Slot Interval"
        hint="Minutes between the times offered. Shorter than the duration gives overlapping starts."
      >
        <Input
          type="number"
          inputMode="numeric"
          min={5}
          step={5}
          value={String(draft.slot_interval_minutes)}
          onChange={(e) =>
            onChange(edit.setNumber(draft, 'slot_interval_minutes', number(e.target.value, 30)))
          }
          data-testid="calendar-interval"
        />
      </Field>
      <Field
        label="Time zone"
        hint={`Blank follows the account, which is ${account.account.timezone}.`}
      >
        <Input
          value={draft.timezone ?? ''}
          placeholder={account.account.timezone}
          onChange={(e) => onChange(edit.setTimezone(draft, e.target.value.trim() || null))}
          data-testid="calendar-timezone"
        />
      </Field>
      <p className={styles.note}>{OMISSIONS}</p>
    </Stack>
  );
}

function Availability({
  draft,
  onChange,
}: {
  draft: Calendar;
  onChange: (next: Calendar) => void;
}) {
  return (
    <Stack gap={4}>
      <div className={styles.rows} data-testid="availability-rows">
        {draft.availability.length === 0 && (
          <p className={styles.muted}>No working hours yet. Nobody can book until there are.</p>
        )}
        {draft.availability.map((hours, index) => (
          <div className={styles.row} key={`${hours.day}-${hours.start}-${index}`}>
            <Field label="Day">
              <Select
                value={String(hours.day)}
                onChange={(e) =>
                  onChange(edit.editWindow(draft, index, { day: number(e.target.value, 1) }))
                }
                data-testid={`window-day-${index}`}
              >
                {DAYS.map((day) => (
                  <option key={day} value={day}>
                    {dayName(day)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Opens">
              <Input
                type="time"
                value={hours.start}
                onChange={(e) => onChange(edit.editWindow(draft, index, { start: e.target.value }))}
                data-testid={`window-start-${index}`}
              />
            </Field>
            <Field label="Closes">
              <Input
                type="time"
                value={hours.end}
                onChange={(e) => onChange(edit.editWindow(draft, index, { end: e.target.value }))}
                data-testid={`window-end-${index}`}
              />
            </Field>
            <Button
              variant="ghost"
              onClick={() => onChange(edit.removeWindow(draft, index))}
              data-testid={`window-remove-${index}`}
            >
              Remove
            </Button>
          </div>
        ))}
      </div>
      <div className={styles.buttons}>
        <Button
          variant="secondary"
          onClick={() => onChange(edit.addWindow(draft))}
          data-testid="window-add"
        >
          Add hours
        </Button>
        <Button
          variant="ghost"
          onClick={() => onChange(edit.setWeekdays(draft, '09:00', '17:00'))}
          data-testid="window-weekdays"
        >
          Weekdays, nine to five
        </Button>
      </div>
      <Field
        label="Minimum Scheduling Notice"
        hint="Minutes. Nothing sooner than this is offered, which is how you stop a booking ten minutes from now."
      >
        <Input
          type="number"
          inputMode="numeric"
          min={0}
          step={15}
          value={String(draft.minimum_notice_minutes)}
          onChange={(e) =>
            onChange(edit.setNumber(draft, 'minimum_notice_minutes', number(e.target.value, 0)))
          }
          data-testid="calendar-notice"
        />
      </Field>
      <Field label="Buffer before" hint="Minutes kept clear ahead of each appointment.">
        <Input
          type="number"
          inputMode="numeric"
          min={0}
          step={5}
          value={String(draft.pre_buffer_minutes)}
          onChange={(e) =>
            onChange(edit.setNumber(draft, 'pre_buffer_minutes', number(e.target.value, 0)))
          }
          data-testid="calendar-pre-buffer"
        />
      </Field>
      <Field label="Buffer after" hint="Minutes kept clear after each appointment.">
        <Input
          type="number"
          inputMode="numeric"
          min={0}
          step={5}
          value={String(draft.post_buffer_minutes)}
          onChange={(e) =>
            onChange(edit.setNumber(draft, 'post_buffer_minutes', number(e.target.value, 0)))
          }
          data-testid="calendar-post-buffer"
        />
      </Field>
      <Field label="Booking window" hint="How many days ahead times are offered.">
        <Input
          type="number"
          inputMode="numeric"
          min={1}
          max={60}
          value={String(draft.booking_window_days)}
          onChange={(e) =>
            onChange(edit.setNumber(draft, 'booking_window_days', number(e.target.value, 14)))
          }
          data-testid="calendar-window"
        />
      </Field>
    </Stack>
  );
}

function Staff({
  draft,
  account,
  users,
  onChange,
}: {
  draft: Calendar;
  account: AccountState;
  users: { id: string; name: string }[];
  onChange: (next: Calendar) => void;
}) {
  const available = users.filter((user) => !draft.staff_ids.includes(user.id));
  return (
    <Stack gap={4}>
      <div className={styles.rows} data-testid="staff-rows">
        {draft.staff_ids.length === 0 && (
          <p className={styles.muted}>
            Nobody hosts on this calendar yet.{' '}
            {draft.type === 'personal'
              ? 'A personal calendar can still be booked; the appointment simply has no host.'
              : 'This type needs at least one team member before anything can be booked.'}
          </p>
        )}
        {draft.staff_ids.map((userId, index) => (
          <div className={styles.row} key={userId}>
            <span className={styles.rowName}>{account.users[userId]?.name ?? userId}</span>
            <span className={styles.rowNote}>
              {index === 0 ? 'First in the order' : `Position ${index + 1}`}
            </span>
            <div className={styles.buttons}>
              <Button
                variant="ghost"
                onClick={() => onChange(edit.moveStaff(draft, userId, -1))}
                disabled={index === 0}
                data-testid={`staff-up-${userId}`}
              >
                Up
              </Button>
              <Button
                variant="ghost"
                onClick={() => onChange(edit.moveStaff(draft, userId, 1))}
                disabled={index === draft.staff_ids.length - 1}
                data-testid={`staff-down-${userId}`}
              >
                Down
              </Button>
              <Button
                variant="ghost"
                onClick={() => onChange(edit.removeStaff(draft, userId))}
                data-testid={`staff-remove-${userId}`}
              >
                Remove
              </Button>
            </div>
          </div>
        ))}
      </div>
      {available.length > 0 && (
        <Field label="Add a team member" hint="The order breaks ties when the calendar assigns.">
          <Select
            value=""
            onChange={(e) => e.target.value && onChange(edit.addStaff(draft, e.target.value))}
            data-testid="staff-add"
          >
            <option value="">Choose someone…</option>
            {available.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <Field label="Assignment" hint={ASSIGNMENT_HELP[draft.assignment]}>
        <Select
          value={draft.assignment}
          onChange={(e) =>
            onChange(edit.setAssignment(draft, e.target.value as Calendar['assignment']))
          }
          data-testid="calendar-assignment"
        >
          {ASSIGNMENT_STRATEGIES.map((strategy) => (
            <option key={strategy} value={strategy}>
              {ASSIGNMENT_LABELS[strategy]}
            </option>
          ))}
        </Select>
      </Field>
      <Field
        label="Allow staff selection during booking"
        hint="The booker may name a host. Without a choice, the assignment rule decides."
      >
        <Select
          value={draft.staff_selection ? 'yes' : 'no'}
          onChange={(e) => onChange(edit.setStaffSelection(draft, e.target.value === 'yes'))}
          data-testid="calendar-staff-selection"
        >
          <option value="no">No</option>
          <option value="yes">Yes</option>
        </Select>
      </Field>
      <p className={styles.note}>
        The host is not the contact owner. A contact can be owned by one person and seen by another,
        and the appointment records who is actually taking it.
      </p>
    </Stack>
  );
}

function ServiceAndLocation({
  draft,
  account,
  users,
  onChange,
}: {
  draft: Calendar;
  account: AccountState;
  users: { id: string; name: string }[];
  onChange: (next: Calendar) => void;
}) {
  const onCalendar = users.filter((user) => draft.staff_ids.includes(user.id));
  return (
    <Stack gap={4}>
      <h3 className={styles.groupHeading}>Locations</h3>
      <div className={styles.rows} data-testid="location-rows">
        {draft.locations.length === 0 && (
          <p className={styles.muted}>No locations yet. A booking will simply not carry one.</p>
        )}
        {draft.locations.map((location) => (
          <div className={styles.row} key={location.id}>
            <Field label="Kind" hint={LOCATION_HELP[location.kind]}>
              <Select
                value={location.kind}
                onChange={(e) =>
                  onChange(
                    edit.editLocation(draft, location.id, {
                      kind: e.target.value as LocationKind,
                    }),
                  )
                }
                data-testid={`location-kind-${location.id}`}
              >
                {LOCATION_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {LOCATION_LABELS[kind]}
                  </option>
                ))}
              </Select>
            </Field>
            {location.kind !== 'ask_booker' && (
              <Field label="What the booker gets">
                <Input
                  value={location.value ?? ''}
                  onChange={(e) =>
                    onChange(
                      edit.editLocation(draft, location.id, {
                        value: e.target.value.trim() ? e.target.value : null,
                      }),
                    )
                  }
                  data-testid={`location-value-${location.id}`}
                />
              </Field>
            )}
            <Button
              variant="ghost"
              onClick={() => onChange(edit.removeLocation(draft, location.id))}
              data-testid={`location-remove-${location.id}`}
            >
              Remove
            </Button>
          </div>
        ))}
      </div>
      <div className={styles.buttons}>
        <Button
          variant="secondary"
          onClick={() => onChange(edit.addLocation(draft))}
          data-testid="location-add"
        >
          Add a location
        </Button>
      </div>
      {draft.locations.length > 0 && (
        <Field label="Default location" hint="What a booking gets when the service names none.">
          <Select
            value={draft.default_location_id ?? ''}
            onChange={(e) => onChange(edit.setDefaultLocation(draft, e.target.value || null))}
            data-testid="calendar-default-location"
          >
            <option value="">None</option>
            {draft.locations.map((location) => (
              <option key={location.id} value={location.id}>
                {LOCATION_LABELS[location.kind]}
                {location.value ? ` — ${location.value}` : ''}
              </option>
            ))}
          </Select>
        </Field>
      )}

      <h3 className={styles.groupHeading}>Services</h3>
      {draft.type !== 'service' ? (
        <p className={styles.muted}>
          Services belong to a Service Calendar. Change the type in Basics to use them.
        </p>
      ) : (
        <>
          <div className={styles.rows} data-testid="service-rows">
            {draft.services.length === 0 && (
              <p className={styles.muted}>
                No services yet. A service calendar needs at least one.
              </p>
            )}
            {draft.services.map((service) => (
              <div className={styles.row} key={service.id}>
                <fieldset className={styles.resourceChoices}>
                  <legend>Equivalent resources — reserve one</legend>
                  {Object.values(account.resources ?? {}).map((resource) => (
                    <label key={resource.id}>
                      <input
                        type="checkbox"
                        checked={service.resource_ids?.includes(resource.id) ?? false}
                        onChange={(e) =>
                          onChange(
                            edit.editService(draft, service.id, {
                              resource_ids: e.target.checked
                                ? [...(service.resource_ids ?? []), resource.id]
                                : (service.resource_ids ?? []).filter((id) => id !== resource.id),
                            }),
                          )
                        }
                      />
                      {resource.name} · capacity {resource.capacity}
                    </label>
                  ))}
                  {!Object.keys(account.resources ?? {}).length && (
                    <p>No resources yet. Define one below the service settings.</p>
                  )}
                </fieldset>
                <Field label="Service">
                  <Input
                    value={service.name}
                    onChange={(e) =>
                      onChange(edit.editService(draft, service.id, { name: e.target.value }))
                    }
                    data-testid={`service-name-${service.id}`}
                  />
                </Field>
                <Field label="Length" hint="Minutes. Blank uses the calendar's duration.">
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={5}
                    step={5}
                    value={
                      service.duration_minutes === null ? '' : String(service.duration_minutes)
                    }
                    onChange={(e) =>
                      onChange(
                        edit.editService(draft, service.id, {
                          duration_minutes: e.target.value
                            ? Number.parseInt(e.target.value, 10)
                            : null,
                        }),
                      )
                    }
                    data-testid={`service-duration-${service.id}`}
                  />
                </Field>
                <Field label="Where" hint="Blank uses the calendar's default.">
                  <Select
                    value={service.location_id ?? ''}
                    onChange={(e) =>
                      onChange(
                        edit.editService(draft, service.id, {
                          location_id: e.target.value || null,
                        }),
                      )
                    }
                    data-testid={`service-location-${service.id}`}
                  >
                    <option value="">The calendar’s default</option>
                    {draft.locations.map((location) => (
                      <option key={location.id} value={location.id}>
                        {LOCATION_LABELS[location.kind]}
                        {location.value ? ` — ${location.value}` : ''}
                      </option>
                    ))}
                  </Select>
                </Field>
                <fieldset className={styles.fieldset}>
                  <legend className={styles.legend}>Who can take it</legend>
                  {onCalendar.length === 0 && (
                    <p className={styles.muted}>Add team members to the calendar first.</p>
                  )}
                  {onCalendar.map((user) => (
                    <label className={styles.check} key={user.id}>
                      <input
                        type="checkbox"
                        checked={service.staff_ids.includes(user.id)}
                        onChange={() =>
                          onChange(edit.toggleServiceStaff(draft, service.id, user.id))
                        }
                        data-testid={`service-staff-${service.id}-${user.id}`}
                      />
                      <span>{user.name}</span>
                    </label>
                  ))}
                  <p className={styles.rowNote}>
                    {service.staff_ids.length === 0
                      ? 'Nobody named, so everyone on the calendar can take it.'
                      : `${service.staff_ids.length} named.`}
                  </p>
                </fieldset>
                <Button
                  variant="ghost"
                  onClick={() => onChange(edit.removeService(draft, service.id))}
                  data-testid={`service-remove-${service.id}`}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
          <div className={styles.buttons}>
            <Button
              variant="secondary"
              onClick={() => onChange(edit.addService(draft))}
              data-testid="service-add"
            >
              Add a service
            </Button>
          </div>
        </>
      )}
    </Stack>
  );
}

function Rules({ draft, onChange }: { draft: Calendar; onChange: (next: Calendar) => void }) {
  return (
    <Stack gap={4}>
      <Field
        label="Allow Cancellation of Meeting"
        hint="Whether the person who booked can cancel it themselves."
      >
        <Select
          value={draft.booking.cancellation_allowed ? 'yes' : 'no'}
          onChange={(e) =>
            onChange(edit.setBookingRule(draft, { cancellation_allowed: e.target.value === 'yes' }))
          }
          data-testid="calendar-allow-cancel"
        >
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </Select>
      </Field>
      <Field
        label="Allow Rescheduling of Meeting"
        hint="Whether the person who booked can move it themselves."
      >
        <Select
          value={draft.booking.reschedule_allowed ? 'yes' : 'no'}
          onChange={(e) =>
            onChange(edit.setBookingRule(draft, { reschedule_allowed: e.target.value === 'yes' }))
          }
          data-testid="calendar-allow-reschedule"
        >
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </Select>
      </Field>
      <Field
        label="Cutoff"
        hint="Hours before the start after which the booker's links stop working. Blank never expires."
      >
        <Input
          type="number"
          inputMode="numeric"
          min={0}
          value={
            draft.booking.change_cutoff_hours === null
              ? ''
              : String(draft.booking.change_cutoff_hours)
          }
          onChange={(e) =>
            onChange(
              edit.setBookingRule(draft, {
                change_cutoff_hours: e.target.value ? Number.parseInt(e.target.value, 10) : null,
              }),
            )
          }
          data-testid="calendar-cutoff"
        />
      </Field>
      <p className={styles.note}>
        These decide what the booker may do from their own confirmation. Somebody on the team can
        always change an appointment from inside the account, which is what the Appointments list
        below is.
      </p>
    </Stack>
  );
}
