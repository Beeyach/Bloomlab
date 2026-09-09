import { describe, expect, it } from 'vitest';
import { gradeExercise } from '@bloomlab/exercise-engine';
import { content } from '../content/bundle';
import { emptyResponse, learnerState } from './response';
import type { ReviewResponse } from './review';
const exercise = content.exercises.find((row) => row.id === 'EX-WHAT_WOULD_YOU_BUILD-qa-release')!;
const good = (): ReviewResponse => ({
  decision: 'release',
  checks: Object.fromEntries(
    exercise.review_checks.map(({ key }) => [
      key,
      {
        status: 'passed',
        observation:
          'Expected and observed results match; evidence is retained in the named training run.',
      },
    ]),
  ),
});
const grade = (review: ReviewResponse) =>
  gradeExercise({
    exercise,
    context: {
      state: learnerState(exercise, { ...emptyResponse(), review }),
      events: [],
      references: {},
      architecture: { workflows: [] },
      provides: ['learner'],
    },
  });
describe('Bloomwired nineteen-area QA release', () => {
  it('authors all nineteen areas as structured tests', () =>
    expect(exercise.review_checks).toHaveLength(19));
  it('cannot release with a missing, failed or blocked check despite otherwise complete work', () => {
    for (const status of ['', 'failed', 'blocked'] as const) {
      const value = good();
      value.checks['reschedule']!.status = status;
      expect(grade(value).outcome).toBe('failed');
      expect(grade(value).failed_critical).toContain('release_decision');
    }
  });
  it('permits an honest hold with observed unresolved tests, while prose judgment remains pending', () => {
    const value = good();
    value.checks['sms']!.status = 'blocked';
    value.decision = 'hold';
    expect(grade(value).failed_critical).toEqual([]);
    expect(grade(value).outcome).toBe('partial');
    expect(grade(value).rubric_pending).toBe(exercise.grading.rubric);
  });
  it('does not count an unperformed test merely because Passed was selected', () => {
    const value = good();
    value.checks['mobile']!.observation = ' ';
    expect(grade(value).outcome).toBe('failed');
  });
});
