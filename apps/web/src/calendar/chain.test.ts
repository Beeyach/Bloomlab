import { beforeEach, describe, expect, it } from 'vitest';

import {
  calendarSlots,
  contentEventName,
  initialAccount,
  validateCalendar,
  validateScenario,
  type Calendar,
  type SimulatorScenario,
  type Slot,
} from '@bloomlab/simulator-core';

import { content } from '../content/bundle';
import { BloomlabDatabase } from '../data/db';
import { startRun, type StoredRun } from '../simulator/store';
import {
  bookAppointment,
  cancelAppointment,
  rescheduleAppointment,
  saveCalendar,
  setAppointmentStatus,
} from './commands';
import * as edit from './edit';
import { eventsSince, logWatermark } from './session';

/**
 * CAL-001 and CAL-003 through the Lab's own commands.
 *
 * The Lab is allowed no shortcut the requirement refuses. Nothing here writes an appointment,
 * nothing injects `WORKFLOW_ENROLLED`, and no slot is invented: every booking uses a time the
 * shared availability engine actually offered, put through the same execution door the Workflow
 * Lab and the Funnel Lab use, and every assertion reads the run's own log afterwards.
 */

const SCENARIO_ID = 'SC-glowhaus-calendar';

const scenario = (): SimulatorScenario => {
  const found = (content.scenarios as unknown as SimulatorScenario[]).find(
    (row) => row.id === SCENARIO_ID,
  );
  if (!found) throw new Error(`${SCENARIO_ID} is not in the content bundle`);
  return found;
};

let database: BloomlabDatabase;
let run: StoredRun;

const options = () => ({ database, createWorker: null });

const of = (state: StoredRun, type: string) =>
  state.state.log.filter((event) => contentEventName(event.type) === type);

const calendarOf = (state: StoredRun, id: string) => state.state.account.calendars[id] as Calendar;

const openings = (state: StoredRun, id: string, query = {}): Slot[] =>
  calendarSlots(state.state.account, calendarOf(state, id), state.state.clock.now, query);

beforeEach(async () => {
  database = new BloomlabDatabase(`calendar-chain-${Math.random().toString(36).slice(2)}`);
  await database.open();
  run = await startRun(scenario(), database);
});

describe('the scenario itself', () => {
  it('is runnable and hands the learner a calendar that needs work', () => {
    expect(validateScenario(scenario())).toEqual([]);
    const account = initialAccount(scenario());
    const consultation = account.calendars.consultation as Calendar;
    // Valid, and unfinished: no buffer, no notice, one host on a calendar two people staff.
    expect(validateCalendar(consultation, account)).toEqual([]);
    expect(consultation.pre_buffer_minutes).toBe(0);
    expect(consultation.post_buffer_minutes).toBe(0);
    expect(consultation.minimum_notice_minutes).toBe(0);
    expect(consultation.staff_ids).toEqual(['theo']);
    // The services are names with no length and nobody assigned. That is the work, not decoration.
    const treatments = account.calendars.treatments as Calendar;
    expect(treatments.services.map((row) => row.duration_minutes)).toEqual([null, null, null]);
    expect(treatments.services.every((row) => row.staff_ids.length === 0)).toBe(true);
    expect(account.workflows['wf-cancellation-recovery']).toBeDefined();
  });
});

