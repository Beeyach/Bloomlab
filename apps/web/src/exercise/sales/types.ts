import type { ProspectDecision, QualificationAxis } from '@bloomlab/content-schema';

/**
 * What a learner produces in the selling families (Phase 16).
 *
 * Everything here is what they decided and wrote — never a score, never a verdict. The
 * projections in this folder turn it into the figures the work area shows and the grader reads;
 * nothing else derives anything from it.
 */

/** The three classifications AUDIT IT allows, and nothing else (EXR-013, SAL-001). */
export const FINDING_CLASSIFICATIONS = ['verified', 'likely', 'unknown'] as const;
export type FindingClassification = (typeof FINDING_CLASSIFICATIONS)[number];

/** One business judged (EXR-012, SAL-002). */
export interface ProspectDecisionResponse {
  decision: ProspectDecision | null;
  /** Why, in the learner's own words. Kept whole for the rubric that judges it later. */
  reason: string;
  /** Which qualification dimensions drove the decision. */
  axes: QualificationAxis[];
  /** The visible evidence the learner leaned on, by evidence id. */
  evidence: string[];
}

/** One audit finding the learner wrote (EXR-013, SAL-001). */
export interface AuditFindingResponse {
  /** Minted by the composer when the row is added; stable across a reload. */
  id: string;
  claim: string;
  classification: FindingClassification | null;
  /** Evidence ids that support the claim. */
  evidence: string[];
  /** For an Unknown: what would confirm it. */
  verification: string;
}

/** One thing the learner sent in a client thread (CONV-002). */
export interface ConversationTurnResponse {
  /** The node they were answering, so a resumed thread is replayed rather than guessed. */
  node: string;
  /** The move they said they were making; null when they wrote without choosing one. */
  move: string | null;
  text: string;
}

/** The sales half of a learner response. Every part is optional on an older saved draft. */
export interface SalesResponse {
  /** Keyed by client id. */
  prospects: Record<string, ProspectDecisionResponse>;
  findings: AuditFindingResponse[];
  /** The one next step asked for, keyed by written field. */
  next_steps: Record<string, string>;
  /** Evidence cited, keyed by written field. */
  citations: Record<string, string[]>;
  turns: ConversationTurnResponse[];
}

export const emptySalesResponse = (): SalesResponse => ({
  prospects: {},
  findings: [],
  next_steps: {},
  citations: {},
  turns: [],
});

export const emptyProspectDecision = (): ProspectDecisionResponse => ({
  decision: null,
  reason: '',
  axes: [],
  evidence: [],
});

export const emptyFinding = (id: string): AuditFindingResponse => ({
  id,
  claim: '',
  classification: null,
  evidence: [],
  verification: '',
});
