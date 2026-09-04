import { contentEventName, type AccountState, type SimulatorEvent } from '@bloomlab/simulator-core';

import type { StoredRun } from '../simulator/store';

/**
 * The boundary of one Calendar Lab action, and what the account did inside it (CAL-003).
 *
 * Event sequence, not log length: execution records consume sequence numbers too, so a watermark
 * taken from the log's length drifts and starts showing older events under a newer action. That
 * was the Phase 13 correction (D-125) and it applies here for the same reason.
 *
 * These are pure reads of a saved run, kept out of the screen so the chain test asserts on the
 * same boundary the Lab draws rather than on a re-implementation of it.
 */

export const logWatermark = (run: StoredRun): number => run.state.log.at(-1)?.sequence ?? -1;

export const eventsSince = (run: StoredRun, afterSequence: number): SimulatorEvent[] =>
  run.state.log.filter((event) => event.sequence > afterSequence);

export interface ChainEntry {
  sequence: number;
  type: string;
  at: string;
  origin: string;
  detail: string;
}

/** What the run logged since the watermark, in its own order, described in plain words. */
export const chainSince = (
  run: StoredRun,
  afterSequence: number,
  account: AccountState,
): ChainEntry[] =>
  eventsSince(run, afterSequence).map((event) => ({
    sequence: event.sequence,
    type: contentEventName(event.type),
    at: event.at,
    origin: event.origin,
    detail: describe(event.payload, account),
  }));

/** A one-line summary of what an event carried, read from the payload the engine recorded. */
export function describe(payload: Record<string, unknown>, account: AccountState): string {
  const parts: string[] = [];
  const contactId = typeof payload.contact_id === 'string' ? payload.contact_id : null;
  if (contactId) {
    const contact = account.contacts[contactId];
    parts.push(contact ? `${contact.first_name} ${contact.last_name ?? ''}`.trim() : contactId);
  }
  if (typeof payload.calendar_id === 'string') {
    parts.push(account.calendars[payload.calendar_id]?.name ?? payload.calendar_id);
  }
  if (typeof payload.host_id === 'string') {
    parts.push(`with ${account.users[payload.host_id]?.name ?? payload.host_id}`);
  }
  if (typeof payload.status === 'string') parts.push(payload.status);
  if (typeof payload.workflow_id === 'string') {
    parts.push(account.workflows[payload.workflow_id]?.name ?? payload.workflow_id);
  }
  if (typeof payload.reason === 'string') parts.push(payload.reason);
  if (typeof payload.tag === 'string') parts.push(`tag ${payload.tag}`);
  if (typeof payload.body === 'string') parts.push(`“${payload.body}”`);
  return parts.join(' · ');
}
