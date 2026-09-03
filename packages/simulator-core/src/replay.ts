import { SimulatorError } from './errors.ts';
import type { SimulatorEvent } from './events.ts';
import { historyHash } from './hash.ts';
import { processEvent } from './run.ts';
import { initialState, type SimulatorScenario } from './scenario.ts';
import { assertCheckpoint, nearestCheckpoint, type Checkpoint } from './snapshot.ts';
import type { SimulatorState } from './state.ts';

/**
 * Replay (SIM-013, SIM-018). Given the authored scenario and the run's event log, the engine
 * reconstructs the same run.
 *
 * Only *root* events are replayed — the ones the scenario queued, the learner injected, or the
 * clock produced. Anything a reducer generated is left out and produced again by the same
 * reducers, which is what guarantees a replay can never duplicate an event or invent a new id:
 * identity comes from the run and its sequence, and the sequence is rebuilt from zero.
 *
 * Because the generator's position is carried in the state and advanced only by draws, a replay
 * makes exactly the same draws in exactly the same order, so a seeded run replays to the same
 * outcome rather than to a new one.
 */

/** An event that entered the run from outside a reducer. */
export const isRootEvent = (event: SimulatorEvent): boolean => event.origin !== 'generated';

export const rootEvents = (log: readonly SimulatorEvent[]): SimulatorEvent[] =>
  log.filter(isRootEvent);

export interface ReplayOptions {
  /**
   * Stop once the reconstructed log holds this many events. Counts every event, generated ones
   * included, so an index taken from the live log means the same thing here.
   */
  to?: number;
  /** Checkpoints to restart from instead of replaying the whole run. */
  checkpoints?: readonly Checkpoint[];
  run_id?: string;
}

/**
 * Rebuilds the run. The live state is never touched: this returns a fresh state built from the
 * scenario, so replaying can never append to the run it is reproducing.
 */
export function replay(
  scenario: SimulatorScenario,
  log: readonly SimulatorEvent[],
  options: ReplayOptions = {},
): SimulatorState {
  const limit = options.to ?? log.length;
  const runId = options.run_id ?? log[0]?.run_id ?? `run-${scenario.id}`;

  let state = initialState(scenario, runId);
  let start = 0;

  const checkpoint = options.checkpoints ? nearestCheckpoint(options.checkpoints, limit) : null;
  if (checkpoint) {
    assertCheckpoint(checkpoint, runId);
    state = checkpoint.state;
    start = checkpoint.log_length;
  }

  for (const event of log.slice(start, limit)) {
    if (!isRootEvent(event)) continue;
    // The clock stands where the event happened; that is what made it happen then.
    state = { ...state, clock: { ...state.clock, now: event.at } };
    // A scenario event that fired is no longer queued.
    state = {
      ...state,
      queue: state.queue.filter(
        (entry) =>
          !(
            entry.type === event.type &&
            entry.at === event.at &&
            entry.sequence === queueSequence(event)
          ),
      ),
    };
    try {
      state = processEvent(state, {
        type: event.type,
        at: event.at,
        payload: event.payload,
        origin: event.origin,
        source: event.source,
      });
    } catch (error) {
      const detail = error instanceof SimulatorError ? error.detail : {};
      throw new SimulatorError(
        'REPLAY_FAILED',
        `Replay could not reproduce ${event.type} at ${event.at}`,
        {
          event_id: event.id,
          cause: error instanceof Error ? error.message : String(error),
          ...detail,
        },
      );
    }
    if (state.log.length >= limit) break;
  }

  return state;
}

/** A scheduled entry's sequence, recoverable from the id the run minted for it. */
function queueSequence(event: SimulatorEvent): number {
  const id = event.source?.id ?? '';
  const tail = id.slice(id.lastIndexOf('-') + 1);
  const parsed = Number(tail);
  return Number.isInteger(parsed) ? parsed : -1;
}

/** True when a replay reproduced the run exactly: same account, history, records and draws. */
export const replayMatches = (live: SimulatorState, replayed: SimulatorState): boolean =>
  historyHash(live) === historyHash(replayed);

/**
 * Steps a run back by `events` processed events (SIM-013). Undo and rewind are the same operation
 * on this architecture: the run is rebuilt from its scenario and the part of its log that is being
 * kept, so stepping back can never leave a half-applied state behind. Stepping back past the
 * beginning lands on the authored initial state.
 */
export function rewind(
  scenario: SimulatorScenario,
  state: SimulatorState,
  events = 1,
  checkpoints?: readonly Checkpoint[],
): SimulatorState {
  const target = Math.max(0, state.log.length - Math.max(1, Math.trunc(events)));
  return replay(scenario, state.log, {
    to: target,
    run_id: state.run_id,
    ...(checkpoints ? { checkpoints } : {}),
  });
}
