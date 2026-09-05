import { fail } from '../errors.ts';
import {
  optionalString,
  requireString,
  type PendingEvent,
  type SimulatorEvent,
} from '../events.ts';
import type { AccountState } from '../state.ts';
import { identifyVisit } from './funnelVisits.ts';
import { bumpAnalytics, count, entity, result, type ReducerResult } from './shared.ts';

/**
 * Intake: forms, surveys and webhooks (FUN-002, spec §44).
 *
 * A form submission is the one place Phase 10 creates a contact from an event, because that is
 * what the event means in GoHighLevel: submitting a form creates the contact if it is new and
 * updates it if it is not. The contact is not conjured as a side effect of a missing reference —
 * the submission generates a real `CONTACT_CREATED` or `CONTACT_UPDATED` event, which is then
 * processed through the same path as anything else, so the CRM shows the same history either way.
 */

function readValues(
  payload: Record<string, unknown>,
  eventType: string,
): Record<string, string | number | boolean> {
  const raw = payload.values;
  if (raw === undefined) return {};
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    fail('INVALID_PAYLOAD', `${eventType} values must be an object of field answers`, { payload });
  }
  const values: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!['string', 'number', 'boolean'].includes(typeof value)) {
      fail('INVALID_PAYLOAD', `${eventType} answer for ${key} must be text, a number or a flag`, {
        key,
        value,
      });
    }
    values[key] = value as string | number | boolean;
  }
  return values;
}

/** Field answers split into the contact's own columns and its custom fields. */
const CONTACT_FIELDS = new Set(['first_name', 'last_name', 'email', 'phone', 'timezone', 'source']);

function submissionEvent(
  account: AccountState,
  event: SimulatorEvent,
  contactId: string,
  values: Record<string, string | number | boolean>,
): PendingEvent {
  const direct: Record<string, unknown> = {};
  const custom: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(values)) {
    if (CONTACT_FIELDS.has(key)) direct[key] = value;
    else if (account.custom_fields[key]) custom[key] = value;
  }
  const exists = account.contacts[contactId] !== undefined;
  const source: PendingEvent['source'] = {
    kind: 'reducer',
    id: event.type,
    caused_by: event.id,
  };
  if (exists) {
    return {
      type: 'CONTACT_UPDATED',
      at: event.at,
      origin: 'generated',
      source,
      payload: { contact_id: contactId, ...direct, custom_fields: custom },
    };
  }
  if (typeof direct.first_name !== 'string' || direct.first_name.length === 0) {
    fail('INVALID_PAYLOAD', `${event.type} would create a contact with no first name`, {
      contact_id: contactId,
      values,
    });
  }
  return {
    type: 'CONTACT_CREATED',
    at: event.at,
    origin: 'generated',
    source,
    payload: {
      contact_id: contactId,
      ...direct,
      source: direct.source ?? `form:${optionalString(event.payload, 'form_id') ?? 'unknown'}`,
      custom_fields: custom,
    },
  };
}

export function formSubmitted(account: AccountState, event: SimulatorEvent): ReducerResult {
  const formId = requireString(event.payload, 'form_id', event.type);
  const form = entity(account.forms, formId, 'form', event.type);
  const contactId = requireString(event.payload, 'contact_id', event.type);
  const values = readValues(event.payload, event.type);
  const unknown = Object.keys(values).filter((field) => !form.fields.includes(field));
  if (unknown.length > 0) {
    fail('INVALID_PAYLOAD', `Form ${formId} has no field ${unknown.join(', ')}`, {
      form_id: formId,
      unknown,
      fields: form.fields,
    });
  }
  const visitId = optionalString(event.payload, 'visit_id');
  const next = bumpAnalytics(
    identifyVisit(account, visitId, contactId, account.contacts[contactId] === undefined),
    count(account.analytics, 'forms_submitted'),
  );
  return result(
    next,
    [
      {
        kind: 'trigger',
        at: event.at,
        contact_id: contactId,
        event_id: event.id,
        data: { form_id: formId, values, ...(visitId ? { visit_id: visitId } : {}) },
      },
    ],
    [submissionEvent(account, event, contactId, values)],
  );
}

export function surveySubmitted(account: AccountState, event: SimulatorEvent): ReducerResult {
  const surveyId = requireString(event.payload, 'survey_id', event.type);
  const survey = entity(account.surveys, surveyId, 'survey', event.type);
  const contactId = requireString(event.payload, 'contact_id', event.type);
  const values = readValues(event.payload, event.type);
  const unknown = Object.keys(values).filter((field) => !survey.fields.includes(field));
  if (unknown.length > 0) {
    fail('INVALID_PAYLOAD', `Survey ${surveyId} has no field ${unknown.join(', ')}`, {
      survey_id: surveyId,
      unknown,
      fields: survey.fields,
    });
  }
  const visitId = optionalString(event.payload, 'visit_id');
  const next = bumpAnalytics(
    identifyVisit(account, visitId, contactId, account.contacts[contactId] === undefined),
    count(account.analytics, 'surveys_submitted'),
  );
  return result(
    next,
    [
      {
        kind: 'trigger',
        at: event.at,
        contact_id: contactId,
        event_id: event.id,
        data: { survey_id: surveyId, values, ...(visitId ? { visit_id: visitId } : {}) },
      },
    ],
    [submissionEvent(account, event, contactId, values)],
  );
}

/**
 * Webhooks are recorded as history, not executed: the simulator has no network, and an inbound
 * webhook's effect is whatever the scenario's workflow does with it (Phase 12). What Phase 10
 * owns is that the call and its response are in the log, deterministically, with their payloads.
 */
export function webhookReceived(account: AccountState, event: SimulatorEvent): ReducerResult {
  const endpoint = requireString(event.payload, 'endpoint', event.type);
  const contactId = optionalString(event.payload, 'contact_id');
  if (contactId) entity(account.contacts, contactId, 'contact', event.type);
  return result(account, [
    {
      kind: 'input',
      at: event.at,
      contact_id: contactId,
      event_id: event.id,
      data: { endpoint, body: event.payload.body ?? null },
    },
  ]);
}

export function webhookResponse(account: AccountState, event: SimulatorEvent): ReducerResult {
  const endpoint = requireString(event.payload, 'endpoint', event.type);
  const status = event.payload.status;
  if (typeof status !== 'number' || !Number.isInteger(status)) {
    fail('INVALID_PAYLOAD', `${event.type} needs an integer status`, { status });
  }
  // HighLevel's own rule: a webhook succeeded only on a 2xx. Everything else — a redirect, a
  // refused credential, a failing service — is a failed action in its execution logs, and this
  // matches that rather than inventing a friendlier threshold (D-140).
  const code = status as number;
  const failed = code < 200 || code >= 300;
  const kind = optionalString(event.payload, 'failure_kind');
  const contactId = optionalString(event.payload, 'contact_id');
  return result(account, [
    {
      kind: failed ? 'failure' : 'step_completed',
      at: event.at,
      contact_id: contactId,
      event_id: event.id,
      data: {
        endpoint,
        status,
        body: event.payload.body ?? null,
        ...(kind ? { failure_kind: kind } : {}),
        ...(event.payload.endpoint_id ? { endpoint_id: event.payload.endpoint_id } : {}),
      },
      // `webhook_auth` and `webhook_unavailable` are different problems with different fixes, so
      // the record says which rather than collapsing both into one token (SIM-011).
      reason: failed ? (kind === 'auth' ? 'webhook_auth' : `webhook_${kind ?? 'error'}`) : null,
    },
  ]);
}
