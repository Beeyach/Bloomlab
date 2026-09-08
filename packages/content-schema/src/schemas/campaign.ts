import { z } from 'zod';

import { campaignRef, projectRef, ref, requireUnique, skillRef, title } from './common.ts';

/**
 * A curated path through the master graph (spec §10–§11, CUR-001, CUR-002). Gates are
 * competency stages, never days; a campaign only references skill IDs.
 */

const gate = z.strictObject({
  id: z.string().regex(/^GATE-[0-9]{1,2}$/, 'Gate IDs look like GATE-4'),
  number: z.number().int().min(0).max(99),
  name: title,
  summary: z.string().trim().min(10),
  /** Skills trained and assessed at this gate. */
  skills: z.array(skillRef),
  /** Placement gates assess skills that live in later gates so strong basics clear them early. */
  placement: z.boolean().default(false),
  assesses: z.array(skillRef).default([]),
  pass_criteria: z.strictObject({
    independent_evidence_per_skill: z.number().int().min(1).default(1),
    pressure_test_required: z.boolean().default(false),
    fieldwork_required: z.boolean().default(false),
    notes: z.string().optional(),
  }),
  projects: z.array(projectRef).default([]),
});

export const CampaignSchema = z
  .strictObject({
    id: ref('campaigns'),
    title,
    /** Display wording, e.g. "Suggested pace: ~30 days at 3–5 hours/day" — never a lock (§8). */
    pace_hint: z.string().trim().min(5),
    summary: z.string().trim().min(20),
    /** Campaigns whose skills count as already available (prerequisite resolution). */
    requires_campaigns: z.array(campaignRef).default([]),
    gates: z.array(gate).min(1),
    coverage_enforced: z.boolean().default(false),
  })
  .superRefine((campaign, ctx) => {
    requireUnique(
      ctx,
      campaign.gates.map((g) => g.id),
      ['gates'],
      'gate id',
    );
    campaign.gates.forEach((g, index) => {
      const previous = campaign.gates[index - 1];
      if (previous && g.number <= previous.number) {
        ctx.addIssue({
          code: 'custom',
          path: ['gates', index, 'number'],
          message: `Gate numbers must increase (${previous.number} then ${g.number})`,
        });
      }
      if (g.assesses.length > 0 && !g.placement) {
        ctx.addIssue({
          code: 'custom',
          path: ['gates', index, 'assesses'],
          message: 'Only a placement gate may list skills it assesses without training them',
        });
      }
    });
    // Skills are never duplicated inside a campaign (CUR-001): each appears in one gate only.
    requireUnique(
      ctx,
      campaign.gates.flatMap((g) => g.skills),
      ['gates'],
      'skill across gates',
    );
    if (campaign.requires_campaigns.includes(campaign.id)) {
      ctx.addIssue({
        code: 'custom',
        path: ['requires_campaigns'],
        message: 'A campaign cannot require itself',
      });
    }
  });

export type Campaign = z.infer<typeof CampaignSchema>;
export type CampaignGate = Campaign['gates'][number];
