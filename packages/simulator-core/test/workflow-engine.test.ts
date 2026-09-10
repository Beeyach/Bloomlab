import { describe, expect, it } from 'vitest';

import {
  MAX_ENROLMENTS_IN_ONE_CHAIN,
  RUNNABLE_FEATURES,
  SimulatorError,
  actionCapabilityFor,
  advanceTo,
  capabilityFor,
  createRun,
  processEvent,
  renderTemplate,
  triggerCapabilityFor,
  validateWorkflowGraph,
  viewFor,
  waitToken,
  type SimulatorState,
  type Workflow,
} from '../src/index.ts';
import { NOW, event } from './fixtures.ts';
import {
  booked,
  clinicWith,
  edge,
  end,
  enrol,
  ifElse,
  messagesTo,
  onlyRun,
  records,
  runsOf,
  sms,
  tag,
  wait,
  workflow,
} from './fixtures/workflows.ts';

/**
 * The workflow engine, piece by piece (WFL-001..WFL-011, SIM-010).
 *
 * The regression fixtures pin whole behaviours; these tests pin the parts a Lab leans on
 * directly — graph validation words, definition versioning, merge fields, the capability
 * registry — and the refusals: what the engine will not run and how it says so.
 */

const refusal = (thunk: () => unknown): string => {
  try {
    thunk();
  } catch (error) {
    if (error instanceof SimulatorError) return error.code;
    throw error;
  }
  throw new Error('expected a refusal');
};

const definitionOf = (state: SimulatorState, id: string): Workflow => {
  const found = state.account.workflows[id];
  if (!found) throw new Error(`no workflow ${id}`);
  return found;
};

const graph = (spec: Parameters<typeof workflow>[0]) => {
  const state = createRun(clinicWith([workflow(spec)]));
  return validateWorkflowGraph(definitionOf(state, spec.id), state.account);
};

const codes = (spec: Parameters<typeof workflow>[0]) => graph(spec).map((issue) => issue.code);

