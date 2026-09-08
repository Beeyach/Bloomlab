import { z } from 'zod';
import { PORTFOLIO_ARTIFACT_KINDS } from './schemas/portfolio.ts';

const id = z.string().min(1).max(200);
const envelope = {
  id,
  learner_id: id,
  device_id: id,
  created_at: z.iso.datetime(),
  updated_at: z.iso.datetime(),
  revision: z.number().int().positive(),
  deleted_at: z.iso.datetime().nullable(),
};

/** Normalized artifact slots point to authored context or the item's append-only contributions. */
export const PortfolioProjectRecordSchema = z
  .strictObject({
    ...envelope,
    schema_version: z.literal(1),
    template_id: id,
    project_id: id,
    reflection: z.string().max(8000),
    artifacts: z.record(
      z.enum(PORTFOLIO_ARTIFACT_KINDS),
      z.strictObject({
        source: z.enum(['project', 'contributions']),
        reference_id: id,
      }),
    ),
  })
  .superRefine((record, ctx) => {
    for (const kind of PORTFOLIO_ARTIFACT_KINDS) {
      const authored = kind === 'brief' || kind === 'business_problem';
      const slot = record.artifacts[kind];
      if (
        slot.source !== (authored ? 'project' : 'contributions') ||
        slot.reference_id !== (authored ? record.project_id : record.id)
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['artifacts', kind],
          message: 'Artifact reference must belong to this project',
        });
      }
    }
  });

/** An asset here is a reference to saved work, never a duplicate image or attempt. */
export const PortfolioAssetRecordSchema = z.strictObject({
  ...envelope,
  schema_version: z.literal(1),
  portfolio_id: id,
  attempt_id: id,
});

/** Bounded structure actually supplied to grading; no account, webhook headers or provider data. */
export const PortfolioCaptureSchema = z.strictObject({
  version: z.literal(1),
  workflows: z
    .array(
      z.strictObject({
        id,
        name: z.string().max(500),
        trigger: id.nullable(),
        nodes: z
          .array(
            z.strictObject({
              id,
              type: z.string().max(100),
              feature: id.nullable(),
              label: z.string().max(500),
            }),
          )
          .max(500),
      }),
    )
    .max(100),
  funnels: z
    .array(
      z.strictObject({
        id,
        name: z.string().max(500),
        steps: z
          .array(
            z.strictObject({
              id,
              name: z.string().max(500),
              purpose: z.string().max(100),
              blocks: z
                .array(
                  z.strictObject({ role: z.string().max(100), connected: z.boolean().nullable() }),
                )
                .max(100),
            }),
          )
          .max(100),
      }),
    )
    .max(100),
});
export type PortfolioProjectRecord = z.infer<typeof PortfolioProjectRecordSchema>;
export type PortfolioAssetRecord = z.infer<typeof PortfolioAssetRecordSchema>;
export type PortfolioCapture = z.infer<typeof PortfolioCaptureSchema>;