describe('CAL-001: a saved calendar changes what the account offers', () => {
  it('saves as an account event and bumps the version', async () => {
    const next = edit.setNumber(calendarOf(run, 'consultation'), 'minimum_notice_minutes', 240);
    const result = await saveCalendar(run, scenario(), next, options());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.run.state.account.calendars.consultation?.version).toBe(2);
    expect(of(result.run, 'calendar.updated')).toHaveLength(1);
  });

  it('moves the first opening when minimum notice is set', async () => {
    expect(openings(run, 'consultation')[0]?.starts_at).toBe('2026-09-08T09:00:00-05:00');
    const result = await saveCalendar(
      run,
      scenario(),
      edit.setNumber(calendarOf(run, 'consultation'), 'minimum_notice_minutes', 240),
      options(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(openings(result.run, 'consultation')[0]?.starts_at).toBe('2026-09-08T13:00:00-05:00');
  });

  it('protects the room when a buffer is added', async () => {
    // Nadia is 11:00 and Marcus 11:30, back to back. Fifteen minutes each side pushes the next
    // opening past both of them rather than into the turnover.
    const before = openings(run, 'consultation').map((slot) => slot.starts_at);
    expect(before).toContain('2026-09-08T10:30:00-05:00');
    let next = edit.setNumber(calendarOf(run, 'consultation'), 'pre_buffer_minutes', 15);
    next = edit.setNumber(next, 'post_buffer_minutes', 15);
    const result = await saveCalendar(run, scenario(), next, options());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const after = openings(result.run, 'consultation').map((slot) => slot.starts_at);
    expect(after).not.toContain('2026-09-08T10:30:00-05:00');
    expect(after).not.toContain('2026-09-08T12:00:00-05:00');
    expect(after).toContain('2026-09-08T12:30:00-05:00');
  });

  it('turns the calendar into a round robin and assigns a host with a reason', async () => {
    let next = edit.setType(calendarOf(run, 'consultation'), 'round_robin');
    next = edit.addStaff(next, 'ivy');
    const result = await saveCalendar(run, scenario(), next, options());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const saved = result.run.state.account.calendars.consultation as Calendar;
    expect(saved.staff_ids).toEqual(['theo', 'ivy']);
    expect(saved.assignment).toBe('optimize_availability');
    // Theo is with Nadia at 11:00, so an 11:00 consultation is Ivy's and the engine says why.
    const eleven = openings(result.run, 'consultation').find(
      (slot) => slot.starts_at === '2026-09-08T11:00:00-05:00',
    );
    expect(eleven?.host_id).toBe('ivy');
    expect(eleven?.host_reason).toBe('only_host');
  });

  it('gives a service its own length and its own eligible staff', async () => {
    let next = calendarOf(run, 'treatments');
    next = edit.editService(next, 'signature-facial', { duration_minutes: 75 });
    next = edit.toggleServiceStaff(next, 'signature-facial', 'ivy');
    const result = await saveCalendar(run, scenario(), next, options());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const facial = openings(result.run, 'treatments', { service_id: 'signature-facial' });
    expect(facial[0]?.duration_minutes).toBe(75);
    expect(facial[0]?.eligible_staff_ids).toEqual(['ivy']);
    const other = openings(result.run, 'treatments', { service_id: 'laser-consult' });
    expect(other[0]?.duration_minutes).toBe(60);
    expect(other[0]?.eligible_staff_ids).toEqual(['ivy', 'theo']);
  });

  it('refuses a definition the account cannot hold', async () => {
    const broken = { ...calendarOf(run, 'consultation'), staff_ids: ['nobody'] };
    const result = await saveCalendar(run, scenario(), broken, options());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.refusal.code).toBe('UNKNOWN_ENTITY');
    // The run is untouched: a refusal changes nothing.
    expect(result.run.state.account.calendars.consultation?.staff_ids).toEqual(['theo']);
  });
});

