import { describe, expect, it } from 'vitest';
import { evaluateAssertion, gradeExercise } from '../src/index.ts';
import { assertion, context, events, exercise } from './fixtures.ts';

const rule = assertion({
  type: 'negative',
  event: 'sms.sent',
  where: { contact_id: 'jordan', after: 'appointment.start' },
});
const at = '2026-09-10T15:00:00Z';
const run = (time: string, contact = 'jordan') =>
  context({
    references: { 'appointment.start': at },
    events: events([{ type: 'sms.sent', at: time, fields: { contact_id: contact } }]),
  });

describe('EXR-007 late-booking after-reference', () => {
  it.each(['2026-09-10T14:59:59Z', at])(
    'does not count an event before or exactly at the boundary: %s',
    (time) => {
      expect(evaluateAssertion(rule, 'critical', run(time)).passed).toBe(true);
    },
  );
  it('fails a post-start message, regardless of authored field values or timezone offset spelling', () => {
    const ctx = run('2026-09-10T08:00:01-07:00');
    ctx.events[0]!.fields.after = 'not-a-clock';
    const report = gradeExercise({
      exercise: exercise({ critical_failures: [rule] }),
      context: ctx,
      hints_used: [],
      assistance: 'independent',
    });
    expect(report.outcome).toBe('failed');
    expect(report.failed_critical).toContain(rule.id);
    expect(evaluateAssertion(rule, 'critical', run('2026-09-10T15:01:00Z', 'maria')).passed).toBe(
      true,
    );
  });
  it.each([
    context({ provides: ['events'] }),
    context(),
    context({ references: { 'appointment.start': 'invalid' } }),
    run('invalid'),
  ])('refuses missing/invalid temporal data instead of passing an empty match', (ctx) => {
    const result = evaluateAssertion(rule, 'critical', ctx);
    expect(result.unevaluated).toBe(true);
    expect(result.passed).toBe(false);
    expect(
      gradeExercise({
        exercise: exercise({ critical_failures: [rule] }),
        context: ctx,
        hints_used: [],
        assistance: 'independent',
      }).outcome,
    ).toBe('partial');
  });
});
