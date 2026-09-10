import { fail } from './errors.ts';
import { requireString, type SimulatorEvent } from './events.ts';
import type { AccountState, Contact } from './state.ts';
import { entity, result, type ReducerResult } from './reducers/shared.ts';

export type ObjectValue = string | number | boolean;
export interface ObjectField {
  key: string;
  type: 'text' | 'number' | 'boolean';
  required: boolean;
}
export interface ObjectSchema {
  id: string;
  name: string;
  fields: ObjectField[];
}
export interface ObjectRecord {
  id: string;
  schema_id: string;
  name: string;
  values: Record<string, ObjectValue>;
  updated_at: string;
}
export interface ObjectAssociation {
  id: string;
  record_id: string;
  contact_id: string;
  label: string;
}
/** Deliberately narrow object-based automation: a record change can notify one account user.
 * It is not a contact enrollment and cannot silently send to all associated contacts. */
export interface ObjectAutomation {
  id: string;
  schema_id: string;
  on: 'created' | 'updated';
  field: string;
  equals: ObjectValue;
  recipient: string;
  message: string;
  enabled: boolean;
}
export interface SegmentRule {
  field: string;
  operator: 'is' | 'contains' | 'empty' | 'greater';
  value: ObjectValue;
}
export interface SmartList {
  id: string;
  name: string;
  match: 'all' | 'any';
  rules: SegmentRule[];
}
export interface AdvancedCrm {
  schemas: Record<string, ObjectSchema>;
  records: Record<string, ObjectRecord>;
  associations: Record<string, ObjectAssociation>;
  automations: Record<string, ObjectAutomation>;
  lists: Record<string, SmartList>;
}

/** Optional on old checkpoints; reading never changes their hash or creates a parallel store. */
export const advancedCrm = (account: AccountState): AdvancedCrm =>
  account.advanced_crm ?? {
    schemas: {},
    records: {},
    associations: {},
    automations: {},
    lists: {},
  };
const invalid = (message: string): never => fail('INVALID_PAYLOAD', message, {});
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return invalid('Expected an object.');
  return value as Record<string, unknown>;
};
const scalar = (value: unknown): ObjectValue => {
  if (
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value))
  )
    return value;
  return invalid('A value must be text, a finite number or a boolean.');
};
const identifier = (
  payload: Record<string, unknown>,
  key: string,
  event: SimulatorEvent,
): string => {
  const id = requireString(payload, key, event.type);
  if (
    !/^[a-zA-Z][a-zA-Z0-9_-]{0,79}$/.test(id) ||
    ['constructor', 'prototype', '__proto__'].includes(id)
  )
    invalid(`${key} must be a safe identifier (letters, numbers, dash or underscore).`);
  return id;
};
const valuesFor = (schema: ObjectSchema, raw: unknown): Record<string, ObjectValue> => {
  const input = object(raw);
  for (const key of Object.keys(input))
    if (!schema.fields.some((field) => field.key === key)) invalid(`Unknown object field: ${key}.`);
  const values: Record<string, ObjectValue> = {};
  for (const field of schema.fields) {
    const value = input[field.key];
    if (value === undefined) {
      if (field.required) invalid(`${field.key} is required.`);
      continue;
    }
    const typed = scalar(value);
    if (typeof typed !== (field.type === 'text' ? 'string' : field.type))
      invalid(`${field.key} must be ${field.type}.`);
    if (field.required && typed === '') invalid(`${field.key} cannot be empty.`);
    values[field.key] = typed;
  }
  return values;
};

