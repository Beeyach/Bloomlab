import type { SimulatorEvent } from './events.ts';
import type { ExecutionRecord } from './execution.ts';
import type { RandomState } from './random.ts';
import type { ScheduledEvent } from './scheduler.ts';

/**
 * One simulated GoHighLevel account (spec §41, §43; SIM-001, SIM-004).
 *
 * There is exactly one of these. The CRM Lab, Workflow Lab, Funnel Lab, Calendar Lab,
 * Conversations, Payments and Reporting all read and write this same account rather than each
 * inventing its own — which is what lets a form submission create a contact, fire a workflow,
 * open an opportunity, send a message, book an appointment and move a report.
 *
 * Collections are id-addressed so references stay explicit and a dangling one is detectable.
 * Domains Phase 10 does not yet transition still exist here, empty and typed, so the Labs above
 * extend this account instead of adding a second one later.
 */

export interface Account {
  id: string;
  name: string;
  /** The account's own zone. A calendar or contact may override it; nothing reads the device. */
  timezone: string;
}

export interface User {
  id: string;
  name: string;
  role: 'admin' | 'user';
}

export interface Contact {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  tags: string[];
  custom_fields: Record<string, string | number | boolean>;
  /** Do-not-disturb: a real GoHighLevel contact setting that suppresses outbound messaging. */
  dnd: boolean;
  timezone: string | null;
  source: string | null;
  company_id: string | null;
  /**
   * The user who owns this contact — GoHighLevel's Contact Owner, called Assigned User on the
   * creation form. A reference into `users`, never a name copied onto the record, so renaming a
   * user does not leave stale names behind (D-089).
   */
  owner_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Company {
  id: string;
  name: string;
}

export const CUSTOM_FIELD_TYPES = [
  'text',
  'number',
  'date',
  'checkbox',
  'dropdown',
  'phone',
  'email',
] as const;

export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number];

export interface CustomField {
  key: string;
  label: string;
  type: CustomFieldType;
  object: 'contact' | 'opportunity';
  /**
   * The choices a `dropdown` offers. Required for that type and refused for every other, because
   * a dropdown with no options is a field the learner cannot actually fill in (D-090).
   */
  options: string[] | null;
}

export interface Pipeline {
  id: string;
  name: string;
  stages: string[];
}

export const OPPORTUNITY_STATUSES = ['open', 'won', 'lost', 'abandoned'] as const;

export type OpportunityStatus = (typeof OPPORTUNITY_STATUSES)[number];

export interface Opportunity {
  id: string;
  /** What the deal is called. GoHighLevel names an opportunity; it is not just its contact. */
  name: string;
  contact_id: string;
  pipeline_id: string;
  stage: string;
  value: number;
  status: OpportunityStatus;
  /**
   * The user who owns this deal. Allowed to differ from the contact's owner, which is what
   * "Allow different owners for contacts and its opportunities" turns on in a real sub-account;
   * a new opportunity starts with the contact's owner and can then be changed (D-089).
   */
  owner_id: string | null;
  /** Values for custom fields whose `object` is `opportunity`. */
  custom_fields: Record<string, string | number | boolean>;
  created_at: string;
  updated_at: string;
}

export interface Calendar {
  id: string;
  name: string;
  duration_minutes: number;
  timezone: string | null;
}

export type AppointmentStatus = 'booked' | 'confirmed' | 'cancelled' | 'showed' | 'no_show';

export interface Appointment {
  id: string;
  contact_id: string;
  calendar_id: string;
  starts_at: string;
  status: AppointmentStatus;
  created_at: string;
  updated_at: string;
}

export interface Form {
  id: string;
  name: string;
  fields: string[];
}

export interface Survey {
  id: string;
  name: string;
  fields: string[];
}

export interface Product {
  id: string;
  name: string;
  price: number;
  recurring: boolean;
}

/* ---- funnels (FUN-001, spec §56) ------------------------------------------------------- */

/**
 * A funnel is a native GoHighLevel object (Sites → Funnels): an ordered set of steps a visitor
 * moves through. What Bloomlab simulates is the **conversion architecture** of one — the steps,
 * what each step is for, what is on each step in what order, and which real account entity a
 * capture element uses. It is not a page builder: there is no styling, no layout, no pixel
 * position anywhere below, and none is coming.
 *
 * `purpose` and `role` are Bloomlab's own vocabulary for the job a step or a block does. They are
 * architecture abstractions, not GoHighLevel controls, and the interface says so. The four roles
 * that carry a `reference_id` are the ones that name a real account entity — a form, a survey, a
 * calendar, a product — and those are native features under their registry records.
 */

