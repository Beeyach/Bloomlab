import {
  demonstrationKey,
  isAttempt,
  isFailure,
  isFieldworkPass,
  isIndependentPass,
  isPass,
  isPracticedPass,
  isPressurePass,
  isSalesUsePass,
} from './evidence.ts';
import {
  failureRate,
  importanceOf,
  refreshOverlay,
  reviewDueFor,
  reviewPriorityFor,
} from './review.ts';
import {
  CONFIDENCE_RULES,
  EXPOSURE_ONLY_KINDS,
  LADDER_RULES,
  MASTERY_RULES_VERSION,
  ladderRank,
  type LadderState,
} from './rules.ts';
import type {
  EvidenceCounts,
  MissingRequirement,
  SkillDefinition,
  SkillEvaluation,
  SkillEvidence,
} from './types.ts';

const byTime = (a: SkillEvidence, b: SkillEvidence) =>
  a.occurred_at.localeCompare(b.occurred_at) || a.id.localeCompare(b.id);

export function countEvidence(history: readonly SkillEvidence[]): EvidenceCounts {
  const independent = history.filter(isIndependentPass);
  return {
    evidence: history.length,
    exposures: history.filter((e) => EXPOSURE_ONLY_KINDS.includes(e.kind)).length,
    attempts: history.filter(isAttempt).length,
    passes: history.filter(isPass).length,
    guided_passes: history.filter(isPass).length,
    practiced_passes: history.filter(isPracticedPass).length,
    independent_passes: independent.length,
    independent_demonstrations: new Set(independent.map(demonstrationKey)).size,
    pressure_passes: history.filter(isPressurePass).length,
    fieldwork_passes: history.filter(isFieldworkPass).length,
    sales_use_passes: history.filter(isSalesUsePass).length,
    failures: history.filter(isFailure).length,
  };
}

/** The earned rung (LADDER_RULES). Pure function of the skill's requirements and its evidence. */
export function ladderStateFor(skill: SkillDefinition, counts: EvidenceCounts): LadderState {
  const req = skill.mastery_requirements;
  const needed = Math.max(LADDER_RULES.mastered_min_independent, req.independent_evidence);
  const mastered =
    counts.independent_passes >= needed &&
    counts.independent_demonstrations >= LADDER_RULES.mastered_min_demonstrations &&
    (!req.pressure_test || counts.pressure_passes >= 1) &&
    (!req.fieldwork_required || counts.fieldwork_passes >= 1) &&
    (!req.sales_use || counts.sales_use_passes >= 1);
  if (mastered) return 'MASTERED';
  if (counts.pressure_passes >= 1) return 'PRESSURE_TESTED';
  if (counts.independent_passes >= 1) return 'INDEPENDENT';
  if (counts.practiced_passes >= 1) return 'PRACTICED';
  if (counts.guided_passes >= 1) return 'GUIDED';
  if (counts.evidence >= 1) return 'LEARNING';
  return 'UNSEEN';
}

export function missingRequirementsFor(
  skill: SkillDefinition,
  ladder: LadderState,
  counts: EvidenceCounts,
): MissingRequirement[] {
  const req = skill.mastery_requirements;
  const missing: MissingRequirement[] = [];
  if (ladder === 'MASTERED') return missing;
  if (counts.attempts === 0) missing.push('practice');
  const needed = Math.max(LADDER_RULES.mastered_min_independent, req.independent_evidence);
  if (
    counts.independent_passes < needed ||
    counts.independent_demonstrations < LADDER_RULES.mastered_min_demonstrations
  ) {
    missing.push('independent_evidence');
  }
  if (req.pressure_test && counts.pressure_passes === 0) missing.push('pressure_test');
  if (req.fieldwork_required && counts.fieldwork_passes === 0) missing.push('real_ghl_fieldwork');
  if (req.sales_use && counts.sales_use_passes === 0) missing.push('sales_use');
  return missing;
}

function confidenceFor(
  ladder: LadderState,
  counts: EvidenceCounts,
  recentFailureRate: number,
  overdue: boolean,
  needsRefresh: boolean,
): number {
  const rules = CONFIDENCE_RULES;
  let value = rules.base[ladder];
  value += Math.min(
    rules.extra_independent_cap,
    Math.max(0, counts.independent_passes - 1) * rules.extra_independent_bonus,
  );
  value -= rules.recent_failure_penalty * recentFailureRate;
  if (overdue) value -= rules.overdue_penalty;
  if (needsRefresh) value = Math.min(value, rules.needs_refresh_cap);
  return Math.round(Math.max(0, Math.min(1, value)) * 100) / 100;
}

/**
 * Evaluates one skill from its evidence history (TA§68): state, confidence, missing
 * requirements and review priority, plus the numbers behind them. Deterministic; `now` only
 * affects the review overlay (due, overdue, NEEDS_REFRESH), never the earned ladder state.
 */
export function evaluateSkill(
  skill: SkillDefinition,
  evidence: readonly SkillEvidence[],
  now: Date,
): SkillEvaluation {
  const history = evidence.filter((e) => e.skill_id === skill.id).sort(byTime);
  const counts = countEvidence(history);
  const ladder = ladderStateFor(skill, counts);
  const attempts = history.filter(isAttempt);
  const lastPass = [...history].reverse().find(isPass) ?? null;
  const lastAttempt = attempts.at(-1) ?? null;
  const importance = importanceOf(skill);
  const rate = failureRate(attempts);
  const due = reviewDueFor(ladder, lastPass?.occurred_at ?? null, importance, rate);
  const overlay = refreshOverlay(ladder, due, lastAttempt, now);
  const overdue = due !== null && now.getTime() > Date.parse(due);
  const state = overlay.needs_refresh ? 'NEEDS_REFRESH' : ladder;
  const missing = missingRequirementsFor(skill, ladder, counts);
  if (overlay.needs_refresh) missing.push('refresh');

  return {
    skill_id: skill.id,
    state,
    ladder_state: ladder,
    refresh_from: overlay.needs_refresh ? ladder : null,
    confidence: confidenceFor(ladder, counts, rate, overdue, overlay.needs_refresh),
    missing_requirements: missing,
    review_priority: reviewPriorityFor({
      due,
      now,
      importance,
      failure_rate: rate,
      needs_refresh: overlay.needs_refresh,
    }),
    review_due: due,
    refresh_reason: overlay.reason,
    last_demonstrated: lastPass?.occurred_at ?? null,
    last_attempt_at: lastAttempt?.occurred_at ?? null,
    last_result: lastAttempt?.result ?? null,
    failure_rate: rate,
    importance,
    counts,
    rules_version: MASTERY_RULES_VERSION,
  };
}

/** Evaluates every skill; skills with no evidence come back UNSEEN. */
export function evaluateSkills(
  skills: readonly SkillDefinition[],
  evidence: readonly SkillEvidence[],
  now: Date,
): Map<string, SkillEvaluation> {
  const bySkill = new Map<string, SkillEvidence[]>();
  for (const item of evidence)
    bySkill.set(item.skill_id, [...(bySkill.get(item.skill_id) ?? []), item]);
  return new Map(
    skills.map((skill) => [skill.id, evaluateSkill(skill, bySkill.get(skill.id) ?? [], now)]),
  );
}

/** True when `state` is at least `floor` on the ladder (NEEDS_REFRESH reads as its refresh_from). */
export function atLeast(evaluation: SkillEvaluation, floor: LadderState): boolean {
  return ladderRank(evaluation.ladder_state) >= ladderRank(floor);
}
