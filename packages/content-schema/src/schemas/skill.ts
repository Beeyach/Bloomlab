import { z } from 'zod';

import { TERRITORIES } from '../ids.ts';
import {
  featureRef,
  judgmentCompetency,
  markdown,
  ref,
  requireUnique,
  skillRef,
  stringList,
  tier,
  title,
} from './common.ts';

/** One node of the master skill graph (spec §10, §12, CUR-001, CUR-016). */
export const SkillSchema = z
  .strictObject({
    id: ref('skills'),
    title,
    territory: z.enum(TERRITORIES),
    tier,
    /** One or two sentences: what the learner can do once this is mastered. */
    summary: z.string().trim().min(20).max(400),
    description: markdown.optional(),
    prerequisites: z.array(skillRef).default([]),
    ghl_features: z.array(featureRef).default([]),
    judgment_competencies: z.array(judgmentCompetency).default([]),
    mastery_requirements: z.strictObject({
      /** Independent demonstrations needed before MASTERED (MAS-003). */
      independent_evidence: z.number().int().min(1).max(10),
      pressure_test: z.boolean(),
      fieldwork_required: z.boolean(),
      /** The skill must also be shown in a sales context (coverage "Sales Use"). */
      sales_use: z.boolean().default(false),
    }),
    keywords: stringList.default([]),
  })
  .superRefine((skill, ctx) => {
    requireUnique(ctx, skill.prerequisites, ['prerequisites'], 'prerequisite');
    requireUnique(ctx, skill.ghl_features, ['ghl_features'], 'GHL feature');
    if (skill.prerequisites.includes(skill.id)) {
      ctx.addIssue({
        code: 'custom',
        path: ['prerequisites'],
        message: 'A skill cannot require itself',
      });
    }
  });

export type Skill = z.infer<typeof SkillSchema>;