describe('graph validation refuses what cannot run (WFL-003)', () => {
  it('passes a straight, complete workflow', () => {
    expect(
      graph({
        id: 'ok',
        trigger: { ghl_feature_id: 'GHL-WF-CONTACT-CREATED' },
        nodes: [sms('s1', 'Hi'), tag('t1', 'hi'), end('e1')],
      }),
    ).toEqual([]);
  });

  it('names a missing trigger and empty steps', () => {
    expect(codes({ id: 'empty', trigger: { ghl_feature_id: '' }, nodes: [] })).toEqual(
      expect.arrayContaining(['NO_TRIGGER', 'NO_NODES']),
    );
  });

  it('refuses a feature the registry does not run, and never calls it runnable', () => {
    const issues = graph({
      id: 'snap',
      trigger: { ghl_feature_id: 'GHL-WF-CONTACT-CREATED' },
      nodes: [
        {
          id: 'x1',
          type: 'action',
          ghl_feature_id: 'GHL-SNAP-SNAPSHOTS',
          config: {},
          position: { x: 0, y: 0 },
        },
      ],
    });
    expect(issues.map((issue) => issue.code)).toContain('UNSUPPORTED_FEATURE');
    expect(issues[0]?.node_id).toBe('x1');
    expect(capabilityFor('GHL-SNAP-SNAPSHOTS')).toBeNull();
    expect(RUNNABLE_FEATURES).not.toContain('GHL-SNAP-SNAPSHOTS');
  });

  it('refuses a cycle', () => {
    expect(
      codes({
        id: 'loop',
        trigger: { ghl_feature_id: 'GHL-WF-CONTACT-CREATED' },
        nodes: [tag('a', 'a'), tag('b', 'b'), tag('c', 'c')],
        edges: [edge('a', 'b'), edge('b', 'c'), edge('c', 'b')],
      }),
    ).toContain('CYCLE');
  });

  it('refuses two entry points and a step nothing leads to', () => {
    const found = codes({
      id: 'split',
      trigger: { ghl_feature_id: 'GHL-WF-CONTACT-CREATED' },
      nodes: [tag('a', 'a'), tag('b', 'b'), tag('c', 'c')],
      edges: [edge('a', 'c')],
    });
    expect(found).toContain('MULTIPLE_ENTRY');
  });

  it('refuses a step with two plain connections onward', () => {
    expect(
      codes({
        id: 'fork',
        trigger: { ghl_feature_id: 'GHL-WF-CONTACT-CREATED' },
        nodes: [tag('a', 'a'), tag('b', 'b'), tag('c', 'c')],
        edges: [edge('a', 'b'), edge('a', 'c')],
      }),
    ).toContain('AMBIGUOUS_NEXT');
  });

  it('checks a branch has a connection for every named branch and a None path', () => {
    const found = codes({
      id: 'branchy',
      trigger: { ghl_feature_id: 'GHL-WF-CONTACT-CREATED' },
      nodes: [
        ifElse('b1', [
          {
            name: 'Yes',
            groups: [{ conditions: [{ field: 'contact.email', operator: 'exists' }] }],
          },
        ]),
        tag('t1', 'yes'),
      ],
      edges: [edge('b1', 't1', 'Maybe')],
    });
    expect(found).toContain('BRANCH_EDGE_MISMATCH');
    expect(found).toContain('BRANCH_NO_FALLBACK');
  });

  it('reports a config problem in the registry action’s own words', () => {
    const issues = graph({
      id: 'blank',
      trigger: { ghl_feature_id: 'GHL-WF-CONTACT-CREATED' },
      nodes: [sms('s1', '')],
    });
    expect(issues).toEqual([
      expect.objectContaining({
        code: 'INVALID_CONFIG',
        node_id: 's1',
        message: 'Send SMS needs a message',
      }),
    ]);
  });

  it('refuses a condition that reads a field a workflow cannot see', () => {
    const issues = graph({
      id: 'peek',
      trigger: { ghl_feature_id: 'GHL-WF-CONTACT-CREATED' },
      nodes: [
        ifElse('b1', [
          {
            name: 'Odd',
            groups: [{ conditions: [{ field: 'account.secret', operator: 'exists' }] }],
          },
        ]),
        end('e1'),
        end('e2'),
      ],
      edges: [edge('b1', 'e1', 'Odd'), edge('b1', 'e2', 'None')],
    });
    expect(issues.map((issue) => issue.code)).toContain('INVALID_CONFIG');
    expect(issues.some((issue) => issue.message.includes('account.secret'))).toBe(true);
  });

  it('refuses an unknown trigger filter and a filter comparing against nothing', () => {
    const found = codes({
      id: 'filters',
      trigger: {
        ghl_feature_id: 'GHL-WF-CONTACT-TAG',
        filters: [
          { field: 'colour', operator: 'is', value: 'blue' },
          { field: 'tag', operator: 'is' },
        ],
      },
      nodes: [end('e1')],
    });
    expect(found).toContain('UNKNOWN_FILTER');
    expect(found).toContain('INVALID_FILTER');
  });
});

