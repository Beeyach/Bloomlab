import { z } from 'zod';

import { featureRef, isoDate, ref, requireUnique, skillRef, stringList } from './common.ts';

/**
 * GHL capability registry record (spec §25–§26, §151; TA§29–§30; GHL-001 … GHL-004).
 * Nothing that claims to be a native GHL feature exists in Bloomlab without one of these.
 */

export const IMPLEMENTATION_TYPES = [
  'native_ghl',
  'integration',
  'custom_code',
  'external_service',
] as const;
export type ImplementationType = (typeof IMPLEMENTATION_TYPES)[number];

export const GHL_FEATURE_STATUSES = ['current', 'needs_review', 'deprecated', 'removed'] as const;
export type GhlFeatureStatus = (typeof GHL_FEATURE_STATUSES)[number];

export const SIMULATION_FIDELITIES = ['A', 'B', 'C', 'REAL_GHL'] as const;
export type SimulationFidelity = (typeof SIMULATION_FIDELITIES)[number];

/** Product areas as GHL's own navigation groups them. Extend deliberately. */
export const FEATURE_AREAS = [
  'Workflows',
  'Contacts',
  'Opportunities',
  'Calendars',
  'Forms & Surveys',
  'Funnels & Websites',
  'Conversations',
  'Payments',
  'Settings',
  'Snapshots',
  'Reputation',
  'Memberships',
  'Reporting',
  'Phone',
  'AI',
  'Marketplace',
  'API',
] as const;
export type FeatureArea = (typeof FEATURE_AREAS)[number];

export const FEATURE_TYPES = [
  'trigger',
  'action',
  'entity',
  'capability',
  'product',
  'setting',
] as const;
export type FeatureType = (typeof FEATURE_TYPES)[number];

/** Hosts that count as official GHL documentation (GHL-006). */
export const OFFICIAL_GHL_HOSTS = [
  'help.gohighlevel.com',
  'marketplace.gohighlevel.com',
  'developers.gohighlevel.com',
  'highlevel.stoplight.io',
  'ideas.gohighlevel.com',
  'www.gohighlevel.com',
  'gohighlevel.com',
] as const;

const officialUrl = z
  .string()
  .url()
  .refine((value) => {
    try {
      const url = new URL(value);
      return (
        url.protocol === 'https:' &&
        (OFFICIAL_GHL_HOSTS as readonly string[]).includes(url.hostname)
      );
    } catch {
      return false;
    }
  }, 'source_url must be an https URL on an official GHL documentation host');

const configField = z.strictObject({
  name: z.string().min(1),
  type: z.enum([
    'string',
    'number',
    'boolean',
    'select',
    'duration',
    'template',
    'reference',
    'json',
  ]),
  required: z.boolean(),
  description: z.string().optional(),
  options: stringList.optional(),
});

export const GhlFeatureSchema = z
  .strictObject({
    id: ref('ghl-features'),
    /** Exact current name as GHL's documentation writes it (GHL-010). */
    official_name: z.string().trim().min(2),
    area: z.enum(FEATURE_AREAS),
    feature_type: z.enum(FEATURE_TYPES),
    implementation_type: z.enum(IMPLEMENTATION_TYPES),
    status: z.enum(GHL_FEATURE_STATUSES),
    simulation_fidelity: z.enum(SIMULATION_FIDELITIES),
    last_verified: isoDate,
    source_url: officialUrl,
    /** What the simulator or the lesson does not reproduce; may be empty but must be stated. */
    known_limitations: z.array(z.string().trim().min(1)),
    skills: z.array(skillRef),
    /** What the Workflow Lab may offer for this feature (TA§29). */
    supported_configs: z.strictObject({
      filters: stringList.default([]),
      config_fields: z.array(configField).default([]),
      options: stringList.default([]),
      notes: z.string().optional(),
    }),
    /** Required for fidelity B and C: the label shown wherever the approximation appears. */
    approximation_note: z.string().trim().min(10).optional(),
    /** How the record was verified (date, page section) — the review log repeats this. */
    verification_note: z.string().optional(),
    /** Older or colloquial names this feature has gone by. */
    aliases: stringList.default([]),
    /** For deprecated / removed features: what to teach instead. */
    replaced_by: featureRef.optional(),
  })
  .superRefine((feature, ctx) => {
    requireUnique(ctx, feature.skills, ['skills'], 'skill');
    if (
      (feature.simulation_fidelity === 'B' || feature.simulation_fidelity === 'C') &&
      !feature.approximation_note
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['approximation_note'],
        message: `Fidelity ${feature.simulation_fidelity} features must label their approximation (GHL-004)`,
      });
    }
    if (
      feature.status === 'removed' &&
      !feature.replaced_by &&
      feature.known_limitations.length === 0
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['replaced_by'],
        message:
          'A removed feature needs replaced_by or a known_limitations note saying what to do',
      });
    }
    if (feature.implementation_type !== 'native_ghl' && feature.simulation_fidelity === 'A') {
      ctx.addIssue({
        code: 'custom',
        path: ['simulation_fidelity'],
        message: 'Only native GHL behaviour can be reproduced at fidelity A',
      });
    }
  });

export type GhlFeature = z.infer<typeof GhlFeatureSchema>;