/** What a step is for. A Bloomlab abstraction; HighLevel does not label steps this way. */
export const FUNNEL_STEP_PURPOSES = [
  'capture',
  'offer',
  'booking',
  'checkout',
  'confirmation',
  'content',
] as const;
export type FunnelStepPurpose = (typeof FUNNEL_STEP_PURPOSES)[number];

/** The conversion job one block does. Also a Bloomlab abstraction. */
export const FUNNEL_BLOCK_ROLES = [
  'headline',
  'problem',
  'outcome',
  'proof',
  'benefits',
  'objections',
  'cta',
  'form',
  'survey',
  'calendar',
  'checkout',
] as const;
export type FunnelBlockRole = (typeof FUNNEL_BLOCK_ROLES)[number];

/**
 * The roles that use a real account entity, and which collection each one names. A block of any
 * other role references nothing: it is words on a page and the simulation treats it as such.
 */
export const FUNNEL_BLOCK_REFERENCES = {
  form: 'forms',
  survey: 'surveys',
  calendar: 'calendars',
  checkout: 'products',
} as const;
export type FunnelReferencingRole = keyof typeof FUNNEL_BLOCK_REFERENCES;

export const isReferencingRole = (role: FunnelBlockRole): role is FunnelReferencingRole =>
  role in FUNNEL_BLOCK_REFERENCES;

export interface FunnelBlock {
  id: string;
  role: FunnelBlockRole;
  /** The learner's own words for this block. Content, not styling. */
  headline: string | null;
  body: string | null;
  /** The account entity this block uses, for the four roles that use one; null when unset. */
  reference_id: string | null;
  /** For a `cta`: the step it sends the visitor to. Null means the step's own `next_step_id`. */
  target_step_id: string | null;
}

export interface FunnelStep {
  id: string;
  name: string;
  purpose: FunnelStepPurpose;
  /** In reading order, which is the order the visitor meets them. */
  blocks: FunnelBlock[];
  /** Where a completed step sends the visitor. Null ends the funnel. */
  next_step_id: string | null;
}

/**
 * One funnel, versioned exactly the way a workflow definition is (D-104): a save bumps the
 * version, so a grade or a run that read version 2 still says so once the learner is on version 5.
 */
export interface Funnel {
  id: string;
  name: string;
  steps: FunnelStep[];
  version: number;
}

export interface Payment {
  id: string;
  contact_id: string;
  product_id: string | null;
  amount: number;
  status: 'received' | 'failed' | 'refunded';
  /** Why a payment failed, as a token the interface turns into words. */
  reason: string | null;
  at: string;
}

export type MessageChannel = 'sms' | 'email';
export type MessageDirection = 'outbound' | 'inbound';

export interface Message {
  id: string;
  channel: MessageChannel;
  direction: MessageDirection;
  body: string;
  subject: string | null;
  at: string;
  /** Set when a workflow node sent it, so the timeline can attribute the message. */
  workflow_id: string | null;
  node_id: string | null;
  opened_at: string | null;
}

/** One contact's message history, in the order the run produced it. */
export interface Conversation {
  id: string;
  contact_id: string;
  messages: Message[];
  last_message_at: string | null;
}

export type WorkflowRunStatus = 'active' | 'waiting' | 'completed' | 'exited' | 'failed';

/** The wait types the simulator runs (registry GHL-WF-WAIT, fidelity B; D-100). */
export const WAIT_KINDS = ['period', 'date', 'appointment', 'reply', 'condition'] as const;
export type WaitKind = (typeof WAIT_KINDS)[number];

/**
 * What a parked run is waiting for (WFL-008). Plain data: it survives `structuredClone`,
 * IndexedDB, sync, a snapshot, replay and a Worker transfer. `token` is the one identity a wake
 * must present — a wake carrying an older token (the run has since moved on or exited) is stale
 * and is recorded as such rather than resuming anything.
 */