describe('definitions are account events (WFL-002, D-104, D-107)', () => {
  const definition = {
    id: 'wf-new',
    name: 'Brand new',
    trigger: { ghl_feature_id: 'GHL-WF-CONTACT-CREATED', filters: [] },
    nodes: [
      {
        id: 'n1',
        type: 'action',
        ghl_feature_id: 'GHL-WF-ADD-CONTACT-TAG',
        config: { tag: 'new' },
        position: { x: 0, y: 0 },
      },
    ],
    edges: [],
    settings: { allow_reentry: false, timezone: 'America/Chicago' },
  };

  it('creates a workflow at version 1 and updates it to version 2', () => {
    let state = processEvent(
      createRun(clinicWith([])),
      event('WORKFLOW_CREATED', NOW, { workflow: definition }),
    );
    expect(definitionOf(state, 'wf-new').version).toBe(1);
    expect(records(state, 'input')[0]?.reason).toBe('workflow_created');
    state = processEvent(
      state,
      event('WORKFLOW_UPDATED', NOW, {
        workflow_id: 'wf-new',
        workflow: { ...definition, name: 'Renamed' },
      }),
    );
    expect(definitionOf(state, 'wf-new')).toMatchObject({ name: 'Renamed', version: 2 });
  });

  it('a run remembers the version it enrolled against after the definition moves on', () => {
    let state = processEvent(
      createRun(clinicWith([])),
      event('WORKFLOW_CREATED', NOW, { workflow: definition }),
    );
    state = processEvent(state, enrol('wf-new', 'maria'));
    const hashBefore = onlyRun(state).definition_hash;
    state = processEvent(
      state,
      event('WORKFLOW_UPDATED', NOW, {
        workflow_id: 'wf-new',
        workflow: {
          ...definition,
          nodes: [{ ...definition.nodes[0], config: { tag: 'changed' } }],
        },
      }),
    );
    expect(definitionOf(state, 'wf-new').version).toBe(2);
    expect(onlyRun(state)).toMatchObject({ definition_version: 1, definition_hash: hashBefore });
    // And a fresh enrolment sees the new behaviour with a new hash.
    state = processEvent(state, enrol('wf-new', 'lena'));
    const lena = runsOf(state).find((run) => run.contact_id === 'lena');
    expect(lena?.definition_version).toBe(2);
    expect(lena?.definition_hash).not.toBe(hashBefore);
  });

  it('refuses a duplicate id, an unknown node type, an edge to nowhere and a bad timezone', () => {
    const base = createRun(clinicWith([]));
    const created = processEvent(base, event('WORKFLOW_CREATED', NOW, { workflow: definition }));
    expect(
      refusal(() =>
        processEvent(created, event('WORKFLOW_CREATED', NOW, { workflow: definition })),
      ),
    ).toBe('DUPLICATE_ENTITY');
    expect(
      refusal(() =>
        processEvent(
          base,
          event('WORKFLOW_CREATED', NOW, {
            workflow: { ...definition, nodes: [{ ...definition.nodes[0], type: 'magic' }] },
          }),
        ),
      ),
    ).toBe('INVALID_PAYLOAD');
    expect(
      refusal(() =>
        processEvent(
          base,
          event('WORKFLOW_CREATED', NOW, {
            workflow: { ...definition, edges: [{ from: 'n1', to: 'ghost' }] },
          }),
        ),
      ),
    ).toBe('UNKNOWN_ENTITY');
    expect(
      refusal(() =>
        processEvent(
          base,
          event('WORKFLOW_CREATED', NOW, {
            workflow: { ...definition, settings: { timezone: 'Mars/Olympus' } },
          }),
        ),
      ),
    ).toBe('INVALID_TIMEZONE');
  });

  it('stores half-built work: a saved definition need not be runnable', () => {
    const state = processEvent(
      createRun(clinicWith([])),
      event('WORKFLOW_CREATED', NOW, {
        workflow: { ...definition, trigger: { ghl_feature_id: '', filters: [] }, nodes: [] },
      }),
    );
    expect(definitionOf(state, 'wf-new').nodes).toEqual([]);
    expect(
      validateWorkflowGraph(definitionOf(state, 'wf-new'), state.account).length,
    ).toBeGreaterThan(0);
  });

  it('refuses a definition event with code in it: config is data only', () => {
    const state = processEvent(
      createRun(clinicWith([])),
      event('WORKFLOW_CREATED', NOW, {
        workflow: {
          ...definition,
          nodes: [{ ...definition.nodes[0], config: { tag: 'x', run: () => 'never' } }],
        },
      }),
    );
    // Functions do not survive; the stored config is plain data.
    expect(definitionOf(state, 'wf-new').nodes[0]?.config).toEqual({ tag: 'x' });
  });
});

