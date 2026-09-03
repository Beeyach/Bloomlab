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
  EMPTY_ANALYTICS,
  type Account,
  type AccountState,
  type Analytics,
  type Appointment,
  type AppointmentStatus,
  type Calendar,
  type Company,
  type Contact,
  type Conversation,
  type CustomField,
  type Form,
  type Message,
  type MessageChannel,
  type MessageDirection,
  type Note,
  type Opportunity,
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
} from './state.ts';

export {
  MINUTE_MS,
  HOUR_MS,
  addDays,
  addHours,
  addMinutes,
  formatInstant,
  instant,
  isAfter,
  isBeforeOrAt,
  isValidTimeZone,
  minutesBetween,
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
  type ScenarioInjectableEvent,
  type ScenarioIssue,
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
