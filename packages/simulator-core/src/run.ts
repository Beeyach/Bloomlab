import { applyEvent } from './apply.ts';
import { SimulatorError, fail } from './errors.ts';
import {
  assertPendingEvent,
  type PendingEvent,
  type SimulatorEvent,
  type SimulatorEventType,
} from './events.ts';
import { executionRecord, type ExecutionDraft, type ExecutionRecord } from './execution.ts';
import {
  initialState,
  resolveEventType,
  type ScenarioInjectableEvent,
  type SimulatorScenario,
} from './scenario.ts';
import { compareScheduled, partitionDue, peek, type ScheduledEvent } from './scheduler.ts';
import type { SimulatorDiagnostic, SimulatorState } from './state.ts';
import { workflowReactions } from './workflow/reactions.ts';
import { addDays, addHours, addMinutes, instant, isAfter, toZone } from './time.ts';

/**
 * The run: one shared account, one clock, one queue, one history.
 *
 * Every event enters through `processEvent`, whether the scenario queued it, the learner injected
 * it, the clock produced it, or a reducer generated it. There is no second route into the state,
 * so a generated event is logged, ordered, recorded and replayed exactly like any other
 * (SIM-003).
 */

/**
 * Cascade protection (SIM-003). A malformed scenario or, later, a workflow that re-triggers
 * itself must not hang the browser. One operation may process this many events before the engine
 * refuses; the refusal is explicit and carries the trail that caused it, because a silently
 * dropped event would hide exactly the bug a learner is meant to find (D-078).
 */
export const MAX_EVENTS_PER_OPERATION = 500;

export interface RunOptions {
  /** Stable run identity. Two runs of one scenario are two runs; ids are never random here. */
  run_id?: string;
}

export const createRun = (scenario: SimulatorScenario, options: RunOptions = {}): SimulatorState =>
  initialState(scenario, options.run_id ?? `run-${scenario.id}`);

const eventId = (runId: string, sequence: number) => `ev-${runId}-${sequence}`;

function mint(state: SimulatorState, pending: PendingEvent): SimulatorEvent {
  return {
    id: eventId(state.run_id, state.sequence),
    type: pending.type,
    at: toZone(pending.at, state.clock.timezone),
    sequence: state.sequence,
    payload: { ...pending.payload },
    origin: pending.origin,
    source: pending.source ?? null,
    run_id: state.run_id,
    scenario_id: state.scenario_id,
  };
}

const diagnostic = (at: string, error: SimulatorError): SimulatorDiagnostic => ({
  at,
  code: error.code,
  message: error.message,
  detail: error.detail,
});

/**
 * Processes one event and everything it generates, breadth-first so a consequence never overtakes
 * a sibling. The state handed in is never mutated: each step builds the next state from the last.
 */
export function processEvent(state: SimulatorState, pending: PendingEvent): SimulatorState {
  assertPendingEvent(pending);
  let current = state;
  const frontier: PendingEvent[] = [pending];
  let processed = 0;

  while (frontier.length > 0) {
    const next = frontier.shift() as PendingEvent;
    assertPendingEvent(next);
    processed += 1;
    if (processed > MAX_EVENTS_PER_OPERATION) {
      throw new SimulatorError(
        'CASCADE_LIMIT',
        `One operation produced more than ${MAX_EVENTS_PER_OPERATION} events`,
        {
          limit: MAX_EVENTS_PER_OPERATION,
          started_with: pending.type,
          pending: next.type,
          run_id: current.run_id,
          at: current.clock.now,
        },
      );
    }

    const event = mint(current, next);
    // History is appended before the reducer runs, so an event that then fails is still visible
    // in the log that produced the failure.
    const log = [...current.log, event];
    const outcome = applyEvent(current.account, event, current);

    let sequence = current.sequence + 1;
    // An event a workflow step caused carries its attribution in the payload; every record that
    // event produces inherits it, so a timeline can answer "which step sent this" for records a
    // domain reducer wrote without knowing about workflows (WFL-010).
    const records: ExecutionRecord[] = outcome.records.map((draft) => {
      const record = executionRecord(current.run_id, sequence, attributed(draft, event));
      sequence += 1;
      return record;
    });

    // Wakes a reducer asked for enter the queue here, with ids from the queue sequence, so a
    // replay's reducer queues the very same entry (D-101). Wakes it no longer wants are dropped.
    const dropped = new Set(outcome.unschedule ?? []);
    let queue = dropped.size
      ? current.queue.filter((entry) => !dropped.has(String(entry.payload.resume_token ?? '')))
      : current.queue;
    let queueSequence = current.queue_sequence;
    for (const draft of outcome.scheduled ?? []) {
      const at = toZone(draft.at, current.clock.timezone);
      if (instant(at) < instant(event.at)) {
        fail('INVALID_TIME', `Cannot schedule ${draft.type} before the event that scheduled it`, {
          at,
          now: event.at,
        });
      }
      const id = `sc-${current.run_id}-${queueSequence}`;
      queue = [
        ...queue,
        {
          id,
          at,
          sequence: queueSequence,
          type: draft.type,
          payload: { ...draft.payload },
          origin: 'scheduled' as const,
          source: { kind: 'scheduled' as const, id },
          description: draft.description ?? null,
        },
      ].sort(compareScheduled);
      queueSequence += 1;
    }

    current = {
      ...current,
      account: outcome.account,
      log,
      execution: [...current.execution, ...records],
      sequence,
      queue,
      queue_sequence: queueSequence,
    };
    frontier.push(...outcome.generated);
    // The account's workflows react to what just happened: triggers fire and waits release, as
    // generated events after this event's own consequences (WFL-010).
    frontier.push(...workflowReactions(event, current.account, current));
  }

  return current;
}

