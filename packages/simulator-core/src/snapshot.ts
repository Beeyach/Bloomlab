import { fail } from './errors.ts';
import type { SimulatorState } from './state.ts';
import { stateHash } from './hash.ts';

/**
 * Snapshots (spec §9, SIM-013). A run is stored as its authored scenario plus its event log plus
 * periodic checkpoints — not as a full state serialized after every tiny event, which would make
 * a long run enormous for no gain.
 *
 * The policy (D-080): a checkpoint every `CHECKPOINT_EVERY` processed events, plus any the caller
 * takes explicitly at a moment worth returning to. Replay restarts from the nearest checkpoint at
 * or before the target and re-runs only the events after it.
 */

export const CHECKPOINT_EVERY = 25;

export interface Checkpoint {
  id: string;
  run_id: string;
  /** How many events had been processed when it was taken; the index replay restarts from. */
  log_length: number;
  /** Simulator time at that moment. */
  at: string;
  /** `auto` for the periodic ones, or a caller's own label. */
  label: string;
  /** Guards against a checkpoint being paired with a state it did not come from. */
  hash: string;
  state: SimulatorState;
}

export const checkpoint = (state: SimulatorState, label = 'auto'): Checkpoint => ({
  id: `cp-${state.run_id}-${state.log.length}`,
  run_id: state.run_id,
  log_length: state.log.length,
  at: state.clock.now,
  label,
  hash: stateHash(state),
  state,
});

/**
 * Takes a checkpoint if the policy calls for one. Returns the same list when it does not, so a
 * caller can run this after every operation without thinking about the cadence.
 */
export function maybeCheckpoint(
  checkpoints: readonly Checkpoint[],
  state: SimulatorState,
): Checkpoint[] {
  const last = checkpoints[checkpoints.length - 1];
  const since = state.log.length - (last?.log_length ?? 0);
  if (last && since < CHECKPOINT_EVERY) return [...checkpoints];
  if (!last && state.log.length < CHECKPOINT_EVERY) return [...checkpoints];
  return [...checkpoints, checkpoint(state)];
}

/** The latest checkpoint at or before an index in the log. */
export function nearestCheckpoint(
  checkpoints: readonly Checkpoint[],
  logLength: number,
): Checkpoint | null {
  let best: Checkpoint | null = null;
  for (const candidate of checkpoints) {
    if (candidate.log_length <= logLength && (!best || candidate.log_length > best.log_length)) {
      best = candidate;
    }
  }
  return best;
}

/** Refuses a checkpoint that does not belong to this run, or whose state has been tampered with. */
export function assertCheckpoint(candidate: Checkpoint, runId: string): void {
  if (!candidate || typeof candidate !== 'object' || !candidate.state) {
    fail('INVALID_SNAPSHOT', 'Checkpoint has no state', { checkpoint: candidate?.id });
  }
  if (candidate.run_id !== runId) {
    fail('INVALID_SNAPSHOT', `Checkpoint ${candidate.id} belongs to run ${candidate.run_id}`, {
      expected: runId,
      found: candidate.run_id,
    });
  }
  if (candidate.state.log.length !== candidate.log_length) {
    fail('INVALID_SNAPSHOT', `Checkpoint ${candidate.id} disagrees with its own state`, {
      log_length: candidate.log_length,
      actual: candidate.state.log.length,
    });
  }
  if (stateHash(candidate.state) !== candidate.hash) {
    fail('INVALID_SNAPSHOT', `Checkpoint ${candidate.id} does not match its hash`, {
      checkpoint: candidate.id,
    });
  }
}
