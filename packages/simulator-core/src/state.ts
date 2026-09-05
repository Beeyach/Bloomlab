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

/* ---- calendars (CAL-001, spec §44) ------------------------------------------------------ */

/**
 * The calendar families Bloomlab simulates. HighLevel also ships Class Booking, Collective,
 * Group and Event calendars; those are practised in GHL and named as omissions in the registry
 * rather than approximated here (registry GHL-CAL-CALENDARS).
 */
export const CALENDAR_TYPES = ['personal', 'round_robin', 'service'] as const;
export type CalendarType = (typeof CALENDAR_TYPES)[number];

/**
 * How a calendar picks the host for a booking.
 *
 * `single` is a personal calendar's one team member. The other two carry HighLevel's own names
 * for its round-robin distribution methods, because the simulated rule is close enough to teach
 * them: Optimize for Availability hands the booking to the next available member, Optimize for
 * Equal Distribution hands it to the member with the fewest bookings that month. The nuance
 * HighLevel adds to the second — temporarily limiting a member who runs too far ahead — is not
 * simulated and the registry says so (D-127).
 */
export const ASSIGNMENT_STRATEGIES = ['single', 'optimize_availability', 'optimize_equal'] as const;
export type AssignmentStrategy = (typeof ASSIGNMENT_STRATEGIES)[number];

/**
 * One weekly working window, in the calendar's own zone. ISO weekday numbering (1 = Monday …
 * 7 = Sunday), the same numbering the workflow time window uses. `HH:MM` wall-clock times rather
 * than instants, because a working day is a wall-clock fact: 09:00 stays 09:00 across a
 * daylight-saving change, which is what a business actually means by "we open at nine".
 */
export interface AvailabilityWindow {
  day: number;
  start: string;
  end: string;
}

/**
 * Where the meeting happens. HighLevel's booking pages offer an address, a phone number, a Zoom
 * or Google Meet link, a custom value, or asking the booker — the same list, with the two
 * integration-generated links simulated as a stored link rather than a real conferencing call.
 */
export const LOCATION_KINDS = [
  'address',
  'phone',
  'zoom',
  'google_meet',
  'custom',
  'ask_booker',
] as const;
export type LocationKind = (typeof LOCATION_KINDS)[number];

export interface CalendarLocation {
  id: string;
  kind: LocationKind;
  /** What the booker is given. Null only for `ask_booker`, which the booker fills in. */
  value: string | null;
}

/**
 * One service on a service calendar. A service is behaviour, not a label: it can set its own
 * duration, narrow the staff who may take it, and carry its own location into the booking.
 */
export interface CalendarService {
  id: string;
  name: string;
  /** Overrides the calendar's duration when set. */
  duration_minutes: number | null;
  /** Users eligible for this service. Empty means every team member on the calendar. */
  staff_ids: string[];
  /** The location this service is delivered at. Null uses the calendar's default. */
  location_id: string | null;
}

/**
 * What the person who booked may do afterwards — HighLevel's "Allow Cancellation of Meeting" and
 * "Allow Rescheduling of Meeting", with the cutoff that expires those links before the
 * appointment.
 */
export interface CalendarBookingRules {
  cancellation_allowed: boolean;
  reschedule_allowed: boolean;
  /** Hours before the start after which the booker can no longer change it. Null never expires. */
  change_cutoff_hours: number | null;
}

/**
 * A calendar as configuration (CAL-001, D-126). Everything an availability answer depends on is
 * here as plain data: no Date objects, no formatted labels, no component state. The engine in
 * `calendar/` is the only thing that turns it into bookable times, and both the Calendar Lab and
 * the Funnel Lab ask that engine rather than each holding a rule of their own (D-129).
 */
export interface Calendar {
  id: string;
  name: string;
  type: CalendarType;
  timezone: string | null;
  /** How long one appointment is, unless the chosen service says otherwise. */
  duration_minutes: number;
  /** Minutes between the starts of consecutive offered slots — HighLevel's Slot Interval. */
  slot_interval_minutes: number;
  pre_buffer_minutes: number;
  post_buffer_minutes: number;
  /** HighLevel's Minimum Scheduling Notice, in minutes so an hour rule and a day rule are one field. */
  minimum_notice_minutes: number;
  /** How far ahead the calendar offers times, in days. */
  booking_window_days: number;
  availability: AvailabilityWindow[];
  /** The team members who host on this calendar, in the order the learner arranged them. */
  staff_ids: string[];
  assignment: AssignmentStrategy;
  /** Round robin only: the booker may name a host instead of taking the assignment. */
  staff_selection: boolean;
  services: CalendarService[];
  locations: CalendarLocation[];
  default_location_id: string | null;
  booking: CalendarBookingRules;
  /** Bumped by every saved edit, exactly as a workflow and a funnel are (D-104). */
  version: number;
}

export type AppointmentStatus = 'booked' | 'confirmed' | 'cancelled' | 'showed' | 'no_show';

/** Who made the booking. HighLevel's Customer Booked Appointment trigger only fires for the first. */
export type BookedBy = 'customer' | 'staff';