describe('CAL-003: the appointment lifecycle reaches workflows', () => {
  const book = async (bookedBy: 'customer' | 'staff' = 'customer') => {
    const slot = openings(run, 'consultation').find(
      (row) => row.starts_at === '2026-09-10T13:00:00-05:00',
    );
    expect(slot).toBeTruthy();
    const result = await bookAppointment(
      run,
      scenario(),
      {
        contact_id: 'soraya',
        calendar_id: 'consultation',
        slot: slot as Slot,
        service_id: null,
        location_id: 'studio',
        booked_by: bookedBy,
      },
      options(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('the booking was refused');
    return result.run;
  };

  it('refuses a slot that another booking took after it was shown', async () => {
    const stale = openings(run, 'consultation').find(
      (row) => row.starts_at === '2026-09-10T13:00:00-05:00',
    ) as Slot;
    const first = await bookAppointment(
      run,
      scenario(),
      {
        contact_id: 'soraya',
        calendar_id: 'consultation',
        slot: stale,
        service_id: null,
        location_id: 'studio',
        booked_by: 'customer',
      },
      options(),
    );
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = await bookAppointment(
      first.run,
      scenario(),
      {
        contact_id: 'marcus',
        calendar_id: 'consultation',
        slot: stale,
        service_id: null,
        location_id: 'studio',
        booked_by: 'customer',
      },
      options(),
    );
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.refusal.code).toBe('INVALID_PAYLOAD');
    expect(second.run.state.log).toHaveLength(first.run.state.log.length);
  });

  it('books what the engine offered, with its host, length and location', async () => {
    const after = await book();
    const appointment = Object.values(after.state.account.appointments).find(
      (row) => row.contact_id === 'soraya',
    );
    expect(appointment).toMatchObject({
      calendar_id: 'consultation',
      starts_at: '2026-09-10T13:00:00-05:00',
      duration_minutes: 30,
      host_id: 'theo',
      location_id: 'studio',
      booked_by: 'customer',
      status: 'booked',
    });
    // The host is not the contact's owner. Soraya has none; the appointment still has a host.
    expect(after.state.account.contacts.soraya?.owner_id).toBeNull();
  });

  it('enrols the reminder for a customer booking and not for a staff one', async () => {
    const customer = await book('customer');
    expect(of(customer, 'workflow.enrolled').map((row) => row.payload.workflow_id)).toContain(
      'wf-consult-reminder',
    );
    run = await startRun(scenario(), database);
    const staff = await book('staff');
    expect(of(staff, 'workflow.enrolled').map((row) => row.payload.workflow_id)).not.toContain(
      'wf-consult-reminder',
    );
  });

  it('confirms through a real status event and runs the confirmed workflow', async () => {
    const after = await book();
    const appointment = Object.values(after.state.account.appointments).find(
      (row) => row.contact_id === 'soraya',
    );
    const from = logWatermark(after);
    const result = await setAppointmentStatus(
      after,
      scenario(),
      appointment?.id as string,
      'confirmed',
      options(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const since = eventsSince(result.run, from).map((row) => contentEventName(row.type));
    expect(since[0]).toBe('appointment.status_changed');
    expect(since).toContain('workflow.enrolled');
    expect(result.run.state.account.contacts.soraya?.tags).toContain('confirmed');
  });

  it('cancels through a real event, frees the time and starts recovery', async () => {
    const after = await book();
    const appointment = Object.values(after.state.account.appointments).find(
      (row) => row.contact_id === 'soraya',
    );
    const from = logWatermark(after);
    const result = await cancelAppointment(
      after,
      scenario(),
      appointment?.id as string,
      null,
      options(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const since = eventsSince(result.run, from);
    const names = since.map((row) => contentEventName(row.type));
    expect(names[0]).toBe('appointment.cancelled');
    // The reminder is pulled out first, then recovery starts. Both are the engine's own events.
    const exited = since.findIndex((row) => row.type === 'WORKFLOW_EXITED');
    const entered = since.findIndex(
      (row) =>
        row.type === 'WORKFLOW_ENROLLED' && row.payload.workflow_id === 'wf-cancellation-recovery',
    );
    expect(exited).toBeGreaterThanOrEqual(0);
    expect(entered).toBeGreaterThan(exited);
    for (const row of since.filter((entry) => entry.type === 'WORKFLOW_ENROLLED')) {
      expect(row.origin).toBe('generated');
      expect(row.source?.kind).toBe('workflow_trigger');
    }
    expect(result.run.state.account.contacts.soraya?.tags).toContain('win-back');
    // And the time is bookable again.
    expect(openings(result.run, 'consultation').map((row) => row.starts_at)).toContain(
      '2026-09-10T13:00:00-05:00',
    );
  });

  it('refuses a move when the chosen time became unavailable', async () => {
    const after = await book();
    const appointment = Object.values(after.state.account.appointments).find(
      (row) => row.contact_id === 'soraya',
    );
    const target = calendarSlots(
      after.state.account,
      after.state.account.calendars.consultation as Calendar,
      after.state.clock.now,
      { ignore_appointment_id: appointment?.id },
    ).find((row) => row.starts_at === '2026-09-11T10:00:00-05:00') as Slot;
    const occupied = await bookAppointment(
      after,
      scenario(),
      {
        contact_id: 'marcus',
        calendar_id: 'consultation',
        slot: target,
        service_id: null,
        location_id: 'studio',
        booked_by: 'staff',
      },
      options(),
    );
    expect(occupied.ok).toBe(true);
    if (!occupied.ok) return;
    const moved = await rescheduleAppointment(
      occupied.run,
      scenario(),
      appointment?.id as string,
      target,
      options(),
    );
    expect(moved.ok).toBe(false);
    if (moved.ok) return;
    expect(moved.refusal.code).toBe('INVALID_PAYLOAD');
    expect(moved.run.state.account.appointments[appointment?.id as string]?.starts_at).toBe(
      '2026-09-10T13:00:00-05:00',
    );
  });

  it('moves an appointment onto another slot the same engine produced', async () => {
    const after = await book();
    const appointment = Object.values(after.state.account.appointments).find(
      (row) => row.contact_id === 'soraya',
    );
    const target = calendarSlots(
      after.state.account,
      after.state.account.calendars.consultation as Calendar,
      after.state.clock.now,
      { ignore_appointment_id: appointment?.id },
    ).find((row) => row.starts_at === '2026-09-11T10:00:00-05:00');
    expect(target).toBeTruthy();
    const result = await rescheduleAppointment(
      after,
      scenario(),
      appointment?.id as string,
      target as Slot,
      options(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.run.state.account.appointments[appointment?.id as string]).toMatchObject({
      starts_at: '2026-09-11T10:00:00-05:00',
      status: 'booked',
    });
    // The old time is free and the new one is not.
    const times = openings(result.run, 'consultation').map((row) => row.starts_at);
    expect(times).toContain('2026-09-10T13:00:00-05:00');
    expect(times).not.toContain('2026-09-11T10:00:00-05:00');
    // The reminder re-entered and measures against the new instant.
    const live = Object.values(result.run.state.account.workflow_runs).filter(
      (row) => row.workflow_id === 'wf-consult-reminder' && row.status === 'waiting',
    );
    expect(live).toHaveLength(1);
    expect(live[0]?.wait?.wake_at).toBe('2026-09-10T10:00:00-05:00');
  });

  it('leaves a form-triggered run alone when an appointment is cancelled', async () => {
    const after = await book();
    const appointment = Object.values(after.state.account.appointments).find(
      (row) => row.contact_id === 'soraya',
    );
    const cancelled = await cancelAppointment(
      after,
      scenario(),
      appointment?.id as string,
      null,
      options(),
    );
    expect(cancelled.ok).toBe(true);
    if (!cancelled.ok) return;
    const recovery = Object.values(cancelled.run.state.account.workflow_runs).find(
      (row) => row.workflow_id === 'wf-cancellation-recovery',
    );
    expect(recovery).toBeTruthy();
    // And the reminder is out, not still waiting to text somebody who cancelled.
    const reminder = Object.values(cancelled.run.state.account.workflow_runs).find(
      (row) => row.workflow_id === 'wf-consult-reminder',
    );
    expect(reminder?.status).toBe('exited');
  });
});
