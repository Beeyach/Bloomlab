import { beforeEach, expect, it } from 'vitest';
import { gradeExercise } from '@bloomlab/exercise-engine';
import { content } from '../content/bundle';
import { db } from '../data/db';
import { startRun } from '../simulator/store';
import { gradingContextFrom } from '../simulator/grading';
import { addNote, assignContact, updateContact } from './commands';
const exercise = content.exercises.find((row) => row.id === 'EX-BUILD_IT-lead-handover')!;
beforeEach(async () => {
  await db.delete();
  await db.open();
});
it('grades lead handover from real CRM commands and refuses an untouched account', async () => {
  let run = await startRun(
    content.scenarios.find((row) => row.id === 'SC-glowhaus-crm')! as never,
    db,
  );
  const grade = () =>
    gradeExercise({ exercise, context: gradingContextFrom(run.state, { learner: {} }) });
  expect(grade().outcome).toBe('failed');
  run = (await assignContact(run, 'aisha', 'dana', db)).run;
  run = (
    await updateContact(
      run,
      'jordan',
      { custom_fields: { treatment_interest: 'Signature Facial' } },
      db,
    )
  ).run;
  expect(grade().outcome).toBe('failed');
  run = (
    await addNote(
      run,
      { contact_id: 'aisha' },
      'Dana will call Aisha to confirm fit before offering a time. The enquiry acknowledgement did not reserve an appointment.',
      undefined,
      db,
    )
  ).run;
  expect(grade().outcome).toBe('passed');
  expect(run.state.log.some((row) => row.type === 'NOTE_ADDED')).toBe(true);
});
