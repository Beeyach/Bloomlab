import { fail } from '../errors.ts';
import { optionalString, requireString, type SimulatorEvent } from '../events.ts';
import type {
  AccountState,
  Conversation,
  Message,
  MessageChannel,
  MessageDirection,
} from '../state.ts';
import { bumpAnalytics, count, entity, put, result, type ReducerResult } from './shared.ts';

/**
 * Simulated SMS and email (CONV-001). Messages land in one conversation per contact, in the order
 * the run produced them, so a timeline and a "did they get two reminders?" check read the same
 * history.
 */

function appendMessage(account: AccountState, contactId: string, message: Message): AccountState {
  const existing = account.conversations[contactId];
  const conversation: Conversation = existing
    ? { ...existing, messages: [...existing.messages, message], last_message_at: message.at }
    : {
        id: `cv-${contactId}`,
        contact_id: contactId,
        messages: [message],
        last_message_at: message.at,
      };
  return { ...account, conversations: put(account.conversations, contactId, conversation) };
}

function message(
  event: SimulatorEvent,
  channel: MessageChannel,
  direction: MessageDirection,
): Message {
  return {
    id: `msg-${event.id}`,
    channel,
    direction,
    body: requireString(event.payload, 'body', event.type),
    subject: optionalString(event.payload, 'subject'),
    at: event.at,
    workflow_id: optionalString(event.payload, 'workflow_id'),
    node_id: optionalString(event.payload, 'node_id'),
    opened_at: null,
  };
}

/**
 * Outbound messaging respects the two conditions GoHighLevel enforces: a contact with no phone
 * cannot receive an SMS, and a contact on do-not-disturb receives nothing. Both are recorded as a
 * skipped action rather than silently dropped — the symptom is the lesson (spec §49).
 */
function sendable(
  account: AccountState,
  contactId: string,
  channel: MessageChannel,
  eventType: string,
): string | null {
  const contact = entity(account.contacts, contactId, 'contact', eventType);
  if (contact.dnd) return 'dnd';
  if (channel === 'sms' && !contact.phone) return 'missing_phone';
  if (channel === 'email' && !contact.email) return 'missing_email';
  return null;
}

const outbound = (
  channel: MessageChannel,
): ((a: AccountState, e: SimulatorEvent) => ReducerResult) =>
  function send(account, event) {
    const contactId = requireString(event.payload, 'contact_id', event.type);
    const blocked = sendable(account, contactId, channel, event.type);
    const body = message(event, channel, 'outbound');
    if (blocked) {
      return result(account, [
        {
          kind: 'action_skipped',
          at: event.at,
          contact_id: contactId,
          event_id: event.id,
          workflow_id: body.workflow_id,
          node_id: body.node_id,
          data: { channel },
          reason: blocked,
        },
      ]);
    }
    const next = bumpAnalytics(
      appendMessage(account, contactId, body),
      count(account.analytics, 'messages_sent'),
    );
    return result(next, [
      {
        kind: 'step_completed',
        at: event.at,
        contact_id: contactId,
        event_id: event.id,
        workflow_id: body.workflow_id,
        node_id: body.node_id,
        data: { channel, message_id: body.id },
      },
    ]);
  };

export const smsSent = outbound('sms');
export const emailSent = outbound('email');

const inbound = (
  channel: MessageChannel,
): ((a: AccountState, e: SimulatorEvent) => ReducerResult) =>
  function receive(account, event) {
    const contactId = requireString(event.payload, 'contact_id', event.type);
    entity(account.contacts, contactId, 'contact', event.type);
    const body = message(event, channel, 'inbound');
    const next = bumpAnalytics(
      appendMessage(account, contactId, body),
      count(account.analytics, 'messages_received'),
    );
    return result(next, [
      {
        kind: 'input',
        at: event.at,
        contact_id: contactId,
        event_id: event.id,
        data: { channel, message_id: body.id },
      },
    ]);
  };

export const smsReceived = inbound('sms');
export const emailReceived = inbound('email');

/** An open is stamped on the message it belongs to; opening twice keeps the first instant. */
export function emailOpened(account: AccountState, event: SimulatorEvent): ReducerResult {
  const contactId = requireString(event.payload, 'contact_id', event.type);
  const conversation = account.conversations[contactId];
  const messageId = optionalString(event.payload, 'message_id');
  const target = conversation?.messages.find((candidate) =>
    messageId
      ? candidate.id === messageId
      : candidate.channel === 'email' && candidate.direction === 'outbound',
  );
  if (!conversation || !target) {
    fail('UNKNOWN_ENTITY', `${event.type} names an email that was never sent`, {
      contact_id: contactId,
      message_id: messageId,
    });
  }
  if (target.opened_at !== null) {
    return result(account, [
      {
        kind: 'action_skipped',
        at: event.at,
        contact_id: contactId,
        event_id: event.id,
        data: { message_id: target.id, opened_at: target.opened_at },
        reason: 'already_opened',
      },
    ]);
  }
  const messages = conversation.messages.map((candidate) =>
    candidate.id === target.id ? { ...candidate, opened_at: event.at } : candidate,
  );
  const next = bumpAnalytics(
    {
      ...account,
      conversations: put(account.conversations, contactId, { ...conversation, messages }),
    },
    count(account.analytics, 'emails_opened'),
  );
  return result(next, [
    {
      kind: 'input',
      at: event.at,
      contact_id: contactId,
      event_id: event.id,
      data: { message_id: target.id },
    },
  ]);
}
