import type { SimulatorState } from './state.ts';

/**
 * Stable logical comparison. Proving that a replay produced the same run as the live execution
 * needs a comparison that does not depend on the order properties happen to have been written in,
 * so values are canonicalized with sorted keys before they are hashed.
 *
 * This is a test and diagnostics instrument. It is never shown to a learner: a hash means nothing
 * to someone learning GoHighLevel, and a screen full of hex is exactly the diagnostic-looking
 * product information the design system rules out.
 */

/** Canonical JSON: object keys sorted, arrays kept in order because order is meaning here. */
export function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
}

/** FNV-1a, the same hash the learner-record ids use, so the codebase has one hashing habit. */
export function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/**
 * What the run has *done*: the account it produced, where its clock stands, its authoritative
 * history, its execution records and its generator position. A replay must match this exactly.
 *
 * The scheduled queue is deliberately absent — it is what the run is *about to* do, not what it
 * has done, and it is persisted with the run rather than derived from history (D-079).
 */
export const historyHash = (state: SimulatorState): string =>
  fnv1a(
    canonical({
      account: state.account,
      clock: state.clock,
      log: state.log,
      execution: state.execution,
      random: state.random,
      sequence: state.sequence,
    }),
  );

/** The whole run, queue included: what a snapshot has to restore exactly. */
export const stateHash = (state: SimulatorState): string =>
  fnv1a(
    canonical({
      version: state.version,
      run_id: state.run_id,
      scenario_id: state.scenario_id,
      clock: state.clock,
      account: state.account,
      queue: state.queue,
      queue_sequence: state.queue_sequence,
      log: state.log,
      execution: state.execution,
      random: state.random,
      sequence: state.sequence,
    }),
  );