describe('merge fields are data substitution (WFL-004)', () => {
  const viewOf = (state: SimulatorState) => {
    const run = onlyRun(state);
    const view = viewFor(
      state.account,
      definitionOf(state, run.workflow_id),
      run,
      state.clock.timezone,
      state.clock.now,
    );
    if (!view) throw new Error('no view');
    return view;
  };

  it('fills contact, appointment and custom values, and reports what it could not', () => {
    const wf = workflow({
      id: 'wf-merge',
      trigger: { ghl_feature_id: 'GHL-WF-CUSTOMER-BOOKED-APPOINTMENT' },
      nodes: [wait('w1', { wait_type: 'period', hours: 1 })],
    });
    const state = processEvent(
      createRun(clinicWith([wf])),
      booked('maria', 'a1', '2026-09-05T14:00:00-05:00'),
    );
    const out = renderTemplate(
      'Hi {{contact.first_name}}, see you {{appointment.start_date}} at {{appointment.start_time}}. Call {{custom_values.front_desk_phone}}. {{contact.custom_fields.consult_outcome}}{{nonsense.field}}',
      viewOf(state),
    );
    expect(out.text).toBe('Hi Maria, see you September 5 at 2:00 pm. Call +15125550100. ');
    expect(out.unresolved).toEqual(['contact.custom_fields.consult_outcome', 'nonsense.field']);
  });

  it('never evaluates what is inside the braces', () => {
    const wf = workflow({
      id: 'wf-merge',
      trigger: { ghl_feature_id: 'GHL-WF-CONTACT-CREATED' },
      nodes: [wait('w1', { wait_type: 'period', hours: 1 })],
    });
    const state = processEvent(createRun(clinicWith([wf])), enrol('wf-merge', 'maria'));
    // Anything that is not a plain dotted name is not a merge field: it is left as literal text,
    // never run. A known-shaped name the run cannot supply renders blank and is reported.
    const out = renderTemplate(
      '{{contact.first_name.toUpperCase()}} {{1+1}} {{process.env}}',
      viewOf(state),
    );
    expect(out.text).toBe('{{contact.first_name.toUpperCase()}} {{1+1}} ');
    expect(out.unresolved).toEqual(['process.env']);
  });
});

describe('the capability registry (WFL-011, D-105)', () => {
  it('is keyed by registry feature id and knows triggers from actions', () => {
    expect(triggerCapabilityFor('GHL-WF-CUSTOMER-BOOKED-APPOINTMENT')?.kind).toBe('trigger');
    expect(actionCapabilityFor('GHL-WF-SEND-SMS')?.kind).toBe('action');
    expect(actionCapabilityFor('GHL-WF-CUSTOMER-BOOKED-APPOINTMENT')).toBeNull();
    expect(capabilityFor('GHL-WF-GOAL-EVENT')).toBeNull();
    expect(capabilityFor(null)).toBeNull();
  });

  it('lists every runnable feature once, and nothing else', () => {
    expect(new Set(RUNNABLE_FEATURES).size).toBe(RUNNABLE_FEATURES.length);
    for (const id of RUNNABLE_FEATURES) expect(capabilityFor(id)).not.toBeNull();
  });

  it('a staff booking does not fire Customer Booked Appointment', () => {
    const wf = workflow({
      id: 'wf-confirm',
      trigger: { ghl_feature_id: 'GHL-WF-CUSTOMER-BOOKED-APPOINTMENT' },
      nodes: [tag('t1', 'booked')],
    });
    const state = processEvent(createRun(clinicWith([wf])), {
      ...booked('maria', 'a1', '2026-09-05T14:00:00-05:00'),
      payload: {
        ...booked('maria', 'a1', '2026-09-05T14:00:00-05:00').payload,
        booked_by: 'staff',
      },
    });
    expect(runsOf(state)).toHaveLength(0);
  });

  it('a no-op change fires no trigger, so a tag workflow that tags cannot loop', () => {
    const wf = workflow({
      id: 'wf-any-tag',
      trigger: { ghl_feature_id: 'GHL-WF-CONTACT-TAG' },
      nodes: [tag('t1', 'again')],
      settings: { allow_reentry: true },
    });
    // The tag this workflow adds is itself a TAG_ADDED event, which does enrol again — once,
    // because the second run adds a tag Maria already has, and a change that changed nothing
    // fires no trigger. Two runs, not a loop.
    const state = processEvent(
      createRun(clinicWith([wf])),
      event('TAG_ADDED', NOW, { contact_id: 'maria', tag: 'start' }),
    );
    expect(runsOf(state)).toHaveLength(2);
    expect(records(state, 'action_skipped').map((row) => row.reason)).toEqual([
      'tag_already_present',
    ]);
    // WORKFLOW_* events themselves never enrol anyone.
    expect(state.log.filter((row) => row.type === 'WORKFLOW_ENROLLED')).toHaveLength(2);
  });
});

