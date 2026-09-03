import { atLeast } from './mastery.ts';
import { MASTERY_RULES_VERSION } from './rules.ts';
import type {
  CampaignDefinition,
  CampaignEvaluation,
  GateEvaluation,
  GateSkillStatus,
  MissingRequirement,
  SkillDefinition,
  SkillEvaluation,
} from './types.ts';

/**
 * Prerequisite and gate behaviour (spec §7, §11, §143; PRD-002, PRD-003, CUR-002).
 * No function here reads a clock: gates open on evidence and only on evidence. A skill whose
 * prerequisites are all INDEPENDENT (on the ladder — a refresh-due prerequisite still counts)
 * is available immediately, wherever it sits in the campaign, so the learner can work ahead.
 */

const unseen = (skillId: string): SkillEvaluation => ({
  skill_id: skillId,
  state: 'UNSEEN',
  ladder_state: 'UNSEEN',
  refresh_from: null,
  confidence: 0,
  missing_requirements: ['practice', 'independent_evidence'],
  review_priority: 0,
  review_due: null,
  refresh_reason: null,
  last_demonstrated: null,
  last_attempt_at: null,
  last_result: null,
  failure_rate: 0,
  importance: 1,
  counts: {
    evidence: 0,
    exposures: 0,
    attempts: 0,
    passes: 0,
    guided_passes: 0,
    practiced_passes: 0,
    independent_passes: 0,
    independent_demonstrations: 0,
    pressure_passes: 0,
    fieldwork_passes: 0,
    sales_use_passes: 0,
    failures: 0,
  },
  rules_version: MASTERY_RULES_VERSION,
});

export function unsatisfiedPrerequisites(
  skill: SkillDefinition,
  evaluations: ReadonlyMap<string, SkillEvaluation>,
): string[] {
  return skill.prerequisites.filter((id) => {
    const evaluation = evaluations.get(id);
    return !evaluation || !atLeast(evaluation, 'INDEPENDENT');
  });
}

/** Whether a skill meets a gate's pass criteria (competency, never time). */
export function skillPassesGate(
  evaluation: SkillEvaluation,
  criteria: CampaignDefinition['gates'][number]['pass_criteria'],
): { passes: boolean; missing: MissingRequirement[] } {
  const missing: MissingRequirement[] = [];
  if (!atLeast(evaluation, 'INDEPENDENT')) missing.push('independent_evidence');
  if (evaluation.counts.independent_passes < criteria.independent_evidence_per_skill) {
    if (!missing.includes('independent_evidence')) missing.push('independent_evidence');
  }
  if (criteria.pressure_test_required && evaluation.counts.pressure_passes === 0)
    missing.push('pressure_test');
  if (criteria.fieldwork_required && evaluation.counts.fieldwork_passes === 0)
    missing.push('real_ghl_fieldwork');
  return { passes: missing.length === 0, missing };
}

export function evaluateCampaign(
  campaign: CampaignDefinition,
  skills: ReadonlyMap<string, SkillDefinition>,
  evaluations: ReadonlyMap<string, SkillEvaluation>,
): CampaignEvaluation {
  const evaluationOf = (id: string) => evaluations.get(id) ?? unseen(id);
  const gates: GateEvaluation[] = [...campaign.gates]
    .sort((a, b) => a.number - b.number)
    .map((gate) => {
      const statuses: GateSkillStatus[] = gate.skills.map((skillId) => {
        const skill = skills.get(skillId);
        const evaluation = evaluationOf(skillId);
        const unsatisfied = skill ? unsatisfiedPrerequisites(skill, evaluations) : [];
        const { passes, missing } = skillPassesGate(evaluation, gate.pass_criteria);
        return {
          skill_id: skillId,
          state: evaluation.state,
          available: unsatisfied.length === 0,
          passes,
          missing,
          unsatisfied_prerequisites: unsatisfied,
        };
      });
      const passedCount = statuses.filter((s) => s.passes).length;
      const cleared = gate.assesses.filter((id) => atLeast(evaluationOf(id), 'INDEPENDENT'));
      let status: GateEvaluation['status'];
      if (gate.placement) status = 'optional';
      else if (statuses.length > 0 && passedCount === statuses.length) status = 'passed';
      else if (statuses.some((s) => evaluationOf(s.skill_id).counts.evidence > 0))
        status = 'in_progress';
      else if (statuses.some((s) => s.available)) status = 'available';
      else status = 'locked';
      return {
        gate: gate.id,
        number: gate.number,
        name: gate.name,
        status,
        skills: statuses,
        cleared,
        passed_count: passedCount,
        total: statuses.length,
      };
    });

  const progression = gates.filter((g) => g.status !== 'optional');
  const current = progression.find((g) => g.status !== 'passed') ?? null;
  const notPassingAvailable = (gate: GateEvaluation) =>
    gate.skills.filter((s) => s.available && !s.passes).map((s) => s.skill_id);
  const currentIndex = current ? progression.indexOf(current) : progression.length;
  const workAhead = progression.slice(currentIndex + 1).flatMap(notPassingAvailable);
  const unlocked = [...new Set(campaign.gates.flatMap((g) => g.skills))].filter((id) => {
    const skill = skills.get(id);
    return skill ? unsatisfiedPrerequisites(skill, evaluations).length === 0 : false;
  });

  return {
    campaign_id: campaign.id,
    gates,
    current_gate: current?.gate ?? null,
    next_required: current ? notPassingAvailable(current) : [],
    work_ahead: workAhead,
    unlocked_skills: unlocked,
    passed_gates: progression.filter((g) => g.status === 'passed').map((g) => g.gate),
    complete: progression.length > 0 && progression.every((g) => g.status === 'passed'),
    rules_version: MASTERY_RULES_VERSION,
  };
}
