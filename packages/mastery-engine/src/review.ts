import { isFailure } from './evidence.ts';
import { REVIEW_RULES, ladderRank, type LadderState } from './rules.ts';
import type {
  ReviewItem,
  ReviewSchedule,
  SkillDefinition,
  SkillEvaluation,
  SkillEvidence,
} from './types.ts';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Importance from the skill's own requirements (REVIEW_RULES.importance). */
export function importanceOf(skill: SkillDefinition): number {
  const req = skill.mastery_requirements;
  const w = REVIEW_RULES.importance;
  return (
    1 +
    (req.pressure_test ? w.pressure_test : 0) +
    (req.fieldwork_required ? w.fieldwork_required : 0) +
    (req.sales_use ? w.sales_use : 0)
  );
}

/** Failures over the last `failure_window` attempts (0 with no attempts). */
export function failureRate(attempts: readonly SkillEvidence[]): number {
  const recent = attempts.slice(-REVIEW_RULES.failure_window);
  if (recent.length === 0) return 0;
  return Math.round((recent.filter(isFailure).length / recent.length) * 100) / 100;
}

/** Days until the next review for an earned state, or null when the state is not reviewed. */
export function reviewIntervalDays(
  ladder: LadderState,
  importance: number,
  failure: number,
): number | null {
  const base = REVIEW_RULES.interval_days[ladder];
  if (base === undefined) return null;
  const shortened = (base / importance) * (1 - REVIEW_RULES.failure_shortening * failure);
  return Math.max(REVIEW_RULES.min_interval_days, Math.round(shortened * 10) / 10);
}

export function reviewDueFor(
  ladder: LadderState,
  lastDemonstrated: string | null,
  importance: number,
  failure: number,
): string | null {
  const interval = reviewIntervalDays(ladder, importance, failure);
  if (interval === null || !lastDemonstrated) return null;
  return new Date(Date.parse(lastDemonstrated) + interval * DAY_MS).toISOString();
}

/**
 * NEEDS_REFRESH overlay: overdue beyond the grace window, or the latest attempt is a failed
 * retrieval (spec §32: a failed retrieval re-queues the skill). Only earned states that are
 * reviewed (PRACTICED and above) can need refresh.
 */
export function refreshOverlay(
  ladder: LadderState,
  due: string | null,
  lastAttempt: SkillEvidence | null,
  now: Date,
): { needs_refresh: boolean; reason: 'overdue' | 'failed_retrieval' | null } {
  if (ladderRank(ladder) < ladderRank('PRACTICED')) return { needs_refresh: false, reason: null };
  if (lastAttempt && lastAttempt.kind === 'retrieval' && isFailure(lastAttempt)) {
    return { needs_refresh: true, reason: 'failed_retrieval' };
  }
  if (due && now.getTime() > Date.parse(due) + REVIEW_RULES.refresh_grace_days * DAY_MS) {
    return { needs_refresh: true, reason: 'overdue' };
  }
  return { needs_refresh: false, reason: null };
}

export function reviewPriorityFor(input: {
  due: string | null;
  now: Date;
  importance: number;
  failure_rate: number;
  needs_refresh: boolean;
}): number {
  if (!input.due && !input.needs_refresh) return 0;
  const overdueDays = input.due
    ? Math.max(0, (input.now.getTime() - Date.parse(input.due)) / DAY_MS)
    : 0;
  const priority =
    input.importance * (1 + overdueDays / REVIEW_RULES.overdue_days_per_point) +
    input.failure_rate * REVIEW_RULES.failure_weight +
    (input.needs_refresh ? REVIEW_RULES.needs_refresh_bonus : 0);
  return Math.round(priority * 100) / 100;
}

/**
 * The review queue (TA§69): what is due now, highest priority first, and what is coming.
 * Skills below PRACTICED are progression, not review, and never appear here.
 */
export function scheduleReviews(evaluations: Iterable<SkillEvaluation>, now: Date): ReviewSchedule {
  const due: ReviewItem[] = [];
  const upcoming: ReviewItem[] = [];
  for (const evaluation of evaluations) {
    if (!evaluation.review_due && evaluation.state !== 'NEEDS_REFRESH') continue;
    const dueAt = evaluation.review_due ?? now.toISOString();
    const item: ReviewItem = {
      skill_id: evaluation.skill_id,
      due_at: dueAt,
      priority: evaluation.review_priority,
      reason:
        evaluation.state === 'NEEDS_REFRESH'
          ? 'needs_refresh'
          : now.getTime() > Date.parse(dueAt)
            ? 'overdue'
            : 'due',
      last_demonstrated: evaluation.last_demonstrated,
      state: evaluation.state,
    };
    if (evaluation.state === 'NEEDS_REFRESH' || now.getTime() >= Date.parse(dueAt)) due.push(item);
    else upcoming.push(item);
  }
  due.sort((a, b) => b.priority - a.priority || a.skill_id.localeCompare(b.skill_id));
  upcoming.sort((a, b) => a.due_at.localeCompare(b.due_at) || a.skill_id.localeCompare(b.skill_id));
  return { due, upcoming };
}
