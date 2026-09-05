/**
 * `@bloomlab/simulator-core` — the deterministic GoHighLevel simulation engine (spec §41–§48,
 * SIM-001 … SIM-019).
 *
 *   State + Event + Configuration → Transition → New State + Generated Events + Execution Records
 *
 * Pure TypeScript. No React, no DOM, no IndexedDB or Dexie, no Cloudflare, no fetch, no network,
 * no Claude, no browser globals, no `Math.random()`, no `Date.now()` and no reading of the user's
 * timezone. React displays what this produces; it never decides what the simulation does, and
 * persistence adapters live outside the package.
 *
 * There is one simulated account. Every Lab above this — CRM, Workflow, Funnel, Calendar,
 * Conversations, Payments, Reporting — shares it rather than inventing its own.
 */

export { SIMULATOR_VERSION } from './version.ts';

export {
  SIMULATOR_ERROR_CODES,
  SimulatorError,
  isSimulatorError,
  type SimulatorErrorCode,
} from './errors.ts';

export {
  CONTENT_EVENT_NAMES,
  EVENT_ORIGINS,
  SIMULATOR_EVENT_TYPES,
  assertPendingEvent,
  contentEventName,
  eventTypeFromContent,
  isSimulatorEventType,
  type EventOrigin,
  type EventPayload,
  type EventSource,
  type PendingEvent,
  type SimulatorEvent,
  type SimulatorEventType,
} from './events.ts';

export {
  EXECUTION_KINDS,
  executionRecord,
  type ExecutionDraft,
  type ExecutionKind,
  type ExecutionRecord,
} from './execution.ts';

export {
  ASSIGNMENT_STRATEGIES,
  CALENDAR_TYPES,
  CUSTOM_FIELD_TYPES,
  EMPTY_ANALYTICS,
  EXTERNAL_FAILURE_KINDS,
  FUNNEL_REACH_LEVELS,
  FUNNEL_VISIT_ENDINGS,
  LOCATION_KINDS,
  OPPORTUNITY_STATUSES,
  type Account,
  type AccountState,
  type Analytics,
  type Appointment,
  type AppointmentStatus,
  type AssignmentStrategy,
  type AvailabilityWindow,
  type BookedBy,
  type Calendar,
  type CalendarBookingRules,
  type CalendarLocation,
  type CalendarService,
  type CalendarType,
  type LocationKind,
  type Company,
  type Contact,
  type Conversation,
  type CrmTarget,
  type CustomField,
  type CustomFieldType,
  type ExternalEndpoint,
  type ExternalFailureKind,
  type Form,
  type FunnelReachLevel,
  type FunnelStepView,
  type FunnelVisit,
  type FunnelVisitEnding,
  FUNNEL_BLOCK_REFERENCES,
  FUNNEL_BLOCK_ROLES,
  FUNNEL_STEP_PURPOSES,
  isReferencingRole,
  type Funnel,
  type FunnelBlock,
  type FunnelBlockRole,
  type FunnelReferencingRole,
  type FunnelStep,
  type FunnelStepPurpose,
  type Message,
  type MessageChannel,
  type MessageDirection,
  type Note,
  type Opportunity,
  type OpportunityStatus,
  type Payment,
  type Pipeline,
  type Product,
  type SimulatorDiagnostic,
  type SimulatorState,
  type Survey,
  type Task,
  type User,
  type Workflow,
  type WorkflowEdge,
  type WorkflowNode,
  type WorkflowRun,
  type WorkflowRunStatus,
  type WorkflowTriggerFilter,
  CONDITION_OPERATORS,
  WAIT_KINDS,
  type BranchDefinition,
  type Condition,
  type ConditionGroup,
  type ConditionOperator,
  type TimeWindow,
  type WaitKind,
  type WorkflowRunContext,
  type WorkflowSettings,
  type WorkflowWait,
} from './state.ts';

