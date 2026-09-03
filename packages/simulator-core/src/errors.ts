/**
 * The simulator fails visibly (spec §129). Every refusal carries a machine-readable code and the
 * detail needed to debug the scenario, and nothing is quietly repaired: an event naming a contact
 * that does not exist is an error, not an invitation to invent one.
 */

export const SIMULATOR_ERROR_CODES = [
  /** The event envelope itself is wrong: missing type, unparseable time, non-object payload. */
  'MALFORMED_EVENT',
  /** A type outside the authoritative catalogue (spec §44). */
  'UNKNOWN_EVENT_TYPE',
  /** The payload lacks a field this event type requires, or a field has the wrong type. */
  'INVALID_PAYLOAD',
  /** The event names an entity the account does not contain. */
  'UNKNOWN_ENTITY',
  /** The event would create an entity that already exists. */
  'DUPLICATE_ENTITY',
  /** Not an IANA zone the runtime can resolve. */
  'INVALID_TIMEZONE',
  /** Not an ISO 8601 instant, or scheduled before the clock it is queued against. */
  'INVALID_TIME',
  /** One operation produced more events than the cascade limit allows (SIM-003). */
  'CASCADE_LIMIT',
  /** A snapshot that does not match its run, or whose shape the engine cannot restore. */
  'INVALID_SNAPSHOT',
  /** Replay could not reconstruct the run from its initial state and log. */
  'REPLAY_FAILED',
  /** The PRNG state is missing or out of range. */
  'INVALID_RANDOM_STATE',
  /** The scenario cannot be compiled into a runnable initial state. */
  'INVALID_SCENARIO',
  /** The injector was asked for an action the scenario does not offer. */
  'ACTION_NOT_ALLOWED',
] as const;

export type SimulatorErrorCode = (typeof SIMULATOR_ERROR_CODES)[number];

export class SimulatorError extends Error {
  readonly code: SimulatorErrorCode;
  /** Structured context: ids, offending values, limits. Never a sentence to show a learner. */
  readonly detail: Record<string, unknown>;

  constructor(code: SimulatorErrorCode, message: string, detail: Record<string, unknown> = {}) {
    super(message);
    this.name = 'SimulatorError';
    this.code = code;
    this.detail = detail;
  }
}

/**
 * Declared as a function rather than an arrow so TypeScript narrows on it: after `fail(...)` the
 * compiler knows control cannot continue, which is what lets a guard double as a type guard.
 */
export function fail(
  code: SimulatorErrorCode,
  message: string,
  detail: Record<string, unknown> = {},
): never {
  throw new SimulatorError(code, message, detail);
}

export const isSimulatorError = (value: unknown): value is SimulatorError =>
  value instanceof SimulatorError;
