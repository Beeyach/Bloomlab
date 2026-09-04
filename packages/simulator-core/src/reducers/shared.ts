import { fail } from '../errors.ts';
import type { PendingEvent, SimulatorEvent } from '../events.ts';
import type { ExecutionDraft } from '../execution.ts';
import type { AccountState, Analytics, SimulatorState } from '../state.ts';

/**
 * What one event did: the account that follows it, the execution records it produced, and the
 * events it generated. Generated events are returned rather than applied, so the runner puts
 * every one of them through the same processing path as an injected event — there is no second,
 * hidden route into the state (SIM-003).
 */
export interface ReducerResult {
  account: AccountState;
  records: ExecutionDraft[];
  generated: PendingEvent[];
  /**
   * Entries the run should queue for later — a workflow wake, a timeout. The runner mints their
   * ids from the queue sequence, so the same reducer in a replay queues the same entry (D-101).
   */
  scheduled?: ScheduledDraft[];
  /** Queue entries to drop, matched by the resume token in their payload: a wake nobody needs. */
  unschedule?: string[];
}

export interface ScheduledDraft {
  at: string;
  type: PendingEvent['type'];
  payload: Record<string, unknown>;
  source?: PendingEvent['source'];
  description?: string;
}

export type Reducer = (
  account: AccountState,
  event: SimulatorEvent,
  state: SimulatorState,
) => ReducerResult;

export const result = (
  account: AccountState,
  records: ExecutionDraft[] = [],
  generated: PendingEvent[] = [],
  extra: Pick<ReducerResult, 'scheduled' | 'unschedule'> = {},
): ReducerResult => ({ account, records, generated, ...extra });

/**
 * An entity an event names must already exist. The engine does not invent one to make an event
 * succeed: a scenario that references a contact it never created is a scenario bug, and saying so
 * is the whole point of the CRM Lab's later lessons about references.
 */
export function entity<T>(
  collection: Record<string, T>,
  id: string,
  kind: string,
  eventType: string,
): T {
  const found = collection[id];
  if (found === undefined) {
    fail('UNKNOWN_ENTITY', `${eventType} names a ${kind} that does not exist: ${id}`, {
      kind,
      id,
      event: eventType,
    });
  }
  return found as T;
}

export const bumpAnalytics = (
  account: AccountState,
  changes: Partial<Analytics>,
): AccountState => ({
  ...account,
  analytics: { ...account.analytics, ...changes },
});

/** Adds to a counter without the caller having to read it first. */
export const count = (analytics: Analytics, key: keyof Analytics, by = 1): Partial<Analytics> => ({
  [key]: analytics[key] + by,
});

/** Replaces one record in an id-addressed collection, leaving the original object untouched. */
export const put = <T>(collection: Record<string, T>, id: string, value: T): Record<string, T> => ({
  ...collection,
  [id]: value,
});
