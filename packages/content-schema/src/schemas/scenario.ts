import { z } from 'zod';

import { eventTypeFromContent, isSimulatorEventType } from '@bloomlab/simulator-core';

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
import { FUNNEL_BLOCK_REFERENCES, FunnelDefinitionSchema } from './funnel.ts';
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

const user = z.strictObject({
  id: z.string().min(1),
  name: z.string().min(1),
  role: z.enum(['admin', 'user']).default('user'),
});

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
  /** A user in this scenario's own `users` list (D-089). */
  owner_id: z.string().min(1).optional(),
});

/** Internal context the account already carries (D-091). At least one target, checked below. */
const note = z.strictObject({
  id: z.string().min(1),
  body: z.string().trim().min(1),
  contact_id: z.string().min(1).optional(),
  opportunity_id: z.string().min(1).optional(),
  author_id: z.string().min(1).optional(),
  at: isoDateTime.optional(),
});

/** Work already owed on a record (D-091). */
const task = z.strictObject({
  id: z.string().min(1),
  title: z.string().trim().min(1),
  contact_id: z.string().min(1).optional(),
  opportunity_id: z.string().min(1).optional(),
  description: z.string().optional(),
  due_at: isoDateTime.optional(),
  completed: z.boolean().default(false),
  assigned_to: z.string().min(1).optional(),
});

const customField = z
  .strictObject({
    key: z.string().regex(/^[a-z][a-z0-9_]*$/),
    label: z.string().min(1),
    type: z.enum(['text', 'number', 'date', 'checkbox', 'dropdown', 'phone', 'email']),
    object: z.enum(['contact', 'opportunity']).default('contact'),
    /** Required for `dropdown`, refused for every other type (D-090). */
    options: stringList.optional(),
  })
  .superRefine((field, ctx) => {
    // A dropdown with no options is a field nobody can fill in; options on any other type are a
    // promise no screen keeps. The engine refuses both, so authoring refuses them here.
    if (field.type === 'dropdown' && (field.options ?? []).length === 0) {
      ctx.addIssue({ code: 'custom', path: ['options'], message: 'A dropdown needs its options' });
    }
    if (field.type !== 'dropdown' && field.options) {
      ctx.addIssue({
        code: 'custom',
        path: ['options'],
        message: `Only a dropdown has options; ${field.key} is ${field.type}`,
      });
    }
    if (field.options && new Set(field.options).size !== field.options.length) {
      ctx.addIssue({ code: 'custom', path: ['options'], message: 'Duplicate option' });
    }
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

/** Surveys share the form shape; the engine keeps them apart because HighLevel does. */
const survey = form;

/** A product a checkout block can reference (FUN-001). Configuration is the Payments Lab's. */
const product = z.strictObject({
  id: z.string().min(1),
  name: z.string().min(1),
  price: z.number().min(0),
  recurring: z.boolean().default(false),
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
  /** GoHighLevel names a deal; without one every card reads as its contact. */
  name: z.string().trim().min(1).optional(),
  /** The four fixed statuses; HighLevel does not allow renaming or adding to them. */
  status: z.enum(['open', 'won', 'lost', 'abandoned']).optional(),
  owner_id: z.string().min(1).optional(),
  custom_fields: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
});

export const AccountStateSchema = z
  .strictObject({
    users: z.array(user).default([]),
    contacts: z.array(contact).default([]),
    notes: z.array(note).default([]),
    tasks: z.array(task).default([]),
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
    surveys: z.array(survey).default([]),
    products: z.array(product).default([]),
    workflows: z.array(WorkflowDefinitionSchema).default([]),
    funnels: z.array(FunnelDefinitionSchema).default([]),
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
    requireUnique(
      ctx,
      state.funnels.map((f) => f.id),
      ['funnels'],
      'funnel id',
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
    // A funnel block that names a form, survey, calendar or product this account never declares
    // is a broken reference the engine would refuse at load; the compiler catches it first.
    const held: Record<string, Set<string>> = {
      forms: new Set(state.forms.map((f) => f.id)),
      surveys: new Set(state.surveys.map((f) => f.id)),
      calendars,
      products: new Set(state.products.map((p) => p.id)),
    };
    state.funnels.forEach((funnel, index) => {
      funnel.steps.forEach((step, at) => {
        step.blocks.forEach((block, position) => {
          const collection =
            FUNNEL_BLOCK_REFERENCES[block.role as keyof typeof FUNNEL_BLOCK_REFERENCES];
          if (!collection || !block.reference_id) return;
          if (!held[collection]?.has(block.reference_id))
            ctx.addIssue({
              code: 'custom',
              path: ['funnels', index, 'steps', at, 'blocks', position, 'reference_id'],
              message: `Unknown ${block.role} ${block.reference_id}`,
            });
        });
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

/**
 * Events a scenario may schedule or offer. Two runtimes consume them, and the name says which.
 *
 * Most are GoHighLevel account events from the simulator's catalogue (spec §44), named the way
 * content names them (`appointment.status_changed`) or by the engine's own type. Those must
 * resolve, because a scenario scheduling an event the engine has never heard of is a content bug
 * and the compiler is where a content bug should surface — not the middle of a learner's run.
 *
 * The rest belong to the roleplay runtime (spec §39): a client speaking during a discovery or
 * negotiation, or a prospect's own business answering a test enquiry during an outside-in audit.
 * They are not account events and the simulator refuses to run them; they are listed explicitly
 * rather than allowed by a loose fallback, so a typo is still caught.
 */
export const ROLEPLAY_EVENT_TYPES = [
  /** The client says something in a call or a thread (Call Room, Phases 16–17). */
  'client.message',
  /** The prospect's business replies to a test enquiry (AUDIT_IT fieldwork). */
  'enquiry.response',
] as const;

const scenarioEventName = z
  .string()
  .min(1)
  .refine(
    (name) =>
      isSimulatorEventType(name) ||
      eventTypeFromContent(name) !== null ||
      (ROLEPLAY_EVENT_TYPES as readonly string[]).includes(name),
    { message: 'Neither a simulator event (spec §44) nor a roleplay event (spec §39)' },
  );

const scheduledEvent = z.strictObject({
  at: isoDateTime,
  type: scenarioEventName,
  payload: z.record(z.string(), z.unknown()).default({}),
  description: z.string().optional(),
});

const injectableEvent = z.strictObject({
  id: z.string().regex(/^[a-z][a-z0-9_-]*$/),
  type: scenarioEventName,
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
