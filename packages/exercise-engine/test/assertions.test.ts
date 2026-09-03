import { describe, expect, it } from 'vitest';

import { evaluateAssertion, resolvePath, sourcesFor } from '../src/index.ts';
import { architecture, assertion, context, events, providing } from './fixtures.ts';

const judge = (definition: Parameters<typeof evaluateAssertion>[0], ctx = context()) =>
  evaluateAssertion(definition, 'required', ctx);

const STATE = {
  contacts: { maria: { tags: ['meta-lead', 'booked'], phone: '+1512', score: 42, note: null } },
  opportunities: { 'opp-maria': { stage: 'Lost', value: 410 } },
  decision: { choice: 'contact_custom_field', reasoning_mentions: ['merge_field'] },
  prediction: { tag: 'booked' },
};

describe('path resolution', () => {
  it('walks nested objects, id-keyed records and arrays without eval', () => {
    expect(resolvePath(STATE, 'opportunities.opp-maria.stage')).toEqual({
      found: true,
      value: 'Lost',
    });
    expect(resolvePath(STATE, 'contacts.maria.tags.1')).toEqual({ found: true, value: 'booked' });
    expect(resolvePath(STATE, 'contacts.nobody.tags').found).toBe(false);
    expect(resolvePath(STATE, 'contacts.maria.tags.9').found).toBe(false);
  });

  it('refuses to resolve through the prototype chain', () => {
    expect(resolvePath(STATE, '__proto__.polluted').found).toBe(false);
    expect(resolvePath(STATE, 'contacts.constructor.name').found).toBe(false);
  });
});

describe('STATE assertions', () => {
  const state = context({ state: STATE });
  const check = (partial: Record<string, unknown>) =>
    judge(assertion({ type: 'state', ...partial }), state);

  it('equals passes on a match and fails with the observed value', () => {
    expect(
      check({ path: 'opportunities.opp-maria.stage', operator: 'equals', value: 'Lost' }).passed,
    ).toBe(true);
    const wrong = check({
      path: 'opportunities.opp-maria.stage',
      operator: 'equals',
      value: 'Won',
    });
    expect(wrong.passed).toBe(false);
    expect(wrong.expected).toBe('opportunities.opp-maria.stage = "Won"');
    expect(wrong.observed).toBe('opportunities.opp-maria.stage = "Lost"');
  });

  it('contains works on arrays and on text', () => {
    expect(
      check({ path: 'contacts.maria.tags', operator: 'contains', value: 'booked' }).passed,
    ).toBe(true);
    expect(check({ path: 'contacts.maria.tags', operator: 'contains', value: 'lost' }).passed).toBe(
      false,
    );
    expect(check({ path: 'contacts.maria.phone', operator: 'contains', value: '512' }).passed).toBe(
      true,
    );
  });

  it('not_contains passes when absent and when the path is missing', () => {
    expect(
      check({ path: 'contacts.maria.tags', operator: 'not_contains', value: 'dnd' }).passed,
    ).toBe(true);
    expect(
      check({ path: 'contacts.maria.tags', operator: 'not_contains', value: 'booked' }).passed,
    ).toBe(false);
    expect(
      check({ path: 'contacts.ghost.tags', operator: 'not_contains', value: 'dnd' }).passed,
    ).toBe(true);
  });

  it('exists and absent treat a missing path and an explicit null the same way', () => {
    expect(check({ path: 'contacts.maria.phone', operator: 'exists' }).passed).toBe(true);
    expect(check({ path: 'contacts.maria.note', operator: 'exists' }).passed).toBe(false);
    expect(check({ path: 'contacts.ghost', operator: 'exists' }).passed).toBe(false);
    expect(check({ path: 'contacts.maria.note', operator: 'absent' }).passed).toBe(true);
    expect(check({ path: 'contacts.ghost', operator: 'absent' }).passed).toBe(true);
    expect(check({ path: 'contacts.maria.phone', operator: 'absent' }).passed).toBe(false);
  });

  it('gte and lte compare numbers and refuse anything else', () => {
    expect(check({ path: 'contacts.maria.score', operator: 'gte', value: 42 }).passed).toBe(true);
    expect(check({ path: 'contacts.maria.score', operator: 'gte', value: 43 }).passed).toBe(false);
    expect(check({ path: 'contacts.maria.score', operator: 'lte', value: 42 }).passed).toBe(true);
    const text = check({ path: 'contacts.maria.phone', operator: 'gte', value: 5 });
    expect(text.passed).toBe(false);
    expect(text.observed).toContain('not a number');
  });

  it('a missing path fails equals and says so', () => {
    const missing = check({ path: 'contacts.ghost.stage', operator: 'equals', value: 'Lost' });
    expect(missing.passed).toBe(false);
    expect(missing.observed).toBe('contacts.ghost.stage is not in the state');
  });

  it('reads the learner roots from the same tree', () => {
    expect(
      check({ path: 'decision.choice', operator: 'equals', value: 'contact_custom_field' }).passed,
    ).toBe(true);
    expect(
      check({ path: 'decision.reasoning_mentions', operator: 'contains', value: 'merge_field' })
        .passed,
    ).toBe(true);
    expect(check({ path: 'prediction.tag', operator: 'equals', value: 'booked' }).passed).toBe(
      true,
    );
  });
});

