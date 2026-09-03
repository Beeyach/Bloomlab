/** Keys that could reach the prototype chain; a content path may never resolve through them. */
const UNSAFE = new Set(['__proto__', 'constructor', 'prototype']);

export interface Resolved {
  found: boolean;
  value: unknown;
}

/**
 * Resolves a dotted content path (`opportunities.opp-maria.stage`, `contacts.maria.tags`) against
 * a plain object tree. No `eval`, no function calls, no prototype access: a path either names a
 * real own property at every step or it is simply not found.
 */
export function resolvePath(root: unknown, path: string): Resolved {
  const segments = path.split('.').filter((segment) => segment.length > 0);
  if (segments.length === 0) return { found: false, value: undefined };
  let current: unknown = root;
  for (const segment of segments) {
    if (UNSAFE.has(segment)) return { found: false, value: undefined };
    if (current === null || current === undefined) return { found: false, value: undefined };
    if (Array.isArray(current)) {
      const index = Number(segment);
      if (!Number.isInteger(index) || index < 0 || index >= current.length) {
        return { found: false, value: undefined };
      }
      current = current[index];
      continue;
    }
    if (typeof current !== 'object') return { found: false, value: undefined };
    const record = current as Record<string, unknown>;
    if (!Object.prototype.hasOwnProperty.call(record, segment)) {
      return { found: false, value: undefined };
    }
    current = record[segment];
  }
  return { found: true, value: current };
}

/** How a value reads in a report line: short, unambiguous, and never `[object Object]`. */
export function describeValue(value: unknown): string {
  if (value === undefined) return 'not found';
  if (value === null) return 'null';
  if (Array.isArray(value)) return `[${value.map((item) => describeValue(item)).join(', ')}]`;
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
