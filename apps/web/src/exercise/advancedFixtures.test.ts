import { describe, expect, it } from 'vitest';
import { gradeExercise, type GradingContext } from '@bloomlab/exercise-engine';
import { content } from '../content/bundle';
import { learnerState, emptyResponse } from './response';
import { canGradeNow } from './runtime';

describe('advanced curriculum uses objective AI-Off practicals', () => {
  const exercises = content.exercises.filter((exercise) =>
    exercise.advanced_topics.some(
      (topic) => !topic.startsWith('connect.') && !topic.startsWith('labs.'),
    ),
  );
  it('grades every authored contract, refusing an empty or individually corrupted answer', () => {
    expect(exercises.length).toBeGreaterThanOrEqual(9);
    for (const exercise of exercises) {
      expect(canGradeNow(exercise), exercise.id).toBe(true);
      expect(exercise.grading.mode).toBe('deterministic');
      expect(exercise.fixture_checks.length).toBeGreaterThanOrEqual(2);
      const correct = Object.fromEntries(
        exercise.fixture_checks.map((check) => [check.field, check.expected_json]),
      );
      const context = (written: Record<string, string>): GradingContext => ({
        state: learnerState(exercise, { ...emptyResponse(), written }),
        events: [],
        references: {},
        architecture: { workflows: [] },
        provides: ['learner'],
      });
      expect(gradeExercise({ exercise, context: context({}) }).outcome, exercise.id).toBe('failed');
      expect(gradeExercise({ exercise, context: context(correct) }).outcome, exercise.id).toBe(
        'passed',
      );
      for (const check of exercise.fixture_checks)
        expect(
          gradeExercise({ exercise, context: context({ ...correct, [check.field]: 'null' }) })
            .outcome,
          `${exercise.id}/${check.key}`,
        ).toBe('failed');
    }
  });
});
