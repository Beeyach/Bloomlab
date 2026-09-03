import { z } from 'zod';

import {
  clientRef,
  exerciseRef,
  markdown,
  portfolioRef,
  ref,
  requireUnique,
  skillRef,
  tier,
  title,
} from './common.ts';

/** Starter and capstone projects (spec §154–§155, CUR-030, CUR-031). */
export const ProjectSchema = z
  .strictObject({
    id: ref('projects'),
    title,
    tier,
    brief: markdown,
    client: clientRef,
    skills: z.array(skillRef).min(1),
    stages: z
      .array(
        z.strictObject({
          id: z.string().regex(/^s[0-9]+$|^[a-z][a-z0-9_-]*$/),
          name: z.string().min(3),
          exercises: z.array(exerciseRef).min(1),
          deliverable: z.string().min(5),
        }),
      )
      .min(1),
    fieldwork_required: z.boolean(),
    portfolio: portfolioRef.nullable(),
    /** Capstone: no normal hints; reasoning questions asked afterwards (§155). */
    capstone: z.boolean().default(false),
    reasoning_questions: z.array(z.string().min(5)).default([]),
  })
  .superRefine((project, ctx) => {
    requireUnique(
      ctx,
      project.stages.map((s) => s.id),
      ['stages'],
      'stage id',
    );
    requireUnique(
      ctx,
      project.stages.flatMap((s) => s.exercises),
      ['stages'],
      'exercise across stages',
    );
    if (project.capstone && project.reasoning_questions.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['reasoning_questions'],
        message: 'A capstone asks reasoning questions',
      });
    }
  });

export type Project = z.infer<typeof ProjectSchema>;