export function advancedCrmChanged(account: AccountState, event: SimulatorEvent): ReducerResult {
  const p = event.payload;
  const id = identifier(p, 'id', event);
  const data = advancedCrm(account);
  const input = [
    {
      kind: 'input' as const,
      at: event.at,
      event_id: event.id,
      data: { id, operation: event.type },
    },
  ];
  if (event.type === 'COMPANY_SAVED') {
    const company = { id, name: requireString(p, 'name', event.type) };
    return result({ ...account, companies: { ...account.companies, [id]: company } }, input);
  }
  if (event.type === 'COMPANY_CONTACT_LINKED') {
    const contact = entity(account.contacts, id, 'contact', event.type);
    const companyId = p.company_id === null ? null : requireString(p, 'company_id', event.type);
    if (companyId) entity(account.companies, companyId, 'company', event.type);
    return result(
      {
        ...account,
        contacts: {
          ...account.contacts,
          [id]: { ...contact, company_id: companyId, updated_at: event.at },
        },
      },
      input,
    );
  }
  if (event.type === 'OBJECT_SCHEMA_SAVED') {
    if (!Array.isArray(p.fields) || p.fields.length < 1 || p.fields.length > 30)
      invalid('Define between 1 and 30 fields.');
    const fields = (p.fields as unknown[]).map((raw): ObjectField => {
      const field = object(raw);
      if (
        !['text', 'number', 'boolean'].includes(String(field.type)) ||
        typeof field.required !== 'boolean'
      )
        invalid('A field needs a supported type and a required flag.');
      return {
        key: identifier(field, 'key', event),
        type: field.type as ObjectField['type'],
        required: field.required as boolean,
      };
    });
    if (new Set(fields.map((field) => field.key)).size !== fields.length)
      invalid('Field keys must be unique.');
    const schema = { id, name: requireString(p, 'name', event.type), fields };
    for (const row of Object.values(data.records).filter((row) => row.schema_id === id))
      valuesFor(schema, row.values);
    for (const rule of Object.values(data.automations).filter((rule) => rule.schema_id === id)) {
      if (
        !fields.some(
          (field) =>
            field.key === rule.field &&
            typeof rule.equals === (field.type === 'text' ? 'string' : field.type),
        )
      )
        invalid('This edit would invalidate an object automation.');
    }
    return result(
      { ...account, advanced_crm: { ...data, schemas: { ...data.schemas, [id]: schema } } },
      input,
    );
  }
  if (event.type === 'OBJECT_RECORD_SAVED') {
    const schemaId = requireString(p, 'schema_id', event.type);
    const schema = entity(data.schemas, schemaId, 'object schema', event.type);
    const previous = data.records[id];
    if (previous && previous.schema_id !== schemaId) invalid('A record cannot change object type.');
    const record: ObjectRecord = {
      id,
      schema_id: schemaId,
      name: requireString(p, 'name', event.type),
      values: valuesFor(schema, p.values),
      updated_at: event.at,
    };
    const generated = Object.values(data.automations)
      .filter(
        (rule) =>
          rule.enabled &&
          rule.schema_id === schemaId &&
          rule.on === (previous ? 'updated' : 'created') &&
          record.values[rule.field] === rule.equals,
      )
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      .map((rule) => ({
        type: 'NOTIFICATION_SENT' as const,
        at: event.at,
        payload: {
          recipient: rule.recipient,
          message: `${rule.message} · ${record.name}`,
          object_record_id: id,
          object_automation_id: rule.id,
        },
        origin: 'generated' as const,
        source: { kind: 'reducer' as const, id: rule.id, caused_by: event.id },
      }));
    return result(
      { ...account, advanced_crm: { ...data, records: { ...data.records, [id]: record } } },
      input,
      generated,
    );
  }
  if (event.type === 'OBJECT_ASSOCIATION_SAVED') {
    const recordId = requireString(p, 'record_id', event.type);
    const contactId = requireString(p, 'contact_id', event.type);
    entity(data.records, recordId, 'object record', event.type);
    entity(account.contacts, contactId, 'contact', event.type);
    const label = requireString(p, 'label', event.type);
    if (
      Object.values(data.associations).some(
        (row) =>
          row.id !== id &&
          row.record_id === recordId &&
          row.contact_id === contactId &&
          row.label === label,
      )
    )
      invalid('That labelled association already exists.');
    const association = { id, record_id: recordId, contact_id: contactId, label };
    return result(
      {
        ...account,
        advanced_crm: { ...data, associations: { ...data.associations, [id]: association } },
      },
      input,
    );
  }
  if (event.type === 'OBJECT_AUTOMATION_SAVED') {
    const schemaId = requireString(p, 'schema_id', event.type);
    const schema = entity(data.schemas, schemaId, 'object schema', event.type);
    const field = requireString(p, 'field', event.type);
    const defined = schema.fields.find((row) => row.key === field);
    const equals = scalar(p.equals);
    if (!defined || typeof equals !== (defined.type === 'text' ? 'string' : defined.type))
      invalid('Choose a defined field and a correctly typed comparison.');
    if (!['created', 'updated'].includes(String(p.on)) || typeof p.enabled !== 'boolean')
      invalid('Choose created or updated and an enabled flag.');
    const recipient = requireString(p, 'recipient', event.type);
    entity(account.users, recipient, 'user', event.type);
    const rule: ObjectAutomation = {
      id,
      schema_id: schemaId,
      field,
      equals,
      on: p.on as ObjectAutomation['on'],
      enabled: p.enabled as boolean,
      recipient,
      message: requireString(p, 'message', event.type),
    };
    return result(
      { ...account, advanced_crm: { ...data, automations: { ...data.automations, [id]: rule } } },
      input,
    );
  }
  if (event.type === 'SMART_LIST_SAVED') {
    if (
      !['all', 'any'].includes(String(p.match)) ||
      !Array.isArray(p.rules) ||
      !p.rules.length ||
      p.rules.length > 20
    )
      invalid('A list needs all/any matching and between 1 and 20 rules.');
    const rules = (p.rules as unknown[]).map((raw): SegmentRule => {
      const rule = object(raw);
      const field = requireString(rule, 'field', event.type);
      if (
        ![
          'first_name',
          'last_name',
          'email',
          'phone',
          'source',
          'tags',
          'dnd',
          'company_id',
          'opportunity_status',
        ].includes(field) &&
        !(
          field.startsWith('custom_fields.') &&
          account.custom_fields[field.slice(14)]?.object === 'contact'
        )
      )
        invalid(`Unsupported segment field: ${field}.`);
      if (!['is', 'contains', 'empty', 'greater'].includes(String(rule.operator)))
        invalid('Unsupported segment operator.');
      const value = scalar(rule.value);
      if (rule.operator === 'greater' && typeof value !== 'number')
        invalid('Greater than needs a number.');
      return { field, operator: rule.operator as SegmentRule['operator'], value };
    });
    const list: SmartList = {
      id,
      name: requireString(p, 'name', event.type),
      match: p.match as SmartList['match'],
      rules,
    };
    return result(
      { ...account, advanced_crm: { ...data, lists: { ...data.lists, [id]: list } } },
      input,
    );
  }
  return invalid('Unsupported advanced CRM operation.');
}

