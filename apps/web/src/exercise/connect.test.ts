import { describe, expect, it } from 'vitest';
import { gradeExercise, type GradingContext } from '@bloomlab/exercise-engine';
import { content } from '../content/bundle';
import { learnerState, emptyResponse } from './response';
import { canGradeNow } from './runtime';
import { treatmentFor } from './runnerCopy';

describe('CONNECT uses the existing AI-Off runner and evidence contract', () => {
  const exercises = content.exercises.filter((exercise) =>
    exercise.advanced_topics.some((topic) => topic.startsWith('connect.')),
  );
  it('has nine runnable practicals, none depending on provider or simulator credentials', () => {
    expect(exercises).toHaveLength(9);
    for (const exercise of exercises) {
      expect(canGradeNow(exercise), exercise.id).toBe(true);
      expect(exercise.grading.mode).toBe('deterministic');
      expect(treatmentFor(exercise).freeResponse).toBe(false);
      expect(treatmentFor(exercise).stance).toContain('No external action');
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