describe('actions beyond text and tags run for real (WFL-005)', () => {
  const run = (nodes: Parameters<typeof workflow>[0]['nodes'], contact = 'maria') =>
    processEvent(
      createRun(
        clinicWith([
          workflow({ id: 'wf-act', trigger: { ghl_feature_id: 'GHL-WF-CONTACT-CREATED' }, nodes }),
        ]),
      ),
      enrol('wf-act', contact, { context: { opportunity_id: 'opp-maria' } }),
    );

  it('sends an email with merged subject and body', () => {
    const state = run([
      {
        id: 'e1',
        type: 'action',
        ghl_feature_id: 'GHL-WF-SEND-EMAIL',
        config: { subject: 'For {{contact.first_name}}', body: 'Your consult.' },
        position: { x: 0, y: 0 },
      },
    ]);
    const [message] = state.account.conversations.maria?.messages ?? [];
    expect(message).toMatchObject({
      channel: 'email',
      subject: 'For Maria',
      body: 'Your consult.',
      workflow_id: 'wf-act',
    });
  });

  it('removes a tag, and skips when it is not there', () => {
    const state = run([
      {
        id: 'r1',
        type: 'action',
        ghl_feature_id: 'GHL-WF-REMOVE-CONTACT-TAG',
        config: { tag: 'meta-lead' },
        position: { x: 0, y: 0 },
      },
      {
        id: 'r2',
        type: 'action',
        ghl_feature_id: 'GHL-WF-REMOVE-CONTACT-TAG',
        config: { tag: 'meta-lead' },
        position: { x: 0, y: 1 },
      },
    ]);
    expect(state.account.contacts.maria?.tags).not.toContain('meta-lead');
    expect(records(state, 'action_skipped').map((row) => row.node_id)).toEqual(['r2']);
    expect(onlyRun(state).status).toBe('completed');
  });

  it('updates a dropdown field only to one of its options', () => {
    const good = run([
      {
        id: 'u1',
        type: 'action',
        ghl_feature_id: 'GHL-WF-UPDATE-CONTACT-FIELD',
        config: { field: 'consult_outcome', value: 'Booked' },
        position: { x: 0, y: 0 },
      },
    ]);
    expect(good.account.contacts.maria?.custom_fields.consult_outcome).toBe('Booked');
    const bad = run([
      {
        id: 'u1',
        type: 'action',
        ghl_feature_id: 'GHL-WF-UPDATE-CONTACT-FIELD',
        config: { field: 'consult_outcome', value: 'Maybe' },
        position: { x: 0, y: 0 },
      },
    ]);
    expect(onlyRun(bad).status).toBe('failed');
    expect(records(bad, 'failure')[0]?.reason).toBe('invalid_value');
  });

  it('assigns the least-loaded of the listed users and can leave an owner alone', () => {
    const state = run([
      {
        id: 'a1',
        type: 'action',
        ghl_feature_id: 'GHL-WF-ASSIGN-TO-USER',
        config: { users: ['u-ary', 'u-sam'] },
        position: { x: 0, y: 0 },
      },
      {
        id: 'a2',
        type: 'action',
        ghl_feature_id: 'GHL-WF-ASSIGN-TO-USER',
        config: { users: ['u-sam'], only_if_unassigned: true },
        position: { x: 0, y: 1 },
      },
    ]);
    expect(state.account.contacts.maria?.owner_id).toBe('u-ary');
    expect(records(state, 'input').find((row) => row.node_id === 'a2')?.data).toMatchObject({
      skipped: 'already_assigned',
    });
  });

  it('moves an existing opportunity and creates one where there is none', () => {
    const moved = run([
      {
        id: 'o1',
        type: 'action',
        ghl_feature_id: 'GHL-WF-CREATE-UPDATE-OPPORTUNITY',
        config: { pipeline: 'consultations', stage: 'Showed', value: 500 },
        position: { x: 0, y: 0 },
      },
    ]);
    expect(moved.account.opportunities['opp-maria']).toMatchObject({ stage: 'Showed', value: 500 });
    const created = run(
      [
        {
          id: 'o1',
          type: 'action',
          ghl_feature_id: 'GHL-WF-CREATE-UPDATE-OPPORTUNITY',
          config: {
            pipeline: 'consultations',
            stage: 'New Lead',
            name: '{{contact.first_name}} consult',
          },
          position: { x: 0, y: 0 },
        },
      ],
      'lena',
    );
    const lenas = Object.values(created.account.opportunities).filter(
      (row) => row.contact_id === 'lena',
    );
    expect(lenas).toHaveLength(1);
    expect(lenas[0]).toMatchObject({ stage: 'New Lead', name: 'Lena consult' });
  });

  it('notifies a team member without touching the conversation', () => {
    const state = run([
      {
        id: 'n1',
        type: 'action',
        ghl_feature_id: 'GHL-WF-SEND-INTERNAL-NOTIFICATION',
        config: {
          channel: 'in-app',
          recipient: 'u-ary',
          message: '{{contact.first_name}} needs a call',
        },
        position: { x: 0, y: 0 },
      },
    ]);
    expect(state.log.map((row) => row.type)).toContain('NOTIFICATION_SENT');
    expect(state.account.conversations.maria?.messages ?? []).toHaveLength(0);
    const record = records(state, 'step_completed').find((row) => row.node_id === 'n1');
    expect(record?.data).toMatchObject({
      recipient: 'u-ary',
      message: 'Maria needs a call',
      delivered: false,
    });
  });

  it('records a webhook it would have sent, and sends nothing', () => {
    const state = run([
      {
        id: 'h1',
        type: 'action',
        ghl_feature_id: 'GHL-WF-CUSTOM-WEBHOOK',
        config: {
          url: 'https://example.test/hook',
          custom_data: { interest: '{{contact.custom_fields.treatment_interest}}' },
        },
        position: { x: 0, y: 0 },
      },
    ]);
    const response = state.log.find((row) => row.type === 'WEBHOOK_RESPONSE');
    expect(response?.payload).toMatchObject({ endpoint: 'https://example.test/hook', status: 200 });
    expect((response?.payload.body as Record<string, unknown>).interest).toBe('Signature Facial');
    expect(records(state, 'input').find((row) => row.node_id === 'h1')?.data).toMatchObject({
      simulated: true,
    });
  });

  it('fails a run at a goal node, saying the feature is not runnable, instead of pretending', () => {
    const state = run([
      {
        id: 'g1',
        type: 'goal',
        ghl_feature_id: 'GHL-WF-GOAL-EVENT',
        config: {},
        position: { x: 0, y: 0 },
      },
      tag('t1', 'after-goal'),
    ]);
    expect(onlyRun(state).status).toBe('failed');
    expect(records(state, 'failure')[0]?.reason).toBe('unsupported_feature');
    expect(state.account.contacts.maria?.tags).not.toContain('after-goal');
  });

  it('skips a text to a contact with no phone and still finishes the run', () => {
    const state = run([sms('s1', 'Hello'), tag('t1', 'texted')], 'jordan');
    expect(records(state, 'action_skipped')[0]?.reason).toBe('missing_phone');
    expect(state.account.contacts.jordan?.tags).toContain('texted');
    expect(onlyRun(state).status).toBe('completed');
  });
});

