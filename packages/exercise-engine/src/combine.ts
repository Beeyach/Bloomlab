import type { GradeReport } from './types';
/** Pure structural contract: validated judgment enters here, networking never does. */
interface Judgment {
  score: number;
  rubric_results: { id: string; passed: boolean; reason: string }[];
  critical_issue: string | null;
}
interface RubricDefinition {
  id: string;
  items: { id: string; tier: 'critical' | 'required' | 'quality' | 'bonus'; weight: number }[];
}
/** Reapply the objective threshold BEFORE considering a pending rubric (AI-007). */
export function objectiveReport(report: GradeReport): GradeReport {
  if (report.reason !== 'rubric_pending') return report;
  if (report.score !== null && report.score < report.pass_threshold)
    return { ...report, outcome: 'failed', reason: 'below_threshold' };
  return report;
}
/** D-171: each scored half must pass independently; combined score is the lower half.
 * Critical gates cannot be averaged away; bonus contributes nothing to the denominator.
 * Model's aggregate score is advisory only; Bloomlab recomputes from exact weighted items.
 */
export function combineRubric(
  report: GradeReport,
  rubric: RubricDefinition,
  judgment: Judgment,
): GradeReport {
  const objective = objectiveReport(report);
  if (objective.outcome === 'failed' || objective.counts.unevaluated > 0) return objective;
  if (report.rubric_pending !== rubric.id) throw new Error('Rubric version mismatch');
  const ids = judgment.rubric_results.map((r) => r.id);
  if (
    new Set(ids).size !== rubric.items.length ||
    ids.length !== rubric.items.length ||
    rubric.items.some((i) => !ids.includes(i.id))
  )
    throw new Error('Invalid rubric items');
  const passed = (id: string) => judgment.rubric_results.find((r) => r.id === id)!.passed;
  const critical = rubric.items
    .filter((i) => i.tier === 'critical' && !passed(i.id))
    .map((i) => `${rubric.id}:${i.id}`);
  const scored = rubric.items.filter((i) => i.tier === 'required' || i.tier === 'quality');
  const denominator = scored.reduce((n, i) => n + i.weight, 0);
  const rubricScore = denominator
    ? Math.round(
        (scored.reduce((n, i) => n + (passed(i.id) ? i.weight : 0), 0) / denominator) * 100,
      )
    : 100;
  const score = objective.score === null ? rubricScore : Math.min(objective.score, rubricScore);
  const failed = critical.length > 0 || judgment.critical_issue !== null;
  return {
    ...objective,
    score,
    rubric_pending: null,
    failed_critical: [...objective.failed_critical, ...critical],
    outcome: failed || score < report.pass_threshold ? 'failed' : 'passed',
    reason: failed
      ? 'critical_failure'
      : score < report.pass_threshold
        ? 'below_threshold'
        : 'threshold_met',
  };
}
