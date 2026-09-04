import { SimulatorError, fail } from './errors.ts';
import {
  eventTypeFromContent,
  isSimulatorEventType,
  type EventPayload,
  type SimulatorEventType,
} from './events.ts';
import { createRandomState } from './random.ts';
import type { ScheduledEvent } from './scheduler.ts';
import { compareScheduled } from './scheduler.ts';
import {
  EMPTY_ANALYTICS,
  type AccountState,
  type Appointment,
  type Contact,
  type SimulatorState,
  type Workflow,
} from './state.ts';
import { instant, isValidTimeZone, toZone } from './time.ts';
import { SIMULATOR_VERSION } from './version.ts';

/**
 * Scenario input (spec §40, SIM-004). The engine consumes normalized data and never branches on
 * a scenario's identity: there is no `if (scenario.id === …)` anywhere in this package. Anything
 * particular to a client or a situation stays in `content/`.
 *
 * The shape below is structurally satisfied by the authored `Scenario` from `@bloomlab/content-
 * schema`, the same way the exercise grader accepts an authored exercise without depending on the
 * content package. That keeps the dependency arrow pointing one way.
 */

export interface ScenarioContact {
  id: string;
  first_name: string;
  last_name?: string | undefined;
  email?: string | undefined;
  phone?: string | undefined;
  tags?: readonly string[] | undefined;
  custom_fields?: Readonly<Record<string, string | number | boolean>> | undefined;
  dnd?: boolean | undefined;
  timezone?: string | undefined;
  source?: string | undefined;
  /** A user in the scenario's own `users` list (D-089). */
  owner_id?: string | undefined;
}

/** A person in the account, so ownership and assignment resolve to somebody (D-089). */
export interface ScenarioUser {
  id: string;
  name: string;
  role?: 'admin' | 'user' | undefined;
}

/** An internal note the account already carries when the run starts (D-091). */
export interface ScenarioNote {
  id: string;
  body: string;
  contact_id?: string | undefined;
  opportunity_id?: string | undefined;
  author_id?: string | undefined;
  at?: string | undefined;
}

/** Work already owed on a record when the run starts (D-091). */
export interface ScenarioTask {
  id: string;
  title: string;
  contact_id?: string | undefined;
  opportunity_id?: string | undefined;
  description?: string | undefined;
  due_at?: string | undefined;
  completed?: boolean | undefined;
  assigned_to?: string | undefined;
}

export interface ScenarioWorkflowNode {
  id: string;
  type: 'action' | 'wait' | 'branch' | 'goal' | 'end';
  ghl_feature_id?: string | undefined;
  label?: string | undefined;
  config?: Readonly<Record<string, unknown>> | undefined;
  position: { x: number; y: number };
}

export interface ScenarioWorkflow {
  id: string;
  name: string;
  trigger: {
    ghl_feature_id: string;
    filters?:
      | readonly {
          field: string;
          operator: 'is' | 'is_not' | 'contains' | 'exists' | 'not_exists' | 'gt' | 'lt';
          value?: string | number | boolean | undefined;
        }[]
      | undefined;
  };
  nodes: readonly ScenarioWorkflowNode[];
  edges?: readonly { from: string; to: string; branch?: string | undefined }[] | undefined;
  settings?:
    | {
        allow_reentry?: boolean | undefined;
        timezone?: string | undefined;
        notes?: string | undefined;
      }
    | undefined;
}

