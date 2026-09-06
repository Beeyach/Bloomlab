import { beforeEach, describe, expect, it } from 'vitest';

import { content } from '../content/bundle';
import { db } from '../data/db';
import { NORMAL_RUN, loadAttempt, saveResponse, startAttempt } from './attempt';
import { finalizeAttempt } from './finalize';

const ID = 'EX-ARCHITECTURE_DECISION-treatment-interest';
const exercise = content.exercises.find((candidate) => candidate.id === ID)!;

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
});

describe('submission waits for queued attempt writes', () => {
  it('records the last edit even when Run it starts before that save resolves', async () => {
    const started = await startAttempt(exercise, NORMAL_RUN, {}, db);

    // Deliberately do not await the keystroke save. This is the real UI order when the learner
    // types and immediately clicks Run it: the edit has been queued, but React may still hold the
    // older ActiveAttempt object that was rendered before IndexedDB finished.
    const saving = saveResponse(
      ID,
      NORMAL_RUN,
      {
        choice: 'contact_custom_field',
        text: 'A contact custom field: reminder templates print it as a merge field.',
      },
      db,
    );

    const finalized = await finalizeAttempt(exercise, started, db);
    await saving;

    expect(finalized.report.score).toBe(100);
    expect(finalized.attempt.response?.choice).toBe('contact_custom_field');
    expect(finalized.attempt.response?.text).toContain('merge field');
    expect(await loadAttempt(ID, NORMAL_RUN, db)).toBeUndefined();
  });
});
