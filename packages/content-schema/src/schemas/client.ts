import { z } from 'zod';

import { factRecord, isoDate, ref, requireUnique, stringList, timeZone } from './common.ts';

/**
 * Persistent fictional client (spec §37–§39, CNT-008, CNT-009, NEG-001). The fifteen §38
 * fields are all required; `hidden_state` holds the roleplay values that are never shown to the
 * learner as numbers.
 */

export const INDUSTRIES = [
  'med_spa',
  'coach',
  'consultant',
  'therapist',
  'photographer',
  'realtor',
  'gym_fitness',
  'pet_service',
  'hvac',
  'roofing',
  'cleaning',
  'remodeling',
  'dentist',
  'chiropractor',
  'law_firm',
  'accounting',
  'recruiting',
  'course_creator',
  'wedding_vendor',
  'b2b_service',
] as const;
export type Industry = (typeof INDUSTRIES)[number];

export const RELATIONSHIP_STAGES = [
  'cold',
  'prospect',
  'discovery',
  'proposal',
  'client',
  'paused',
  'churned',
] as const;

const percent = z.number().min(0).max(100);

/** Spec §39 values plus decision authority and provider strength (EXERCISE_ENGINE.md §7). */
export const HiddenStateSchema = z.strictObject({
  trust: percent,
  urgency: percent,
  price_sensitivity: percent,
  frustration: percent,
  technical_sophistication: percent,
  fear: percent,
  previous_bad_experience: percent,
  alternative_provider_strength: percent,
  actual_budget: z.number().min(0),
  stated_budget: z.number().min(0),
  decision_authority: z.enum(['sole', 'shared', 'none']),
});

export type HiddenState = z.infer<typeof HiddenStateSchema>;

export const ClientSchema = z
  .strictObject({
    id: ref('clients'),
    business_name: z.string().trim().min(2),
    industry: z.enum(INDUSTRIES),
    locations: z
      .array(
        z.strictObject({
          name: z.string().min(1),
          city: z.string().min(1),
          region: z.string().optional(),
          timezone: timeZone,
        }),
      )
      .min(1),
    team: z
      .array(
        z.strictObject({
          name: z.string().min(1),
          role: z.string().min(1),
          notes: z.string().optional(),
        }),
      )
      .min(1),
    offers: z
      .array(
        z.strictObject({
          name: z.string().min(1),
          price: z.number().min(0),
          billing: z.enum(['one_time', 'recurring', 'package']),
          notes: z.string().optional(),
        }),
      )
      .min(1),
    lead_sources: stringList.min(1),
    current_systems: stringList.min(1),
    /** Named numbers the learner may be shown (monthly_leads, booking_rate, …). */
    metrics: z.record(z.string(), z.number()),
    problems: stringList.min(1),
    relationship_state: z.strictObject({
      stage: z.enum(RELATIONSHIP_STAGES),
      since: isoDate,
      owner: z.string().optional(),
      notes: z.string().optional(),
    }),
    assets: z.array(
      z.strictObject({
        kind: z.enum([
          'domain',
          'funnel',
          'form',
          'calendar',
          'pipeline',
          'snapshot',
          'document',
          'brand',
        ]),
        name: z.string().min(1),
        notes: z.string().optional(),
      }),
    ),
    hidden_facts: factRecord,
    voice: z.strictObject({
      /** Voice character registry reference (TA§46), checked by the compiler. */
      character: ref('voice-characters'),
      tone: z.string().min(3),
      speaking_style: z.string().min(3),
      sample_phrases: stringList.min(1),
    }),
    history: z.array(z.strictObject({ date: isoDate, event: z.string().min(3) })),
    hidden_state: HiddenStateSchema,
  })
  .superRefine((client, ctx) => {
    requireUnique(
      ctx,
      client.locations.map((l) => l.name),
      ['locations'],
      'location name',
    );
    if (client.hidden_state.stated_budget > client.hidden_state.actual_budget * 3) {
      ctx.addIssue({
        code: 'custom',
        path: ['hidden_state', 'stated_budget'],
        message: 'Stated budget is implausibly far above the actual budget',
      });
    }
  });

export type Client = z.infer<typeof ClientSchema>;
