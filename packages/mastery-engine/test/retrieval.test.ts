import { beforeEach, describe, expect, it } from 'vitest';

import {
  DEMONSTRATION_RULES,
  INDEPENDENT_KINDS,
  REVIEW_DEMONSTRATION_KINDS,
  evaluateSkill,
  isDemonstration,
  isFieldworkPass,
  isIndependentPass,
  isPass,
} from '../src/index.ts';
import { ALPHA, BETA, GAMMA, at, evidence, resetCounter } from './fixtures.ts';

const DAY = 24 * 3600 * 1000;

beforeEach(resetCounter);

const beta = (options: Omit<Parameters<typeof evidence>[0], 'skill'>) =>
  evidence({ ...options, skill: BETA.id });

/** BETA: one declared demonstration, no other requirement; MASTERED after two on different days. */
const mastered = () => [
  beta({ kind: 'independent_exercise', at: at(1) }),
  beta({ kind: 'independent_exercise', at: at(3), exercise: 'EX-BUILD_IT-two' }),
];

describe('retrieval maintains mastery and never advances it (spec §32; D-052)', () => {
  it('kind sets: retrieval is a review demonstration, not a progression kind', () => {
    expect(INDEPENDENT_KINDS).not.toContain('retrieval');
    expect(REVIEW_DEMONSTRATION_KINDS).toEqual([...INDEPENDENT_KINDS, 'retrieval']);
    expect(DEMONSTRATION_RULES.kinds).toBe(REVIEW_DEMONSTRATION_KINDS);
    const retrieval = beta({ kind: 'retrieval', at: at(5) });
    expect(isPass(retrieval)).toBe(true);
    expect(isIndependentPass(retrieval)).toBe(false);
    expect(isDemonstration(retrieval)).toBe(true);
  });

  it('INDEPENDENT + successful retrieval stays INDEPENDENT; the independent count does not increase', () => {
    const one = [beta({ kind: 'independent_exercise', at: at(1) })];
    const before = evaluateSkill(BETA, one, new Date(at(2)));
    const after = evaluateSkill(
      BETA,
      [...one, beta({ kind: 'retrieval', at: at(5) })],
      new Date(at(6)),
    );
    expect(before.state).toBe('INDEPENDENT');
    expect(after.state).toBe('INDEPENDENT');
    expect(after.ladder_state).toBe('INDEPENDENT');
    expect(after.counts.independent_passes).toBe(before.counts.independent_passes);
    expect(after.counts.independent_passes).toBe(1);
    expect(after.counts.independent_demonstrations).toBe(1);
    expect(after.counts.attempts).toBe(2);
    expect(after.counts.passes).toBe(2);
  });

  it('retrieval cannot supply the second demonstration MASTERED needs', () => {
    const withRetrievals = [
      beta({ kind: 'independent_exercise', at: at(1) }),
      beta({ kind: 'retrieval', at: at(5) }),
      beta({ kind: 'retrieval', at: at(9), exercise: 'EX-BUILD_IT-two' }),
    ];
    const result = evaluateSkill(BETA, withRetrievals, new Date(at(10)));
    expect(result.state).toBe('INDEPENDENT');
    expect(result.counts.independent_demonstrations).toBe(1);
    expect(result.missing_requirements).toEqual(['independent_evidence']);

    // A real second demonstration still does.
    const withExercise = [
      ...withRetrievals,
      beta({ kind: 'independent_exercise', at: at(11), exercise: 'EX-BUILD_IT-two' }),
    ];
    expect(evaluateSkill(BETA, withExercise, new Date(at(12))).state).toBe('MASTERED');
  });

  it('MASTERED → NEEDS_REFRESH → successful retrieval → MASTERED, review_due advances, independent count unchanged', () => {
    const history = mastered();
    const firstDue = Date.parse(at(3)) + 60 * DAY;
    const settled = evaluateSkill(BETA, history, new Date(at(4)));
    expect(settled.state).toBe('MASTERED');
    expect(settled.review_due).toBe(new Date(firstDue).toISOString());

    const stale = evaluateSkill(BETA, history, new Date(firstDue + 15 * DAY));
    expect(stale.state).toBe('NEEDS_REFRESH');
    expect(stale.refresh_from).toBe('MASTERED');

    const retrievalAt = new Date(firstDue + 16 * DAY).toISOString();
    const restored = evaluateSkill(
      BETA,
      [...history, beta({ kind: 'retrieval', at: retrievalAt })],
      new Date(retrievalAt),
    );
    expect(restored.state).toBe('MASTERED');
    expect(restored.ladder_state).toBe('MASTERED');
    expect(restored.refresh_from).toBeNull();
    expect(restored.last_demonstrated).toBe(retrievalAt);
    expect(restored.review_due).toBe(new Date(Date.parse(retrievalAt) + 60 * DAY).toISOString());
    expect(Date.parse(restored.review_due as string)).toBeGreaterThan(firstDue);
    expect(restored.counts.independent_passes).toBe(2);
    expect(restored.counts.independent_demonstrations).toBe(2);
    expect(restored.counts.passes).toBe(3);
  });

  it('a failed retrieval still forces NEEDS_REFRESH and moves nothing forward', () => {
    const result = evaluateSkill(
      BETA,
      [...mastered(), beta({ kind: 'retrieval', result: 'failed', at: at(5) })],
      new Date(at(6)),
    );
    expect(result.state).toBe('NEEDS_REFRESH');
    expect(result.refresh_reason).toBe('failed_retrieval');
    expect(result.ladder_state).toBe('MASTERED');
    expect(result.last_demonstrated).toBe(at(3));
    expect(result.counts.independent_passes).toBe(2);
  });

  it('a qualifying retrieval updates last_demonstrated; an assisted one does not', () => {
    const base = mastered();
    const unassisted = evaluateSkill(
      BETA,
      [...base, beta({ kind: 'retrieval', at: at(5) })],
      new Date(at(6)),
    );
    expect(unassisted.last_demonstrated).toBe(at(5));
    const light = evaluateSkill(
      BETA,
      [...base, beta({ kind: 'retrieval', at: at(5), hints: ['nudge'] })],
      new Date(at(6)),
    );
    expect(light.last_demonstrated).toBe(at(5));
    const heavy = evaluateSkill(
      BETA,
      [...base, beta({ kind: 'retrieval', at: at(5), hints: ['worked_example'] })],
      new Date(at(6)),
    );
    expect(heavy.last_demonstrated).toBe(at(3));
    const guided = evaluateSkill(
      BETA,
      [...base, beta({ kind: 'retrieval', at: at(5), hints: ['concept_reminder'] })],
      new Date(at(6)),
    );
    expect(guided.last_demonstrated).toBe(at(3));
  });

  it('fieldwork and real-GHL proof requirements are unchanged', () => {
    for (const kind of ['fieldwork', 'real_ghl'] as const) {
      const proven = evidence({ skill: GAMMA.id, kind, at: at(3), realGhl: true });
      expect(isPass(proven)).toBe(true);
      expect(isIndependentPass(proven)).toBe(true);
      expect(isFieldworkPass(proven)).toBe(true);
      expect(isDemonstration(proven)).toBe(true);
      const unproven = evidence({ skill: GAMMA.id, kind, at: at(3), realGhl: false });
      expect(isPass(unproven)).toBe(false);
      expect(isIndependentPass(unproven)).toBe(false);
      expect(isFieldworkPass(unproven)).toBe(false);
      expect(isDemonstration(unproven)).toBe(false);
    }
    // GAMMA needs two sales-use demonstrations and provided fieldwork.
    const sales = [
      evidence({ skill: GAMMA.id, kind: 'sales_use', at: at(1), exercise: 'EX-WRITE_IT-one' }),
      evidence({ skill: GAMMA.id, kind: 'sales_use', at: at(2), exercise: 'EX-SAY_IT-one' }),
    ];
    const unproven = evaluateSkill(
      GAMMA,
      [...sales, evidence({ skill: GAMMA.id, kind: 'fieldwork', at: at(3), realGhl: false })],
      new Date(at(4)),
    );
    expect(unproven.state).toBe('INDEPENDENT');
    expect(unproven.missing_requirements).toEqual(['real_ghl_fieldwork']);
    expect(unproven.counts.fieldwork_passes).toBe(0);
    const proven = evaluateSkill(
      GAMMA,
      [...sales, evidence({ skill: GAMMA.id, kind: 'fieldwork', at: at(3), realGhl: true })],
      new Date(at(4)),
    );
    expect(proven.state).toBe('MASTERED');
    expect(proven.counts.fieldwork_passes).toBe(1);
    // ALPHA's pressure-test requirement is untouched by retrieval too.
    const alpha = evaluateSkill(
      ALPHA,
      [
        evidence({ kind: 'independent_exercise', at: at(1) }),
        evidence({ kind: 'independent_exercise', at: at(2), exercise: 'EX-BUILD_IT-two' }),
        evidence({ kind: 'retrieval', at: at(5) }),
      ],
      new Date(at(6)),
    );
    expect(alpha.state).toBe('INDEPENDENT');
    expect(alpha.missing_requirements).toEqual(['pressure_test']);
  });
});
