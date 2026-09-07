/** Explicit successful gateway fixture for tests of history/sync/UI, never a runtime fallback. */
import { vi } from 'vitest';
import { content } from '../content/bundle';
import type { AiEvaluationRequest } from '@bloomlab/shared';
export const fakeEvaluation = vi.fn(async (input: AiEvaluationRequest) => {
  const rubric = content.rubrics.find((r) => r.id === input.rubric_id)!;
  return {
    run_id: 'test-run',
    rubric_id: rubric.id,
    rubric_version: rubric.version,
    result: {
      score: 100,
      rubric_results: rubric.items.map((i) => ({
        id: i.id,
        passed: true,
        reason: 'Test judgment',
      })),
      critical_issue: null,
      strengths: [],
      improvements: [],
      next_probe: 'Explain.',
      confidence: 1,
    },
  };
});
