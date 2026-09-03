import { z } from 'zod';

import { projectRef, ref, requireUnique, title } from './common.ts';

/**
 * Portfolio item template (spec §35–§36, PORT-001 … PORT-003). Fictional work is always labelled;
 * there is deliberately no field for client outcomes.
 */

export const PORTFOLIO_LABELS = ['Simulation Project', 'Demonstration Build'] as const;

/** The ten things a portfolio item stores (spec §35). */
export const PORTFOLIO_ARTIFACT_KINDS = [
  'brief',
  'business_problem',
  'architecture',
  'funnel',
  'workflows',
  'screenshots',
  'learner_reasoning',
  'skills_demonstrated',
  'assistance_level',
  'real_ghl_evidence',
] as const;

export const PortfolioSchema = z
  .strictObject({
    id: ref('portfolio'),
    project: projectRef,
    label: z.enum(PORTFOLIO_LABELS),
    title,
    /** Position in the §36 progression (1 … 20). */
    progression_number: z.number().int().min(1).max(20),
    artifacts: z
      .array(
        z.strictObject({
          kind: z.enum(PORTFOLIO_ARTIFACT_KINDS),
          required: z.boolean(),
          description: z.string().min(5),
        }),
      )
      .min(1),
  })
  .superRefine((portfolio, ctx) => {
    requireUnique(
      ctx,
      portfolio.artifacts.map((a) => a.kind),
      ['artifacts'],
      'artifact kind',
    );
    for (const must of [
      'brief',
      'business_problem',
      'architecture',
      'learner_reasoning',
    ] as const) {
      if (!portfolio.artifacts.some((a) => a.kind === must)) {
        ctx.addIssue({
          code: 'custom',
          path: ['artifacts'],
          message: `Portfolio items always store ${must}`,
        });
      }
    }
  });

export type Portfolio = z.infer<typeof PortfolioSchema>;
