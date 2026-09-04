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

/**
 * One contact's passage through one workflow. Phase 10 records enrolment, step completion and
 * exit as history; Phase 12's Workflow Lab is what actually walks a contact from node to node.
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

export interface Workflow {
  id: string;
  name: string;
  trigger: { ghl_feature_id: string; filters: WorkflowTriggerFilter[] };
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  settings: { allow_reentry: boolean; timezone: string | null; notes: string | null };
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