export interface ScenarioAccountState {
  users?: readonly ScenarioUser[] | undefined;
  contacts?: readonly ScenarioContact[] | undefined;
  notes?: readonly ScenarioNote[] | undefined;
  tasks?: readonly ScenarioTask[] | undefined;
  tags?: readonly string[] | undefined;
  custom_fields?:
    | readonly {
        key: string;
        label: string;
        type: 'text' | 'number' | 'date' | 'checkbox' | 'dropdown' | 'phone' | 'email';
        object?: 'contact' | 'opportunity' | undefined;
        /** Required for `dropdown`, refused for every other type (D-090). */
        options?: readonly string[] | undefined;
      }[]
    | undefined;
  custom_values?: readonly { key: string; value: string }[] | undefined;
  pipelines?: readonly { id: string; name: string; stages: readonly string[] }[] | undefined;
  opportunities?:
    | readonly {
        id: string;
        contact_id: string;
        pipeline_id: string;
        stage: string;
        value?: number | undefined;
        name?: string | undefined;
        status?: 'open' | 'won' | 'lost' | 'abandoned' | undefined;
        owner_id?: string | undefined;
        custom_fields?: Readonly<Record<string, string | number | boolean>> | undefined;
      }[]
    | undefined;
  calendars?:
    | readonly {
        id: string;
        name: string;
        duration_minutes: number;
        timezone?: string | undefined;
      }[]
    | undefined;
  appointments?:
    | readonly {
        id: string;
        contact_id: string;
        calendar_id: string;
        starts_at: string;
        status?: Appointment['status'] | undefined;
      }[]
    | undefined;
  forms?: readonly { id: string; name: string; fields: readonly string[] }[] | undefined;
  surveys?: readonly { id: string; name: string; fields: readonly string[] }[] | undefined;
  products?:
    | readonly { id: string; name: string; price: number; recurring?: boolean | undefined }[]
    | undefined;
  workflows?: readonly ScenarioWorkflow[] | undefined;
}

export interface ScenarioScheduledEvent {
  at: string;
  /** The authored dotted name (`appointment.status_changed`) or a catalogue type. */
  type: string;
  payload?: EventPayload | undefined;
  description?: string | undefined;
}

export interface ScenarioInjectableEvent {
  id: string;
  type: string;
  description: string;
  payload?: EventPayload | undefined;
}

export interface SimulatorScenario {
  id: string;
  title?: string | undefined;
  initial_account_state: ScenarioAccountState;
  simulation_time: string;
  timezone: string;
  seed: number;
  scheduled_events?: readonly ScenarioScheduledEvent[] | undefined;
  injectable_events?: readonly ScenarioInjectableEvent[] | undefined;
}

/** A GHL feature as the validator needs to see it; the registry is supplied, never hardcoded. */
export interface FeatureRecord {
  id: string;
  fidelity: 'A' | 'B' | 'C' | 'REAL_GHL';
}

export interface ScenarioIssue {
  code: string;
  path: string;
  message: string;
}

const issue = (code: string, path: string, message: string): ScenarioIssue => ({
  code,
  path,
  message,
});

function duplicates(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) repeated.add(id);
    seen.add(id);
  }
  return [...repeated];
}

/**
 * Everything the engine cannot safely run, reported rather than skipped (spec §100). A scenario
 * with a dangling reference, an impossible timestamp or an event type the catalogue does not
 * contain is a content bug, and the compiler is where a content bug should surface.
 */