describe('waits that the fixtures do not cover (WFL-006)', () => {
  it('a date wait needs an explicit offset and proceeds at once when the date has passed', () => {
    const late = workflow({
      id: 'wf-date',
      trigger: { ghl_feature_id: 'GHL-WF-CONTACT-CREATED' },
      nodes: [
        wait('w1', { wait_type: 'date', at: '2026-09-01T09:00:00-05:00' }),
        tag('t1', 'after'),
      ],
    });
    const passed = processEvent(createRun(clinicWith([late])), enrol('wf-date', 'maria'));
    expect(records(passed, 'waiting')[0]?.reason).toBe('wait_target_passed');
    expect(passed.account.contacts.maria?.tags).toContain('after');

    const bare = workflow({
      ...late,
      nodes: [wait('w1', { wait_type: 'date', at: '2026-09-10T09:00:00' }), tag('t1', 'after')],
    });
    const refused = processEvent(createRun(clinicWith([bare])), enrol('wf-date', 'maria'));
    expect(onlyRun(refused).status).toBe('failed');
    expect(records(refused, 'failure')[0]?.reason).toBe('invalid_wait');

    const ahead = workflow({
      ...late,
      nodes: [
        wait('w1', { wait_type: 'date', at: '2026-09-10T10:00:00+01:00' }),
        tag('t1', 'after'),
      ],
    });
    const parked = processEvent(createRun(clinicWith([ahead])), enrol('wf-date', 'maria'));
    // 10:00 in +01:00 is 04:00 in Chicago.
    expect(onlyRun(parked).wait?.wake_at).toBe('2026-09-10T04:00:00-05:00');
  });

  it('a condition wait releases when a later event makes the condition true', () => {
    const wf = workflow({
      id: 'wf-cond',
      trigger: { ghl_feature_id: 'GHL-WF-CONTACT-CREATED' },
      nodes: [
        wait('w1', {
          wait_type: 'condition',
          groups: [
            { conditions: [{ field: 'contact.tags', operator: 'contains', value: 'paid' }] },
          ],
          timeout_hours: 48,
        }),
        sms('s1', 'Thanks for paying.'),
      ],
    });
    let state = processEvent(createRun(clinicWith([wf])), enrol('wf-cond', 'maria'));
    expect(onlyRun(state).status).toBe('waiting');
    state = processEvent(state, event('TAG_ADDED', NOW, { contact_id: 'maria', tag: 'vip' }));
    expect(onlyRun(state).status).toBe('waiting');
    state = processEvent(
      state,
      event('TAG_ADDED', '2026-09-03T10:00:00-05:00', { contact_id: 'maria', tag: 'paid' }),
    );
    expect(onlyRun(state).status).toBe('completed');
    expect(messagesTo(state, 'maria').map((m) => m.at)).toEqual(['2026-09-03T10:00:00-05:00']);
    // The timeout wake was dropped with the release.
    expect(state.queue.filter((row) => row.type === 'WORKFLOW_RESUMED')).toHaveLength(0);
  });

  it('a wake for a run that already moved on is recorded as stale and changes nothing', () => {
    const wf = workflow({
      id: 'wf-stale',
      trigger: { ghl_feature_id: 'GHL-WF-CONTACT-CREATED' },
      nodes: [wait('w1', { wait_type: 'period', hours: 1 }), tag('t1', 'after')],
    });
    let state = processEvent(createRun(clinicWith([wf])), enrol('wf-stale', 'maria'));
    const run = onlyRun(state);
    state = processEvent(
      state,
      event('WORKFLOW_EXITED', NOW, { workflow_run_id: run.id, reason: 'goal_met' }),
    );
    const before = state.account;
    state = processEvent(
      state,
      event('WORKFLOW_RESUMED', '2026-09-03T10:00:00-05:00', {
        workflow_run_id: run.id,
        resume_token: run.wait?.token,
        cause: 'time',
      }),
    );
    expect(state.account).toBe(before);
    expect(records(state, 'action_skipped').at(-1)?.reason).toBe('stale_resume');
  });

  it('wait tokens are deterministic', () => {
    expect(waitToken('wr-1', 'w1', 7)).toBe('wr-1:w1:7');
  });

  it('an appointment wait with no appointment in reach fails, and says so', () => {
    const wf = workflow({
      id: 'wf-appt',
      trigger: { ghl_feature_id: 'GHL-WF-CONTACT-CREATED' },
      nodes: [
        wait('w1', { wait_type: 'appointment', relative: 'before', hours: 1 }),
        tag('t1', 'x'),
      ],
    });
    const state = processEvent(createRun(clinicWith([wf])), enrol('wf-appt', 'lena'));
    expect(onlyRun(state).status).toBe('failed');
    expect(records(state, 'failure')[0]?.reason).toBe('no_appointment');
  });
});

