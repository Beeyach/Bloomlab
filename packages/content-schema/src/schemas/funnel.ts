import { z } from 'zod';

import { requireUnique, title } from './common.ts';

/**
 * A funnel as data (FUN-001, spec §56): steps in order, and inside each step the blocks a visitor
 * meets in order. Conversion architecture, not a page — there is no styling, no layout and no
 * pixel position here, and the Funnel Lab adds none.
 *
 * `purpose` and `role` are Bloomlab's own vocabulary for the job a step or a block does. They are
 * architecture abstractions, not GoHighLevel controls, and everything that shows them says so.
 * The four roles that carry a `reference_id` name a real account entity — a form, a survey, a
 * calendar, a product — and those are native features with registry records.
 */

export const FUNNEL_STEP_PURPOSES = [
  'capture',
  'offer',
  'booking',
  'checkout',
  'confirmation',
  'content',
] as const;
export type FunnelStepPurpose = (typeof FUNNEL_STEP_PURPOSES)[number];

export const FUNNEL_BLOCK_ROLES = [
  'headline',
  'problem',
  'outcome',
  'proof',
  'benefits',
  'objections',
  'cta',
  'form',
  'survey',
  'calendar',
  'checkout',
] as const;
export type FunnelBlockRole = (typeof FUNNEL_BLOCK_ROLES)[number];

/** The roles that use an account entity, and which collection each names. */
export const FUNNEL_BLOCK_REFERENCES = {
  form: 'forms',
  survey: 'surveys',
  calendar: 'calendars',
  checkout: 'products',
} as const;

const id = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/, 'Ids are letters, digits, - and _');

export const FunnelBlockSchema = z
  .strictObject({
    id,
    role: z.enum(FUNNEL_BLOCK_ROLES),
    headline: z.string().trim().min(1).optional(),
    body: z.string().trim().min(1).optional(),
    /** The account entity this block uses; only the four referencing roles may name one. */
    reference_id: z.string().min(1).optional(),
    /** A call to action may send the visitor somewhere other than the step's own destination. */
    target_step_id: z.string().min(1).optional(),
  })
  .superRefine((block, ctx) => {
    if (block.reference_id && !(block.role in FUNNEL_BLOCK_REFERENCES)) {
      ctx.addIssue({
        code: 'custom',
        path: ['reference_id'],
        message: `A ${block.role} block uses no account entity`,
      });
    }
    if (block.target_step_id && block.role !== 'cta') {
      ctx.addIssue({
        code: 'custom',
        path: ['target_step_id'],
        message: 'Only a call to action names a destination',
      });
    }
  });

export const FunnelStepSchema = z.strictObject({
  id,
  name: z.string().trim().min(1),
  purpose: z.enum(FUNNEL_STEP_PURPOSES),
  blocks: z.array(FunnelBlockSchema).default([]),
  next_step_id: z.string().min(1).optional(),
});

export const FunnelDefinitionSchema = z
  .strictObject({
    id,
    name: title,
    steps: z.array(FunnelStepSchema).default([]),
  })
  .superRefine((funnel, ctx) => {
    requireUnique(
      ctx,
      funnel.steps.map((step) => step.id),
      ['steps'],
      'step id',
    );
    const steps = new Set(funnel.steps.map((step) => step.id));
    funnel.steps.forEach((step, index) => {
      requireUnique(
        ctx,
        step.blocks.map((block) => block.id),
        ['steps', index, 'blocks'],
        'block id',
      );
      if (step.next_step_id && !steps.has(step.next_step_id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['steps', index, 'next_step_id'],
          message: `Unknown step ${step.next_step_id}`,
        });
      }
      step.blocks.forEach((block, at) => {
        if (block.target_step_id && !steps.has(block.target_step_id)) {
          ctx.addIssue({
            code: 'custom',
            path: ['steps', index, 'blocks', at, 'target_step_id'],
            message: `Unknown step ${block.target_step_id}`,
          });
        }
      });
    });
  });

export type FunnelDefinition = z.infer<typeof FunnelDefinitionSchema>;
