import { BOSS_STAGES, CAPSTONE_INPUTS, CAPSTONE_ACTIONS } from './fieldReady.ts';
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
          engagement_stage: z.enum(BOSS_STAGES).optional(),
          actions: z.array(z.enum(CAPSTONE_ACTIONS)).default([]),
          exercises: z.array(exerciseRef).min(1),
          conditional_exercises: z
            .array(
              z.strictObject({
                from_stage: z.string().min(1),
                from_exercise: exerciseRef,
                choice: z.string().regex(/^[a-z][a-z0-9_]*$/),
                exercises: z.array(exerciseRef).min(1),
                consequence: markdown,
              }),
            )
            .default([]),
          deliverable: z.string().min(5),
        }),
      )
      .min(1),
    fieldwork_required: z.boolean(),
    portfolio: portfolioRef.nullable(),
    /** Capstone: no normal hints; reasoning questions asked afterwards (§155). */
    capstone: z.boolean().default(false),
    boss_client: z.boolean().default(false),
    inputs: z
      .array(z.strictObject({ category: z.enum(CAPSTONE_INPUTS), brief: markdown }))
      .default([]),
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
    project.stages.forEach((stage, index) =>
      stage.conditional_exercises.forEach((rule) => {
        const source = project.stages.findIndex((s) => s.id === rule.from_stage);
        if (
          source < 0 ||
          source >= index ||
          !project.stages[source]?.exercises.includes(rule.from_exercise)
        )
          ctx.addIssue({
            code: 'custom',
            path: ['stages', index, 'conditional_exercises'],
            message: 'A consequence must reference an exercise in an earlier stage',
          });
      }),
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
