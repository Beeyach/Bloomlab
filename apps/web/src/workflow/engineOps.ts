import {
  advance,
  advanceTo,
  injectAction,
  isSimulatorError,
  nextEvent,
  processEvent,
  type PendingEvent,
  type SimulatorErrorCode,
  type SimulatorScenario,
  type SimulatorState,
  type TimeMachineStep,
} from '@bloomlab/simulator-core';

/**
 * The operations the Workflow Lab may ask the engine to perform (SIM-014, D-109).
 *
 * This file is the one place that names them, and the one function that runs them, and it is
 * plain data in and plain data out: it is imported by the Web Worker and by the direct fallback
 * alike, so the two paths cannot disagree — parity is by construction, and the parity test proves
 * it by hashing both results. Nothing here touches React, storage or the DOM.
 */

export type EngineOp =
  | { kind: 'process'; event: PendingEvent }
  | { kind: 'advance'; step: TimeMachineStep }
  | { kind: 'advance_to'; at: string }
  | { kind: 'next_event' }
  | { kind: 'inject_action'; action_id: string; overrides?: Record<string, unknown> }
  /** Several operations as one unit: all of them apply or none does. */
  | { kind: 'batch'; ops: EngineOp[] };

/** What the engine refused, in a shape that crosses a worker boundary intact. */
export interface EngineRefusal {
  code: SimulatorErrorCode | 'ENGINE_CRASHED' | 'ENGINE_TIMEOUT' | 'UNEXPECTED';
  message: string;
  detail: Record<string, unknown>;
}

export interface EngineStats {
  /** Milliseconds the pure computation took, measured where it ran. */
  compute_ms: number;
  events_added: number;
  records_added: number;
}

export type EngineOutcome =
  { ok: true; state: SimulatorState; stats: EngineStats } | { ok: false; refusal: EngineRefusal };

function apply(state: SimulatorState, scenario: SimulatorScenario, op: EngineOp): SimulatorState {
  switch (op.kind) {
    case 'process':
      return processEvent(state, op.event);
    case 'advance':
      return advance(state, op.step);
    case 'advance_to':
      return advanceTo(state, op.at);
    case 'next_event':
      return nextEvent(state);
    case 'inject_action':
      return injectAction(state, scenario, op.action_id, op.overrides ?? {});
    case 'batch':
      return op.ops.reduce((current, next) => apply(current, scenario, next), state);
  }
}

/**
 * Runs one operation against a state. A refusal comes back as data, never as a thrown error,
 * because on the worker side a throw would be a crash and on the main side it would be a leak of
 * the engine's exception type into a screen.
 */
export function runOp(
  state: SimulatorState,
  scenario: SimulatorScenario,
  op: EngineOp,
  now: () => number = () => (typeof performance !== 'undefined' ? performance.now() : 0),
): EngineOutcome {
  const started = now();
  try {
    const next = apply(state, scenario, op);
    return {
      ok: true,
      state: next,
      stats: {
        compute_ms: Math.max(0, now() - started),
        events_added: next.log.length - state.log.length,
        records_added: next.execution.length - state.execution.length,
      },
    };
  } catch (error) {
    if (isSimulatorError(error)) {
      return {
        ok: false,
        refusal: { code: error.code, message: error.message, detail: error.detail },
      };
    }
    return {
      ok: false,
      refusal: {
        code: 'UNEXPECTED',
        message: error instanceof Error ? error.message : String(error),
        detail: {},
      },
    };
  }
}

/* ---- the worker protocol ------------------------------------------------------------- */

export interface EngineRequest {
  id: number;
  state: SimulatorState;
  scenario: SimulatorScenario;
  op: EngineOp;
}

export type EngineResponse = { id: number } & EngineOutcome;

/** What the worker does with a request. Exported so the parity test can call it without a thread. */
export function handleEngineRequest(request: EngineRequest): EngineResponse {
  return { id: request.id, ...runOp(request.state, request.scenario, request.op) };
}
