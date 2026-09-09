import { describe, it, expect } from 'vitest';
import {
  createRun,
  processEvent,
  advancedCrm,
  segmentContacts,
  replay,
  historyHash,
  checkpoint,
  assertCheckpoint,
  type SimulatorState,
  type SimulatorEventType,
} from '../src/index.ts';

const scenario = {
  id: 'SC-advanced-crm',
  simulation_time: '2026-09-09T09:00:00Z',
  timezone: 'UTC',
  seed: 25,
  initial_account_state: {
    users: [{ id: 'owner', name: 'Owner', role: 'admin' as const }],
    contacts: [
      { id: 'a', first_name: 'Ada', tags: ['lead'] },
      { id: 'b', first_name: 'Bo', dnd: true },
    ],
    custom_fields: [{ key: 'score', label: 'Score', type: 'number' as const }],
  },
};
const start = () => createRun(scenario, { run_id: 'advanced-crm' });
const fire = (state: SimulatorState, type: SimulatorEventType, payload: Record<string, unknown>) =>
  processEvent(state, { type, payload, at: state.clock.now, origin: 'injected' });
const schema = {
  id: 'properties',
  name: 'Properties',
  fields: [
    { key: 'value', type: 'number', required: true },
    { key: 'ready', type: 'boolean', required: false },
  ],
};

