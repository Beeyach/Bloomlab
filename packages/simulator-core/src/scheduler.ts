import type { EventOrigin, EventPayload, EventSource, SimulatorEventType } from './events.ts';
import { instant } from './time.ts';

/**
 * The scheduled-event queue (spec §45, SIM-008).
 *
 * Ordering is explicit and total, never an accident of object iteration or sort stability:
 *
 *   1. the scheduled instant, earliest first;
 *   2. then the insertion sequence, so two events queued for the same instant run in the order
 *      they were created — a consequence always follows its cause;
 *   3. then the stable scheduled id, which settles the remaining case where two entries were
 *      minted with the same sequence by different code paths.
 *
 * The same inputs therefore always execute in the same order, on every engine, in every replay
 * (D-077).
 */

export interface ScheduledEvent {
  /** Deterministic: `sc-<run>-<sequence>`. */
  id: string;
  at: string;
  /** Insertion order across the whole run; the second half of the ordering rule. */
  sequence: number;
  type: SimulatorEventType;
  payload: EventPayload;
  origin: EventOrigin;
  source: EventSource | null;
  /** Authored description, for the harness and the scenario's own documentation. */
  description: string | null;
}

/** The documented tie rule, in one place, used by the queue and by every test that proves it. */
export function compareScheduled(a: ScheduledEvent, b: ScheduledEvent): number {
  const byTime = instant(a.at) - instant(b.at);
  if (byTime !== 0) return byTime;
  const bySequence = a.sequence - b.sequence;
  if (bySequence !== 0) return bySequence;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Returns a new queue with the entry in its ordered place; the input queue is untouched. */
export const enqueue = (
  queue: readonly ScheduledEvent[],
  entry: ScheduledEvent,
): ScheduledEvent[] => [...queue, entry].sort(compareScheduled);

/** Splits the queue at an instant: everything due at or before it, and everything still ahead. */
export function partitionDue(
  queue: readonly ScheduledEvent[],
  target: string,
): { due: ScheduledEvent[]; remaining: ScheduledEvent[] } {
  const limit = instant(target);
  const ordered = [...queue].sort(compareScheduled);
  const due: ScheduledEvent[] = [];
  const remaining: ScheduledEvent[] = [];
  for (const entry of ordered) {
    if (instant(entry.at) <= limit) due.push(entry);
    else remaining.push(entry);
  }
  return { due, remaining };
}

/** The next entry the queue would run, without removing it. */
export const peek = (queue: readonly ScheduledEvent[]): ScheduledEvent | null =>
  queue.length === 0 ? null : ([...queue].sort(compareScheduled)[0] ?? null);
