import { optionalString, requireString, type SimulatorEvent } from '../events.ts';
import type { AccountState } from '../state.ts';
import { entity, result, type ReducerResult } from './shared.ts';

/**
 * Send Internal Notification (registry GHL-WF-SEND-INTERNAL-NOTIFICATION, fidelity B).
 *
 * The simulator records that a team member was notified — who, on which channel, with what text
 * — and delivers nothing, which is the registry's stated approximation. It is a structured
 * internal event, never a customer message: it does not touch a conversation.
 */
export function notificationSent(account: AccountState, event: SimulatorEvent): ReducerResult {
  const recipient = requireString(event.payload, 'recipient', event.type);
  entity(account.users, recipient, 'user', event.type);
  const contactId = optionalString(event.payload, 'contact_id');
  if (contactId) entity(account.contacts, contactId, 'contact', event.type);
  return result(account, [
    {
      kind: 'step_completed',
      at: event.at,
      contact_id: contactId,
      workflow_id: optionalString(event.payload, 'workflow_id'),
      node_id: optionalString(event.payload, 'node_id'),
      workflow_run_id: optionalString(event.payload, 'workflow_run_id'),
      event_id: event.id,
      data: {
        recipient,
        channel: optionalString(event.payload, 'channel') ?? 'in-app',
        message: optionalString(event.payload, 'message') ?? '',
        delivered: false,
      },
    },
  ]);
}
