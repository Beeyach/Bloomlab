import { describe, expect, it } from 'vitest';
import { fixtureState } from '../src/fixtures.ts';

const check = {
  key: 'payload',
  field: 'answer',
  expected_json: '{"active":false,"budget":0,"tags":["consult"]}',
};
describe('objective local fixtures', () => {
  it('compares JSON structurally without changing types or array order', () => {
    expect(
      fixtureState([check], { answer: '{"tags":["consult"],"budget":0,"active":false}' }),
    ).toEqual({ payload: true });
    for (const answer of [
      '',
      '{',
      'null',
      'false',
      '{"active":"false","budget":0,"tags":["consult"]}',
      '{"active":false,"budget":0,"tags":["consult"],"extra":true}',
    ])
      expect(fixtureState([check], { answer })).toEqual({ payload: false });
    expect(
      fixtureState([{ key: 'order', field: 'answer', expected_json: '[1,2]' }], {
        answer: '[2,1]',
      }),
    ).toEqual({ order: false });
  });
  it('rejects executable text, excessive input and missing drafts without executing anything', () => {
    for (const answer of [
      'globalThis.compromised = true',
      ' '.repeat(100_001),
      '{"__proto__":{"polluted":true}}',
    ])
      expect(fixtureState([check], { answer }).payload).toBe(false);
    expect(fixtureState([check], {}).payload).toBe(false);
    expect(Object.hasOwn(Object.prototype, 'polluted')).toBe(false);
  });
});
