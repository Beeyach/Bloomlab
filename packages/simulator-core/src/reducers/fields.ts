import { fail } from '../errors.ts';
import {
  optionalStringList,
  requireString,
  type EventPayload,
  type SimulatorEvent,
} from '../events.ts';
import {
  CUSTOM_FIELD_TYPES,
  type AccountState,
  type CustomField,
  type CustomFieldType,
} from '../state.ts';
import { entity, put, result, type ReducerResult } from './shared.ts';

/**
 * Custom field definitions (CRM-001, D-090).
 *
 * A definition is the thing a value is checked against, so it is authored and edited as its own
 * event rather than appearing implicitly the first time somebody sets a value. A field belongs to
 * one object — `contact` or `opportunity` — and that is fixed at definition time: moving a field
 * between objects would orphan every value already stored under it, so it is refused rather than
 * silently migrated.
 *
 * `dropdown` is the one type that needs more than a name to be usable. A dropdown with no options
 * is a field the learner can define but never fill in, so options are required for that type and
 * refused for every other, where they would be a promise the UI could not keep.
 */

const KEY = /^[a-z][a-z0-9_]*$/;

const isFieldType = (value: unknown): value is CustomFieldType =>
  typeof value === 'string' && (CUSTOM_FIELD_TYPES as readonly string[]).includes(value);

/** Options belong to a dropdown and to nothing else, and a dropdown cannot do without them. */
function readOptions(
  payload: EventPayload,
  type: CustomFieldType,
  eventType: SimulatorEvent['type'],
): string[] | null {
  const options = optionalStringList(payload, 'options', eventType);
  if (type === 'dropdown') {
    if (!options || options.length === 0) {
      fail('INVALID_PAYLOAD', 'A dropdown field needs the options it offers', { payload });
    }
    const unique = new Set(options);
    if (unique.size !== options.length) {
      fail('INVALID_PAYLOAD', 'A dropdown field cannot offer the same option twice', { options });
    }
    return [...options];
  }
  if (options) {
    fail('INVALID_PAYLOAD', `Only a dropdown field has options; ${type} does not`, { type });
  }
  return null;
}

export function fieldDefined(account: AccountState, event: SimulatorEvent): ReducerResult {
  const key = requireString(event.payload, 'key', event.type);
  if (!KEY.test(key)) {
    fail('INVALID_PAYLOAD', `A field key is lower case, starts with a letter: ${key}`, { key });
  }
  if (account.custom_fields[key]) {
    fail('DUPLICATE_ENTITY', `A custom field ${key} already exists`, {
      key,
      object: account.custom_fields[key]?.object,
    });
  }
  const rawType = event.payload.type;
  if (!isFieldType(rawType)) {
    fail('INVALID_PAYLOAD', `${event.type} needs one of ${CUSTOM_FIELD_TYPES.join(', ')}`, {
      type: rawType,
    });
  }
  const object = event.payload.object ?? 'contact';
  if (object !== 'contact' && object !== 'opportunity') {
    fail('INVALID_PAYLOAD', 'A custom field belongs to a contact or an opportunity', { object });
  }
  const field: CustomField = {
    key,
    label: requireString(event.payload, 'label', event.type),
    type: rawType,
    object,
    options: readOptions(event.payload, rawType, event.type),
  };
  return result({ ...account, custom_fields: put(account.custom_fields, key, field) }, [
    {
      kind: 'input',
      at: event.at,
      event_id: event.id,
      data: { key, label: field.label, type: field.type, object: field.object },
    },
  ]);
}

export function fieldUpdated(account: AccountState, event: SimulatorEvent): ReducerResult {
  const key = requireString(event.payload, 'key', event.type);
  const existing = entity(account.custom_fields, key, 'custom field', event.type);
  const changed: Record<string, unknown> = {};
  const updated: CustomField = { ...existing };

  // The type and the object are what every stored value was written against. Changing either
  // would leave values behind that no longer mean what they say, so both are refused here rather
  // than migrated silently — the learner deletes and redefines, and sees the cost of that.
  if (event.payload.type !== undefined && event.payload.type !== existing.type) {
    fail(
      'INVALID_PAYLOAD',
      `A field's type is fixed once values exist; ${key} is ${existing.type}`,
      {
        key,
        type: existing.type,
        requested: event.payload.type,
      },
    );
  }
  if (event.payload.object !== undefined && event.payload.object !== existing.object) {
    fail('INVALID_PAYLOAD', `A field belongs to one object; ${key} is a ${existing.object} field`, {
      key,
      object: existing.object,
    });
  }

  if (event.payload.label !== undefined) {
    updated.label = requireString(event.payload, 'label', event.type);
    changed.label = updated.label;
  }
  if (event.payload.options !== undefined) {
    updated.options = readOptions(event.payload, existing.type, event.type);
    changed.options = updated.options;
  }

  return result({ ...account, custom_fields: put(account.custom_fields, key, updated) }, [
    { kind: 'step_completed', at: event.at, event_id: event.id, data: { key, changed } },
  ]);
}