export function validateScenario(
  scenario: SimulatorScenario,
  features?: readonly FeatureRecord[],
): ScenarioIssue[] {
  const issues: ScenarioIssue[] = [];
  const state = scenario.initial_account_state ?? {};

  if (!isValidTimeZone(scenario.timezone)) {
    issues.push(issue('INVALID_TIMEZONE', 'timezone', `Unknown timezone ${scenario.timezone}`));
  }
  try {
    instant(scenario.simulation_time);
  } catch {
    issues.push(
      issue('INVALID_TIME', 'simulation_time', `Not an instant: ${scenario.simulation_time}`),
    );
  }
  if (!Number.isInteger(scenario.seed) || scenario.seed < 0 || scenario.seed >= 0x100000000) {
    issues.push(issue('INVALID_SEED', 'seed', `Seed must be a 32-bit unsigned integer`));
  }

  const collections = {
    users: state.users ?? [],
    contacts: state.contacts ?? [],
    notes: state.notes ?? [],
    tasks: state.tasks ?? [],
    pipelines: state.pipelines ?? [],
    calendars: state.calendars ?? [],
    appointments: state.appointments ?? [],
    opportunities: state.opportunities ?? [],
    forms: state.forms ?? [],
    surveys: state.surveys ?? [],
    products: state.products ?? [],
    workflows: state.workflows ?? [],
  };
  for (const [name, rows] of Object.entries(collections)) {
    for (const id of duplicates(rows.map((row) => row.id))) {
      issues.push(issue('DUPLICATE_ID', `initial_account_state.${name}`, `Duplicate id ${id}`));
    }
  }

  const contactIds = new Set(collections.contacts.map((contact) => contact.id));
  const calendarIds = new Set(collections.calendars.map((calendar) => calendar.id));
  const pipelines = new Map(collections.pipelines.map((pipeline) => [pipeline.id, pipeline]));
  const userIds = new Set(collections.users.map((user) => user.id));
  const opportunityIds = new Set(collections.opportunities.map((row) => row.id));
  const fields = new Map((state.custom_fields ?? []).map((field) => [field.key, field]));

  /** An owner or assignee must be somebody the account actually has (D-089). */
  const checkUser = (id: string | undefined, path: string) => {
    if (id !== undefined && !userIds.has(id)) {
      issues.push(issue('DANGLING_REF', path, `Unknown user ${id}`));
    }
  };

  /** A value must name a field the account defines, for the object it is stored on (D-090). */
  const checkFieldValues = (
    values: Readonly<Record<string, string | number | boolean>> | undefined,
    object: 'contact' | 'opportunity',
    path: string,
  ) => {
    for (const key of Object.keys(values ?? {})) {
      const field = fields.get(key);
      if (!field) {
        issues.push(issue('UNKNOWN_FIELD', `${path}.${key}`, `No custom field ${key} is defined`));
        continue;
      }
      if ((field.object ?? 'contact') !== object) {
        issues.push(
          issue(
            'WRONG_FIELD_OBJECT',
            `${path}.${key}`,
            `${key} is a ${field.object ?? 'contact'} field`,
          ),
        );
      }
    }
  };

  // A dropdown with no options is a field nobody can fill in; options on anything else are a
  // promise no screen keeps. The reducer refuses both, so authoring must too (D-090).
  (state.custom_fields ?? []).forEach((field, index) => {
    const path = `initial_account_state.custom_fields.${index}`;
    if (field.type === 'dropdown' && (field.options ?? []).length === 0) {
      issues.push(issue('MISSING_OPTIONS', path, `Dropdown ${field.key} offers no options`));
    }
    if (field.type !== 'dropdown' && field.options) {
      issues.push(
        issue(
          'UNEXPECTED_OPTIONS',
          path,
          `Only a dropdown has options; ${field.key} is ${field.type}`,
        ),
      );
    }
    if (field.options && new Set(field.options).size !== field.options.length) {
      issues.push(issue('DUPLICATE_OPTION', path, `${field.key} offers the same option twice`));
    }
  });

  collections.contacts.forEach((contact, index) => {
    const path = `initial_account_state.contacts.${index}`;
    checkUser(contact.owner_id, `${path}.owner_id`);
    checkFieldValues(contact.custom_fields, 'contact', `${path}.custom_fields`);
  });

  // A note or a task must hang off something that exists, and off something at all (D-091).
  const checkTarget = (
    row: { contact_id?: string | undefined; opportunity_id?: string | undefined },
    path: string,
  ) => {
    if (row.contact_id !== undefined && !contactIds.has(row.contact_id)) {
      issues.push(issue('DANGLING_REF', `${path}.contact_id`, `Unknown contact ${row.contact_id}`));
    }
    if (row.opportunity_id !== undefined && !opportunityIds.has(row.opportunity_id)) {
      issues.push(
        issue(
          'DANGLING_REF',
          `${path}.opportunity_id`,
          `Unknown opportunity ${row.opportunity_id}`,
        ),
      );
    }
    if (row.contact_id === undefined && row.opportunity_id === undefined) {
      issues.push(issue('NO_TARGET', path, 'Needs a contact_id or an opportunity_id'));
    }
  };

  collections.notes.forEach((note, index) => {
    const path = `initial_account_state.notes.${index}`;
    checkTarget(note, path);
    checkUser(note.author_id, `${path}.author_id`);
    if (note.at !== undefined) {
      try {
        instant(note.at);
      } catch {
        issues.push(issue('INVALID_TIME', `${path}.at`, `Not an instant: ${note.at}`));
      }
    }
  });

  collections.tasks.forEach((task, index) => {
    const path = `initial_account_state.tasks.${index}`;
    checkTarget(task, path);
    checkUser(task.assigned_to, `${path}.assigned_to`);
    if (task.due_at !== undefined) {
      try {
        instant(task.due_at);
      } catch {
        issues.push(issue('INVALID_TIME', `${path}.due_at`, `Not an instant: ${task.due_at}`));
      }
    }
  });

  collections.appointments.forEach((appointment, index) => {
    const path = `initial_account_state.appointments.${index}`;
    if (!contactIds.has(appointment.contact_id)) {
      issues.push(issue('DANGLING_REF', path, `Unknown contact ${appointment.contact_id}`));
    }
    if (!calendarIds.has(appointment.calendar_id)) {
      issues.push(issue('DANGLING_REF', path, `Unknown calendar ${appointment.calendar_id}`));
    }
    try {
      instant(appointment.starts_at);
    } catch {
      issues.push(issue('INVALID_TIME', path, `Not an instant: ${appointment.starts_at}`));
    }
  });

  collections.opportunities.forEach((opportunity, index) => {
    const ownerPath = `initial_account_state.opportunities.${index}`;
    checkUser(opportunity.owner_id, `${ownerPath}.owner_id`);
    checkFieldValues(opportunity.custom_fields, 'opportunity', `${ownerPath}.custom_fields`);
    const path = `initial_account_state.opportunities.${index}`;
    if (!contactIds.has(opportunity.contact_id)) {
      issues.push(issue('DANGLING_REF', path, `Unknown contact ${opportunity.contact_id}`));
    }
    const pipeline = pipelines.get(opportunity.pipeline_id);
    if (!pipeline) {
      issues.push(issue('DANGLING_REF', path, `Unknown pipeline ${opportunity.pipeline_id}`));
    } else if (!pipeline.stages.includes(opportunity.stage)) {
      issues.push(issue('UNKNOWN_STAGE', path, `No stage "${opportunity.stage}"`));
    }
  });

  const featureIds = features ? new Map(features.map((feature) => [feature.id, feature])) : null;
  const checkFeature = (id: string | undefined, path: string) => {
    if (!id || !featureIds) return;
    const feature = featureIds.get(id);
    if (!feature) {
      issues.push(issue('UNKNOWN_FEATURE', path, `No GHL feature ${id} in the registry`));
    } else if (feature.fidelity === 'REAL_GHL') {
      // REAL_GHL is practised in the real product, never simulated as if it were native.
      issues.push(issue('REAL_GHL_FEATURE', path, `${id} is REAL_GHL and cannot be simulated`));
    }
  };

  collections.workflows.forEach((workflow, index) => {
    const path = `initial_account_state.workflows.${index}`;
    checkFeature(workflow.trigger?.ghl_feature_id, `${path}.trigger`);
    const nodeIds = workflow.nodes.map((node) => node.id);
    for (const id of duplicates(nodeIds)) {
      issues.push(issue('DUPLICATE_NODE', `${path}.nodes`, `Duplicate node id ${id}`));
    }
    const known = new Set(nodeIds);
    workflow.nodes.forEach((node, nodeIndex) => {
      if (node.type !== 'end' && !node.ghl_feature_id) {
        issues.push(
          issue('MISSING_FEATURE', `${path}.nodes.${nodeIndex}`, `${node.id} needs a feature`),
        );
      }
      checkFeature(node.ghl_feature_id, `${path}.nodes.${nodeIndex}`);
    });
    (workflow.edges ?? []).forEach((edge, edgeIndex) => {
      if (!known.has(edge.from)) {
        issues.push(
          issue('DANGLING_EDGE', `${path}.edges.${edgeIndex}`, `Unknown node ${edge.from}`),
        );
      }
      if (!known.has(edge.to)) {
        issues.push(
          issue('DANGLING_EDGE', `${path}.edges.${edgeIndex}`, `Unknown node ${edge.to}`),
        );
      }
    });
    if (workflow.settings?.timezone && !isValidTimeZone(workflow.settings.timezone)) {
      issues.push(issue('INVALID_TIMEZONE', `${path}.settings`, 'Unknown timezone'));
    }
  });

  const entities = {
    contact_id: contactIds,
    calendar_id: calendarIds,
    appointment_id: new Set(collections.appointments.map((row) => row.id)),
    opportunity_id: new Set(collections.opportunities.map((row) => row.id)),
    form_id: new Set(collections.forms.map((row) => row.id)),
    survey_id: new Set(collections.surveys.map((row) => row.id)),
    workflow_id: new Set(collections.workflows.map((row) => row.id)),
    pipeline_id: new Set(pipelines.keys()),
    product_id: new Set(collections.products.map((row) => row.id)),
    user_id: userIds,
    owner_id: userIds,
    assigned_to: userIds,
    author_id: userIds,
    task_id: new Set(collections.tasks.map((row) => row.id)),
    note_id: new Set(collections.notes.map((row) => row.id)),
  };

  const checkEvent = (event: ScenarioScheduledEvent | ScenarioInjectableEvent, path: string) => {
    const type = resolveEventType(event.type);
    if (!type) {
      issues.push(issue('UNKNOWN_EVENT_TYPE', path, `${event.type} is not a simulator event`));
      return;
    }
    for (const [field, known] of Object.entries(entities)) {
      const value = event.payload?.[field];
      // A form submission legitimately names a contact that does not exist yet: that is what
      // creates it. Every other reference must already resolve.
      if (field === 'contact_id' && (type === 'FORM_SUBMITTED' || type === 'SURVEY_SUBMITTED')) {
        continue;
      }
      // An event that creates the entity it names must not find it already there.
      if (typeof value === 'string' && !known.has(value) && !CREATES[type]?.includes(field)) {
        issues.push(issue('DANGLING_REF', `${path}.payload.${field}`, `Unknown ${field} ${value}`));
      }
    }
  };

  (scenario.scheduled_events ?? []).forEach((event, index) => {
    const path = `scheduled_events.${index}`;
    try {
      instant(event.at);
    } catch {
      issues.push(issue('INVALID_TIME', path, `Not an instant: ${event.at}`));
    }
    checkEvent(event, path);
  });

  (scenario.injectable_events ?? []).forEach((event, index) => {
    checkEvent(event, `injectable_events.${index}`);
  });
  for (const id of duplicates((scenario.injectable_events ?? []).map((event) => event.id))) {
    issues.push(issue('DUPLICATE_ID', 'injectable_events', `Duplicate action id ${id}`));
  }

  return issues;
}

