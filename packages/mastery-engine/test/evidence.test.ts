import { describe, expect, it } from 'vitest';

import {
  assistanceFromHints,
  effectiveAssistance,
  isIndependentPass,
  isPass,
  isPracticedPass,
  validateEvidence,
} from '../src/index.ts';
import { evidence } from './fixtures.ts';

describe('evidence record (spec §30, MAS-003)', () => {
  it('accepts a complete record', () => {
    expect(validateEvidence(evidence({ kind: 'deterministic_exercise' }))).toEqual([]);
  });

  it.each([
    'skill_id',
    'exercise_id',
    'result',
    'score',
    'assistance',
    'difficulty',
    'critical_failures',
    'occurred_at',
    'versions',
    'real_ghl',
    'kind',
    'hints_used',
    'source',
  ])('rejects a record without %s', (field) => {
    const record = evidence({ kind: 'deterministic_exercise' }) as unknown as Record<
      string,
      unknown
    >;
    delete record[field];
    expect(validateEvidence(record).map((i) => i.path)).toContain(field);
  });

  it('requires the simulator, content and app versions inside `versions` (INF-013)', () => {
    for (const key of ['app', 'content', 'content_hash', 'simulator', 'rules']) {
      const record = evidence({ kind: 'deterministic_exercise' });
      const versions = { ...record.versions } as Record<string, unknown>;
      delete versions[key];
      const issues = validateEvidence({ ...record, versions });
      expect(issues.map((i) => i.path)).toContain(`versions.${key}`);
    }
  });

  it('rejects unknown keys and out-of-range values', () => {
    expect(validateEvidence({ ...evidence({ kind: 'exposure' }), xp: 10 })).not.toEqual([]);
    expect(validateEvidence(evidence({ kind: 'deterministic_exercise', score: 140 }))).not.toEqual(
      [],
    );
  });
});

describe('assistance semantics (spec §28, §34; MAS-007, MAS-011)', () => {
  it('rolls hints up by the explicit table', () => {
    expect(assistanceFromHints([])).toBe('independent');
    expect(assistanceFromHints(['nudge'])).toBe('light');
    expect(assistanceFromHints(['nudge', 'nudge'])).toBe('light');
    expect(assistanceFromHints(['nudge', 'nudge', 'nudge'])).toBe('guided');
    expect(assistanceFromHints(['concept_reminder'])).toBe('guided');
    expect(assistanceFromHints(['nudge', 'worked_example'])).toBe('heavy');
  });

  it('never lets a worked-example pass count as independent', () => {
    const heavy = evidence({ kind: 'independent_exercise', hints: ['worked_example'] });
    expect(effectiveAssistance(heavy)).toBe('heavy');
    expect(isPass(heavy)).toBe(true);
    expect(isIndependentPass(heavy)).toBe(false);
    expect(isPracticedPass(heavy)).toBe(false);
  });

  it('treats guided practice as guided even without hints', () => {
    const guided = evidence({ kind: 'guided_practice' });
    expect(effectiveAssistance(guided)).toBe('guided');
    expect(isIndependentPass(guided)).toBe(false);
  });

  it('a light nudge is practice, not independence', () => {
    const light = evidence({ kind: 'deterministic_exercise', hints: ['nudge'] });
    expect(isPracticedPass(light)).toBe(true);
    expect(isIndependentPass(light)).toBe(false);
  });

  it('a critical failure is never a pass, whatever the score (spec §31)', () => {
    const dangerous = evidence({ kind: 'deterministic_exercise', score: 95, critical: ['c1'] });
    expect(isPass(dangerous)).toBe(false);
  });
});
