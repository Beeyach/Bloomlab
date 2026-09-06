import { z } from 'zod';

import { featureRef, markdown, ref, requireUnique, skillRef, stringList } from './common.ts';

/** Glossary term for search and the Academy (spec §98, TA§71, CNT-010). */
export const GlossarySchema = z
  .strictObject({
    id: ref('glossary'),
    term: z.string().trim().min(2).max(80),
    definition: markdown,
    aliases: stringList.default([]),
    /**
     * Ordinary business language a client already uses (SAL-007). A no-show is a no-show to
     * anyone; a custom value is not. This is what separates necessary vocabulary from jargon
     * when an explanation written for an owner is counted, and it is content rather than a list
     * hidden in one component.
     */
    owner_safe: z.boolean().default(false),
    related_skills: z.array(skillRef).default([]),
    ghl_features: z.array(featureRef).default([]),
  })
  .superRefine((entry, ctx) => {
    requireUnique(ctx, entry.related_skills, ['related_skills'], 'skill');
    requireUnique(ctx, entry.ghl_features, ['ghl_features'], 'GHL feature');
  });

export type GlossaryEntry = z.infer<typeof GlossarySchema>;
