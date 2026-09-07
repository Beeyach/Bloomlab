import { beforeEach, it, expect, vi } from 'vitest';
import { combineRubric, objectiveReport } from '@bloomlab/exercise-engine';
import { content } from '../content/bundle';
import { db } from '../data/db';
import { startAttempt, saveResponse, loadAttempt, NORMAL_RUN } from '../exercise/attempt';
import { gradeAttempt, finalizeAttempt } from '../exercise/finalize';
import { evaluateSubmission } from './client';
vi.mock('./client', () => ({
  evaluateSubmission: vi.fn(),
  classifyLanguage: vi.fn().mockResolvedValue(null),
}));
const exercise = content.exercises.find(
  (e) => e.id === 'EX-ARCHITECTURE_DECISION-treatment-interest',
)!;
const rubric = content.rubrics.find((r) => r.id === exercise.grading.rubric)!;
const judgment = () => ({
  score: 100,
  rubric_results: rubric.items.map((i) => ({ id: i.id, passed: true, reason: 'Evidence' })),
  critical_issue: null,
  strengths: [],
  improvements: [],
  next_probe: 'Explain.',
  confidence: 1,
});
beforeEach(async () => {
  vi.clearAllMocks();
  await Promise.all(db.tables.map((t) => t.clear()));
});
async function ready() {
  await startAttempt(exercise, NORMAL_RUN, {}, db);
  return (await saveResponse(
    exercise.id,
    NORMAL_RUN,
    {
      choice: 'contact_custom_field',
      text: 'A contact custom field: reminder templates print it as a merge field.',
    },
    db,
  ))!;
}
it('AI-008 reload and retry preserve work and finalize evidence once', async () => {
  const attempt = await ready();
  vi.mocked(evaluateSubmission).mockRejectedValueOnce(new Error('offline'));
  await expect(finalizeAttempt(exercise, attempt, db)).rejects.toThrow('offline');
  const saved = (await loadAttempt(exercise.id, NORMAL_RUN, db))!;
  expect(saved.response).toEqual(attempt.response);
  expect(saved.submitted).toBeDefined();
  expect(await db.exercise_attempts.count()).toBe(0);
  vi.mocked(evaluateSubmission).mockResolvedValue({
    run_id: 'run',
    rubric_id: rubric.id,
    rubric_version: rubric.version,
    result: judgment(),
  });
  const result = await finalizeAttempt(exercise, saved, db);
  expect(result.report.rubric_pending).toBeNull();
  await finalizeAttempt(exercise, saved, db);
  expect(await db.exercise_attempts.count()).toBe(1);
});
it('AI-007 model 100 cannot rescue a deterministic critical failure', async () => {
  const attempt = await ready();
  const report = gradeAttempt(exercise, attempt);
  const failed = {
    ...report,
    outcome: 'failed' as const,
    reason: 'critical_failure' as const,
    failed_critical: ['objective'],
  };
  expect(combineRubric(failed, rubric, judgment())).toEqual(failed);
});
it('AI-007 rubric_pending cannot hide objective threshold failure or missing runtime', async () => {
  const attempt = await ready();
  const report = gradeAttempt(exercise, attempt);
  expect(
    objectiveReport({ ...report, reason: 'rubric_pending', score: report.pass_threshold - 1 })
      .outcome,
  ).toBe('failed');
  const missing = {
    ...report,
    counts: { ...report.counts, unevaluated: 1 },
    outcome: 'partial' as const,
  };
  expect(combineRubric(missing, rubric, judgment()).outcome).toBe('partial');
});
it('weighted rubric items decide score independently of model aggregate', async () => {
  const attempt = await ready();
  const report = gradeAttempt(exercise, attempt);
  const result = judgment();
  result.rubric_results = result.rubric_results.map((r) => ({
    ...r,
    passed: rubric.items.find((i) => i.id === r.id)!.tier === 'critical',
  }));
  expect(combineRubric(report, rubric, result).outcome).toBe('failed');
});
