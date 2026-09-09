import { isFieldworkPass, isIndependentPass, validateEvidence } from './evidence.ts';
import { MASTERY_RULES_VERSION } from './rules.ts';
import type { SkillEvidence } from './types.ts';

/** MAS-010: each domain needs its own evidence; there is no compensating average. */
export const FIELD_READY_AREAS = [
  'funnel_strategy',
  'ghl_implementation',
  'automation',
  'crm_architecture',
  'troubleshooting',
  'sales',
  'pricing',
  'negotiation',
  'fieldwork',
  'client_explanation',
] as const;
export type FieldReadyArea = (typeof FIELD_READY_AREAS)[number];

export interface FieldReadyMapping {
  id: string;
  evidence_areas?: readonly FieldReadyArea[];
}

/**
 * Consumes the canonical evidence ledger for one learner. Placement clears beginner work,
 * but cannot stand in for later independent application. The caller still checks the campaign
 * and capstone: this result answers only whether every required evidence domain is represented.
 */
export function evaluateFieldReady(
  learnerId: string,
  skills: readonly FieldReadyMapping[],
  evidence: readonly SkillEvidence[],
) {
  const mapping = new Map(skills.map((skill) => [skill.id, skill.evidence_areas ?? []]));
  const eligible = evidence.filter(
    (item) =>
      item.learner_id === learnerId &&
      validateEvidence(item).length === 0 &&
      item.source.type !== 'placement' &&
      isIndependentPass(item),
  );
  const areas = FIELD_READY_AREAS.map((area) => {
    const basis = eligible.filter(
      (item) =>
        mapping.get(item.skill_id)?.includes(area) &&
        (area !== 'fieldwork' ||
          (isFieldworkPass(item) && (item.real_ghl?.evidence.length ?? 0) > 0)),
    );
    return {
      area,
      satisfied: basis.length > 0,
      evidence_ids: [...new Set(basis.map((item) => item.id))].sort(),
      skill_ids: [...new Set(basis.map((item) => item.skill_id))].sort(),
    };
  });
  const missing_areas = areas.filter((area) => !area.satisfied).map((area) => area.area);
  return {
    complete: missing_areas.length === 0,
    missing_areas,
    areas,
    rules_version: MASTERY_RULES_VERSION,
  };
}