export interface WorkflowWait {
  node_id: string;
  kind: WaitKind;
  /** Simulator instant the run wakes at, for time-based waits and for the timeout of the others. */
  wake_at: string | null;
  /** Why the wake is scheduled: the wait's own instant, or a timeout on an event/condition wait. */
  wake_reason: 'due' | 'timeout' | null;
  /** The appointment an appointment-relative wait measured against. */
  appointment_id: string | null;
  /** For a reply wait: which channel releases it. */
  reply_channel: 'sms' | 'email' | 'any' | null;
  /** For a condition wait: the condition groups re-evaluated when the contact changes. */
  condition: ConditionGroup[] | null;
  token: string;
  started_at: string;
}

/** What enrolled the contact, so appointment-relative waits and merge values have a subject. */
export interface WorkflowRunContext {
  trigger_event_id: string | null;
  appointment_id: string | null;
  opportunity_id: string | null;
  form_id: string | null;
  message_id: string | null;
}

/**
 * One contact's passage through one workflow. Phase 10 recorded enrolment, step completion and
 * exit as history; Phase 12 walks the contact from node to node (D-101), so a run now also
 * carries what it is waiting for, what enrolled it, and which version of the definition it ran.
 */
export interface WorkflowRun {
  id: string;
  workflow_id: string;
  contact_id: string;
  status: WorkflowRunStatus;
  current_node_id: string | null;
  completed_node_ids: string[];
  enrolled_at: string;
  /** A machine token (`goal_met`, `removed`, `completed`), never a sentence. */
  exit_reason: string | null;
  exited_at: string | null;
  wait: WorkflowWait | null;
  context: WorkflowRunContext;
  /**
   * The definition this run executed against: its version number and the hash of its behaviour
   * at enrolment (D-104). A later edit to the workflow bumps the version, so history stays
   * readable as history rather than looking like it ran through nodes that did not exist yet.
   */
  definition_version: number;
  definition_hash: string;
}

/** One comparison inside an If/Else or a condition wait (WFL-009). Data, never an expression. */
export interface Condition {
  /** A dotted address into the run's context: `contact.phone`, `contact.tags`, `appointment.status`. */
  field: string;
  operator: ConditionOperator;
  /** Static, or a merge value such as `{{contact.first_name}}` resolved at evaluation. */
  value?: string | number | boolean;
}

export const CONDITION_OPERATORS = [
  'is',
  'is_not',
  'contains',
  'not_contains',
  'exists',
  'not_exists',
  'gt',
  'lt',
] as const;
export type ConditionOperator = (typeof CONDITION_OPERATORS)[number];

/** Conditions inside a group are ANDed; groups inside a branch are ORed (registry GHL-WF-IF-ELSE). */
export interface ConditionGroup {
  conditions: Condition[];
}

/** One named path out of an If/Else. Evaluated top-down; the first that matches wins. */
export interface BranchDefinition {
  name: string;
  groups: ConditionGroup[];
}

/**
 * A learner-facing "send only during these hours" rule (D-102). Modelled after HighLevel's
 * workflow time window: an outbound message that falls outside the window is held until the
 * window next opens, in the workflow's zone. Days use ISO numbering (1 = Monday … 7 = Sunday).
 */
export interface TimeWindow {
  days: number[];
  /** `HH:MM` in the workflow's zone. */
  start: string;
  end: string;
}

/**
 * What a note or a task is attached to (D-091).
 *
 * HighLevel puts both on a contact, an opportunity or a company. Bloomlab models the first two
 * and keeps them as two nullable references rather than one polymorphic id, so a record attached
 * to an opportunity can still be read from its contact's history without a join table, and so
 * companies can be added later by adding a third column rather than reshaping every row.
 * At least one reference is always set; the reducers refuse a record attached to nothing.
 */
export interface CrmTarget {
  contact_id: string | null;
  opportunity_id: string | null;
}

export interface Task extends CrmTarget {
  id: string;
  title: string;
  description: string | null;
  /** Simulator time, never the device clock. */
  due_at: string | null;
  completed: boolean;
  completed_at: string | null;
  /** A user in the account. */
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
}

/** Internal only: a note is context for the team and never reaches the contact. */
export interface Note extends CrmTarget {
  id: string;
  body: string;
  /** Who wrote it, when the account knows. */
  author_id: string | null;
  at: string;
}

/**
 * Counters reporting reads (REP-001). Derived from what actually happened in the run — there is
 * no invented analytics anywhere in Bloomlab.
 */
