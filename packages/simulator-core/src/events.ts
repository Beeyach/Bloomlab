import { fail } from './errors.ts';

/**
 * The authoritative simulator event catalogue (spec §44, SIM-005). These names are the engine's
 * own vocabulary and are not renamed casually; where the interface represents a real GoHighLevel
 * feature it uses that feature's real name from the registry instead (GHL-010).
 */
export const SIMULATOR_EVENT_TYPES = [
  'CONTACT_CREATED',
  'CONTACT_UPDATED',
  'TAG_ADDED',
  'TAG_REMOVED',
  'FORM_SUBMITTED',
  'SURVEY_SUBMITTED',
  'APPOINTMENT_BOOKED',
  'APPOINTMENT_RESCHEDULED',
  'APPOINTMENT_CANCELLED',
  'APPOINTMENT_STATUS_CHANGED',
  'SMS_SENT',
  'SMS_RECEIVED',
  'EMAIL_SENT',
  'EMAIL_OPENED',
  'OPPORTUNITY_CREATED',
  'OPPORTUNITY_UPDATED',
  'PIPELINE_STAGE_CHANGED',
  'PAYMENT_RECEIVED',
  'PAYMENT_FAILED',
  'REFUND_ISSUED',
  'TIME_ADVANCED',
  'WORKFLOW_ENROLLED',
  'WORKFLOW_STEP_COMPLETED',
  'WORKFLOW_EXITED',
  'WEBHOOK_RECEIVED',
  'WEBHOOK_RESPONSE',
] as const;

export type SimulatorEventType = (typeof SIMULATOR_EVENT_TYPES)[number];

const TYPES = new Set<string>(SIMULATOR_EVENT_TYPES);

export const isSimulatorEventType = (value: unknown): value is SimulatorEventType =>
  typeof value === 'string' && TYPES.has(value);

/**
 * Content and the exercise grader address the same events in a dotted lower-case form
 * (`appointment.status_changed`, `sms.sent`), which is what scenarios schedule and what authored
 * assertions match on. The two forms are one deterministic transformation apart — the first
 * underscore becomes a dot — so neither is a hand-maintained lookup table that can drift (D-076).
 */
export const contentEventName = (type: SimulatorEventType): string =>
  type.toLowerCase().replace('_', '.');

const BY_CONTENT_NAME = new Map<string, SimulatorEventType>(
  SIMULATOR_EVENT_TYPES.map((type) => [contentEventName(type), type]),
);

/** The catalogue type an authored event name refers to, or `null` when content names nothing. */
export const eventTypeFromContent = (name: string): SimulatorEventType | null =>
  BY_CONTENT_NAME.get(name) ?? null;

/** Every authored name the engine accepts, for validators and diagnostics. */
export const CONTENT_EVENT_NAMES: readonly string[] = [...BY_CONTENT_NAME.keys()];

/** Where an event came from. Generated and injected events travel the same path (SIM-003). */
export const EVENT_ORIGINS = [
  /** Queued by the authored scenario before the run began. */
  'scenario',
  /** Put in by the learner, an exercise, or the harness through the injector (SIM-009). */
  'injected',
  /** Produced by the engine while processing another event. */
  'generated',
  /** Emitted by the clock itself when the Time Machine moves (SIM-007). */
  'clock',
] as const;

export type EventOrigin = (typeof EVENT_ORIGINS)[number];

/** What produced a generated event, so a log line can be traced back to its cause. */
export interface EventSource {
  kind: 'workflow_node' | 'injector_action' | 'scheduled' | 'time_machine' | 'reducer';
  id: string;
  /** The event this one came out of, when it came out of one. */
  caused_by?: string;
}

export type EventPayload = Record<string, unknown>;

/**
 * One processed event. The envelope carries identity, type, the run's own timestamp, a total
 * order, the payload, where it came from and what produced it — everything replay, grading,
 * snapshots and the execution timeline need (SIM-005, SIM-013).
 */
export interface SimulatorEvent {
  /** Stable and deterministic: the same run replayed mints the same ids. */
  id: string;
  type: SimulatorEventType;
  /** Simulator time, never wall-clock time (spec §45). */
  at: string;
  /**
   * Position in the run's processed order. Two events at the same instant are ordered by this,
   * which is exactly what the grader's `index` means, so sequence never depends on sort stability.
   */
  sequence: number;
  payload: EventPayload;
  origin: EventOrigin;
  source: EventSource | null;
  run_id: string;
  scenario_id: string;
}

/** An event that has not been processed yet: no identity or order until it enters the run. */
export interface PendingEvent {
  type: SimulatorEventType;
  at: string;
  payload: EventPayload;
  origin: EventOrigin;
  source?: EventSource | null;
}

const isPlainObject = (value: unknown): value is EventPayload =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Validates the envelope before anything reads the payload. Nothing is coerced into success. */
export function assertPendingEvent(candidate: unknown): asserts candidate is PendingEvent {
  if (!isPlainObject(candidate)) {
    fail('MALFORMED_EVENT', 'An event must be an object', { candidate });
  }
  const event = candidate as Partial<PendingEvent>;
  if (typeof event.type !== 'string') {
    fail('MALFORMED_EVENT', 'An event must carry a type', { candidate });
  }
  if (!isSimulatorEventType(event.type)) {
    fail('UNKNOWN_EVENT_TYPE', `${event.type} is not in the simulator event catalogue`, {
      type: event.type,
    });
  }
  if (typeof event.at !== 'string' || event.at.length === 0) {
    fail('MALFORMED_EVENT', `${event.type} has no simulator timestamp`, { candidate });
  }
  if (event.payload !== undefined && !isPlainObject(event.payload)) {
    fail('MALFORMED_EVENT', `${event.type} has a payload that is not an object`, { candidate });
  }
}

/** Reads a required string field, refusing rather than defaulting. */
export function requireString(
  payload: EventPayload,
  field: string,
  type: SimulatorEventType,
): string {
  const value = payload[field];
  if (typeof value !== 'string' || value.length === 0) {
    fail('INVALID_PAYLOAD', `${type} needs a ${field}`, { field, payload, type });
  }
  return value as string;
}

export function optionalString(payload: EventPayload, field: string): string | null {
  const value = payload[field];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function requireNumber(
  payload: EventPayload,
  field: string,
  type: SimulatorEventType,
): number {
  const value = payload[field];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    fail('INVALID_PAYLOAD', `${type} needs a numeric ${field}`, { field, payload, type });
  }
  return value as number;
}
