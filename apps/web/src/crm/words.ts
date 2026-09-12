import type { AccountState } from '@bloomlab/simulator-core';

import type { ActivityEntry } from './activity';

/**
 * Turning structured CRM facts into the words a learner reads (D-095).
 *
 * Kept apart from `activity.ts` on purpose: that module decides what happened, this one decides
 * how to say it. Rewording history can never rewrite it, and an exercise asserting on an entry is
 * unaffected by a copy change.
 *
 * Everything here resolves ids through the account, so a user rename shows up everywhere at once
 * and no screen ever hard-codes a person's name.
 */

/** A user's name, or plain words when nobody owns the record. */
export const ownerName = (account: AccountState, id: string | null | undefined): string =>
  (id ? account.users[id]?.name : null) ?? 'Unassigned';

/** A user's name for a sentence, where "Unassigned" would read oddly. */
const personName = (account: AccountState, id: string | null | undefined): string =>
  (id ? account.users[id]?.name : null) ?? 'Someone';

/** One place decides how a contact is named, so a list and a heading never disagree. */
export const fullName = (contact: { first_name: string; last_name: string | null }): string =>
  [contact.first_name, contact.last_name].filter(Boolean).join(' ');

export const contactName = (account: AccountState, id: string | null | undefined): string => {
  const contact = id ? account.contacts[id] : null;
  return contact ? fullName(contact) : 'Unknown contact';
};

const timeFormatters = new Map<string, Intl.DateTimeFormat>();
const dayFormatters = new Map<string, Intl.DateTimeFormat>();

function formatter(
  cache: Map<string, Intl.DateTimeFormat>,
  timezone: string,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const cached = cache.get(timezone);
  if (cached) return cached;
  const created = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, ...options });
  cache.set(timezone, created);
  return created;
}

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null;

/**
 * Simulator time in the account's own zone, never the device clock and never a bare ISO string.
 * `Intl` is given the zone explicitly for the same reason the engine does: nothing reads where
 * the learner happens to be sitting.
 */
export function simulatorTime(at: string, timezone: string): string {
  try {
    return formatter(timeFormatters, timezone, {
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(at));
  } catch {
    return at;
  }
}

/** Just the day, for a due date where the minute is noise. */
export function simulatorDay(at: string, timezone: string): string {
  try {
    return formatter(dayFormatters, timezone, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    }).format(new Date(at));
  } catch {
    return at;
  }
}

/** How many whole days a deal has sat where it is, measured in simulator time. */
export function daysSince(from: string, now: string): number {
  const started = Date.parse(from);
  const current = Date.parse(now);
  if (Number.isNaN(started) || Number.isNaN(current)) return 0;
  return Math.max(0, Math.floor((current - started) / 86_400_000));
}

const listOf = (value: unknown): string =>
  Object.keys((value ?? {}) as Record<string, unknown>).join(', ');

/**
 * One line of history. The entry says what happened; this says it in English.
 *
 * Anything not spelled out here falls back to a plain description rather than a raw event name,
 * because a learner reading their own account should never meet `OPPORTUNITY_UPDATED`.
 */
export function describeActivity(entry: ActivityEntry, account: AccountState): string {
  const { data } = entry;
  switch (entry.kind) {
    case 'contact_created':
      return 'Contact created';
    case 'contact_updated': {
      const fields = listOf(data.custom_fields);
      if (fields) return `Custom fields updated: ${fields}`;
      if (data.dnd === true) return 'Do not disturb turned on';
      if (data.dnd === false) return 'Do not disturb turned off';
      return 'Contact details updated';
    }
    case 'contact_assigned':
      return text(data.owner_id)
        ? `Contact assigned to ${personName(account, text(data.owner_id))}`
        : 'Contact unassigned';
    case 'tag_added':
      return `Tag added: ${text(data.tag) ?? 'unnamed'}`;
    case 'tag_removed':
      return `Tag removed: ${text(data.tag) ?? 'unnamed'}`;
    case 'opportunity_created':
      return `Opportunity created in ${text(data.stage) ?? 'the pipeline'}`;
    case 'opportunity_updated': {
      const fields = listOf(data.custom_fields);
      if (fields) return `Opportunity fields updated: ${fields}`;
      if (text(data.status)) return `Opportunity marked ${text(data.status)}`;
      if (typeof data.value === 'number') return 'Opportunity value updated';
      return 'Opportunity updated';
    }
    case 'opportunity_assigned':
      return text(data.owner_id)
        ? `Opportunity assigned to ${personName(account, text(data.owner_id))}`
        : 'Opportunity unassigned';
    case 'stage_changed':
      return `Moved to ${text(data.stage) ?? 'another stage'}`;
    case 'note_added':
      return data.seeded === true ? 'Note (already on the record)' : 'Note added';
    case 'task_created':
      return data.seeded === true ? 'Task (already on the record)' : 'Task created';
    case 'task_updated':
      return 'Task updated';
    case 'task_completed':
      return 'Task completed';
    case 'task_reopened':
      return 'Task reopened';
    case 'appointment':
      return text(data.status) ? `Appointment marked ${text(data.status)}` : 'Appointment booked';
    case 'message': {
      const type = text(data.event_type) ?? '';
      if (type.startsWith('SMS')) return type.endsWith('SENT') ? 'Text sent' : 'Text received';
      return type.endsWith('OPENED') ? 'Email opened' : 'Email sent';
    }
    case 'payment':
      return 'Payment activity';
    case 'field_defined':
      return `Custom field ${text(data.key) ?? ''} defined`.trim();
    case 'pipeline_changed':
      return 'Pipeline updated';
  }
}

/** The body of a note, for the one activity kind that carries its own words. */
export const activityBody = (entry: ActivityEntry): string | null =>
  entry.kind === 'note_added' ? text(entry.data.body) : text(entry.data.title);