/** Live projection, never a saved membership or a decorative count. Missing values stay missing. */
export function segmentContacts(account: AccountState, list: SmartList): Contact[] {
  return Object.values(account.contacts)
    .filter((contact) => {
      const matches = list.rules.map((rule) => {
        const value: unknown =
          rule.field === 'opportunity_status'
            ? Object.values(account.opportunities)
                .filter((row) => row.contact_id === contact.id)
                .map((row) => row.status)
            : rule.field.startsWith('custom_fields.')
              ? contact.custom_fields[rule.field.slice(14)]
              : contact[rule.field as keyof Contact];
        if (rule.operator === 'empty')
          return (
            value === undefined ||
            value === null ||
            value === '' ||
            (Array.isArray(value) && value.length === 0)
          );
        if (rule.operator === 'greater')
          return typeof value === 'number' && typeof rule.value === 'number' && value > rule.value;
        if (rule.operator === 'contains')
          return typeof value === 'string' && typeof rule.value === 'string'
            ? value.toLowerCase().includes(rule.value.toLowerCase())
            : Array.isArray(value) && value.includes(rule.value);
        return Array.isArray(value) ? value.includes(rule.value) : value === rule.value;
      });
      return list.match === 'all' ? matches.every(Boolean) : matches.some(Boolean);
    })
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
