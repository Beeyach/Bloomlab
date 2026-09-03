import { initialState, type SimulatorScenario } from './scenario.ts';
import type { SimulatorState } from './state.ts';

/**
 * Reset (SIM-018). The run returns to the state the scenario authored: the initial account, the
 * scenario's clock, its queue as written, its seed at position zero, and no history at all.
 *
 * Nothing here mutates the scenario. `initialState` compiles a fresh account from the authored
 * data every time it is called, and the content object the app loaded is a separate, untouched
 * structure — a reset that damaged the content would break every other run of that scenario.
 *
 * Reset is deliberate: it is the caller's explicit act, never something the engine does to
 * recover from a bad event.
 */
export const resetRun = (scenario: SimulatorScenario, runId: string): SimulatorState =>
  initialState(scenario, runId);

/** True when a run stands exactly where the scenario starts it. */
export const isAtInitialState = (state: SimulatorState): boolean =>
  state.log.length === 0 && state.execution.length === 0 && state.random.draws === 0;
