import { HiddenStateSchema } from './client.ts';
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

/** `HH:MM` wall-clock in the calendar's own zone. A working day is a wall-clock fact. */
const timeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Needs an HH:MM time of day');

const availabilityWindow = z.strictObject({
  /** ISO weekday: 1 = Monday … 7 = Sunday, the same numbering the workflow time window uses. */
  day: z.number().int().min(1).max(7),
  start: timeOfDay,
  end: timeOfDay,
});

const calendarLocation = z.strictObject({
  id: z.string().min(1),
  kind: z.enum(['address', 'phone', 'zoom', 'google_meet', 'custom', 'ask_booker']),
  /** What the booker is given. Only `ask_booker` may leave it out. */
  value: z.string().trim().min(1).optional(),
});

const calendarService = z.strictObject({
  id: z.string().min(1),
  name: z.string().min(1),
  /** Overrides the calendar's duration when set. */
  duration_minutes: z.number().int().min(5).optional(),
  /** Users eligible for this service; empty means every team member on the calendar. */
  staff_ids: stringList.optional(),
  location_id: z.string().min(1).optional(),
});

/** A calendar as configuration (CAL-001). Everything but identity and duration has a default. */
const calendar = z
  .strictObject({
    id: z.string().min(1),
    name: z.string().min(1),
    type: z.enum(['personal', 'round_robin', 'service']).optional(),
    duration_minutes: z.number().int().min(5),
    slot_interval_minutes: z.number().int().min(5).optional(),
    pre_buffer_minutes: z.number().int().min(0).optional(),
    post_buffer_minutes: z.number().int().min(0).optional(),
    minimum_notice_minutes: z.number().int().min(0).optional(),
    booking_window_days: z.number().int().min(1).max(60).optional(),
    timezone: timeZone.optional(),
    availability: z.array(availabilityWindow).optional(),
    staff_ids: stringList.optional(),
    assignment: z.enum(['single', 'optimize_availability', 'optimize_equal']).optional(),
    staff_selection: z.boolean().optional(),
    services: z.array(calendarService).optional(),
    locations: z.array(calendarLocation).optional(),
    default_location_id: z.string().min(1).optional(),
    booking: z
      .strictObject({
        cancellation_allowed: z.boolean().optional(),
        reschedule_allowed: z.boolean().optional(),
        change_cutoff_hours: z.number().int().min(0).optional(),
      })
      .optional(),
  })
  .superRefine((row, ctx) => {
    const locations = new Set((row.locations ?? []).map((location) => location.id));
    (row.locations ?? []).forEach((location, index) => {
      if (location.kind !== 'ask_booker' && !location.value) {
        ctx.addIssue({
          code: 'custom',
          path: ['locations', index, 'value'],
          message: `A ${location.kind} location needs something to give the booker`,
        });
      }
    });
    if (row.default_location_id && !locations.has(row.default_location_id)) {
      ctx.addIssue({
        code: 'custom',
        path: ['default_location_id'],
        message: `Unknown location ${row.default_location_id}`,
      });
    }
    const staff = new Set(row.staff_ids ?? []);
    (row.services ?? []).forEach((service, index) => {
      (service.staff_ids ?? []).forEach((userId) => {
        if (!staff.has(userId)) {
          ctx.addIssue({
            code: 'custom',
            path: ['services', index, 'staff_ids'],
            message: `${userId} is not on this calendar`,
          });
        }
      });
      if (service.location_id && !locations.has(service.location_id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['services', index, 'location_id'],
          message: `Unknown location ${service.location_id}`,
        });
      }
    });
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
  /** What the booking was made for, kept on the record so a later calendar edit cannot move it. */
  duration_minutes: z.number().int().min(5).optional(),
  /** The team member hosting it — a different thing from the contact's owner (D-130). */
  host_id: z.string().min(1).optional(),
  service_id: z.string().min(1).optional(),
  location_id: z.string().min(1).optional(),
  booked_by: z.enum(['customer', 'staff']).optional(),
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

/**
 * What one outside service answers a Webhook action with (SIM-011, D-139).
 *
 * Training simulation, not a HighLevel control. Bloomlab makes no request: this is the scenario's
 * own deterministic reply for one exact URL, so a learner can tell a refused credential from a
 * service that is down. Anywhere it is shown, the interface says it is the simulator's stand-in
 * for the outside world rather than something a sub-account holds.
 */
const externalEndpoint = z.strictObject({
  id: z.string().min(1),
  url: z.string().url(),
  /** What the service requires before it accepts a call at all. */
  auth: z
    .strictObject({
      /** The header it looks in. Defaults to Authorization, which is what most services use. */
      header: z.string().trim().min(1).optional(),
      token: z.string().trim().min(1),
    })
    .optional(),
  ok_status: z.number().int().min(100).max(599).optional(),
  unauthorized_status: z.number().int().min(400).max(499).optional(),
  /** When set, the service itself is failing — a different problem from a wrong credential. */
  outage: z
    .strictObject({
      status: z.number().int().min(100).max(599).optional(),
      kind: z.enum(['server_error', 'unavailable', 'timeout']),
    })
    .optional(),
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
    external_endpoints: z.array(externalEndpoint).default([]),
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
    requireUnique(
      ctx,
      state.external_endpoints.map((e) => e.id),
      ['external_endpoints'],
      'endpoint id',
    );
    // Two profiles for one URL would make the answer depend on iteration order, which is exactly
    // the kind of invisible behaviour a troubleshooting scenario must not have.
    requireUnique(
      ctx,
      state.external_endpoints.map((e) => e.url),
      ['external_endpoints'],
      'endpoint URL',
    );
    const contacts = new Set(state.contacts.map((c) => c.id));
    const calendars = new Set(state.calendars.map((c) => c.id));
    const calendarsById = new Map(state.calendars.map((c) => [c.id, c]));
    const users = new Set(state.users.map((u) => u.id));
    const pipelines = new Map(state.pipelines.map((p) => [p.id, p]));
    // A calendar's team is a reference like any other: a host the account does not have would
    // put a name on an appointment that means nothing (D-130).
    state.calendars.forEach((c, index) => {
      (c.staff_ids ?? []).forEach((userId) => {
        if (!users.has(userId))
          ctx.addIssue({
            code: 'custom',
            path: ['calendars', index, 'staff_ids'],
            message: `Unknown user ${userId}`,
          });
      });
    });
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
      const held = calendarsById.get(a.calendar_id);
      if (a.host_id && !users.has(a.host_id))
        ctx.addIssue({
          code: 'custom',
          path: ['appointments', index, 'host_id'],
          message: `Unknown user ${a.host_id}`,
        });
      if (held && a.host_id && !(held.staff_ids ?? []).includes(a.host_id))
        ctx.addIssue({
          code: 'custom',
          path: ['appointments', index, 'host_id'],
          message: `${a.host_id} does not host on ${held.id}`,
        });
      if (held && a.service_id && !(held.services ?? []).some((s) => s.id === a.service_id))
        ctx.addIssue({
          code: 'custom',
          path: ['appointments', index, 'service_id'],
          message: `Unknown service ${a.service_id}`,
        });
      if (held && a.location_id && !(held.locations ?? []).some((l) => l.id === a.location_id))
        ctx.addIssue({
          code: 'custom',
          path: ['appointments', index, 'location_id'],
          message: `Unknown location ${a.location_id}`,
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

/**
 * A staged failure a learner is asked to diagnose (SIM-011, DES-013, D-142).
 *
 * Everything here is a case fact — what is wrong from the outside, what the client said, where to
 * look. Nothing here is the answer. The fault and the fix live in the grading assertions of the
 * exercise that uses the scenario, so an Incident can be rendered in full without handing the
 * learner what they were asked to work out (§26, §71).
 *
 * `failure_mode` names which of the nine §49 failures this incident stages, so the Incident
 * surface and the regression fixtures address the same thing by the same name.
 */
const incident = z.strictObject({
  title: title,
  /** What is observably wrong, stated without naming a cause. */
  symptom: z.string().trim().min(20),
  /** What the client actually said, in their words. */
  client_complaint: z.string().trim().min(20),
  /** Which of the nine failures this stages. */
  failure_mode: z.enum(FAILURE_MODES),
  /** Where to look: the parts of the account this incident is about. */
  inspect: stringList.min(1),
  /**
   * What the learner should do to reproduce it — advancing the clock, sending a test lead. Plain
   * steps, never "the problem is …".
   */
  reproduce: stringList.default([]),
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
    /** The staged failure this scenario is, when it is one (SIM-011, DES-013). */
    incident: incident.nullable().default(null),
    economics: PricingEconomicsSchema.optional(),
    /** Overrides of the client's hidden roleplay state for this situation (spec §39). */
    hidden_state_overrides: HiddenStateSchema.partial().default({}),
  })
  .superRefine((scenario, ctx) => {
    requireUnique(
      ctx,
      scenario.injectable_events.map((e) => e.id),
      ['injectable_events'],
      'event id',
    );
    requireUnique(ctx, scenario.failure_modes, ['failure_modes'], 'failure mode');
    // An incident is one of the scenario's declared failure modes, so the two can never disagree
    // about what is being staged.
    if (scenario.incident && !scenario.failure_modes.includes(scenario.incident.failure_mode)) {
      ctx.addIssue({
        code: 'custom',
        path: ['incident', 'failure_mode'],
        message: `${scenario.incident.failure_mode} is not one of this scenario's failure_modes`,
      });
    }
  });

export type Scenario = z.infer<typeof ScenarioSchema>;
