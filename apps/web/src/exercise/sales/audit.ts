import type { EvidenceItem, Exercise } from '@bloomlab/content-schema';

import type { AuditFindingResponse, SalesResponse } from './types';
import { answered } from './words';

/**
 * What AUDIT IT counted (EXR-013, SAL-001).
 *
 * The rule the whole family exists to teach: **Verified** has to point at something observed
 * first-hand. Confidence in the wording changes nothing here, because nothing here reads the
 * wording — a claim is supported by the evidence behind it or it is an unsupported claim, and
 * unsupported claims cost points rather than earning them.
 */
export interface AuditProjection {
  /** Findings with a claim actually written. */
  findings_count: number;
  classified: number;
  verified: number;
  likely: number;
  unknown: number;
  supported: number;
  unsupported_claims: number;
  with_verification_plan: number;
}

export type FindingProblem =
  | 'no_claim'
  | 'no_classification'
  | 'verified_without_direct_evidence'
  | 'likely_without_evidence'
  | 'unknown_without_plan';

export interface FindingVerdict {
  id: string;
  written: boolean;
  supported: boolean;
  problem: FindingProblem | null;
}

const evidenceById = (exercise: Exercise): Map<string, EvidenceItem> =>
  new Map(exercise.sales.evidence.map((item) => [item.id, item]));

/**
 * Why one finding does or does not stand up. Only evidence the exercise actually shows counts:
 * an id that is not in the pack supports nothing.
 */
export function findingVerdict(exercise: Exercise, finding: AuditFindingResponse): FindingVerdict {
  const pack = evidenceById(exercise);
  const cited = finding.evidence.map((id) => pack.get(id)).filter((item) => item !== undefined);
  const written = answered(finding.claim);
  const problem = ((): FindingProblem | null => {
    if (!written) return 'no_claim';
    if (finding.classification === null) return 'no_classification';
    if (finding.classification === 'verified') {
      return cited.some((item) => item.direct) ? null : 'verified_without_direct_evidence';
    }
    if (finding.classification === 'likely') {
      return cited.length > 0 ? null : 'likely_without_evidence';
    }
    return answered(finding.verification) ? null : 'unknown_without_plan';
  })();
  return { id: finding.id, written, supported: written && problem === null, problem };
}

export const auditVerdicts = (exercise: Exercise, sales: SalesResponse): FindingVerdict[] =>
  sales.findings.map((finding) => findingVerdict(exercise, finding));

export function projectAudit(exercise: Exercise, sales: SalesResponse): AuditProjection {
  const verdicts = auditVerdicts(exercise, sales);
  const written = sales.findings.filter((_, index) => verdicts[index]?.written);
  const ofClass = (value: AuditFindingResponse['classification']) =>
    written.filter((finding) => finding.classification === value).length;
  const supported = verdicts.filter((verdict) => verdict.supported).length;
  return {
    findings_count: written.length,
    classified: written.filter((finding) => finding.classification !== null).length,
    verified: ofClass('verified'),
    likely: ofClass('likely'),
    unknown: ofClass('unknown'),
    supported,
    unsupported_claims: written.length - supported,
    with_verification_plan: written.filter(
      (finding) => finding.classification === 'unknown' && answered(finding.verification),
    ).length,
  };
}