describe('a run can be read back without the workflow running twice', () => {
  it('advancing time past a wait and replaying to a checkpoint agree on the walk', () => {
    const wf = workflow({
      id: 'wf-walk',
      trigger: { ghl_feature_id: 'GHL-WF-CONTACT-CREATED' },
      nodes: [
        tag('t1', 'one'),
        wait('w1', { wait_type: 'period', minutes: 30 }),
        tag('t2', 'two'),
        end('e1'),
      ],
    });
    let state = processEvent(createRun(clinicWith([wf])), enrol('wf-walk', 'maria'));
    state = advanceTo(state, '2026-09-03T09:30:00-05:00');
    expect(onlyRun(state).completed_node_ids).toEqual(['t1', 'w1', 't2', 'e1']);
    // One step_completed for the wait, one for the end; the tags recorded themselves.
    expect(records(state, 'step_completed').map((row) => row.node_id)).toEqual([
      't1',
      'w1',
      't2',
      'e1',
    ]);
    expect(records(state, 'step_started').map((row) => row.node_id)).toEqual([
      't1',
      'w1',
      't2',
      'e1',
    ]);
  });
});

describe('dynamic values in conditions (WFL-009)', () => {
  it('a condition value may be a merge field, resolved against the same contact', () => {
    // "Source is the contact's own first name" — true only for a contact named after their source.
    const wf = workflow({
      id: 'wf-dyn',
      trigger: { ghl_feature_id: 'GHL-WF-CONTACT-CREATED' },
      nodes: [
        ifElse('b1', [
          {
            name: 'Self-referral',
            groups: [
              {
                conditions: [
                  {
                    field: 'contact.custom_fields.consult_outcome',
                    operator: 'is',
                    value: '{{contact.custom_fields.treatment_interest}}',
                  },
                ],
              },
            ],
          },
        ]),
        tag('t1', 'matched'),
        tag('t2', 'unmatched'),
      ],
      edges: [edge('b1', 't1', 'Self-referral'), edge('b1', 't2', 'None')],
    });
    const base = clinicWith([wf]);
    const contacts = [
      ...(base.initial_account_state.contacts ?? []),
      {
        id: 'same',
        first_name: 'Same',
        custom_fields: { treatment_interest: 'Laser', consult_outcome: 'Laser' },
      },
    ];
    let state = createRun({
      ...base,
      initial_account_state: {
        ...base.initial_account_state,
        contacts,
        custom_fields: [
          ...(base.initial_account_state.custom_fields ?? []).map((field) =>
            field.key === 'consult_outcome'
              ? { ...field, options: ['Booked', 'Thinking about it', 'Not a fit', 'Laser'] }
              : field,
          ),
        ],
      },
    });
    state = processEvent(state, enrol('wf-dyn', 'same'));
    state = processEvent(state, enrol('wf-dyn', 'maria'));
    expect(state.account.contacts.same?.tags).toContain('matched');
    expect(state.account.contacts.maria?.tags).toContain('unmatched');
    const [first] = records(state, 'branch_result');
    expect(first?.data).toMatchObject({
      branches: [
        { groups: [{ conditions: [{ expected: 'Laser', actual: 'Laser', passed: true }] }] },
      ],
    });
  });
});