describe('EVENT assertions', () => {
  const run = context({
    events: events([
      {
        type: 'sms.sent',
        at: '2026-09-03T10:00:00Z',
        fields: { contact_id: 'maria', purpose: 'rebooking' },
      },
      {
        type: 'sms.sent',
        at: '2026-09-03T10:05:00Z',
        fields: { contact_id: 'jordan', purpose: 'rebooking' },
      },
      {
        type: 'sms.sent',
        at: '2026-09-03T10:06:00Z',
        fields: { contact_id: 'maria', purpose: 'reminder_24h' },
      },
      { type: 'tag.added', at: '2026-09-03T10:07:00Z', fields: { contact_id: 'maria' } },
    ]),
  });
  const check = (partial: Record<string, unknown>) =>
    judge(assertion({ type: 'event', event: 'sms.sent', ...partial }), run);

  it('counts exactly, at least and at most', () => {
    expect(check({ count: { exactly: 3 } }).passed).toBe(true);
    expect(check({ count: { exactly: 2 } }).passed).toBe(false);
    expect(check({ count: { min: 2 } }).passed).toBe(true);
    expect(check({ count: { min: 4 } }).passed).toBe(false);
    expect(check({ count: { max: 3 } }).passed).toBe(true);
    expect(check({ count: { max: 2 } }).passed).toBe(false);
  });

  it('narrows by where, and a wrong purpose does not match', () => {
    const exact = check({
      count: { exactly: 1 },
      where: { contact_id: 'maria', purpose: 'rebooking' },
    });
    expect(exact.passed).toBe(true);
    expect(exact.expected).toBe('exactly 1 sms.sent where contact_id=maria, purpose=rebooking');
    expect(exact.observed).toBe('1 matching event');
    expect(check({ count: { exactly: 1 }, where: { purpose: 'never_authored' } }).passed).toBe(
      false,
    );
    expect(check({ count: { exactly: 2 }, where: { contact_id: 'maria' } }).passed).toBe(true);
  });

  it('reports zero matches plainly and separates contacts', () => {
    const none = check({ count: { min: 1 }, where: { contact_id: 'lena' } });
    expect(none.passed).toBe(false);
    expect(none.observed).toBe('0 matching events');
    expect(check({ count: { exactly: 1 }, where: { contact_id: 'jordan' } }).passed).toBe(true);
  });

  it('a type that never occurred counts zero', () => {
    expect(
      judge(assertion({ type: 'event', event: 'call.placed', count: { exactly: 0 } }), run).passed,
    ).toBe(true);
  });
});

