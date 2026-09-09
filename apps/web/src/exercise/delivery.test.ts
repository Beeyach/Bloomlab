import { describe, expect, it } from 'vitest';
import type { Exercise } from '@bloomlab/content-schema';
import { gradeExercise } from '@bloomlab/exercise-engine';
import { content } from '../content/bundle';
import { emptyResponse, learnerState, type LearnerResponse } from './response';
import { emptySalesResponse } from './sales/types';
import { projectConversation } from './sales/conversation';
import { sequenceState } from './sequence';

const byId = (id: string) => content.exercises.find((row) => row.id === id)!;
const grade = (exercise: Exercise, response: Partial<LearnerResponse>) =>
  gradeExercise({
    exercise,
    context: {
      state: learnerState(exercise, { ...emptyResponse(), ...response }),
      events: [],
      references: {},
      architecture: { workflows: [] },
      provides: ['learner'],
    },
  });
describe('Delivery obligations remain authoritative with AI Off', () => {
  it('SAL-010 allows hold, re-scope or re-price and penalizes an unpaid commitment', () => {
    const exercise = byId('EX-WRITE_IT-glowhaus-scope-change');
    for (const move of ['hold', 'rescope', 'reprice', 'free']) {
      const turns = [
        {
          node: 'request',
          move,
          text: 'Here is my commercial decision and the effect on the delivery date.',
        },
      ];
      const result = grade(exercise, { sales: { ...emptySalesResponse(), turns } });
      expect(result.outcome).toBe(move === 'free' ? 'failed' : 'partial');
      expect(result.failed_critical).toEqual(move === 'free' ? ['unpaid'] : []);
      // Replaying the durable response has the same consequence; an out-of-order saved turn cannot fabricate it.
      expect(projectConversation(exercise.conversation, JSON.parse(JSON.stringify(turns)))).toEqual(
        projectConversation(exercise.conversation, turns),
      );
    }
    expect(
      projectConversation(exercise.conversation, [
        { node: 'unpaid', move: 'hold', text: 'Forged later turn' },
      ]).flags['scope_protected'],
    ).toBe(false);
  });
  for (const [id, count] of [
    ['EX-WRITE_IT-glowhaus-onboarding', 9],
    ['EX-WRITE_IT-glowhaus-handoff', 4],
  ] as const) {
    it(`${id} rejects every individually missing obligation`, () => {
      const exercise = byId(id);
      expect(exercise.written_fields).toHaveLength(count);
      const written = Object.fromEntries(
        exercise.written_fields.map(({ key }) => [
          key,
          'Name an owner, action, acceptance check and unresolved dependency.',
        ]),
      );
      expect(grade(exercise, { written }).failed_critical).toEqual([]);
      expect(grade(exercise, { written }).outcome).toBe('partial'); // Structural completeness never invents a prose-quality pass.
      for (const { key } of exercise.written_fields) {
        const result = grade(exercise, { written: { ...written, [key]: '  ' } });
        expect(result.outcome, key).toBe('failed');
        expect(result.failed_critical, key).toHaveLength(1);
      }
    });
  }
  it('SAL-012 rejects each reversed dependency, duplicates, omissions and invented steps', () => {
    const exercise = byId('EX-ARCHITECTURE_DECISION-delivery-sequence');
    const correct = [
      'data',
      'pipeline',
      'calendar',
      'forms',
      'workflows',
      'funnel',
      'tracking',
      'qa',
    ];
    expect(sequenceState(exercise.sequence_steps).valid).toBe(false);
    expect(sequenceState(exercise.sequence_steps, correct).valid).toBe(true);
    const written = {
      dependencies: 'Explain the stable upstream inputs.',
      blocked_input: 'Research can proceed; release waits for calendar ownership.',
    };
    expect(grade(exercise, { sequence: correct, written }).failed_critical).toEqual([]);
    for (let i = 0; i < correct.length - 1; i++) {
      const order = [...correct];
      [order[i], order[i + 1]] = [order[i + 1]!, order[i]!];
      expect(grade(exercise, { sequence: order, written }).outcome).toBe('failed');
    }
    for (const order of [
      correct.slice(1),
      [...correct, 'invented'],
      correct.map((key) => (key === 'qa' ? 'tracking' : key)),
    ])
      expect(sequenceState(exercise.sequence_steps, order).valid).toBe(false);
  });
  it('supports genuine partial orders instead of one memorized sequence', () => {
    const steps = [
      { key: 'data', label: 'Data', brief: 'Settle the data model.', depends_on: [] },
      { key: 'copy', label: 'Copy', brief: 'Approve the copy.', depends_on: [] },
      {
        key: 'build',
        label: 'Build',
        brief: 'Build the approved design.',
        depends_on: ['data', 'copy'],
      },
    ];
    expect(sequenceState(steps, ['data', 'copy', 'build']).valid).toBe(true);
    expect(sequenceState(steps, ['copy', 'data', 'build']).valid).toBe(true);
    expect(sequenceState(steps, ['copy', 'build', 'data']).valid).toBe(false);
  });
});
