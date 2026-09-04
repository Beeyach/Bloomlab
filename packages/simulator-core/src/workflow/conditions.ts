import {
  CONDITION_OPERATORS,
  type BranchDefinition,
  type Condition,
  type ConditionGroup,
  type ConditionOperator,
} from '../state.ts';
import { instant } from '../time.ts';
import { renderTemplate } from './merge.ts';
import type { RunView } from './view.ts';

/**
 * If/Else and condition waits (WFL-009, D-103).
 *
 * Branches are evaluated top-down and the first that matches wins; inside a branch the groups
 * are ORed and the conditions inside a group are ANDed; when nothing matches the None branch is
 * taken. That is the registry's description of the real action (GHL-WF-IF-ELSE, fidelity A),
 * and it is all structured data: a condition is a field address, an operator and a value, never
 * an expression. A missing value is explicit: only `not_exists` is true for it. Every comparison —
 * `is_not` and `not_contains` included — needs a value to compare, so a branch written as
 * "status is not cancelled" does not match a contact who has no appointment at all.
 */

export type FieldValue = string | number | boolean | string[] | null;

/** Every field a condition may read, with the value type a form can offer for it. */
export const CONDITION_FIELDS: readonly {
  field: string;
  label: string;
  kind: 'text' | 'list' | 'number' | 'flag' | 'time';
}[] = [
  { field: 'contact.first_name', label: 'Contact first name', kind: 'text' },
  { field: 'contact.last_name', label: 'Contact last name', kind: 'text' },
  { field: 'contact.email', label: 'Contact email', kind: 'text' },
  { field: 'contact.phone', label: 'Contact phone', kind: 'text' },
  { field: 'contact.tags', label: 'Contact tags', kind: 'list' },
  { field: 'contact.dnd', label: 'Contact do-not-disturb', kind: 'flag' },
  { field: 'contact.source', label: 'Contact source', kind: 'text' },
  { field: 'contact.owner_id', label: 'Contact owner', kind: 'text' },
  { field: 'appointment.status', label: 'Appointment status', kind: 'text' },
  { field: 'appointment.starts_at', label: 'Appointment start', kind: 'time' },
  { field: 'appointment.calendar_id', label: 'Appointment calendar', kind: 'text' },
  { field: 'opportunity.stage', label: 'Opportunity stage', kind: 'text' },
  { field: 'opportunity.status', label: 'Opportunity status', kind: 'text' },
  { field: 'opportunity.value', label: 'Opportunity value', kind: 'number' },
  { field: 'opportunity.pipeline_id', label: 'Opportunity pipeline', kind: 'text' },
  { field: 'message.body', label: 'Reply body', kind: 'text' },
  { field: 'message.channel', label: 'Reply channel', kind: 'text' },
];

/** The custom-field addresses this account adds to the list above. */
export const customFieldConditionFields = (
  view: Pick<RunView, 'account'>,
): { field: string; label: string; kind: 'text' | 'number' | 'flag' }[] =>
  Object.values(view.account.custom_fields).map((field) => ({
    field: `${field.object}.custom_fields.${field.key}`,
    label: field.label,
    kind: field.type === 'number' ? 'number' : field.type === 'checkbox' ? 'flag' : 'text',
  }));

/** True when the address is one the engine can read. */
export function isConditionField(field: string, view?: Pick<RunView, 'account'>): boolean {
  if (CONDITION_FIELDS.some((row) => row.field === field)) return true;
  if (!view) return /^(contact|opportunity)\.custom_fields\.[a-zA-Z0-9_]+$/.test(field);
  return customFieldConditionFields(view).some((row) => row.field === field);
}