/** Fields an event type is allowed to name before the entity exists, because it creates it. */
const CREATES: Partial<Record<SimulatorEventType, string[]>> = {
  CONTACT_CREATED: ['contact_id'],
  APPOINTMENT_BOOKED: ['appointment_id'],
  OPPORTUNITY_CREATED: ['opportunity_id'],
  PAYMENT_RECEIVED: ['payment_id'],
  PAYMENT_FAILED: ['payment_id'],
  PIPELINE_CREATED: ['pipeline_id'],
  NOTE_ADDED: ['note_id'],
  TASK_CREATED: ['task_id'],
};

/** Accepts either the authored dotted name or the catalogue type itself. */
export const resolveEventType = (name: string): SimulatorEventType | null =>
  isSimulatorEventType(name) ? name : eventTypeFromContent(name);

/** Throws unless the scenario is runnable, with every issue in the error's detail. */
export function assertRunnableScenario(
  scenario: SimulatorScenario,
  features?: readonly FeatureRecord[],
): void {
  const issues = validateScenario(scenario, features);
  if (issues.length > 0) {
    throw new SimulatorError(
      'INVALID_SCENARIO',
      `Scenario ${scenario.id} cannot be run: ${issues.length} problem(s)`,
      { scenario_id: scenario.id, issues },
    );
  }
}

