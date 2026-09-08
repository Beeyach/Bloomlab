import { describe, expect, it } from 'vitest';
import { ExerciseSchema } from '@bloomlab/content-schema';
import { combineRubric, gradeExercise } from '@bloomlab/exercise-engine';
import { content } from '../content/bundle';

const exercise = content.exercises.find((e) => e.call?.mode === 'cold_call')!;
const rubric = content.rubrics.find((r) => r.id === exercise.grading.rubric)!;
describe('CALL-003 authoritative objective gates and authored configuration', () => {
  it.each([
    [
      { complete: true, next_step_agreed: false, pitched_before_diagnosis: false },
      'required_failure',
    ],
    [
      { complete: true, next_step_agreed: true, pitched_before_diagnosis: true },
      'critical_failure',
    ],
  ] as const)('a perfect model judgment cannot override %j', (call, reason) => {
    const report = gradeExercise({
      exercise,
      context: {
        state: { call },
        events: [],
        references: {},
        architecture: null,
        provides: ['learner'],
      },
      hints_used: [],
      assistance: 'independent',
    });
    const combined = combineRubric(report, rubric, {
      score: 100,
      rubric_results: rubric.items.map((item) => ({
        id: item.id,
        passed: true,
        reason: 'Fixture praise',
      })),
      critical_issue: null,
    });
    expect(combined.outcome).toBe('failed');
    expect(combined.reason).toBe(reason);
  });
  it('rejects unauthored modes, missing call configuration, advanced anchors and unreachable rules', () => {
    expect(ExerciseSchema.safeParse(exercise).success).toBe(true);
    expect(ExerciseSchema.safeParse({ ...exercise, call: undefined }).success).toBe(false);
    expect(ExerciseSchema.safeParse({ ...exercise, mode: 'pressure' }).success).toBe(false);
    expect(
      ExerciseSchema.safeParse({ ...exercise, call: { ...exercise.call, mode: 'invented' } })
        .success,
    ).toBe(false);
    expect(
      ExerciseSchema.safeParse({
        ...exercise,
        call: {
          ...exercise.call,
          rules: [{ node: 'missing', move: 'permission', phrases: ['ask a question'] }],
        },
      }).success,
    ).toBe(false);
  });
});
