import { buildReport, type Report, type SimulatorState } from '@bloomlab/simulator-core';
import type { SimulatorScenario } from '@bloomlab/simulator-core';

import type { StoredRun } from '../simulator/store';
import { execute, type ExecutionOptions, type ExecutionResult } from '../workflow/execution';

/**
 * Running the reporting window, and reading the report off a run (REP-001, D-144).
 *
 * A scenario that carries three weeks of history carries it as queued events rather than as
 * totals in its starting state. Nothing has happened until the run's own clock reaches them —
 * which is the honest position, and it also makes the report's empty state real rather than a
 * special case somebody remembered to write.
 *
 * So the Reporting Lab offers one action: move the clock to the end of what is queued. That is
 * ordinary simulator machinery, through the same execution door every other Lab commits through,
 * so it is logged, persisted, replayable and undone by a reset. Nothing here writes to the
 * account and there is no hidden mutation.
 */

/** The last instant anything is queued for, or null when the run has nothing left to run. */
export function windowEnd(state: SimulatorState): string | null {
  if (state.queue.length === 0) return null;
  return state.queue.reduce(
    (latest, entry) => (entry.at > latest ? entry.at : latest),
    state.queue[0]?.at as string,
  );
}

/** How much of the authored history has not happened yet. */
export const pendingCount = (state: SimulatorState): number => state.queue.length;

/**
 * Moves the run to the end of its queued history, through the engine door. Returns null when
 * there is nothing queued, so a caller never asks the engine to do nothing.
 */
export function runWindow(
  run: StoredRun,
  scenario: SimulatorScenario,
  options?: ExecutionOptions,
): Promise<ExecutionResult> | null {
  const end = windowEnd(run.state);
  if (!end) return null;
  return execute(run, scenario, { kind: 'advance_to', at: end }, options);
}

/** The report for a saved run. Derived every time; never stored, never cached as truth. */
export const reportFor = (run: StoredRun): Report => buildReport(run.state);
