import { z } from 'zod';
import type { Rubric } from '@bloomlab/content-schema';
export const gradingSchema = z.strictObject({
  score: z.number().min(0).max(100),
  rubric_results: z
    .array(
      z.strictObject({ id: z.string(), passed: z.boolean(), reason: z.string().min(1).max(1000) }),
    )
    .min(1)
    .max(50),
  critical_issue: z.string().max(1000).nullable(),
  strengths: z.array(z.string().max(1000)).max(8),
  improvements: z.array(z.string().max(1000)).max(8),
  next_probe: z.string().max(1000),
  confidence: z.number().min(0).max(1),
});
export const gradingFormat = z.toJSONSchema(gradingSchema);
export function validateGrading(value: unknown, rubric: Rubric) {
  const result = gradingSchema.parse(value);
  const ids = result.rubric_results.map((r) => r.id);
  if (
    new Set(ids).size !== rubric.items.length ||
    ids.length !== rubric.items.length ||
    rubric.items.some((i) => !ids.includes(i.id))
  )
    throw new Error('Rubric item mismatch');
  const critical = rubric.items.some(
    (i) => i.tier === 'critical' && !result.rubric_results.find((r) => r.id === i.id)!.passed,
  );
  if (critical !== (result.critical_issue !== null)) throw new Error('Critical result mismatch');
  return result;
}