export {
  RUNNABLE_FEATURES,
  actionCapabilityFor,
  capabilityFor,
  triggerCapabilityFor,
  type ActionCapability,
  type Capability,
  type TriggerCapability,
  type TriggerFilterField,
  type TriggerMatch,
} from './workflow/capabilities.ts';
export {
  CONDITION_FIELDS,
  chooseBranch,
  customFieldConditionFields,
  evaluateCondition,
  isConditionField,
  readBranches,
  readField,
  type BranchChoice,
  type ConditionEvaluation,
} from './workflow/conditions.ts';
export {
  entryNodes,
  isRunnable,
  outgoing,
  validateWorkflowGraph,
  type GraphIssue,
} from './workflow/graph.ts';
export {
  mergeDate,
  mergeTime,
  mergeValue,
  renderTemplate,
  type Rendered,
} from './workflow/merge.ts';
export { nextWindowOpening, readTimeWindow, withinWindow } from './workflow/timewindow.ts';
export {
  subjectAppointment,
  subjectOpportunity,
  viewFor,
  workflowZone,
  type RunView,
} from './workflow/view.ts';
export { MAX_NODE_VISITS_PER_RUN, waitToken } from './workflow/traverse.ts';
export { answerFor, endpointFor, readHeaders, type WebhookAnswer } from './workflow/endpoints.ts';
export { arrivingContacts, workflowReactions } from './workflow/reactions.ts';
export { readDefinition } from './reducers/definitions.ts';
export { MAX_ENROLMENTS_IN_ONE_CHAIN } from './reducers/workflows.ts';
export { readFunnel } from './reducers/funnels.ts';
export {
  firstStep,
  isWalkable,
  reachableSteps,
  readingOrder,
  stepAfter,
  stepOf,
  validateFunnel,
  type FunnelIssue,
  type FunnelPosition,
} from './funnel/graph.ts';
export {
  METRIC_DEFINITIONS,
  METRIC_IDS,
  REPORT_ORDER,
  type MetricBasis,
  type MetricDefinition,
  type MetricId,
  type MetricUnit,
} from './reporting/definitions.ts';
export {
  mean,
  median,
  metric,
  rate,
  type MetricInput,
  type MetricStatus,
  type MetricValue,
} from './reporting/provenance.ts';
export {
  buildReport,
  definitionOf,
  type AppointmentCohort,
  type ContactSpeed,
  type Report,
  type SourceRow,
  type StageRow,
} from './reporting/report.ts';
export {
  BOOKING_DENOMINATOR,
  funnelAutopsy,
  funnelsWithTraffic,
  type AutopsyDropOffRow,
  type AutopsyRate,
  type AutopsyReachRow,
  type AutopsySourceRow,
  type FunnelAutopsy,
} from './reporting/funnelAutopsy.ts';
export { identifyVisit } from './reducers/funnelVisits.ts';
export {
  SLOT_COUNT,
  bookableSlots,
  canCreateContact,
  visitorActions,
  type VisitAction,
} from './funnel/visit.ts';
export { readCalendar } from './reducers/calendars.ts';
export {
  MAX_BOOKING_WINDOW_DAYS,
  bookableSlots as calendarSlots,
  calendarDay,
  calendarZone,
  candidateStaff,
  earliestStart,
  isoWeekday,
  locationFor,
  serviceOf,
  slotAt,
  slotsForCalendar,
  type Slot,
  type SlotQuery,
} from './calendar/availability.ts';
export { assignHost, type Assignment, type AssignmentReason } from './calendar/assignment.ts';
export {
  isBookableDefinition,
  minutesOfDay,
  serviceDuration,
  validateCalendar,
  type CalendarIssue,
  type CalendarIssueCode,
} from './calendar/validation.ts';

export {
  MINUTE_MS,
  HOUR_MS,
  addDays,
  addHours,
  addMinutes,
  formatInstant,
  hasOffset,
  instant,
  instantForDay,
  isAfter,
  isBeforeOrAt,
  isValidTimeZone,
  minutesBetween,
  offsetInstant,
  partsIn,
  toZone,
  type ZonedParts,
} from './time.ts';

export {
  assertRandomState,
  createRandomState,
  nextChance,
  nextInt,
  nextRandom,
  type RandomState,
} from './random.ts';

export { compareScheduled, enqueue, partitionDue, peek, type ScheduledEvent } from './scheduler.ts';

export { REDUCED_EVENT_TYPES, applyEvent } from './apply.ts';
export type { Reducer, ReducerResult } from './reducers/shared.ts';

export {
  assertRunnableScenario,
  initialAccount,
  initialQueue,
  initialState,
  resolveEventType,
  validateScenario,
  type FeatureRecord,
  type ScenarioAccountState,
  type ScenarioContact,
  type ScenarioExternalEndpoint,
  type ScenarioFunnel,
  type ScenarioFunnelBlock,
  type ScenarioFunnelStep,
  type ScenarioInjectableEvent,
  type ScenarioIssue,
  type ScenarioNote,
  type ScenarioTask,
  type ScenarioUser,
  type ScenarioScheduledEvent,
  type ScenarioWorkflow,
  type ScenarioWorkflowNode,
  type SimulatorScenario,
} from './scenario.ts';

export {
  MAX_EVENTS_PER_OPERATION,
  TIME_MACHINE_STEPS,
  advance,
  advanceTo,
  allowedActions,
  createRun,
  injectAction,
  nextEvent,
  nextScheduled,
  processEvent,
  schedule,
  tryProcessEvent,
  type InjectableAction,
  type RunOptions,
  type TimeMachineStep,
} from './run.ts';

export {
  CHECKPOINT_EVERY,
  assertCheckpoint,
  checkpoint,
  maybeCheckpoint,
  nearestCheckpoint,
  type Checkpoint,
} from './snapshot.ts';

export {
  isRootEvent,
  replay,
  replayMatches,
  rewind,
  rootEvents,
  type ReplayOptions,
} from './replay.ts';
export { isAtInitialState, resetRun } from './reset.ts';
export { canonical, fnv1a, historyHash, stateHash } from './hash.ts';
export {
  behaviouralWorkflow,
  workflowsAreBehaviourallyEqual,
  type BehaviouralWorkflow,
} from './workflow.ts';
