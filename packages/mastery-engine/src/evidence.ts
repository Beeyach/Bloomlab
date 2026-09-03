import { z } from 'zod';

import {
  ASSISTANCE_LEVELS,
  ASSISTANCE_RULES,
  EVIDENCE_KINDS,
  EVIDENCE_RESULTS,
  HINT_LEVELS,
  INDEPENDENT_KINDS,
  PRACTICE_KINDS,
  assistanceRank,
  type AssistanceLevel,
  type HintLevel,
} from './rules.ts';
import type { SkillEvidence } from './types.ts';

const iso = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), 'Expected an ISO date-time');

/** Every field of spec §30 is required (MAS-003): a record missing any is rejected. */
export const SkillEvidenceSchema = z.strictObject({
  id: z.string().min(1),
  learner_id: z.string().min(1),
  skill_id: z.string().min(1),
  kind: z.enum(EVIDENCE_KINDS),
  source: z.strictObject({
    type: z.enum(['learning_unit', 'exercise', 'retrieval', 'fieldwork', 'placement', 'manual']),
    id: z.string().min(1).nullable(),
  }),
  exercise_id: z.string().min(1).nullable(),
  exercise_type: z.string().min(1).nullable(),
  attempt_id: z.string().min(1).nullable(),
  result: z.enum(EVIDENCE_RESULTS),
  score: z.number().min(0).max(100).nullable(),
  assistance: z.enum(ASSISTANCE_LEVELS),
  hints_used: z.array(z.enum(HINT_LEVELS)),
  difficulty: z.number().int().min(1).max(5),
  critical_failures: z.array(z.string().min(1)),
  occurred_at: iso,
  versions: z.strictObject({
    app: z.string().min(1),
    content: z.string().min(1),
    content_hash: z.string().min(1),
    simulator: z.string().min(1),
    rules: z.string().min(1),
  }),
  real_ghl: z
    .strictObject({
      required: z.boolean(),
      provided: z.boolean(),
      evidence: z.array(z.string().min(1)),
    })
    .nullable(),
  mode: z.enum(['guided', 'practice', 'independent', 'pressure']).nullable(),
});

export type EvidenceIssue = { path: string; message: string };

/** Validates a record; returns the issues instead of throwing so callers can report them. */
export function validateEvidence(value: unknown): EvidenceIssue[] {
  const result = SkillEvidenceSchema.safeParse(value);
  if (result.success) return [];
  return result.error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));
}

/** Rolls hint use up into an assistance level (spec §28, §34; ASSISTANCE_RULES). */
export function assistanceFromHints(hints: readonly HintLevel[]): AssistanceLevel {
  if (hints.includes('worked_example')) return ASSISTANCE_RULES.worked_example;
  if (hints.includes('concept_reminder')) return ASSISTANCE_RULES.concept_reminder;
  const nudges = hints.filter((hint) => hint === 'nudge').length;
  if (nudges >= ASSISTANCE_RULES.nudges_for_guided) return 'guided';
  if (nudges >= ASSISTANCE_RULES.nudges_for_light) return 'light';
  return 'independent';
}

const maxAssistance = (a: AssistanceLevel, b: AssistanceLevel): AssistanceLevel =>
  assistanceRank(a) >= assistanceRank(b) ? a : b;

/**
 * The assistance that counts: the recorded level, raised by what the hints say and by the
 * exercise's own mode — guided practice is guided at least, whatever the hint log says.
 */
export function effectiveAssistance(evidence: SkillEvidence): AssistanceLevel {
  let level = maxAssistance(evidence.assistance, assistanceFromHints(evidence.hints_used));
  if (evidence.kind === 'guided_practice' || evidence.mode === 'guided') {
    level = maxAssistance(level, 'guided');
  }
  return level;
}

export const isAttempt = (evidence: SkillEvidence): boolean =>
  PRACTICE_KINDS.includes(evidence.kind);

/** A pass with a critical failure is not a pass (spec §31, MAS-004). */
export const isPass = (evidence: SkillEvidence): boolean =>
  isAttempt(evidence) && evidence.result === 'passed' && evidence.critical_failures.length === 0;

export const isFailure = (evidence: SkillEvidence): boolean =>
  isAttempt(evidence) && (evidence.result === 'failed' || evidence.critical_failures.length > 0);

/** A pass that can count toward PRACTICED: an independent-capable kind with at most light help. */
export const isPracticedPass = (evidence: SkillEvidence): boolean =>
  isPass(evidence) &&
  INDEPENDENT_KINDS.includes(evidence.kind) &&
  assistanceRank(effectiveAssistance(evidence)) <= assistanceRank('light');

/** An independent demonstration: unassisted pass of an independent-capable kind (MAS-011). */
export const isIndependentPass = (evidence: SkillEvidence): boolean =>
  isPass(evidence) &&
  INDEPENDENT_KINDS.includes(evidence.kind) &&
  effectiveAssistance(evidence) === 'independent';

export const isPressurePass = (evidence: SkillEvidence): boolean =>
  isIndependentPass(evidence) &&
  (evidence.kind === 'pressure_test' || evidence.mode === 'pressure');

/** Real-GHL fieldwork that was actually provided (spec §30 "where required"). */
export const isFieldworkPass = (evidence: SkillEvidence): boolean =>
  isPass(evidence) &&
  (evidence.kind === 'fieldwork' || evidence.kind === 'real_ghl') &&
  evidence.real_ghl?.provided === true;

export const isSalesUsePass = (evidence: SkillEvidence): boolean =>
  isPass(evidence) && evidence.kind === 'sales_use';

/** The calendar day of a demonstration, for "distinct demonstrations". */
export const dayOf = (iso: string): string => iso.slice(0, 10);

/** A demonstration key: the same exercise on the same day is one demonstration. */
export const demonstrationKey = (evidence: SkillEvidence): string =>
  `${evidence.exercise_id ?? evidence.kind}@${dayOf(evidence.occurred_at)}`;