describe('TIMING assertions', () => {
  const references = {
    'appointment.start': '2026-09-04T15:00:00Z',
    'appointment.no_show': '2026-09-03T15:30:00Z',
  };
  const at = (time: string, fields: Record<string, string> = {}) => ({
    type: 'sms.sent',
    at: time,
    fields,
  });
  const run = (times: { type: string; at: string; fields?: Record<string, string> }[]) =>
    context({ events: events(times), references });
  const check = (partial: Record<string, unknown>, ctx = run([at('2026-09-03T15:00:00Z')])) =>
    judge(
      assertion({
        type: 'timing',
        event: 'sms.sent',
        relative_to: 'appointment.start',
        offset_minutes: -1440,
        tolerance_minutes: 10,
        ...partial,
      }),
      ctx,
    );

  it('passes at the exact offset', () => {
    const exact = check({});
    expect(exact.passed).toBe(true);
    expect(exact.observed).toBe('sms.sent at exactly that moment');
    expect(exact.expected).toBe('sms.sent 1440 min before appointment.start (±10 min)');
  });

  it('passes inside the tolerance and exactly on the boundary, and fails just outside', () => {
    expect(check({}, run([at('2026-09-03T15:07:00Z')])).passed).toBe(true);
    expect(check({}, run([at('2026-09-03T15:10:00Z')])).passed).toBe(true);
    expect(check({}, run([at('2026-09-03T14:50:00Z')])).passed).toBe(true);
    const late = check({}, run([at('2026-09-03T15:11:00Z')]));
    expect(late.passed).toBe(false);
    expect(late.observed).toBe('sms.sent 11 min late');
    expect(check({}, run([at('2026-09-03T14:49:00Z')])).observed).toBe('sms.sent 11 min early');
  });

  it('judges the event closest to the target when several match', () => {
    const many = run([
      at('2026-09-03T12:00:00Z'),
      at('2026-09-03T15:05:00Z'),
      at('2026-09-03T20:00:00Z'),
    ]);
    const result = check({}, many);
    expect(result.passed).toBe(true);
    expect(result.detail?.candidates).toBe(3);
    expect((result.detail?.chosen as { at: string }).at).toBe('2026-09-03T15:05:00Z');
  });

  it('handles a positive offset and a second named reference', () => {
    const result = check(
      { relative_to: 'appointment.no_show', offset_minutes: 15, tolerance_minutes: 15 },
      run([at('2026-09-03T15:40:00Z')]),
    );
    expect(result.passed).toBe(true);
  });

  it('fails when the reference is missing or no event occurred', () => {
    const noReference = check({ relative_to: 'appointment.rescheduled' });
    expect(noReference.passed).toBe(false);
    expect(noReference.observed).toContain('no reference instant');
    const noEvent = check({}, run([{ type: 'tag.added', at: '2026-09-03T15:00:00Z' }]));
    expect(noEvent.passed).toBe(false);
    expect(noEvent.observed).toContain('no sms.sent event');
  });
});