/**
 * D-148. The Workflow Lab's Test Contact runs never move the account clock and every one of them
 * enrols through a generated event, so neither the instant nor the origin separates ninety tests
 * from a loop. The bound counts enrolments in one chain of `caused_by`, and a test's chain has
 * one, so testing the same workflow over and over is never refused.
 */
describe('testing the same workflow over and over is not a loop', () => {
  const INSTANT = workflow({
    id: 'wf-test-again',
    name: 'Instant workflow',
    trigger: { ghl_feature_id: 'GHL-WF-CUSTOMER-BOOKED-APPOINTMENT' },
    nodes: [tag('t1', 'tested'), end('e1')],
    settings: { allow_reentry: true },
  });
  const times = MAX_ENROLMENTS_IN_ONE_CHAIN * 2 + 5;

  it('enrols a hand-started run every time at one instant, past the loop bound', () => {
    let state = createRun(clinicWith([INSTANT]));
    for (let i = 0; i < times; i += 1) {
      state = processEvent(state, enrol('wf-test-again', 'maria'));
    }
    expect(runsOf(state, 'wf-test-again')).toHaveLength(times);
    expect(records(state, 'failure').filter((row) => row.reason === 'workflow_loop')).toEqual([]);
    expect(new Set(runsOf(state, 'wf-test-again').map((run) => run.enrolled_at)).size).toBe(1);
  });

  it('does the same when the Lab fires the trigger, which is how a Test Contact run works', () => {
    let state = createRun(clinicWith([INSTANT]));
    for (let i = 0; i < times; i += 1) {
      state = processEvent(state, booked('maria', `appt-test-${i}`, '2026-09-10T15:00:00-05:00'));
    }
    expect(runsOf(state, 'wf-test-again')).toHaveLength(times);
    expect(records(state, 'failure').filter((row) => row.reason === 'workflow_loop')).toEqual([]);
    // Every one of them enrolled through a generated event at the same account instant: what
    // stops the bound firing is the chain, which is one enrolment long each time.
    expect(state.log.filter((row) => row.type === 'WORKFLOW_ENROLLED').length).toBe(times);
  });
});
