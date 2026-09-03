import { fail } from '../errors.ts';
import { optionalString, requireString, type SimulatorEvent } from '../events.ts';
import type { AccountState, Contact } from '../state.ts';
import { bumpAnalytics, count, entity, put, result, type ReducerResult } from './shared.ts';

/** Contacts and tags: the CRM half of the shared account (CRM-001, SIM-004). */

const FIELD_VALUE = new Set(['string', 'number', 'boolean']);

function readCustomFields(
  payload: Record<string, unknown>,
  eventType: string,
): Record<string, string | number | boolean> {
  const raw = payload.custom_fields;
  if (raw === undefined) return {};
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    fail('INVALID_PAYLOAD', `${eventType} custom_fields must be an object`, { payload });
  }
  const fields: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!FIELD_VALUE.has(typeof value)) {
      fail('INVALID_PAYLOAD', `${eventType} custom field ${key} must be text, a number or a flag`, {
        key,
        value,
      });
    }
    fields[key] = value as string | number | boolean;
  }
  return fields;
}

function readTags(payload: Record<string, unknown>, eventType: string): string[] {
  const raw = payload.tags;
  if (raw === undefined) return [];
  if (!Array.isArray(raw) || raw.some((tag) => typeof tag !== 'string')) {
    fail('INVALID_PAYLOAD', `${eventType} tags must be a list of names`, { payload });
  }
  return raw as string[];
}

export function contactCreated(account: AccountState, event: SimulatorEvent): ReducerResult {
  const id = requireString(event.payload, 'contact_id', event.type);
  if (account.contacts[id]) {
    fail('DUPLICATE_ENTITY', `A contact ${id} already exists`, { contact_id: id });
  }
  const contact: Contact = {
    id,
    first_name: requireString(event.payload, 'first_name', event.type),
    last_name: optionalString(event.payload, 'last_name'),
    email: optionalString(event.payload, 'email'),
    phone: optionalString(event.payload, 'phone'),
    tags: readTags(event.payload, event.type),
    custom_fields: readCustomFields(event.payload, event.type),
    dnd: event.payload.dnd === true,
    timezone: optionalString(event.payload, 'timezone'),
    source: optionalString(event.payload, 'source'),
    company_id: optionalString(event.payload, 'company_id'),
    created_at: event.at,
    updated_at: event.at,
  };
  const tags = [...new Set([...account.tags, ...contact.tags])];
  const next = bumpAnalytics(
    { ...account, contacts: put(account.contacts, id, contact), tags },
    count(account.analytics, 'contacts_created'),
  );
  return result(next, [
    {
      kind: 'input',
      at: event.at,
      contact_id: id,
      event_id: event.id,
      data: { source: contact.source, tags: contact.tags },
    },
  ]);
}

export function contactUpdated(account: AccountState, event: SimulatorEvent): ReducerResult {
  const id = requireString(event.payload, 'contact_id', event.type);
  const existing = entity(account.contacts, id, 'contact', event.type);
  const changed: Record<string, unknown> = {};
  const updated: Contact = { ...existing, updated_at: event.at };

  for (const field of [
    'first_name',
    'last_name',
    'email',
    'phone',
    'timezone',
    'source',
  ] as const) {
    const value = event.payload[field];
    if (value === undefined) continue;
    if (value !== null && typeof value !== 'string') {
      fail('INVALID_PAYLOAD', `${event.type} ${field} must be text`, { field, value });
    }
    if (field === 'first_name' && (value === null || value === '')) {
      fail('INVALID_PAYLOAD', 'A contact cannot lose its first name', { contact_id: id });
    }
    changed[field] = value;
    Object.assign(updated, { [field]: value });
  }

  if (event.payload.dnd !== undefined) {
    if (typeof event.payload.dnd !== 'boolean') {
      fail('INVALID_PAYLOAD', `${event.type} dnd must be true or false`, {
        value: event.payload.dnd,
      });
    }
    updated.dnd = event.payload.dnd;
    changed.dnd = event.payload.dnd;
  }

  if (event.payload.custom_fields !== undefined) {
    const fields = readCustomFields(event.payload, event.type);
    for (const key of Object.keys(fields)) {
      if (!account.custom_fields[key]) {
        fail(
          'UNKNOWN_ENTITY',
          `${event.type} sets a custom field the account has not defined: ${key}`,
          {
            key,
          },
        );
      }
    }
    updated.custom_fields = { ...existing.custom_fields, ...fields };
    changed.custom_fields = fields;
  }

  return result({ ...account, contacts: put(account.contacts, id, updated) }, [
    {
      kind: 'input',
      at: event.at,
      contact_id: id,
      event_id: event.id,
      data: { changed },
    },
  ]);
}

export function tagAdded(account: AccountState, event: SimulatorEvent): ReducerResult {
  const id = requireString(event.payload, 'contact_id', event.type);
  const tag = requireString(event.payload, 'tag', event.type);
  const contact = entity(account.contacts, id, 'contact', event.type);
  // Adding a tag a contact already carries is a no-op in GoHighLevel, not an error. The record
  // says so, because a workflow that fires twice is exactly what a duplicate-enrolment exercise
  // needs to be able to see.
  const already = contact.tags.includes(tag);
  const contacts = already
    ? account.contacts
    : put(account.contacts, id, { ...contact, tags: [...contact.tags, tag], updated_at: event.at });
  const tags = account.tags.includes(tag) ? account.tags : [...account.tags, tag];
  return result({ ...account, contacts, tags }, [
    {
      kind: already ? 'action_skipped' : 'step_completed',
      at: event.at,
      contact_id: id,
      event_id: event.id,
      data: { tag },
      reason: already ? 'tag_already_present' : null,
    },
  ]);
}

export function tagRemoved(account: AccountState, event: SimulatorEvent): ReducerResult {
  const id = requireString(event.payload, 'contact_id', event.type);
  const tag = requireString(event.payload, 'tag', event.type);
  const contact = entity(account.contacts, id, 'contact', event.type);
  const present = contact.tags.includes(tag);
  const contacts = present
    ? put(account.contacts, id, {
        ...contact,
        tags: contact.tags.filter((candidate) => candidate !== tag),
        updated_at: event.at,
      })
    : account.contacts;
  return result({ ...account, contacts }, [
    {
      kind: present ? 'step_completed' : 'action_skipped',
      at: event.at,
      contact_id: id,
      event_id: event.id,
      data: { tag },
      reason: present ? null : 'tag_not_present',
    },
  ]);
}