describe('ARCHITECTURE assertions', () => {
  const built = context({ architecture: architecture() });
  const check = (partial: Record<string, unknown>, ctx = built) =>
    judge(assertion({ type: 'architecture', ...partial }), ctx);

  it('finds the trigger, actions and branches by verified feature id', () => {
    expect(
      check({ requirement: 'trigger_exists', ghl_feature: 'GHL-WF-APPOINTMENT-STATUS' }).passed,
    ).toBe(true);
    expect(
      check({ requirement: 'trigger_exists', ghl_feature: 'GHL-WF-CUSTOMER-BOOKED-APPOINTMENT' })
        .passed,
    ).toBe(false);
    expect(check({ requirement: 'action_exists', ghl_feature: 'GHL-WF-SEND-SMS' }).passed).toBe(
      true,
    );
    expect(check({ requirement: 'action_exists', ghl_feature: 'GHL-WF-SEND-EMAIL' }).passed).toBe(
      false,
    );
    expect(check({ requirement: 'branch_exists', ghl_feature: 'GHL-WF-IF-ELSE' }).passed).toBe(
      true,
    );
  });

  it('feature_used and feature_not_used look at triggers and nodes together', () => {
    expect(check({ requirement: 'feature_used', ghl_feature: 'GHL-WF-WAIT' }).passed).toBe(true);
    expect(
      check({ requirement: 'feature_used', ghl_feature: 'GHL-WF-APPOINTMENT-STATUS' }).passed,
    ).toBe(true);
    expect(
      check({ requirement: 'feature_not_used', ghl_feature: 'GHL-WF-SEND-EMAIL' }).passed,
    ).toBe(true);
    expect(check({ requirement: 'feature_not_used', ghl_feature: 'GHL-WF-SEND-SMS' }).passed).toBe(
      false,
    );
  });

  it('counts nodes and reads the re-entry setting', () => {
    expect(check({ requirement: 'node_count_max', value: 5 }).passed).toBe(true);
    expect(check({ requirement: 'node_count_max', value: 4 }).observed).toBe('5 nodes');
    expect(check({ requirement: 'reentry_disabled' }).passed).toBe(true);
    const reentrant = context({
      architecture: architecture({ settings: { allow_reentry: true } }),
    });
    expect(check({ requirement: 'reentry_disabled' }, reentrant).passed).toBe(false);
  });

  it('is unaffected by where the nodes sit on a canvas', () => {
    const moved = architecture();
    // A position-carrying builder must normalize positions away; the grader never sees them.
    const shuffled = {
      workflows: [{ ...moved.workflows[0]!, nodes: [...moved.workflows[0]!.nodes].reverse() }],
    };
    const before = check({ requirement: 'action_exists', ghl_feature: 'GHL-WF-SEND-SMS' });
    const after = check(
      { requirement: 'action_exists', ghl_feature: 'GHL-WF-SEND-SMS' },
      context({ architecture: shuffled }),
    );
    expect(after.passed).toBe(before.passed);
    expect(after.observed).toBe(before.observed);
  });

  it('says plainly when there is no solution to inspect', () => {
    const empty = context({ architecture: { workflows: [] } });
    expect(
      check({ requirement: 'trigger_exists', ghl_feature: 'GHL-WF-WAIT' }, empty).observed,
    ).toBe('no workflow in the solution');
    expect(check({ requirement: 'reentry_disabled' }, empty).passed).toBe(false);
  });
});

describe('NEGATIVE assertions', () => {
  const run = context({
    events: events([
      { type: 'sms.sent', at: '2026-09-03T10:00:00Z', fields: { contact_id: 'maria' } },
      {
        type: 'workflow.enrolled',
        at: '2026-09-03T09:00:00Z',
        fields: { contact_id: 'maria', trigger_status: 'no_show' },
      },
    ]),
  });
  const check = (partial: Record<string, unknown>) =>
    judge(assertion({ type: 'negative', ...partial }), run);

  it('passes when the forbidden event never happened', () => {
    const clean = check({ event: 'sms.sent', where: { contact_id: 'lena' } });
    expect(clean.passed).toBe(true);
    expect(clean.expected).toBe('no sms.sent where contact_id=lena');
    expect(clean.observed).toBe('none occurred');
  });

  it('fails when it did, and says when', () => {
    const bad = check({ event: 'sms.sent', where: { contact_id: 'maria' } });
    expect(bad.passed).toBe(false);
    expect(bad.observed).toBe('1 occurred (first at 2026-09-03T10:00:00Z)');
  });

  it('narrows correctly: the same event with another field value is not forbidden', () => {
    expect(
      check({
        event: 'workflow.enrolled',
        where: { contact_id: 'maria', trigger_status: 'cancelled' },
      }).passed,
    ).toBe(true);
    expect(
      check({
        event: 'workflow.enrolled',
        where: { contact_id: 'maria', trigger_status: 'no_show' },
      }).passed,
    ).toBe(false);
  });
});