/**
 * One booking. The fields after `starts_at` are the booking's own history: the calendar can be
 * re-configured afterwards and this appointment does not move or change length, because what it
 * was booked for is recorded on it rather than looked up later (D-128).
 */
export interface Appointment {
  id: string;
  contact_id: string;
  calendar_id: string;
  starts_at: string;
  /** The length booked, snapshotted. A later calendar edit never rewrites an existing booking. */
  duration_minutes: number;
  /**
   * The team member hosting it. A different concept from the contact's owner and the
   * opportunity's owner, which is why it is its own reference: they may name the same user and
   * they mean different things (D-130).
   */
  host_id: string | null;
  service_id: string | null;
  location_id: string | null;
  booked_by: BookedBy;
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

/* ---- funnel visit telemetry (FUN-004, EXR-010) ------------------------------------------ */

/**
 * How far down one funnel step a visitor got, as an ordered semantic scale.
 *
 * Bloomlab does not model pixels, viewports or a scroll heatmap, and is not going to: a funnel
 * here is conversion architecture, so "how far did they get" is answered in the funnel's own
 * units — the ordered blocks on the step. `top` is the first block only, `bottom` is the last
 * block reached, `middle` is everything between. `blocks_seen` keeps the raw count beside it so
 * the reach is inspectable rather than a bare label (D-137).
 */
export const FUNNEL_REACH_LEVELS = ['top', 'middle', 'bottom'] as const;
export type FunnelReachLevel = (typeof FUNNEL_REACH_LEVELS)[number];

/** One step of one visit: when the visitor arrived and how far down they got. */
export interface FunnelStepView {
  step_id: string;
  at: string;
  reach: FunnelReachLevel;
  blocks_seen: number;
}

/** How a visit finished. `left` is a drop-off; `completed` reached the end of the funnel. */
export const FUNNEL_VISIT_ENDINGS = ['left', 'completed'] as const;
export type FunnelVisitEnding = (typeof FUNNEL_VISIT_ENDINGS)[number];

/**
 * One visitor's passage through one funnel (FUN-004, EXR-010).
 *
 * This is simulated visitor behaviour — the fictional traffic a funnel received — and never the
 * learner's own browser. It records only what a visit is: where it came from, which steps it met,
 * how far down each it got, whether a form was started, who it turned out to be, and where it
 * stopped. What the visit *achieved* is not duplicated here: a submission, a booking and a
 * payment are already `FORM_SUBMITTED`, `APPOINTMENT_BOOKED` and `PAYMENT_RECEIVED`, and the
 * projection joins them by the `visit_id` those events carry (D-136).
 */
export interface FunnelVisit {
  id: string;
  funnel_id: string;
  /**
   * Where the visit came from, as a recorded fact. Unknown stays Unknown: nothing here guesses
   * an attribution from text nobody recorded (D-138).
   */
  source: string;
  started_at: string;
  /** The steps met, in the order they were met. */
  steps: FunnelStepView[];
  /** Block ids the visitor began filling in. A start is not a submission. */
  forms_started: string[];
  /** Who the visit turned out to be, once a submission identified them. */
  contact_id: string | null;
  /** True when the account had no such contact before this visit identified them. */
  contact_is_new: boolean;
  ended_at: string | null;
  ended_reason: FunnelVisitEnding | null;
  /** The step the visit was on when it ended, or is on now. */
  last_step_id: string | null;
}

/* ---- external endpoints (SIM-011) -------------------------------------------------------- */

/** Why an accepted call still failed. `auth` is the caller's problem; the rest are the service's. */
export const EXTERNAL_FAILURE_KINDS = ['auth', 'server_error', 'unavailable', 'timeout'] as const;
export type ExternalFailureKind = (typeof EXTERNAL_FAILURE_KINDS)[number];

/**
 * What one outside service does when a workflow's Webhook action calls it (SIM-011, D-139).
 *
 * Bloomlab makes no request: there is no network in the simulator and there is not going to be
 * one. This is the scenario's own deterministic answer for a named URL, so a learner can tell
 * "my credentials are wrong" from "the service is down" without either being a real outage. It
 * is training simulation, not a HighLevel field, and the interface says so wherever it is shown.
 *
 * Matching is on the whole URL. A substring rule would make one endpoint silently answer for
 * another, which is exactly the kind of invisible behaviour a troubleshooting phase must not add.
 */
export interface ExternalEndpoint {
  id: string;
  /** The exact URL that reaches this service. */
  url: string;
  /** What it requires before it accepts a call at all. Null accepts any caller. */
  auth: { header: string; token: string } | null;
  /** The status a healthy, accepted call gets back. */
  ok_status: number;
  /** The status a call with missing or wrong credentials gets back. */
  unauthorized_status: number;
  /** When set, the service itself is failing and every accepted call gets this instead. */
  outage: { status: number; kind: Exclude<ExternalFailureKind, 'auth'> } | null;
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
  /** Simulated visitor traffic through those funnels (FUN-004, EXR-010). */
  funnel_visits: Record<string, FunnelVisit>;
  /** What each named outside service answers a Webhook action with (SIM-011). */
  external_endpoints: Record<string, ExternalEndpoint>;
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
