import { z } from 'zod';
import { markdown, requireUnique } from './common.ts';

const key = z.string().regex(/^[a-z][a-z0-9_]*$/);
/** A dependency plan. Order is the initial workbench position, not an answer key. */
export const SequenceStepsSchema = z
  .array(
    z.strictObject({
      key,
      label: z.string().trim().min(2),
      brief: markdown,
      depends_on: z.array(key).default([]),
    }),
  )
  .superRefine((steps, ctx) => {
    requireUnique(
      ctx,
      steps.map((step) => step.key),
      [],
      'step',
    );
    const done = new Set<string>();
    const pending = new Set(steps.map((step) => step.key));
    while (pending.size) {
      const ready = steps.filter(
        (step) => pending.has(step.key) && step.depends_on.every((id) => done.has(id)),
      );
      if (!ready.length) {
        ctx.addIssue({
          code: 'custom',
          message: 'Sequence dependencies contain a cycle or unknown step',
        });
        break;
      }
      for (const step of ready) {
        pending.delete(step.key);
        done.add(step.key);
      }
    }
  });
