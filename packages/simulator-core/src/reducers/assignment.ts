import { fail } from '../errors.ts';
import { requireString, type SimulatorEvent } from '../events.ts';
import type { AccountState } from '../state.ts';
import { entity, put, result, type ReducerResult } from './shared.ts';

/**
 * Ownership (CRM-001, D-089).
 *
 * A contact and an opportunity each carry an owner, and the two are allowed to differ — that is
 * what "Allow different owners for contacts and its opportunities" turns on in a real sub-account,
 * and Bloomlab always behaves as though it is on. An owner is a reference into `users`, never a
 * name copied onto the record, so an unknown user is refused rather than stored as a label that
 * resolves to nothing.
 *
 * Clearing an owner is a real operation, not a missing payload: `owner_id: null` unassigns, while
 * omitting the field entirely is a malformed event. Otherwise "I meant to unassign" and "I forgot
 * to say who" would be the same message.
 */

/** Reads the owner an assignment names: a user in the account, or an explicit null to unassign. */
function readOwner(account: AccountState, event: SimulatorEvent): string | null {
  const value = event.payload.owner_id;
  if (value === undefined) {
    fail('INVALID_PAYLOAD', `${event.type} needs an owner_id, or null to unassign`, {
      payload: event.payload,
    });
  }
  if (value === null) return null;
  if (typeof value !== 'string' || value.length === 0) {
    fail('INVALID_PAYLOAD', `${event.type} owner_id must be a user id or null`, { value });
  }
  entity(account.users, value, 'user', event.type);
  return value;
}

export function contactAssigned(account: AccountState, event: SimulatorEvent): ReducerResult {
  const id = requireString(event.payload, 'contact_id', event.type);
  const contact = entity(account.contacts, id, 'contact', event.type);
  const ownerId = readOwner(account, event);
  const already = contact.owner_id === ownerId;
  const contacts = already
    ? account.contacts
    : put(account.contacts, id, { ...contact, owner_id: ownerId, updated_at: event.at });
  return result({ ...account, contacts }, [
    {
      kind: already ? 'action_skipped' : 'step_completed',
      at: event.at,
      contact_id: id,
      event_id: event.id,
      data: { from_owner: contact.owner_id, to_owner: ownerId },
      reason: already ? 'owner_unchanged' : null,
    },
  ]);
}

export function opportunityAssigned(account: AccountState, event: SimulatorEvent): ReducerResult {
  const id = requireString(event.payload, 'opportunity_id', event.type);
  const opportunity = entity(account.opportunities, id, 'opportunity', event.type);
  const ownerId = readOwner(account, event);
  const already = opportunity.owner_id === ownerId;
  const opportunities = already
    ? account.opportunities
    : put(account.opportunities, id, {
        ...opportunity,
        owner_id: ownerId,
        updated_at: event.at,
      });
  return result({ ...account, opportunities }, [
    {
      kind: already ? 'action_skipped' : 'step_completed',
      at: event.at,
      contact_id: opportunity.contact_id,
      event_id: event.id,
      data: { opportunity_id: id, from_owner: opportunity.owner_id, to_owner: ownerId },
      reason: already ? 'owner_unchanged' : null,
    },
  ]);
}
