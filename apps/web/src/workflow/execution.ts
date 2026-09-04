import type { SimulatorScenario } from '@bloomlab/simulator-core';

import { db, type BloomlabDatabase } from '../data/db';
import { commitRun, type StoredRun } from '../simulator/store';
import {
  runOp,
  type EngineOp,
  type EngineOutcome,
  type EngineRefusal,
  type EngineRequest,
  type EngineResponse,
  type EngineStats,
} from './engineOps';

/**
 * The one door to the engine for the Workflow Lab (SIM-014, D-109).
 *
 * Every execution — a test contact enrolled, the clock moved, a reply injected — comes through
 * `execute`. It hands the operation to the Web Worker when the browser has one, falls back to
 * running the same pure function on the main thread when it does not (tests, old browsers), and
 * in both cases commits the result to storage **only after the engine has succeeded**. A refusal
 * or a crash leaves the saved run exactly as it was: the caller gets the untouched run back with
 * the reason, and nothing half-applied is ever written.
 *
 * The worker is stateless: each message carries the whole state and the answer carries the new
 * one, so the main thread stays the only owner of the run and a crashed worker loses nothing but
 * the one operation in flight. It is recreated on the next call.
 */

export type ExecutionMode = 'auto' | 'direct' | 'worker';

export interface ExecutionTiming extends EngineStats {
  /** Milliseconds from asking to receiving, as the main thread experienced it. */
  round_trip_ms: number;
  ran_in: 'worker' | 'main_thread';
}

export type ExecutionResult =
  | { ok: true; run: StoredRun; timing: ExecutionTiming }
  | { ok: false; run: StoredRun; refusal: EngineRefusal };

export interface ExecutionOptions {
  mode?: ExecutionMode;
  database?: BloomlabDatabase;
  /** How long the worker may take before the operation is treated as lost. */
  timeoutMs?: number;
  /** For tests: a worker factory, or null to force the direct path. */
  createWorker?: (() => Worker) | null;
}

const DEFAULT_TIMEOUT_MS = 30_000;

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/** True when this environment can run a module worker. */
export const workerSupported = (): boolean =>
  typeof Worker === 'function' && typeof window !== 'undefined' && !isTestEnvironment();

/** jsdom offers a `Worker` name without a thread behind it; the engine must not trust it. */
function isTestEnvironment(): boolean {
  const agent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  return /jsdom/i.test(agent);
}

const defaultFactory = (): Worker =>
  new Worker(new URL('./engine.worker.ts', import.meta.url), { type: 'module' });

/* ---- the worker, kept across calls ----------------------------------------------------- */

interface Pending {
  resolve: (response: EngineResponse) => void;
  reject: (reason: EngineRefusal) => void;
  timer: ReturnType<typeof setTimeout>;
}

class EngineWorker {
  private worker: Worker | null = null;
  private pending = new Map<number, Pending>();
  private next = 1;

  constructor(private readonly factory: () => Worker) {}

  private ensure(): Worker {
    if (this.worker) return this.worker;
    const worker = this.factory();
    worker.onmessage = (event: MessageEvent<EngineResponse>) => {
      const waiting = this.pending.get(event.data.id);
      if (!waiting) return;
      clearTimeout(waiting.timer);
      this.pending.delete(event.data.id);
      waiting.resolve(event.data);
    };
    worker.onerror = (event: ErrorEvent) => {
      this.crash({
        code: 'ENGINE_CRASHED',
        message: event.message || 'The simulator worker stopped unexpectedly.',
        detail: { filename: event.filename ?? null, lineno: event.lineno ?? null },
      });
    };
    this.worker = worker;
    return worker;
  }

  /** Fails everything in flight, drops the worker; the next call makes a fresh one. */
  private crash(refusal: EngineRefusal) {
    for (const waiting of this.pending.values()) {
      clearTimeout(waiting.timer);
      waiting.reject(refusal);
    }
    this.pending.clear();
    this.worker?.terminate();
    this.worker = null;
  }

  request(request: Omit<EngineRequest, 'id'>, timeoutMs: number): Promise<EngineResponse> {
    const id = this.next++;
    const worker = this.ensure();
    return new Promise<EngineResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.crash({
          code: 'ENGINE_TIMEOUT',
          message: `The simulator did not answer within ${Math.round(timeoutMs / 1000)} seconds.`,
          detail: { timeout_ms: timeoutMs, op: request.op.kind },
        });
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      try {
        worker.postMessage({ id, ...request } satisfies EngineRequest);
      } catch (error) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject({
          code: 'ENGINE_CRASHED',
          message:
            error instanceof Error ? error.message : 'The run could not be sent to the worker.',
          detail: {},
        });
      }
    });
  }
}

let shared: EngineWorker | null = null;

const workerFor = (factory: () => Worker): EngineWorker => {
  if (!shared) shared = new EngineWorker(factory);
  return shared;
};

/** For tests that swap the factory between cases. */
export function resetEngineWorker(): void {
  shared = null;
}

/* ---- execute ---------------------------------------------------------------------------- */

async function compute(
  run: StoredRun,
  scenario: SimulatorScenario,
  op: EngineOp,
  options: ExecutionOptions,
): Promise<{ outcome: EngineOutcome; ran_in: ExecutionTiming['ran_in'] }> {
  const mode = options.mode ?? 'auto';
  const factory =
    options.createWorker === null
      ? null
      : (options.createWorker ?? (workerSupported() ? defaultFactory : null));
  const useWorker = mode === 'worker' || (mode === 'auto' && factory !== null);
  if (useWorker && factory) {
    try {
      const response = await workerFor(factory).request(
        { state: run.state, scenario, op },
        options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      );
      const { id: _id, ...outcome } = response;
      return { outcome, ran_in: 'worker' };
    } catch (refusal) {
      return { outcome: { ok: false, refusal: refusal as EngineRefusal }, ran_in: 'worker' };
    }
  }
  if (useWorker && !factory) {
    return {
      outcome: {
        ok: false,
        refusal: {
          code: 'ENGINE_CRASHED',
          message: 'No worker is available here.',
          detail: {},
        },
      },
      ran_in: 'main_thread',
    };
  }
  return { outcome: runOp(run.state, scenario, op, now), ran_in: 'main_thread' };
}

/**
 * Runs one operation and, on success, persists the run. On any failure the run returned is the
 * one passed in — same object, same saved rows — so a screen that renders `result.run` cannot
 * show a half-applied change.
 */
export async function execute(
  run: StoredRun,
  scenario: SimulatorScenario,
  op: EngineOp,
  options: ExecutionOptions = {},
): Promise<ExecutionResult> {
  const started = now();
  const { outcome, ran_in } = await compute(run, scenario, op, options);
  if (!outcome.ok) return { ok: false, run, refusal: outcome.refusal };
  const saved = await commitRun({ ...run, state: outcome.state }, options.database ?? db);
  return {
    ok: true,
    run: saved,
    timing: { ...outcome.stats, round_trip_ms: Math.max(0, now() - started), ran_in },
  };
}