describe('SEQUENCE assertions', () => {
  const order = (rows: { type: string; at: string }[]) => context({ events: events(rows) });
  const check = (ctx: ReturnType<typeof order>) =>
    judge(assertion({ type: 'sequence', before: 'sms.sent', after: 'tag.added' }), ctx);

  it('passes in the authored order and fails when reversed', () => {
    expect(
      check(
        order([
          { type: 'sms.sent', at: '2026-09-03T10:00:00Z' },
          { type: 'tag.added', at: '2026-09-03T10:01:00Z' },
        ]),
      ).passed,
    ).toBe(true);
    const reversed = check(
      order([
        { type: 'tag.added', at: '2026-09-03T10:00:00Z' },
        { type: 'sms.sent', at: '2026-09-03T10:01:00Z' },
      ]),
    );
    expect(reversed.passed).toBe(false);
    expect(reversed.observed).toContain('tag.added at 2026-09-03T10:00:00Z came first');
  });

  it('fails and names what never happened', () => {
    expect(check(order([{ type: 'sms.sent', at: '2026-09-03T10:00:00Z' }])).observed).toBe(
      'tag.added never happened',
    );
    expect(check(order([])).observed).toBe('sms.sent and tag.added never happened');
  });

  it('compares the earliest occurrence when either repeats', () => {
    expect(
      check(
        order([
          { type: 'sms.sent', at: '2026-09-03T10:00:00Z' },
          { type: 'tag.added', at: '2026-09-03T10:01:00Z' },
          { type: 'sms.sent', at: '2026-09-03T10:02:00Z' },
          { type: 'tag.added', at: '2026-09-03T10:03:00Z' },
        ]),
      ).passed,
    ).toBe(true);
  });

  it('breaks equal timestamps on the emitted order, deterministically', () => {
    const same = '2026-09-03T10:00:00Z';
    expect(
      check(
        order([
          { type: 'sms.sent', at: same },
          { type: 'tag.added', at: same },
        ]),
      ).passed,
    ).toBe(true);
    expect(
      check(
        order([
          { type: 'tag.added', at: same },
          { type: 'sms.sent', at: same },
        ]),
      ).passed,
    ).toBe(false);
  });
});

describe('source requirements', () => {
  it('maps each assertion to what it must be able to read', () => {
    expect(sourcesFor(assertion({ type: 'state', path: 'contacts.maria.tags' }))).toEqual([
      'state',
    ]);
    expect(sourcesFor(assertion({ type: 'state', path: 'decision.choice' }))).toEqual(['learner']);
    expect(sourcesFor(assertion({ type: 'state', path: 'prediction.tag' }))).toEqual(['learner']);
    expect(
      sourcesFor(assertion({ type: 'state', path: 'answer.names_missing_information' })),
    ).toEqual(['learner']);
    expect(sourcesFor(assertion({ type: 'event', event: 'sms.sent' }))).toEqual(['events']);
    expect(sourcesFor(assertion({ type: 'timing', event: 'sms.sent' }))).toEqual([
      'events',
      'references',
    ]);
    expect(sourcesFor(assertion({ type: 'architecture', requirement: 'trigger_exists' }))).toEqual([
      'architecture',
    ]);
  });

  it('reports an assertion it cannot read as unevaluated, never as a failure', () => {
    const result = judge(
      assertion({
        type: 'architecture',
        requirement: 'trigger_exists',
        ghl_feature: 'GHL-WF-WAIT',
      }),
      providing('learner'),
    );
    expect(result.unevaluated).toBe(true);
    expect(result.passed).toBe(false);
    expect(result.missing_source).toBe('architecture');
    expect(result.observed).toBe('not evaluated: this run provides no architecture');
  });
});