export interface Analytics {
  contacts_created: number;
  forms_submitted: number;
  surveys_submitted: number;
  appointments_booked: number;
  appointments_cancelled: number;
  appointments_showed: number;
  appointments_no_show: number;
  messages_sent: number;
  messages_received: number;
  emails_opened: number;
  opportunities_created: number;
  payments_received: number;
  payments_failed: number;
  refunds_issued: number;
  revenue: number;
}

/** A workflow as data (SIM-016). Layout lives in `position` and never reaches behaviour. */
export interface WorkflowNode {
  id: string;
  type: 'action' | 'wait' | 'branch' | 'goal' | 'end';
  ghl_feature_id: string | null;
  label: string | null;
  config: Record<string, unknown>;
  position: { x: number; y: number };
}

export interface WorkflowEdge {
  from: string;
  to: string;
  branch: string | null;
}

export interface WorkflowTriggerFilter {
  field: string;
  operator: 'is' | 'is_not' | 'contains' | 'exists' | 'not_exists' | 'gt' | 'lt';
  value?: string | number | boolean;
}

export interface WorkflowSettings {
  allow_reentry: boolean;
  timezone: string | null;
  notes: string | null;
  /** Business-hours rule for outbound messages; null means send any time (D-102). */
  time_window: TimeWindow | null;
}

export interface Workflow {
  id: string;
  name: string;
  trigger: { ghl_feature_id: string; filters: WorkflowTriggerFilter[] };
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  settings: WorkflowSettings;
  /** Bumped by every definition edit, so a run can say which version it executed (D-104). */
  version: number;
}

export interface AccountState {
  account: Account;
  users: Record<string, User>;
  contacts: Record<string, Contact>;
  companies: Record<string, Company>;
  /** The account's tag vocabulary; a contact's tags reference it. */
  tags: string[];
  custom_fields: Record<string, CustomField>;
  custom_values: Record<string, string>;
  pipelines: Record<string, Pipeline>;
  opportunities: Record<string, Opportunity>;
  calendars: Record<string, Calendar>;
  appointments: Record<string, Appointment>;
  forms: Record<string, Form>;
  surveys: Record<string, Survey>;
  products: Record<string, Product>;
  payments: Record<string, Payment>;
  /** The funnels the account holds, learner-built or authored by the scenario (FUN-001). */
  funnels: Record<string, Funnel>;
  conversations: Record<string, Conversation>;
  workflows: Record<string, Workflow>;
  workflow_runs: Record<string, WorkflowRun>;
  tasks: Record<string, Task>;
  notes: Record<string, Note>;
  analytics: Analytics;
}

/** A refusal the engine recorded rather than a throw: kept so a scenario can be debugged. */
export interface SimulatorDiagnostic {
  at: string;
  code: string;
  message: string;
  detail: Record<string, unknown>;
}

/**
 * Everything one run is: the shared account, the clock, what is queued, what has happened, what
 * the execution produced, and the generator's position. Plain data throughout — no class
 * instances, no DOM nodes, nothing that would not survive `structuredClone` — so the whole state
 * can be persisted, replayed and, in Phase 12, moved into a Web Worker unchanged (SIM-014).
 */
export interface SimulatorState {
  /** The engine that produced this run (SIM-019). */
  version: string;
  run_id: string;
  scenario_id: string;
  clock: { now: string; timezone: string };
  account: AccountState;
  queue: ScheduledEvent[];
  /** Authoritative history. Entries are never rewritten after they are appended. */
  log: SimulatorEvent[];
  execution: ExecutionRecord[];
  random: RandomState;
  /** The next sequence number for an event or execution record. */
  sequence: number;
  /**
   * The next insertion number for a queued entry. Deliberately separate from `sequence`: queuing
   * something is not history, so it must not shift the identity of the events around it, or a
   * replay — which never re-queues — would mint different event ids than the live run (D-079).
   */
  queue_sequence: number;
  diagnostics: SimulatorDiagnostic[];
}

export const EMPTY_ANALYTICS: Analytics = {
  contacts_created: 0,
  forms_submitted: 0,
  surveys_submitted: 0,
  appointments_booked: 0,
  appointments_cancelled: 0,
  appointments_showed: 0,
  appointments_no_show: 0,
  messages_sent: 0,
  messages_received: 0,
  emails_opened: 0,
  opportunities_created: 0,
  payments_received: 0,
  payments_failed: 0,
  refunds_issued: 0,
  revenue: 0,
};
