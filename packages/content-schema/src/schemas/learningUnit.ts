import { z } from 'zod';

import { TERRITORIES } from '../ids.ts';
import { featureRef, ref, requireUnique, skillRef, tier, title } from './common.ts';

/**
 * Academy unit (spec §98, CUR-036; LearningUnitSchema in CONTENT_ARCHITECTURE.md). The YAML
 * front matter is validated here; the MDX body is parsed by the compiler, which derives the
 * embeds, depth sections and headings from it.
 */

/** Components a unit body may embed. Each is a real interactive element, never a picture of one. */
export const UNIT_EMBEDS = ['Simulation', 'Exercise', 'Feature', 'Depth', 'Callout'] as const;
export type UnitEmbedName = (typeof UNIT_EMBEDS)[number];

export const LearningUnitFrontMatterSchema = z
  .strictObject({
    id: ref('learning-units'),
    title,
    territory: z.enum(TERRITORIES),
    tier,
    skills: z.array(skillRef).min(1),
    ghl_features: z.array(featureRef).default([]),
    estimated_minutes: z.number().int().min(3).max(120),
    summary: z.string().trim().min(20).max(400),
  })
  .superRefine((unit, ctx) => {
    requireUnique(ctx, unit.skills, ['skills'], 'skill');
    requireUnique(ctx, unit.ghl_features, ['ghl_features'], 'GHL feature');
  });

export type LearningUnitFrontMatter = z.infer<typeof LearningUnitFrontMatterSchema>;

/** An inline embed found in the body, with its resolved reference attributes. */
export interface UnitEmbed {
  component: UnitEmbedName;
  attributes: Record<string, string>;
  line: number;
}

export interface LearningUnit extends LearningUnitFrontMatter {
  /** Raw MDX body (front matter removed); the Academy compiles it for rendering (Phase 8). */
  body_mdx: string;
  headings: { depth: number; text: string }[];
  embeds: UnitEmbed[];
  /** Titles of `<Depth>` sections: expandable depth the reader can open (CUR-036). */
  depth_sections: string[];
  word_count: number;
}
