import { describe, expect, it } from 'vitest';
import { evaluateSkill } from '../src/mastery.ts';
import { validateEvidence } from '../src/evidence.ts';
import { ALPHA, evidence, NOW } from './fixtures.ts';

describe('FLD-004 real-GHL mastery gate independently of UI', () => {
  it('requires a passed fieldwork row with provided proof after all other conditions hold', () => {
    const skill = {
      ...ALPHA,
      mastery_requirements: {
        ...ALPHA.mastery_requirements,
        fieldwork_required: true,
        sales_use: true,
      },
    };
    const base = [
      evidence({ kind: 'independent_exercise', exercise: 'EX-BUILD_IT-first' }),
      evidence({ kind: 'pressure_test', exercise: 'EX-REBUILD_BLIND-second' }),
      evidence({ kind: 'sales_use', exercise: 'EX-WRITE_IT-third' }),
    ];
    const missing = evaluateSkill(skill, base, NOW);
    expect(missing.ladder_state).not.toBe('MASTERED');
    expect(missing.missing_requirements).toEqual(['real_ghl_fieldwork']);
    for (const row of [
      evidence({ kind: 'fieldwork', realGhl: false }),
      evidence({ kind: 'fieldwork', realGhl: true, result: 'failed' }),
    ]) {
      expect(validateEvidence(row)).toEqual([]);
      const result = evaluateSkill(skill, [...base, row], NOW);
      expect(result.ladder_state).not.toBe('MASTERED');
      expect(result.missing_requirements).toContain('real_ghl_fieldwork');
      expect(result.counts.fieldwork_passes).toBe(0);
    }
    const proof = evidence({ kind: 'fieldwork', exercise: 'EX-FIELDWORK-real', realGhl: true });
    expect(validateEvidence(proof)).toEqual([]);
    const passed = evaluateSkill(skill, [...base, proof], NOW);
    expect(passed.ladder_state).toBe('MASTERED');
    expect(passed.missing_requirements).not.toContain('real_ghl_fieldwork');
    expect(passed.counts.fieldwork_passes).toBe(1);
  });
});
