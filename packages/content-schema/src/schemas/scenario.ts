import { z } from 'zod';

import {
  clientRef,
  factRecord,
  isoDateTime,
  ref,
  requireUnique,
  stringList,
  timeZone,
  title,
} from './common.ts';
import { WorkflowDefinitionSchema } from './workflow.ts';

/**
 * Simulator starting state (spec §40, §49; ScenarioSchema in CONTENT_ARCHITECTURE.md).
 * A scenario belongs to a persistent client and seeds one simulation run deterministically.
 */

/** Realistic failures the simulator can stage (spec §49 plus the §27 edge-case variables). */
export const FAILURE_MODES = [
  'missing_phone',
  'dnd',
  'invalid_webhook_auth',
  'missing_field',
  'unavailable_appointment',
  'duplicate_enrollment',
  'bad_condition',
  'workflow_loop',
  'integration_failure',
  'late_booking',
  'cancelled_appointment',
  'timezone_mismatch',
  'second_location',
  'duplicate_contact',
] as const;
export type FailureMode = (typeof FAILURE_MODES)[number];

const contact = z.strictObject({
  id: z.string().min(1),
  first_name: z.string().min(1),
  last_name: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  tags: stringList.default([]),
  custom_fields: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({}),
  dnd: z.boolean().default(false),
  timezone: timeZone.optional(),
  source: z.string().optional(),
});

const customField = z.strictObject({
  key: z.string().regex(/^[a-z][a-z0-9_]*$/),
  label: z.string().min(1),
  type: z.enum(['text', 'number', 'date', 'checkbox', 'dropdown', 'phone', 'email']),
  object: z.enum(['contact', 'opportunity']).default('contact'),
});

const pipeline = z.strictObject({
  id: z.string().min(1),
  name: z.string().min(1),
  stages: stringList.min(1),
});

const calendar = z.strictObject({
  id: z.string().min(1),
  name: z.string().min(1),
  duration_minutes: z.number().int().min(5),
  timezone: timeZone.optional(),
});

const form = z.strictObject({
  id: z.string().min(1),
  name: z.string().min(1),
  fields: stringList.min(1),
});

const appointment = z.strictObject({
  id: z.string().min(1),
  contact_id: z.string().min(1),
  calendar_id: z.string().min(1),
  starts_at: isoDateTime,
  status: z.enum(['booked', 'confirmed', 'cancelled', 'showed', 'no_show']).default('booked'),
});

const opportunity = z.strictObject({
  id: z.string().min(1),
  contact_id: z.string().min(1),
  pipeline_id: z.string().min(1),
  stage: z.string().min(1),
  value: z.number().min(0).default(0),
});

export const AccountStateSchema = z
  .strictObject({
    contacts: z.array(contact).default([]),
    tags: stringList.default([]),
    custom_fields: z.array(customField).default([]),
    custom_values: z
      .array(z.strictObject({ key: z.string().min(1), value: z.string() }))
      .default([]),
    pipelines: z.array(pipeline).default([]),
    opportunities: z.array(opportunity).default([]),
    calendars: z.array(calendar).default([]),
    appointments: z.array(appointment).default([]),
    forms: z.array(form).default([]),
    workflows: z.array(WorkflowDefinitionSchema).default([]),
  })
  .superRefine((state, ctx) => {
    requireUnique(
      ctx,
      state.contacts.map((c) => c.id),
      ['contacts'],
      'contact id',
    );
    requireUnique(
      ctx,
      state.pipelines.map((p) => p.id),
      ['pipelines'],
      'pipeline id',
    );
    requireUnique(
      ctx,
      state.calendars.map((c) => c.id),
      ['calendars'],
      'calendar id',
    );
    requireUnique(
      ctx,
      state.workflows.map((w) => w.id),
      ['workflows'],
      'workflow id',
    );
    const contacts = new Set(state.contacts.map((c) => c.id));
    const calendars = new Set(state.calendars.map((c) => c.id));
    const pipelines = new Map(state.pipelines.map((p) => [p.id, p]));
    state.appointments.forEach((a, index) => {
      if (!contacts.has(a.contact_id))
        ctx.addIssue({
          code: 'custom',
          path: ['appointments', index, 'contact_id'],
          message: `Unknown contact ${a.contact_id}`,
        });
      if (!calendars.has(a.calendar_id))
        ctx.addIssue({
          code: 'custom',
          path: ['appointments', index, 'calendar_id'],
          message: `Unknown calendar ${a.calendar_id}`,
        });
    });
    state.opportunities.forEach((o, index) => {
      if (!contacts.has(o.contact_id))
        ctx.addIssue({
          code: 'custom',
          path: ['opportunities', index, 'contact_id'],
          message: `Unknown contact ${o.contact_id}`,
        });
      const pipe = pipelines.get(o.pipeline_id);
      if (!pipe)
        ctx.addIssue({
          code: 'custom',
          path: ['opportunities', index, 'pipeline_id'],
          message: `Unknown pipeline ${o.pipeline_id}`,
        });
      else if (!pipe.stages.includes(o.stage))
        ctx.addIssue({
          code: 'custom',
          path: ['opportunities', index, 'stage'],
          message: `Pipeline ${pipe.id} has no stage "${o.stage}"`,
        });
    });
  });

export type AccountState = z.infer<typeof AccountStateSchema>;

/** The nine pricing-economics fields a PRICE IT scenario stores (PRI-002). */
export const PricingEconomicsSchema = z.strictObject({
  baseline_complexity: z.number().int().min(1).max(5),
  estimated_labor_hours: z.number().min(1),
  risk: z.number().int().min(1).max(5),
  migration: z.boolean(),
  locations: z.number().int().min(1),
  integrations: z.number().int().min(0),
  custom_development: z.boolean(),
  rush: z.boolean(),
  recurring_support: z.boolean(),
});

const scheduledEvent = z.strictObject({
  at: isoDateTime,
  type: z.string().min(1),
  payload: z.record(z.string(), z.unknown()).default({}),
  description: z.string().optional(),
});

const injectableEvent = z.strictObject({
  id: z.string().regex(/^[a-z][a-z0-9_-]*$/),
  type: z.string().min(1),
  description: z.string().min(5),
  payload: z.record(z.string(), z.unknown()).default({}),
});

export const ScenarioSchema = z
  .strictObject({
    id: ref('scenarios'),
    title,
    client: clientRef,
    summary: z.string().trim().min(20),
    initial_account_state: AccountStateSchema,
    simulation_time: isoDateTime,
    timezone: timeZone,
    seed: z.number().int().min(0),
    scheduled_events: z.array(scheduledEvent).default([]),
    injectable_events: z.array(injectableEvent).default([]),
    hidden_facts: factRecord.default({}),
    failure_modes: z.array(z.enum(FAILURE_MODES)).default([]),
    economics: PricingEconomicsSchema.optional(),
    /** Overrides of the client's hidden roleplay state for this situation (spec §39). */
    hidden_state_overrides: z.record(z.string(), z.number()).default({}),
  })
  .superRefine((scenario, ctx) => {
    requireUnique(
      ctx,
      scenario.injectable_events.map((e) => e.id),
      ['injectable_events'],
      'event id',
    );
    requireUnique(ctx, scenario.failure_modes, ['failure_modes'], 'failure mode');
  });

export type Scenario = z.infer<typeof ScenarioSchema>;