/**
 * Processes an event, keeping the run alive if it refuses. The refusal is recorded as a
 * diagnostic rather than swallowed: history is never quietly repaired, and the harness shows
 * exactly what the engine would not do.
 */
export function tryProcessEvent(
  state: SimulatorState,
  pending: PendingEvent,
): { state: SimulatorState; error: SimulatorError | null } {
  try {
    return { state: processEvent(state, pending), error: null };
  } catch (error) {
    if (!(error instanceof SimulatorError)) throw error;
    return {
      state: {
        ...state,
        diagnostics: [...state.diagnostics, diagnostic(state.clock.now, error)],
      },
      error,
    };
  }
}

/** Queues a future event. Scheduling into the past is refused rather than run immediately. */
export function schedule(
  state: SimulatorState,
  entry: {
    at: string;
    type: SimulatorEventType;
    payload?: Record<string, unknown>;
    description?: string;
    source?: ScheduledEvent['source'];
  },
): SimulatorState {
  const at = toZone(entry.at, state.clock.timezone);
  if (instant(at) < instant(state.clock.now)) {
    fail('INVALID_TIME', `Cannot schedule ${entry.type} before the current simulator time`, {
      at,
      now: state.clock.now,
    });
  }
  const scheduled: ScheduledEvent = {
    id: `sc-${state.run_id}-${state.queue_sequence}`,
    at,
    sequence: state.queue_sequence,
    type: entry.type,
    payload: { ...(entry.payload ?? {}) },
    origin: 'scenario',
    source: entry.source ?? null,
    description: entry.description ?? null,
  };
  return {
    ...state,
    queue: [...state.queue, scheduled].sort(compareScheduled),
    queue_sequence: state.queue_sequence + 1,
  };
}

/** Runs one queued entry: the clock moves to it, then it goes through the one processing path. */
function runScheduled(state: SimulatorState, entry: ScheduledEvent): SimulatorState {
  const moved: SimulatorState = {
    ...state,
    clock: { ...state.clock, now: entry.at },
    queue: state.queue.filter((candidate) => candidate.id !== entry.id),
  };
  const { state: next } = tryProcessEvent(moved, {
    type: entry.type,
    at: entry.at,
    payload: entry.payload,
    origin: entry.origin,
    source: entry.source ?? { kind: 'scheduled', id: entry.id },
  });
  return next;
}

/**
 * Moves the clock to `target`, running everything due on the way in queue order, including
 * anything those events schedule before the target. The run finishes exactly at the target.
 */
export function advanceTo(state: SimulatorState, target: string): SimulatorState {
  const at = toZone(target, state.clock.timezone);
  if (isAfter(state.clock.now, at)) {
    fail('INVALID_TIME', 'The simulator clock does not run backwards', {
      now: state.clock.now,
      target: at,
    });
  }
  let current = state;
  let guard = 0;
  for (;;) {
    const { due } = partitionDue(current.queue, at);
    const entry = due[0];
    if (!entry) break;
    guard += 1;
    if (guard > MAX_EVENTS_PER_OPERATION) {
      throw new SimulatorError(
        'CASCADE_LIMIT',
        `Advancing to ${at} ran more than ${MAX_EVENTS_PER_OPERATION} scheduled events`,
        { limit: MAX_EVENTS_PER_OPERATION, target: at, run_id: current.run_id },
      );
    }
    current = runScheduled(current, entry);
  }

  const landed: SimulatorState = { ...current, clock: { ...current.clock, now: at } };
  const { state: next } = tryProcessEvent(landed, {
    type: 'TIME_ADVANCED',
    at,
    payload: { from: state.clock.now, to: at },
    origin: 'clock',
    source: { kind: 'time_machine', id: 'advance' },
  });
  return next;
}