/** Reads one address out of the view. Missing subject or missing value both read as `null`. */
export function readField(field: string, view: RunView): FieldValue {
  const [root, ...rest] = field.split('.');
  const key = rest.join('.');
  const custom = (values: Record<string, string | number | boolean>) => {
    const name = key.startsWith('custom_fields.') ? key.slice('custom_fields.'.length) : key;
    return name in values ? (values[name] as string | number | boolean) : null;
  };
  switch (root) {
    case 'contact': {
      const c = view.contact;
      switch (key) {
        case 'first_name':
          return c.first_name;
        case 'last_name':
          return c.last_name;
        case 'email':
          return c.email;
        case 'phone':
          return c.phone;
        case 'tags':
          return c.tags;
        case 'dnd':
          return c.dnd;
        case 'source':
          return c.source;
        case 'owner_id':
          return c.owner_id;
        case 'timezone':
          return c.timezone;
        default:
          return custom(c.custom_fields);
      }
    }
    case 'appointment': {
      const a = view.appointment;
      if (!a) return null;
      switch (key) {
        case 'status':
          return a.status;
        case 'starts_at':
          return a.starts_at;
        case 'calendar_id':
          return a.calendar_id;
        default:
          return null;
      }
    }
    case 'opportunity': {
      const o = view.opportunity;
      if (!o) return null;
      switch (key) {
        case 'stage':
          return o.stage;
        case 'status':
          return o.status;
        case 'value':
          return o.value;
        case 'pipeline_id':
          return o.pipeline_id;
        case 'name':
          return o.name;
        default:
          return custom(o.custom_fields);
      }
    }
    case 'message': {
      const m = view.message;
      if (!m) return null;
      return key === 'body' ? m.body : key === 'channel' ? m.channel : null;
    }
    default:
      return null;
  }
}

const normalise = (value: unknown): string =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

const present = (value: FieldValue): boolean =>
  value !== null && value !== '' && !(Array.isArray(value) && value.length === 0);

/** The expected value, with merge fields resolved against the same view (dynamic-vs-dynamic). */
function expected(condition: Condition, view: RunView): string | number | boolean | undefined {
  const raw = condition.value;
  if (typeof raw === 'string' && raw.includes('{{')) return renderTemplate(raw, view).text;
  return raw;
}

export interface ConditionEvaluation {
  field: string;
  operator: ConditionOperator;
  expected: string | number | boolean | null;
  actual: FieldValue;
  passed: boolean;
}

/**
 * One comparison of an actual value against an expected one. Trigger filters and If/Else
 * conditions both come here, so "is", "contains" and a missing value mean exactly the same thing
 * on both sides of a workflow.
 */
export function compareValues(
  operator: ConditionOperator,
  actual: FieldValue,
  target: string | number | boolean | undefined,
): boolean {
  const has = present(actual);
  const asText = Array.isArray(actual) ? actual.map(normalise) : normalise(actual ?? '');
  const targetText = normalise(target ?? '');
  const numeric = (value: FieldValue) =>
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))
        ? Number(value)
        : Date.parse(String(value));
  const targetNumeric =
    typeof target === 'number'
      ? target
      : typeof target === 'string'
        ? Number.isFinite(Number(target)) && target.trim() !== ''
          ? Number(target)
          : Number.isNaN(Date.parse(target))
            ? Number.NaN
            : instant(target)
        : Number.NaN;

  switch (operator) {
    case 'exists':
      return has;
    case 'not_exists':
      return !has;
    case 'is':
      return has && (Array.isArray(asText) ? asText.includes(targetText) : asText === targetText);
    case 'is_not':
      return has && (Array.isArray(asText) ? !asText.includes(targetText) : asText !== targetText);
    case 'contains':
      return (
        has &&
        (Array.isArray(asText)
          ? asText.some((entry) => entry.includes(targetText))
          : asText.includes(targetText))
      );
    case 'not_contains':
      return (
        has &&
        (Array.isArray(asText)
          ? !asText.some((entry) => entry.includes(targetText))
          : !asText.includes(targetText))
      );
    case 'gt': {
      const left = has && !Array.isArray(actual) ? numeric(actual) : Number.NaN;
      return Number.isFinite(left) && Number.isFinite(targetNumeric) && left > targetNumeric;
    }
    case 'lt': {
      const left = has && !Array.isArray(actual) ? numeric(actual) : Number.NaN;
      return Number.isFinite(left) && Number.isFinite(targetNumeric) && left < targetNumeric;
    }
  }
}

/** One comparison, with what it saw, so a timeline can explain the outcome (SIM-010). */
export function evaluateCondition(condition: Condition, view: RunView): ConditionEvaluation {
  const actual = readField(condition.field, view);
  const target = expected(condition, view);
  return {
    field: condition.field,
    operator: condition.operator,
    expected: target ?? null,
    actual,
    passed: compareValues(condition.operator, actual, target),
  };
}

