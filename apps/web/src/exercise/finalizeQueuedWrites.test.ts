import { fakeEvaluation } from '../ai/testGateway';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { content } from '../content/bundle';
import { db } from '../data/db';
import { NORMAL_RUN, loadAttempt, saveResponse, startAttempt } from './attempt';
import { registerRuntime, EXERCISE_RUNTIMES } from './runtime';
import { finalizeAttempt } from './finalize';

const ID = 'EX-ARCHITECTURE_DECISION-treatment-interest';
const exercise = content.exercises.find((candidate) => candidate.id === ID)!;

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
});

describe('submission waits for queued attempt writes', () => {
  it('preserves the submitted runtime structure with the canonical attempt and outbox', async () => {
    const architecture = {
      workflows: [{ id: 'actual-workflow', name: 'Submitted workflow', trigger: null, nodes: [] }],
    };
    registerRuntime({
      id: 'portfolio-capture-test',
      provides: ['architecture'],
      handles: (e) => e.id === ID,
      context: async (_, state) => ({
        state,
        architecture,
        events: [],
        references: {},
        provides: ['learner', 'architecture'],
      }),
    });
    try {
      const attempt = await startAttempt(exercise, NORMAL_RUN, {}, db);
      await saveResponse(
        ID,
        NORMAL_RUN,
        {
          choice: 'contact_custom_field',
          text: 'Use a contact custom field as a template merge field.',
        },
        db,
      );
      const finalized = await finalizeAttempt(exercise, attempt, db);
      architecture.workflows[0]!.name = 'Changed after submission';
      const saved = await db.exercise_attempts.get(finalized.attempt.id);
      expect(saved?.portfolio_capture?.workflows[0]?.name).toBe('Submitted workflow');
      const queued = await db.sync_queue.filter((r) => r.entity === 'exercise_attempts').toArray();
      expect(JSON.stringify(queued)).toContain('Submitted workflow');
      expect(finalized.report.outcome).toBe('passed');
    } finally {
      EXERCISE_RUNTIMES.splice(
        EXERCISE_RUNTIMES.findIndex((r) => r.id === 'portfolio-capture-test'),
        1,
      );
    }
  });
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

vi.mock('../ai/client', () => ({
  evaluateSubmission: (...args: Parameters<typeof fakeEvaluation>) => fakeEvaluation(...args),
  classifyLanguage: vi.fn().mockResolvedValue(null),
}));