/** The Time Machine's fixed steps (spec §46, SIM-007). A day is a calendar day in the run's zone. */
export const TIME_MACHINE_STEPS = ['minute', 'hour', 'day'] as const;
export type TimeMachineStep = (typeof TIME_MACHINE_STEPS)[number];

export function advance(state: SimulatorState, step: TimeMachineStep): SimulatorState {
  const zone = state.clock.timezone;
  const target =
    step === 'minute'
      ? addMinutes(state.clock.now, 1, zone)
      : step === 'hour'
        ? addHours(state.clock.now, 1, zone)
        : addDays(state.clock.now, 1, zone);
  return advanceTo(state, target);
}

/** The entry Next Event would run, or `null` when nothing is queued. */
export const nextScheduled = (state: SimulatorState): ScheduledEvent | null => peek(state.queue);

/**
 * Next Event: move to the earliest queued entry and run it, together with the consequences it
 * generates at that same instant. Other entries sharing the timestamp stay queued, so stepping
 * through a run shows one cause at a time. With nothing queued the clock does not move.
 */
export function nextEvent(state: SimulatorState): SimulatorState {
  const entry = nextScheduled(state);
  if (!entry) return state;
  return runScheduled(state, entry);
}

/** An injectable action, resolved from the scenario the run was created from (SIM-009). */
export interface InjectableAction {
  id: string;
  type: SimulatorEventType;
  description: string;
  payload: Record<string, unknown>;
}

/**
 * What this scenario allows to be injected. The engine can express far more events than any one
 * scenario should offer, so the scenario — not the interface — decides what a learner may do.
 */
export function allowedActions(scenario: SimulatorScenario): InjectableAction[] {
  return (scenario.injectable_events ?? []).map((action: ScenarioInjectableEvent) => {
    const type = resolveEventType(action.type);
    if (!type) {
      fail('UNKNOWN_EVENT_TYPE', `Injectable action ${action.id} names ${action.type}`, {
        action: action.id,
        type: action.type,
      });
    }
    return {
      id: action.id,
      type: type as SimulatorEventType,
      description: action.description,
      payload: { ...(action.payload ?? {}) },
    };
  });
}

/**
 * Injects one of the scenario's allowed actions at the current simulator time. An action the
 * scenario does not offer is refused, and a malformed payload fails rather than being coerced
 * into something that happens to work.
 */
export function injectAction(
  state: SimulatorState,
  scenario: SimulatorScenario,
  actionId: string,
  overrides: Record<string, unknown> = {},
): SimulatorState {
  const action = allowedActions(scenario).find((candidate) => candidate.id === actionId);
  if (!action) {
    fail('ACTION_NOT_ALLOWED', `Scenario ${scenario.id} does not offer the action ${actionId}`, {
      action: actionId,
      offered: (scenario.injectable_events ?? []).map((candidate) => candidate.id),
    });
  }
  const allowed = action as InjectableAction;
  const payload = resolveRelativeTimes(
    { ...allowed.payload, ...overrides },
    state.clock.now,
    state.clock.timezone,
  );
  return processEvent(state, {
    type: allowed.type,
    at: state.clock.now,
    payload,
    origin: 'injected',
    source: { kind: 'injector_action', id: allowed.id },
  });
}

/**
 * A scenario may author an action relative to whenever it is used ("books 40 minutes from now"),
 * which is the only way a fixed authored instant would otherwise be wrong. The relative field is
 * resolved against the *simulator* clock, never the wall clock.
 */
function resolveRelativeTimes(
  payload: Record<string, unknown>,
  now: string,
  timeZone: string,
): Record<string, unknown> {
  const { minutes_from_now: minutes, hours_from_now: hours, ...rest } = payload;
  if (typeof minutes === 'number') {
    return { ...rest, starts_at: addMinutes(now, minutes, timeZone) };
  }
  if (typeof hours === 'number') {
    return { ...rest, starts_at: addHours(now, hours, timeZone) };
  }
  return payload;
}

const attributed = (draft: ExecutionDraft, event: SimulatorEvent): ExecutionDraft => {
  const payload = event.payload;
  const pick = (key: 'workflow_id' | 'workflow_run_id' | 'node_id') =>
    typeof payload[key] === 'string' ? (payload[key] as string) : null;
  return {
    ...draft,
    workflow_id: draft.workflow_id ?? pick('workflow_id'),
    workflow_run_id: draft.workflow_run_id ?? pick('workflow_run_id'),
    node_id: draft.node_id ?? pick('node_id'),
  };
};
