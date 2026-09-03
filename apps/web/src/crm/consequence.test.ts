import { beforeEach, describe, expect, it } from 'vitest';

import { gradeExercise } from '@bloomlab/exercise-engine';

import { content } from '../content/bundle';
import { db } from '../data/db';
import { NORMAL_RUN, startAttempt } from '../exercise/attempt';
import { RuntimeUnavailableError, finalizeAttempt } from '../exercise/finalize';
import { canGradeNow, missingSources, runtimeFor } from '../exercise/runtime';
import { startRun, type StoredRun } from '../simulator/store';
import { removeTag, updateContact } from './commands';
import { crmExerciseRuntime } from './exerciseRuntime';
import { CRM_SCENARIO_ID } from './useCrmRun';

/**
 * The CRM-003 consequence, end to end.
 *
 * CRM-003 asks two things of the product: a poor-but-possible modelling choice is allowed while
 * it is being made, and a **later consequence** teaches why it was poor. The first half is proved
 * in `crm.test.ts` — nothing warns, nothing blocks. This file proves the second: the account the
 * learner has been working in is what the exercise is graded against, so the exercise fails while
 * the three tags are there and passes once the fact lives where one answer can be read.
 *
 * Nothing is mocked. The run is a real simulator run of the real training scenario, the fix goes
 * through the same command layer the screen uses, and the grade comes from the real grader.
 */

const EXERCISE_ID = 'EX-FIX_IT-jordan-treatment-interest';
const byId = (id: string) => content.exercises.find((row) => row.id === id)!;
const exercise = byId(EXERCISE_ID);
const scenario = content.scenarios.find((row) => row.id === CRM_SCENARIO_ID)!;

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
});

/** Grades the exercise against whatever the CRM account currently holds. */
async function gradeAgainstTheAccount() {
  const context = await crmExerciseRuntime.context(exercise, {});
  expect(context).not.toBeNull();
  return gradeExercise({ exercise, context: context!, hints_used: [] });
}

const openTheLab = () => startRun(scenario as never, db) as Promise<StoredRun>;

describe('the consequence is graded from the learner’s own account (CRM-003)', () => {
  it('fails while Jordan’s interest is three tags', async () => {
    await openTheLab();
    const report = await gradeAgainstTheAccount();

    expect(report.outcome).toBe('failed');
    // The gate is the tag that duplicates the field, not the score.
    expect(report.failed_critical).toEqual(['c1']);
    expect(report.counts.unevaluated).toBe(0);
    const a1 = report.tiers.required.find((row) => row.id === 'a1')!;
    expect(a1.passed).toBe(false);
    expect(a1.observed).toBe(
      'contacts.jordan.custom_fields.treatment_interest is not in the state',
    );
  });

  it('passes once the fact lives where one answer can be read', async () => {
    let run = await openTheLab();

    const fixed = await updateContact(
      run,
      'jordan',
      { custom_fields: { treatment_interest: 'Signature Facial' } },
      db,
    );
    expect(fixed.ok).toBe(true);
    run = fixed.run;
    for (const tag of ['wants-membership', 'wants-laser', 'wants-facial']) {
      const outcome = await removeTag(run, 'jordan', tag, db);
      expect(outcome.ok).toBe(true);
      run = outcome.run;
    }

    const report = await gradeAgainstTheAccount();
    expect(report.outcome).toBe('passed');
    expect(report.failed_critical).toEqual([]);
    expect(report.score).toBe(100);
  });

  it('still fails when the tags go but the field is never set', async () => {
    let run = await openTheLab();
    for (const tag of ['wants-membership', 'wants-laser', 'wants-facial']) {
      run = (await removeTag(run, 'jordan', tag, db)).run;
    }

    const report = await gradeAgainstTheAccount();
    expect(report.outcome).toBe('failed');
    // Deleting the evidence is not fixing the record: the report still cannot answer the question.
    expect(report.tiers.required.find((row) => row.id === 'a1')?.passed).toBe(false);
  });

  it('fails a learner who tidies Jordan by breaking Maria', async () => {
    let run = await openTheLab();
    run = (
      await updateContact(
        run,
        'jordan',
        { custom_fields: { treatment_interest: 'Signature Facial' } },
        db,
      )
    ).run;
    for (const tag of ['wants-membership', 'wants-laser', 'wants-facial']) {
      run = (await removeTag(run, 'jordan', tag, db)).run;
    }
    run = (
      await updateContact(run, 'maria', { custom_fields: { treatment_interest: 'Laser' } }, db)
    ).run;

    const report = await gradeAgainstTheAccount();
    expect(report.tiers.quality.find((row) => row.id === 'a6')?.passed).toBe(false);
    expect(report.score).toBeLessThan(100);
  });
});

describe('the runtime claims only what the CRM Lab owns (EXR-024)', () => {
  it('makes the CRM exercise gradable and names no missing source', () => {
    expect(canGradeNow(exercise)).toBe(true);
    expect(missingSources(exercise)).toEqual([]);
    expect(runtimeFor(exercise)?.id).toBe('crm-lab');
  });

  it('leaves every workflow exercise exactly as un-runnable as it was', () => {
    for (const id of [
      'EX-BUILD_IT-no-show-recovery',
      'EX-FIX_IT-double-reminder',
      'EX-RUN_THE_LEAD-booking-confirmation',
      'EX-EDGE_CASE-late-booking-reminder',
      'EX-REBUILD_BLIND-appointment-reminders',
    ]) {
      const other = byId(id);
      expect(runtimeFor(other)).toBeNull();
      expect(canGradeNow(other)).toBe(false);
    }
  });

  it('never claims architecture, which is the Workflow Lab’s to supply', async () => {
    await openTheLab();
    const context = await crmExerciseRuntime.context(exercise, {});
    expect(context?.architecture).toBeNull();
    expect(context?.provides).not.toContain('architecture');
  });

  it('refuses the grade rather than failing a learner who has no account yet', async () => {
    const attempt = await startAttempt(exercise, NORMAL_RUN, {}, db);
    await expect(finalizeAttempt(exercise, attempt, db)).rejects.toBeInstanceOf(
      RuntimeUnavailableError,
    );
    expect(await db.exercise_attempts.count()).toBe(0);
    expect(await db.skill_evidence.count()).toBe(0);
  });

  it('records the attempt against the account once there is one', async () => {
    let run = await openTheLab();
    run = (
      await updateContact(
        run,
        'jordan',
        { custom_fields: { treatment_interest: 'Signature Facial' } },
        db,
      )
    ).run;
    for (const tag of ['wants-membership', 'wants-laser', 'wants-facial']) {
      run = (await removeTag(run, 'jordan', tag, db)).run;
    }

    const attempt = await startAttempt(exercise, NORMAL_RUN, {}, db);
    const { report, recorded } = await finalizeAttempt(exercise, attempt, db);
    expect(recorded).toBe(true);
    expect(report.outcome).toBe('passed');
    const evidence = await db.skill_evidence.toArray();
    expect(evidence.map((row) => row.skill_id)).toContain('SK-ARCHITECT-tags-vs-custom-fields');
  });
});