/** A group passes when every condition in it passes (AND). An empty group never matches. */
export function evaluateGroup(group: ConditionGroup, view: RunView) {
  const evaluations = group.conditions.map((condition) => evaluateCondition(condition, view));
  return { evaluations, passed: evaluations.length > 0 && evaluations.every((row) => row.passed) };
}

/** A branch passes when any of its groups passes (OR). */
export function evaluateBranch(branch: BranchDefinition, view: RunView) {
  const groups = branch.groups.map((group) => evaluateGroup(group, view));
  return { name: branch.name, groups, passed: groups.some((group) => group.passed) };
}

export interface BranchChoice {
  /** The branch taken, or `null` for the automatic None fallback. */
  chosen: string | null;
  branches: ReturnType<typeof evaluateBranch>[];
}

/** Top-down, first match wins, None when nothing matches (registry GHL-WF-IF-ELSE). */
export function chooseBranch(branches: BranchDefinition[], view: RunView): BranchChoice {
  const evaluated: ReturnType<typeof evaluateBranch>[] = [];
  for (const branch of branches) {
    const outcome = evaluateBranch(branch, view);
    evaluated.push(outcome);
    if (outcome.passed) return { chosen: branch.name, branches: evaluated };
  }
  return { chosen: null, branches: evaluated };
}

/** True when the whole condition set (ORed groups) currently holds — the condition-wait test. */
export const conditionHolds = (groups: ConditionGroup[], view: RunView): boolean =>
  groups.some((group) => evaluateGroup(group, view).passed);

/* ---- shape checks, shared by graph validation and the definition reducers -------------- */

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Reads authored branches out of a node config, refusing anything that is not the documented shape. */
export function readBranches(raw: unknown): { branches: BranchDefinition[]; problems: string[] } {
  const problems: string[] = [];
  if (!Array.isArray(raw)) return { branches: [], problems: ['branches must be a list'] };
  const branches: BranchDefinition[] = [];
  raw.forEach((entry, index) => {
    if (!isRecord(entry) || typeof entry.name !== 'string' || entry.name.trim() === '') {
      problems.push(`branch ${index + 1} needs a name`);
      return;
    }
    if (entry.name.trim().toLowerCase() === 'none') {
      problems.push(`branch ${index + 1} may not be called None; None is the automatic fallback`);
      return;
    }
    const groups = readGroups(entry.groups, `branch "${entry.name}"`, problems);
    branches.push({ name: entry.name.trim(), groups });
  });
  const names = branches.map((branch) => branch.name.toLowerCase());
  names.forEach((name, index) => {
    if (names.indexOf(name) !== index) problems.push(`two branches are both called "${name}"`);
  });
  return { branches, problems };
}

export function readGroups(raw: unknown, where: string, problems: string[]): ConditionGroup[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    problems.push(`${where} needs at least one condition group`);
    return [];
  }
  return raw.map((group, groupIndex) => {
    const conditions = isRecord(group) && Array.isArray(group.conditions) ? group.conditions : null;
    if (!conditions || conditions.length === 0) {
      problems.push(`${where}, group ${groupIndex + 1} needs at least one condition`);
      return { conditions: [] };
    }
    return {
      conditions: conditions.map((condition, index) => {
        const label = `${where}, group ${groupIndex + 1}, condition ${index + 1}`;
        if (!isRecord(condition) || typeof condition.field !== 'string') {
          problems.push(`${label} needs a field`);
          return { field: '', operator: 'exists' as const };
        }
        if (!isConditionField(condition.field)) {
          problems.push(`${label} reads ${condition.field}, which a workflow cannot see`);
        }
        const operator = condition.operator;
        if (
          typeof operator !== 'string' ||
          !(CONDITION_OPERATORS as readonly string[]).includes(operator)
        ) {
          problems.push(`${label} has an unknown comparison ${String(operator)}`);
          return { field: condition.field, operator: 'exists' as const };
        }
        const needsValue = !['exists', 'not_exists'].includes(operator);
        const value = condition.value;
        if (needsValue && (value === undefined || value === null || value === '')) {
          problems.push(`${label} compares against nothing`);
        }
        if (value !== undefined && !['string', 'number', 'boolean'].includes(typeof value)) {
          problems.push(`${label} has a value that is not text, a number or a flag`);
        }
        const out: Condition = { field: condition.field, operator: operator as ConditionOperator };
        if (value !== undefined && value !== null) out.value = value as string | number | boolean;
        return out;
      }),
    };
  });
}
