import { describe, expect, it } from 'vitest';
import { gradeExercise } from '@bloomlab/exercise-engine';
import { reasonSentence } from './runnerCopy';

describe('honest current evaluation copy (EXR-024)', () => {
  it('keeps rubric-pending work partial without promising an already shipped phase', () => {
    const report = gradeExercise({
      exercise: {
        id: 'pending',
        type: 'WRITE_IT',
        mode: 'practice',
        critical_failures: [],
        expected_outcomes: [
          {
            id: 'answer',
            description: 'Answer supplied',
            type: 'state',
            path: 'answer.supplied',
            operator: 'equals',
            value: true,
          },
        ],
        grading: { mode: 'mixed', rubric: 'WRITTEN_COMMUNICATION_RUBRIC_V2', pass_threshold: 80 },
      },
      context: {
        state: { answer: { supplied: true } },
        events: [],
        references: {},
        architecture: null,
        provides: ['learner'],
      },
    });
    expect(report.reason).toBe('rubric_pending');
    expect(report.outcome).toBe('partial');
    const sentence = reasonSentence(report);
    expect(sentence).toContain(report.rubric_pending);
    expect(sentence).toContain('still pending');
    expect(sentence).toContain('does not pass');
    expect(sentence).not.toMatch(/arrives|coming soon|Phase 19/i);
  });
});
