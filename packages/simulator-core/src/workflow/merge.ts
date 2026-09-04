import { instant, partsIn } from '../time.ts';
import type { RunView } from './view.ts';

/**
 * Merge values — `{{contact.first_name}}` and the rest (D-103).
 *
 * One deterministic resolver for every template the engine renders: SMS bodies, email subjects,
 * field values, condition operands, notification text. It is data substitution and nothing more:
 * no expressions, no code, no `eval`. A value the account cannot supply renders as an empty
 * string, which is what HighLevel does with a merge field it cannot fill, and the name is
 * reported back so the execution record can say which ones came up blank.
 */

const MERGE = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

const pad = (value: number) => String(value).padStart(2, '0');

/** `3:00 pm` in the run's zone — the way a reminder text would say it. */
export function mergeTime(iso: string, zone: string): string {
  const parts = partsIn(instant(iso), zone);
  const hour12 = parts.hour % 12 === 0 ? 12 : parts.hour % 12;
  return `${hour12}:${pad(parts.minute)} ${parts.hour < 12 ? 'am' : 'pm'}`;
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** `September 4` in the run's zone. */
export function mergeDate(iso: string, zone: string): string {
  const parts = partsIn(instant(iso), zone);
  return `${MONTHS[parts.month - 1] ?? ''} ${parts.day}`.trim();
}

const text = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(String).join(', ');
  return null;
};

/**
 * The value behind one merge name, or `null` when the run cannot supply it. The vocabulary is
 * deliberately small and mirrors what the registry says the real product exposes.
 */
export function mergeValue(name: string, view: RunView): string | null {
  const [root, ...rest] = name.split('.');
  const key = rest.join('.');
  const { contact, appointment, opportunity, account } = view;
  switch (root) {
    case 'contact': {
      switch (key) {
        case 'first_name':
          return contact.first_name;
        case 'last_name':
          return contact.last_name ?? '';
        case 'full_name':
        case 'name':
          return [contact.first_name, contact.last_name].filter(Boolean).join(' ');
        case 'email':
          return contact.email ?? '';
        case 'phone':
          return contact.phone ?? '';
        case 'source':
          return contact.source ?? '';
        case 'timezone':
          return contact.timezone ?? '';
        case 'tags':
          return contact.tags.join(', ');
        case 'owner_name':
        case 'assigned_user':
          return contact.owner_id ? (account.users[contact.owner_id]?.name ?? '') : '';
        default: {
          const custom = key.startsWith('custom_fields.')
            ? key.slice('custom_fields.'.length)
            : key;
          if (custom in contact.custom_fields) return text(contact.custom_fields[custom]);
          return null;
        }
      }
    }
    case 'custom_values':
    case 'custom_value':
      return key in account.custom_values ? account.custom_values[key]! : null;
    case 'appointment': {
      if (!appointment) return null;
      switch (key) {
        case 'start_time':
          return mergeTime(appointment.starts_at, view.zone);
        case 'start_date':
          return mergeDate(appointment.starts_at, view.zone);
        case 'start':
        case 'starts_at':
          return appointment.starts_at;
        case 'status':
          return appointment.status;
        case 'calendar':
        case 'calendar_name':
          return account.calendars[appointment.calendar_id]?.name ?? appointment.calendar_id;
        default:
          return null;
      }
    }
    case 'opportunity': {
      if (!opportunity) return null;
      switch (key) {
        case 'name':
          return opportunity.name;
        case 'stage':
          return opportunity.stage;
        case 'status':
          return opportunity.status;
        case 'value':
          return String(opportunity.value);
        case 'pipeline':
        case 'pipeline_name':
          return account.pipelines[opportunity.pipeline_id]?.name ?? opportunity.pipeline_id;
        default: {
          const custom = key.startsWith('custom_fields.')
            ? key.slice('custom_fields.'.length)
            : key;
          if (custom in opportunity.custom_fields) return text(opportunity.custom_fields[custom]);
          return null;
        }
      }
    }
    case 'user': {
      const owner = contact.owner_id ? account.users[contact.owner_id] : null;
      if (!owner) return null;
      return key === 'name' ? owner.name : null;
    }
    case 'message': {
      if (!view.message) return null;
      return key === 'body' ? view.message.body : key === 'channel' ? view.message.channel : null;
    }
    default:
      return null;
  }
}

export interface Rendered {
  text: string;
  /** Merge names the run could not fill; rendered blank, reported here. */
  unresolved: string[];
}

/** Substitutes every `{{name}}`; unknown names render blank and are listed. Pure. */
export function renderTemplate(template: string, view: RunView): Rendered {
  const unresolved: string[] = [];
  const rendered = template.replace(MERGE, (_whole, name: string) => {
    const value = mergeValue(name, view);
    if (value === null) {
      if (!unresolved.includes(name)) unresolved.push(name);
      return '';
    }
    return value;
  });
  return { text: rendered, unresolved };
}

/** True when the text contains at least one merge field. */
export const hasMergeFields = (template: string): boolean => MERGE.test(template);