describe('advanced shared CRM', () => {
  it('keeps historical checkpoints unchanged until an advanced edit; company links are references', () => {
    const state = start();
    const cp = checkpoint(state);
    expect(advancedCrm(state.account).records).toEqual({});
    assertCheckpoint(cp, state.run_id);
    expect(state.account).not.toHaveProperty('advanced_crm');
    let next = fire(state, 'COMPANY_SAVED', { id: 'agency', name: 'Training Agency' });
    next = fire(next, 'COMPANY_CONTACT_LINKED', { id: 'a', company_id: 'agency' });
    next = fire(next, 'COMPANY_SAVED', { id: 'agency', name: 'Renamed Agency' });
    expect(next.account.contacts.a?.company_id).toBe('agency');
    expect(Object.keys(next.account.contacts)).toHaveLength(2);
    expect(() =>
      fire(next, 'COMPANY_CONTACT_LINKED', { id: 'a', company_id: 'missing' }),
    ).toThrow();
    expect(
      fire(next, 'COMPANY_CONTACT_LINKED', { id: 'a', company_id: null }).account.contacts.a
        ?.company_id,
    ).toBeNull();
  });
  it('validates schemas and records atomically while allowing excessive but valid modelling', () => {
    const state = fire(start(), 'OBJECT_SCHEMA_SAVED', schema);
    expect(() =>
      fire(state, 'OBJECT_SCHEMA_SAVED', {
        ...schema,
        fields: [...schema.fields, schema.fields[0]],
      }),
    ).toThrow();
    expect(() => fire(state, 'OBJECT_SCHEMA_SAVED', { ...schema, id: '__proto__' })).toThrow();
    for (const values of [{}, { value: '12' }, { value: 12, unknown: true }, { value: Infinity }])
      expect(() =>
        fire(state, 'OBJECT_RECORD_SAVED', {
          id: 'home',
          schema_id: 'properties',
          name: 'Home',
          values,
        }),
      ).toThrow();
    const next = fire(state, 'OBJECT_RECORD_SAVED', {
      id: 'home',
      schema_id: 'properties',
      name: 'Home',
      values: { value: 12, ready: true },
    });
    expect(advancedCrm(state.account).records).toEqual({});
    expect(() =>
      fire(next, 'OBJECT_SCHEMA_SAVED', {
        ...schema,
        fields: [{ key: 'value', type: 'text', required: true }],
      }),
    ).toThrow();
    expect(
      advancedCrm(
        fire(next, 'OBJECT_SCHEMA_SAVED', { ...schema, id: 'duplicate_leads', name: 'Leads again' })
          .account,
      ).schemas.duplicate_leads,
    ).toBeDefined();
  });
  it('supports labelled many-to-many associations and refuses dangling/duplicate links', () => {
    let state = fire(start(), 'OBJECT_SCHEMA_SAVED', schema);
    state = fire(state, 'OBJECT_RECORD_SAVED', {
      id: 'home',
      schema_id: 'properties',
      name: 'Home',
      values: { value: 12 },
    });
    for (const id of ['a', 'b'])
      state = fire(state, 'OBJECT_ASSOCIATION_SAVED', {
        id: `link-${id}`,
        record_id: 'home',
        contact_id: id,
        label: 'Owner',
      });
    expect(Object.keys(advancedCrm(state.account).associations)).toHaveLength(2);
    expect(() =>
      fire(state, 'OBJECT_ASSOCIATION_SAVED', {
        id: 'again',
        record_id: 'home',
        contact_id: 'a',
        label: 'Owner',
      }),
    ).toThrow();
    expect(() =>
      fire(state, 'OBJECT_ASSOCIATION_SAVED', {
        id: 'bad',
        record_id: 'missing',
        contact_id: 'a',
        label: 'Owner',
      }),
    ).toThrow();
  });
  it('runs object conditions through generated shared events, with no contact message or real delivery; replay is exact', () => {
    let state = fire(start(), 'OBJECT_SCHEMA_SAVED', schema);
    const automation = {
      id: 'notify',
      schema_id: 'properties',
      on: 'created',
      field: 'ready',
      equals: true,
      recipient: 'owner',
      message: 'Review property',
      enabled: true,
    };
    state = fire(state, 'OBJECT_AUTOMATION_SAVED', automation);
    state = fire(state, 'OBJECT_RECORD_SAVED', {
      id: 'home',
      schema_id: 'properties',
      name: 'Home',
      values: { value: 12, ready: true },
    });
    expect(state.log.at(-1)?.type).toBe('NOTIFICATION_SENT');
    expect(state.execution.at(-1)?.data.delivered).toBe(false);
    expect(state.account.conversations).toEqual({});
    state = fire(state, 'OBJECT_RECORD_SAVED', {
      id: 'home',
      schema_id: 'properties',
      name: 'Home edited',
      values: { value: 20, ready: true },
    });
    expect(state.log.filter((e) => e.type === 'NOTIFICATION_SENT')).toHaveLength(1);
    state = fire(state, 'OBJECT_AUTOMATION_SAVED', {
      ...automation,
      on: 'updated',
      enabled: false,
    });
    state = fire(state, 'OBJECT_RECORD_SAVED', {
      id: 'home',
      schema_id: 'properties',
      name: 'Home',
      values: { value: 30, ready: true },
    });
    expect(state.log.filter((e) => e.type === 'NOTIFICATION_SENT')).toHaveLength(1);
    expect(historyHash(replay(scenario, state.log, { run_id: state.run_id }))).toBe(
      historyHash(state),
    );
  });
  it('segments current account data with typed AND/OR, missing values and changing membership', () => {
    let state = fire(start(), 'SMART_LIST_SAVED', {
      id: 'audience',
      name: 'Reachable leads',
      match: 'all',
      rules: [
        { field: 'tags', operator: 'is', value: 'lead' },
        { field: 'dnd', operator: 'is', value: false },
      ],
    });
    const list = advancedCrm(state.account).lists.audience!;
    expect(segmentContacts(state.account, list).map((c) => c.id)).toEqual(['a']);
    state = fire(state, 'CONTACT_UPDATED', { contact_id: 'a', dnd: true });
    expect(segmentContacts(state.account, list)).toEqual([]);
    expect(segmentContacts(state.account, { ...list, match: 'any' }).map((c) => c.id)).toEqual([
      'a',
    ]);
    expect(
      segmentContacts(state.account, {
        ...list,
        rules: [{ field: 'email', operator: 'empty', value: '' }],
      }),
    ).toHaveLength(2);
    state = fire(state, 'CONTACT_UPDATED', { contact_id: 'b', custom_fields: { score: 5 } });
    expect(
      segmentContacts(state.account, {
        ...list,
        rules: [{ field: 'custom_fields.score', operator: 'greater', value: 4 }],
      }).map((c) => c.id),
    ).toEqual(['b']);
    expect(() =>
      fire(state, 'SMART_LIST_SAVED', {
        ...list,
        rules: [{ field: 'invented', operator: 'is', value: '' }],
      }),
    ).toThrow();
  });
});
