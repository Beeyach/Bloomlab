import { describe, expect, it } from 'vitest';
import { evaluateFieldReady, FIELD_READY_AREAS } from '../src/index.ts';
import { evidence } from './fixtures.ts';

const skills = FIELD_READY_AREAS.map((area) => ({ id: `skill-${area}`, evidence_areas: [area] }));
const complete = () =>
  skills.map((skill) =>
    evidence({
      skill: skill.id,
      kind: skill.evidence_areas[0] === 'fieldwork' ? 'fieldwork' : 'independent_exercise',
      score: 100,
      realGhl: skill.evidence_areas[0] === 'fieldwork' ? true : undefined,
    }),
  );
describe('MAS-010 independent Field Ready evidence domains', () => {
  it('fails a perfect average with one empty area and identifies the missing basis', () => {
    const rows = complete().filter((row) => row.skill_id !== 'skill-negotiation');
    const result = evaluateFieldReady('learner-1', skills, rows);
    expect(result.complete).toBe(false);
    expect(result.missing_areas).toEqual(['negotiation']);
    expect(result.areas.find((area) => area.area === 'negotiation')?.evidence_ids).toEqual([]);
  });
  it('returns sorted canonical evidence references without an average or an AI call', () => {
    const rows = complete();
    const result = evaluateFieldReady('learner-1', skills, rows);
    expect(result.complete).toBe(true);
    expect(evaluateFieldReady('learner-1', skills, [...rows].reverse())).toEqual(result);
    expect(result.areas.every((area) => area.evidence_ids.length === 1)).toBe(true);
  });
  it.each(['assisted', 'critical', 'failed', 'placement', 'other learner', 'invalid'])(
    'refuses %s evidence',
    (kind) => {
      const rows = complete();
      const row = rows[0]!;
      if (kind === 'assisted') row.hints_used = ['worked_example'];
      if (kind === 'critical') row.critical_failures = ['duplicate-message'];
      if (kind === 'failed') row.result = 'failed';
      if (kind === 'placement') row.source.type = 'placement';
      if (kind === 'other learner') row.learner_id = 'someone-else';
      if (kind === 'invalid') row.versions = { ...row.versions, content: '' };
      expect(evaluateFieldReady('learner-1', skills, rows).missing_areas).toEqual([
        'funnel_strategy',
      ]);
    },
  );
  it('requires both manual real-GHL proof and its evidence references', () => {
    const rows = complete();
    rows.find((row) => row.kind === 'fieldwork')!.real_ghl!.evidence = [];
    expect(evaluateFieldReady('learner-1', skills, rows).missing_areas).toEqual(['fieldwork']);
  });
  it('cannot turn retrieval or quiz exposure into independent capability', () => {
    const rows = complete();
    rows[0]!.kind = 'retrieval';
    rows[1]!.kind = 'quiz';
    expect(evaluateFieldReady('learner-1', skills, rows).missing_areas).toEqual([
      'funnel_strategy',
      'ghl_implementation',
    ]);
  });
});
