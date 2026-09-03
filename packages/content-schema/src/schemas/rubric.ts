import { z } from 'zod';

import { EXERCISE_TYPES } from '../ids.ts';
import { ref, requireUnique, title } from './common.ts';

/**
 * Versioned grading rubric (TA§33, TA§42; AI-011, EXR-003). Changing a rubric creates a new
 * version; attempts keep the version they were graded against.
 */

export const RUBRIC_TIERS = ['critical', 'required', 'quality', 'bonus'] as const;
export type RubricTier = (typeof RUBRIC_TIERS)[number];

/** Which class of model may apply the rubric (TA§36); `none` means code decides. */
export const MODEL_CLASSES = ['none', 'cheap', 'strong'] as const;

const item = z.strictObject({
  id: z
    .string()
    .regex(/^r[0-9]+$|^[a-z][a-z0-9_]*$/, 'Rubric item IDs are short lower-case tokens'),
  tier: z.enum(RUBRIC_TIERS),
  criterion: z.string().trim().min(10),
  guidance: z.string().optional(),
  weight: z.number().int().min(1).max(10).default(1),
});

export const RubricSchema = z
  .strictObject({
    id: ref('rubrics'),
    version: z.number().int().min(1),
    title,
    applies_to: z.array(z.enum(EXERCISE_TYPES)).min(1),
    model_class: z.enum(MODEL_CLASSES),
    items: z.array(item).min(1),
    /** The structured response shape the AI gateway validates against (TA§40). */
    output_schema: z.literal('ai_grading_v1'),
    /** Reminds graders that verified uncertainty beats fabricated confidence (spec §13). */
    rewards_verified_uncertainty: z.boolean().default(false),
  })
  .superRefine((rubric, ctx) => {
    if (!rubric.id.endsWith(`_V${rubric.version}`)) {
      ctx.addIssue({
        code: 'custom',
        path: ['version'],
        message: `ID must end with _V${rubric.version}`,
      });
    }
    requireUnique(
      ctx,
      rubric.items.map((i) => i.id),
      ['items'],
      'item id',
    );
    if (!rubric.items.some((i) => i.tier === 'critical' || i.tier === 'required')) {
      ctx.addIssue({
        code: 'custom',
        path: ['items'],
        message: 'A rubric needs at least one critical or required item',
      });
    }
    if (rubric.model_class === 'none' && rubric.items.some((i) => i.guidance)) {
      // guidance is for a model; harmless, but it signals a mismatch worth flagging
      ctx.addIssue({
        code: 'custom',
        path: ['model_class'],
        message: 'Deterministic rubrics do not carry model guidance',
      });
    }
  });

export type Rubric = z.infer<typeof RubricSchema>;
