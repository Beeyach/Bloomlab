import type { Exercise } from '@bloomlab/content-schema';

import { projectAudit, type AuditProjection } from './audit';
import { projectConversation, type ConversationProjection } from './conversation';
import { projectExplanation, type ExplanationProjection, type JargonTerm } from './explanation';
import { projectMessages, type MessageProjection } from './message';
import { projectProspects, type ProspectProjection } from './prospects';
import type { SalesResponse } from './types';
import { jargonVocabulary } from './vocabulary';

export * from './types';
export { projectAudit, auditVerdicts, findingVerdict } from './audit';
export type { AuditProjection, FindingProblem, FindingVerdict } from './audit';
export { projectConversation, resolveThread } from './conversation';
export type { ConversationProjection, ResolvedThread, ThreadMessage } from './conversation';
export { jargonTerms, projectExplanation } from './explanation';
export type { ExplanationProjection, JargonTerm } from './explanation';
export { messageFields, projectMessages } from './message';
export type { MessageFieldProjection, MessageProjection } from './message';
export { projectProspects, prospectVerdict, prospectVerdicts } from './prospects';
export type { ProspectProjection, ProspectVerdict } from './prospects';
export { jargonVocabulary } from './vocabulary';
export { answered, sharePercent, wordCount } from './words';

/** The five sales roots of the grading state tree, computed once from one response. */
export interface SalesState {
  prospects: ProspectProjection;
  audit: AuditProjection;
  message: MessageProjection;
  explanation: ExplanationProjection;
  conversation: ConversationProjection;
}

export interface SalesStateInput {
  exercise: Exercise;
  /** The named long-form answers, as the runner already keeps them. */
  written: Record<string, string>;
  sales: SalesResponse;
  /** The exercise's own response markers, matched against a piece of writing. */
  markersIn: (text: string) => string[];
  /** Defaults to the glossary; passed explicitly by tests. */
  vocabulary?: readonly JargonTerm[];
}

/**
 * Every sales projection, from one response, in one place.
 *
 * The work area shows a learner these numbers and the grader reads these numbers, because they
 * are the same call. Nothing recomputes a word count or a talk share anywhere else (§72 of the
 * phase brief).
 */
export function salesState(input: SalesStateInput): SalesState {
  const { exercise, written, sales, markersIn } = input;
  return {
    prospects: projectProspects(exercise, sales),
    audit: projectAudit(exercise, sales),
    message: projectMessages(exercise, written, sales),
    explanation: projectExplanation(
      exercise,
      written,
      markersIn,
      input.vocabulary ?? jargonVocabulary(),
    ),
    conversation: projectConversation(exercise.conversation, sales.turns),
  };
}