/**
 * A note or a task authored against an opportunity inherits that deal's contact, exactly as the
 * `NOTE_ADDED` and `TASK_CREATED` reducers do, so a record seeded by a scenario and one created
 * by a learner have the same shape (D-091).
 */
const contactOfOpportunity = (
  state: ScenarioAccountState,
  opportunityId: string | undefined,
): string | null =>
  (opportunityId
    ? (state.opportunities ?? []).find((row) => row.id === opportunityId)?.contact_id
    : null) ?? null;

const resolveNoteContact = (state: ScenarioAccountState, note: ScenarioNote): string | null =>
  contactOfOpportunity(state, note.opportunity_id);

const resolveTaskContact = (state: ScenarioAccountState, task: ScenarioTask): string | null =>
  contactOfOpportunity(state, task.opportunity_id);

const index = <T extends { id: string }, R>(
  rows: readonly T[] | undefined,
  make: (row: T) => R,
): Record<string, R> => Object.fromEntries((rows ?? []).map((row) => [row.id, make(row)] as const));

/** Compiles an authored scenario into the account the run starts from. */
export function initialAccount(scenario: SimulatorScenario): AccountState {
  const state = scenario.initial_account_state ?? {};
  const at = toZone(scenario.simulation_time, scenario.timezone);
  const contacts: Record<string, Contact> = index(state.contacts, (contact) => ({
    id: contact.id,
    first_name: contact.first_name,
    last_name: contact.last_name ?? null,
    email: contact.email ?? null,
    phone: contact.phone ?? null,
    tags: [...(contact.tags ?? [])],
    custom_fields: { ...(contact.custom_fields ?? {}) },
    dnd: contact.dnd ?? false,
    timezone: contact.timezone ?? null,
    source: contact.source ?? null,
    company_id: null,
    owner_id: contact.owner_id ?? null,
    created_at: at,
    updated_at: at,
  }));

  const workflows: Record<string, Workflow> = index(state.workflows, (workflow) => ({
    id: workflow.id,
    name: workflow.name,
    trigger: {
      ghl_feature_id: workflow.trigger.ghl_feature_id,
      filters: (workflow.trigger.filters ?? []).map((filter) => ({ ...filter })),
    },
    nodes: workflow.nodes.map((node) => ({
      id: node.id,
      type: node.type,
      ghl_feature_id: node.ghl_feature_id ?? null,
      label: node.label ?? null,
      config: { ...(node.config ?? {}) },
      position: { ...node.position },
    })),
    edges: (workflow.edges ?? []).map((edge) => ({
      from: edge.from,
      to: edge.to,
      branch: edge.branch ?? null,
    })),
    settings: {
      allow_reentry: workflow.settings?.allow_reentry ?? false,
      timezone: workflow.settings?.timezone ?? null,
      notes: workflow.settings?.notes ?? null,
    },
  }));

  return {
    account: { id: scenario.id, name: scenario.title ?? scenario.id, timezone: scenario.timezone },
    users: index(state.users, (user) => ({
      id: user.id,
      name: user.name,
      role: user.role ?? 'user',
    })),
    contacts,
    companies: {},
    tags: [...(state.tags ?? [])],
    custom_fields: Object.fromEntries(
      (state.custom_fields ?? []).map((field) => [
        field.key,
        {
          key: field.key,
          label: field.label,
          type: field.type,
          object: field.object ?? 'contact',
          options: field.options ? [...field.options] : null,
        },
      ]),
    ),
    custom_values: Object.fromEntries(
      (state.custom_values ?? []).map((value) => [value.key, value.value]),
    ),
    pipelines: index(state.pipelines, (pipeline) => ({
      id: pipeline.id,
      name: pipeline.name,
      stages: [...pipeline.stages],
    })),
    opportunities: index(state.opportunities, (opportunity) => ({
      id: opportunity.id,
      name: opportunity.name ?? opportunity.id,
      contact_id: opportunity.contact_id,
      pipeline_id: opportunity.pipeline_id,
      stage: opportunity.stage,
      value: opportunity.value ?? 0,
      status: opportunity.status ?? ('open' as const),
      // A deal with no author-given owner starts on the contact's owner, the same rule the
      // creation event follows, so a scenario and a learner produce the same shape (D-089).
      owner_id:
        opportunity.owner_id ??
        (state.contacts ?? []).find((row) => row.id === opportunity.contact_id)?.owner_id ??
        null,
      custom_fields: { ...(opportunity.custom_fields ?? {}) },
      created_at: at,
      updated_at: at,
    })),
    calendars: index(state.calendars, (calendar) => ({
      id: calendar.id,
      name: calendar.name,
      duration_minutes: calendar.duration_minutes,
      timezone: calendar.timezone ?? null,
    })),
    appointments: index(state.appointments, (appointment) => ({
      id: appointment.id,
      contact_id: appointment.contact_id,
      calendar_id: appointment.calendar_id,
      starts_at: toZone(appointment.starts_at, scenario.timezone),
      status: appointment.status ?? 'booked',
      created_at: at,
      updated_at: at,
    })),
    forms: index(state.forms, (form) => ({
      id: form.id,
      name: form.name,
      fields: [...form.fields],
    })),
    surveys: index(state.surveys, (survey) => ({
      id: survey.id,
      name: survey.name,
      fields: [...survey.fields],
    })),
    products: index(state.products, (product) => ({
      id: product.id,
      name: product.name,
      price: product.price,
      recurring: product.recurring ?? false,
    })),
    payments: {},
    conversations: {},
    workflows,
    workflow_runs: {},
    tasks: index(state.tasks, (task) => ({
      id: task.id,
      contact_id: task.contact_id ?? resolveTaskContact(state, task),
      opportunity_id: task.opportunity_id ?? null,
      title: task.title,
      description: task.description ?? null,
      due_at: task.due_at ? toZone(task.due_at, scenario.timezone) : null,
      completed: task.completed ?? false,
      completed_at: task.completed ? at : null,
      assigned_to: task.assigned_to ?? null,
      created_at: at,
      updated_at: at,
    })),
    notes: index(state.notes, (note) => ({
      id: note.id,
      contact_id: note.contact_id ?? resolveNoteContact(state, note),
      opportunity_id: note.opportunity_id ?? null,
      body: note.body,
      author_id: note.author_id ?? null,
      at: note.at ? toZone(note.at, scenario.timezone) : at,
    })),
    analytics: { ...EMPTY_ANALYTICS },
  };
}

