import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  SIMULATOR_EVENT_TYPES,
  SIMULATOR_VERSION,
  REDUCED_EVENT_TYPES,
  contentEventName,
  createRun,
  eventTypeFromContent,
  historyHash,
  processEvent,
  stateHash,
} from '../src/index.ts';
import { NOW, event, scenario } from './fixtures.ts';

/** Core purity (SIM-002, SIM-003): what the package is not allowed to touch, proven from source. */

function sources(directory: string, found: string[] = []): string[] {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) sources(path, found);
    else if (entry.name.endsWith('.ts')) found.push(path);
  }
  return found;
}

const SRC = join(process.cwd(), 'packages', 'simulator-core', 'src');

/**
 * Comments are stripped before the scan. The rule is about what the code does, and these files
 * describe the prohibitions in prose — a doc comment saying "no `Math.random()`" must not read as
 * a violation of itself.
 */
const withoutComments = (code: string) =>
  code.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');

const FILES = sources(SRC).map((path) => ({
  path,
  code: withoutComments(readFileSync(path, 'utf8')),
}));

describe('the package touches nothing outside itself (SIM-002)', () => {
  it('has source files to check', () => {
    expect(FILES.length).toBeGreaterThan(10);
  });

  it.each([
    ['React', /from 'react|require\('react/],
    ['the DOM', /\b(document|window|navigator|localStorage)\./],
    ['IndexedDB or Dexie', /indexedDB|from 'dexie'/i],
    ['Cloudflare or the network', /\bfetch\(|XMLHttpRequest|WebSocket|cloudflare/i],
    ['Claude or any AI gateway', /anthropic|claude|openai/i],
    ['uncontrolled randomness', /Math\.random/],
    ['the wall clock', /Date\.now\(\)|new Date\(\)/],
  ])('never reaches for %s', (_what, pattern) => {
    const offenders = FILES.filter(({ code }) => pattern.test(code)).map(({ path }) =>
      path.slice(SRC.length + 1),
    );
    expect(offenders).toEqual([]);
  });

  it('reads the machine timezone nowhere', () => {
    // `resolvedOptions().timeZone` is how code accidentally picks up the user's zone. Zones are
    // data the scenario supplies; the engine must never ask the device for one.
    const offenders = FILES.filter(({ code }) => /resolvedOptions\(\)/.test(code));
    expect(offenders.map((file) => file.path)).toEqual([]);
  });

  it('imports nothing but its own modules', () => {
    const external = FILES.flatMap(({ path, code }) =>
      [...code.matchAll(/from '([^']+)'/g)]
        .map((match) => match[1] ?? '')
        .filter((source) => !source.startsWith('.'))
        .map((source) => `${path.slice(SRC.length + 1)} -> ${source}`),
    );
    expect(external).toEqual([]);
  });
});

describe('every catalogue event has a transition (SIM-005)', () => {
  it('covers the catalogue exactly', () => {
    expect([...REDUCED_EVENT_TYPES].sort()).toEqual([...SIMULATOR_EVENT_TYPES].sort());
  });

  it('maps every type to the authored name content uses, and back', () => {
    for (const type of SIMULATOR_EVENT_TYPES) {
      const name = contentEventName(type);
      expect(name).toMatch(/^[a-z]+\.[a-z_]+$/);
      expect(eventTypeFromContent(name)).toBe(type);
    }
  });

  it('keeps the names the spec wrote', () => {
    // These are the catalogue from spec §44; they are not renamed casually.
    expect(SIMULATOR_EVENT_TYPES).toContain('APPOINTMENT_STATUS_CHANGED');
    expect(SIMULATOR_EVENT_TYPES).toContain('PIPELINE_STAGE_CHANGED');
    expect(SIMULATOR_EVENT_TYPES).toContain('EMAIL_OPENED');
    expect(SIMULATOR_EVENT_TYPES).toContain('WEBHOOK_RESPONSE');
    expect(SIMULATOR_EVENT_TYPES).toHaveLength(44);
  });
});

describe('transitions are pure (SIM-003)', () => {
  it('produces the same result from the same input, every time', () => {
    const start = createRun(scenario());
    const once = processEvent(
      start,
      event('TAG_ADDED', NOW, { contact_id: 'maria', tag: 'booked' }),
    );
    const twice = processEvent(
      start,
      event('TAG_ADDED', NOW, { contact_id: 'maria', tag: 'booked' }),
    );
    expect(stateHash(once)).toBe(stateHash(twice));
  });

  it('does not mutate the state it is given', () => {
    const start = createRun(scenario());
    const before = stateHash(start);
    const snapshot = structuredClone(start);
    processEvent(
      start,
      event('CONTACT_UPDATED', NOW, { contact_id: 'maria', phone: '+15125550001' }),
    );
    expect(stateHash(start)).toBe(before);
    expect(start).toEqual(snapshot);
  });

  it('does not mutate the account collections it copies from', () => {
    const start = createRun(scenario());
    const contactBefore = structuredClone(start.account.contacts.maria);
    const next = processEvent(
      start,
      event('TAG_ADDED', NOW, { contact_id: 'maria', tag: 'booked' }),
    );
    expect(start.account.contacts.maria).toEqual(contactBefore);
    expect(next.account.contacts.maria?.tags).toContain('booked');
    expect(start.account.contacts.maria?.tags).not.toContain('booked');
  });

  it('never advances the clock by itself', () => {
    const start = createRun(scenario());
    const next = processEvent(
      start,
      event('TAG_ADDED', NOW, { contact_id: 'maria', tag: 'booked' }),
    );
    expect(next.clock.now).toBe(start.clock.now);
  });

  it('carries the engine version on every run', () => {
    expect(createRun(scenario()).version).toBe(SIMULATOR_VERSION);
    expect(SIMULATOR_VERSION).toMatch(/^\d{4}\.\d{2}\.\d{2}-r\d+$/);
  });

  it('hashes history independently of property order', () => {
    const start = createRun(scenario());
    const next = processEvent(
      start,
      event('TAG_ADDED', NOW, { contact_id: 'maria', tag: 'booked' }),
    );
    // Same data, every object rebuilt with its keys inserted in the opposite order.
    const reorder = (value: unknown): unknown => {
      if (Array.isArray(value)) return value.map(reorder);
      if (value === null || typeof value !== 'object') return value;
      const entries = Object.entries(value as Record<string, unknown>).reverse();
      return Object.fromEntries(entries.map(([key, item]) => [key, reorder(item)]));
    };
    const reordered = reorder(next) as typeof next;
    expect(reordered).toEqual(next);
    expect(historyHash(reordered)).toBe(historyHash(next));
  });
});
