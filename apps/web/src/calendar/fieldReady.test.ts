import { beforeEach, expect, it } from 'vitest';
import { calendarSlots, type SimulatorScenario } from '@bloomlab/simulator-core';
import { gradeExercise } from '@bloomlab/exercise-engine';
import { content } from '../content/bundle';
import { db } from '../data/db';
import { startRun } from '../simulator/store';
import { gradingContextFrom } from '../simulator/grading';
import {
  saveCalendar,
  bookAppointment,
  rescheduleAppointment,
  cancelAppointment,
} from './commands';
const scenario = content.scenarios.find(
  (row) => row.id === 'SC-glowhaus-calendar',
) as unknown as SimulatorScenario;
const exercise = content.exercises.find((row) => row.id === 'EX-BUILD_IT-consultation-capacity')!;
beforeEach(async () => {
  await db.delete();
  await db.open();
});
it('passes the authored capacity build only after configuration and the real appointment lifecycle', async () => {
  let run = await startRun(scenario, db);
  const options = { database: db, createWorker: null };
  const grade = () =>
    gradeExercise({ exercise, context: gradingContextFrom(run.state, { learner: {} }) });
  expect(grade().outcome).toBe('failed');
  const calendar = {
    ...run.state.account.calendars.consultation!,
    duration_minutes: 45,
    post_buffer_minutes: 15,
    minimum_notice_minutes: 120,
  };
  run = (await saveCalendar(run, scenario, calendar, options)).run;
  expect(grade().outcome).toBe('failed');
  const slots = () =>
    calendarSlots(
      run.state.account,
      run.state.account.calendars.consultation!,
      run.state.clock.now,
    );
  const booked = await bookAppointment(
    run,
    scenario,
    {
      contact_id: 'soraya',
      calendar_id: 'consultation',
      slot: slots()[0]!,
      service_id: null,
      location_id: 'studio',
      booked_by: 'customer',
    },
    options,
  );
  expect(booked.ok).toBe(true);
  run = booked.run;
  const appointment = Object.values(run.state.account.appointments).find(
    (row) => row.contact_id === 'soraya',
  )!;
  const moved = await rescheduleAppointment(run, scenario, appointment.id, slots()[0]!, options);
  expect(moved.ok).toBe(true);
  run = moved.run;
  const cancelled = await cancelAppointment(
    run,
    scenario,
    appointment.id,
    'Controlled QA case',
    options,
  );
  expect(cancelled.ok).toBe(true);
  run = cancelled.run;
  expect(grade().outcome).toBe('passed');
});
