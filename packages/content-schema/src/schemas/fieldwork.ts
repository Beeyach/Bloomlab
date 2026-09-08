import { z } from 'zod';
import { requireUnique, stringList } from './common.ts';

const item = z.strictObject({
  key: z.string().regex(/^[a-z][a-z0-9_]{0,59}$/),
  prompt: z.string().trim().min(5).max(2000),
  required: z.boolean().default(true),
});
/** v1 authoring stays readable; existing enum evidence and reasoning strings remain valid. */
export const FieldworkSchema = z
  .strictObject({
    required: z.boolean(),
    tasks: stringList.min(1),
    evidence: z
      .array(z.enum(['screenshot', 'configuration_answers', 'explanation', 'test_results']))
      .min(1),
    reasoning_questions: z
      .array(z.union([z.string().trim().min(1), item]))
      .max(12)
      .default([]),
    proof: z
      .strictObject({
        screenshots: z.array(item).max(6).default([]),
        configuration: z.array(item).min(1).max(12),
        explanations: z.array(item).min(1).max(6),
        tests: z.array(item).min(1).max(12),
      })
      .optional(),
  })
  .superRefine((value, ctx) => {
    for (const [group, items] of Object.entries(value.proof ?? {}))
      requireUnique(
        ctx,
        items.map((i) => i.key),
        ['proof', group],
        'proof key',
      );
    requireUnique(
      ctx,
      value.reasoning_questions.map((q, i) =>
        typeof q === 'string' ? `reasoning_${i + 1}` : q.key,
      ),
      ['reasoning_questions'],
      'reasoning key',
    );
    if (value.proof && !value.reasoning_questions.some((q) => typeof q === 'string' || q.required))
      ctx.addIssue({
        code: 'custom',
        path: ['reasoning_questions'],
        message: 'Fieldwork needs required post-proof reasoning',
      });
  });
export type Fieldwork = z.infer<typeof FieldworkSchema>;
export const reasoningItems = (fieldwork: Fieldwork) =>
  fieldwork.reasoning_questions.map((q, i) =>
    typeof q === 'string' ? { key: `reasoning_${i + 1}`, prompt: q, required: true } : q,
  );