/** The scenario's authored queue, in the engine's own ordering. */
export function initialQueue(scenario: SimulatorScenario, runId: string): ScheduledEvent[] {
  return (scenario.scheduled_events ?? [])
    .map((event, index_) => {
      const type = resolveEventType(event.type);
      if (!type) {
        fail('UNKNOWN_EVENT_TYPE', `${event.type} is not a simulator event`, { type: event.type });
      }
      return {
        id: `sc-${runId}-${index_}`,
        at: toZone(event.at, scenario.timezone),
        sequence: index_,
        type: type as SimulatorEventType,
        payload: { ...(event.payload ?? {}) },
        origin: 'scenario' as const,
        source: { kind: 'scheduled' as const, id: `sc-${runId}-${index_}` },
        description: event.description ?? null,
      };
    })
    .sort(compareScheduled);
}

/**
 * A run at its authored beginning: the compiled account, the scenario's clock, its queue, its
 * seed, and empty history. `reset` returns exactly here (SIM-018), and the scenario object is
 * never mutated to get there.
 */
export function initialState(scenario: SimulatorScenario, runId: string): SimulatorState {
  return {
    version: SIMULATOR_VERSION,
    run_id: runId,
    scenario_id: scenario.id,
    clock: {
      now: toZone(scenario.simulation_time, scenario.timezone),
      timezone: scenario.timezone,
    },
    account: initialAccount(scenario),
    queue: initialQueue(scenario, runId),
    log: [],
    execution: [],
    random: createRandomState(scenario.seed),
    sequence: 0,
    queue_sequence: (scenario.scheduled_events ?? []).length,
    diagnostics: [],
  };
}
