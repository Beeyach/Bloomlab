import { z } from 'zod';

import { featureRef, markdown, ref, requireUnique, skillRef, stringList } from './common.ts';

/** Glossary term for search and the Academy (spec §98, TA§71, CNT-010). */
export const GlossarySchema = z
  .strictObject({
    id: ref('glossary'),
    term: z.string().trim().min(2).max(80),
    definition: markdown,
    aliases: stringList.default([]),
    related_skills: z.array(skillRef).default([]),
    ghl_features: z.array(featureRef).default([]),
  })
  .superRefine((entry, ctx) => {
    requireUnique(ctx, entry.related_skills, ['related_skills'], 'skill');
    requireUnique(ctx, entry.ghl_features, ['ghl_features'], 'GHL feature');
  });

export type GlossaryEntry = z.infer<typeof GlossarySchema>;
