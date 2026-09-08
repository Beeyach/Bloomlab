import type { AiGrading } from '@bloomlab/shared';
import type { Rubric } from '@bloomlab/content-schema';
import { z } from 'zod';
import { GradingValidationError } from '../ai/diagnostics';
import { gradingSchema, validateGrading } from '../ai/output';

export const CALL_GRADING_CONTRACT = 'call-speakers-v2';

export const CALL_GRADING_INSTRUCTION = [
  'Call speaker contract: Only learner_confirmed text is evidence of what the learner said or did.',
  'client_context and closing_client_context are context only and must never be credited to the learner.',
  'For every rubric explanation, evaluate the learner_confirmed behavior against the corresponding numbered turn and client_context.',
  'Keep each rubric explanation to one or two concise sentences grounded in those turns.',
  'Write rubric reasons, strengths and critical_issue as precise paraphrases with numbered turn references. Avoid quotation marks, quoted labels and quoted suggested wording in these fields; suggestions belong in improvements or next_probe.',
  'Attribute any quotation to its actual speaker; never treat a client-only question, diagnosis, commitment or next step as learner evidence.',
  'In rubric reasons, strengths and critical_issue, quotation marks may surround only exact, contiguous learner_confirmed text. Paraphrase client context and identify it as client context; do not quote client-only words in these fields.',
  'Before crediting a named system or term to the learner, verify that the learner actually used it. Client terminology alone is not evidence of learner terminology.',
  'If learner evidence is absent, say so instead of inferring it from the client. Suggested future wording belongs in improvements or next_probe, not claims about completed learner behavior.',
  'Accent, pronunciation and transcript corrections are not graded.',
  'Deterministic critical and required failures remain authoritative regardless of the rubric score.',
].join(' ');

/** A generic array can be structurally valid while omitting seven dimensions. Named required
 * properties constrain the provider to the authored dimensions; the public saved format stays
 * an ordered array and still passes every existing grading and speaker validator. */
export function callGradingContract(rubric: Rubric) {
  const item = gradingSchema.shape.rubric_results.element.omit({ id: true });
  const schema = gradingSchema.extend({
    rubric_results: z.strictObject(
      Object.fromEntries(rubric.items.map((entry) => [entry.id, item.describe(entry.criterion)])),
    ),
    critical_issue: gradingSchema.shape.critical_issue.describe(
      'Exactly null when all critical-tier rubric items pass. Otherwise explain the failed critical item. A required-tier failure alone does not make this non-null.',
    ),
  });
  return {
    format: z.toJSONSchema(schema),
    parse(value: unknown) {
      const result = schema.parse(value);
      return validateGrading(
        {
          ...result,
          rubric_results: rubric.items.map(({ id }) => ({ id, ...result.rubric_results[id]! })),
        },
        rubric,
      );
    },
  };
}

/** A quote credited in feedback must exist in learner evidence, never just client context.
 * This validates citations, not every semantic claim; live attribution review still matters.
 */
export function validateLearnerQuotations(result: AiGrading, confirmed: readonly string[]): void {
  for (const text of [
    ...result.rubric_results.map((item) => item.reason),
    ...result.strengths,
    result.critical_issue ?? '',
  ]) {
    // Word-internal apostrophes are contractions, including inside a single-quoted span.
    const quoted =
      /"([^"]+)"|“([^”]+)”|‘([^’]+)’|(?<![\p{L}\p{N}])'((?:[^']|'(?=[\p{L}\p{N}]))+)'(?![\p{L}\p{N}])/gu;
    for (const match of text.matchAll(quoted)) {
      const quote = match.slice(1).find((part) => part !== undefined)!;
      if (!confirmed.some((learner) => learner.includes(quote)))
        throw new GradingValidationError(
          'learner_quotation_mismatch',
          'Feedback quotation is not confirmed learner evidence',
        );
    }
  }
}
