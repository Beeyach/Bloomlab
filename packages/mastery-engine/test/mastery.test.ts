import { beforeEach, describe, expect, it } from 'vitest';

import { MASTERY_RULES_VERSION, MASTERY_STATES, evaluateSkill } from '../src/index.ts';
import { ALPHA, BETA, GAMMA, NOW, at, evidence, resetCounter } from './fixtures.ts';

beforeEach(resetCounter);

const beta = (options: Omit<Parameters<typeof evidence>[0], 'skill'>) =>
  evidence({ ...options, skill: BETA.id });

describe('mastery ladder (spec §29–§30, MAS-001, MAS-002, MAS-011)', () => {
  it('1. a new learner starts UNSEEN', () => {
    const result = evaluateSkill(ALPHA, [], NOW);
    expect(result.state).toBe('UNSEEN');
    expect(result.confidence).toBe(0);
    expect(result.missing_requirements).toContain('practice');
    expect(result.rules_version).toBe(MASTERY_RULES_VERSION);
  });

  it('2. lesson exposure never creates mastery: ten readings and a passed quiz stay LEARNING', () => {
    const history = [
      ...Array.from({ length: 10 }, (_, i) => evidence({ kind: 'exposure', at: at(i + 1) })),
      evidence({ kind: 'quiz', result: 'passed', score: 100 }),
    ];
    const result = evaluateSkill(ALPHA, history, NOW);
    expect(result.state).toBe('LEARNING');
    expect(result.counts.attempts).toBe(0);
  });

  it('3. guided success advances to GUIDED, never to PRACTICED or INDEPENDENT', () => {
    const history = [evidence({ kind: 'exposure' }), evidence({ kind: 'guided_practice' })];
    expect(evaluateSkill(ALPHA, history, NOW).state).toBe('GUIDED');
    const twice = [...history, evidence({ kind: 'guided_practice', at: at(2) })];
    expect(evaluateSkill(ALPHA, twice, NOW).state).toBe('GUIDED');
  });

  it('4. a worked-example or heavily assisted pass counts as GUIDED, not independent', () => {
    const heavy = evaluateSkill(
      ALPHA,
      [evidence({ kind: 'independent_exercise', hints: ['worked_example'] })],
      NOW,
    );
    expect(heavy.state).toBe('GUIDED');
    expect(heavy.counts.independent_passes).toBe(0);
    const concept = evaluateSkill(
      ALPHA,
      [evidence({ kind: 'deterministic_exercise', hints: ['concept_reminder'] })],
      NOW,
    );
    expect(concept.state).toBe('GUIDED');
    const light = evaluateSkill(
      ALPHA,
      [evidence({ kind: 'deterministic_exercise', hints: ['nudge'] })],
      NOW,
    );
    expect(light.state).toBe('PRACTICED');
  });

  it('5. repeated independent evidence advances by the explicit rule', () => {
    const one = [beta({ kind: 'independent_exercise', at: at(1) })];
    expect(evaluateSkill(BETA, one, NOW).state).toBe('INDEPENDENT');

    // Same exercise, same day: one demonstration, still INDEPENDENT.
    const sameDay = [...one, beta({ kind: 'independent_exercise', at: at(1, 14) })];
    const sameDayResult = evaluateSkill(BETA, sameDay, NOW);
    expect(sameDayResult.state).toBe('INDEPENDENT');
    expect(sameDayResult.counts.independent_demonstrations).toBe(1);
    expect(sameDayResult.missing_requirements).toEqual(['independent_evidence']);

    // A second demonstration on another day: BETA needs nothing else → MASTERED.
    const twoDays = [...one, beta({ kind: 'independent_exercise', at: at(3) })];
    expect(evaluateSkill(BETA, twoDays, NOW).state).toBe('MASTERED');

    // ALPHA also requires a pressure test: the same pattern stays INDEPENDENT with that missing.
    const alphaTwoDays = [
      evidence({ kind: 'independent_exercise', at: at(1) }),
      evidence({ kind: 'independent_exercise', at: at(3) }),
    ];
    const alpha = evaluateSkill(ALPHA, alphaTwoDays, NOW);
    expect(alpha.state).toBe('INDEPENDENT');
    expect(alpha.missing_requirements).toEqual(['pressure_test']);
  });

  it('6. pressure-test evidence is distinguished from normal practice', () => {
    const base = [
      evidence({ kind: 'independent_exercise', at: at(1) }),
      evidence({ kind: 'independent_exercise', at: at(2), exercise: 'EX-BUILD_IT-two' }),
    ];
    const normal = evaluateSkill(
      ALPHA,
      [...base, evidence({ kind: 'independent_exercise', at: at(3) })],
      NOW,
    );
    expect(normal.state).toBe('INDEPENDENT');
    expect(normal.counts.pressure_passes).toBe(0);

    const assistedPressure = evaluateSkill(
      ALPHA,
      [...base, evidence({ kind: 'pressure_test', at: at(3), hints: ['nudge'] })],
      NOW,
    );
    expect(assistedPressure.counts.pressure_passes).toBe(0);
    expect(assistedPressure.state).toBe('INDEPENDENT');

    const pressure = evaluateSkill(
      ALPHA,
      [...base, evidence({ kind: 'pressure_test', at: at(3) })],
      NOW,
    );
    expect(pressure.counts.pressure_passes).toBe(1);
    expect(pressure.state).toBe('MASTERED');

    const onlyPressure = evaluateSkill(
      ALPHA,
      [evidence({ kind: 'pressure_test', at: at(3) })],
      NOW,
    );
    expect(onlyPressure.state).toBe('PRESSURE_TESTED');
  });

  it('7. a failure lowers confidence and shortens review without deleting prior evidence', () => {
    const passes = [
      beta({ kind: 'independent_exercise', at: at(1) }),
      beta({ kind: 'independent_exercise', at: at(2), exercise: 'EX-BUILD_IT-two' }),
    ];
    const before = evaluateSkill(BETA, passes, NOW);
    const after = evaluateSkill(
      BETA,
      [...passes, beta({ kind: 'independent_exercise', result: 'failed', at: at(5) })],
      NOW,
    );
    expect(after.ladder_state).toBe(before.ladder_state);
    expect(after.counts.evidence).toBe(3);
    expect(after.counts.independent_passes).toBe(2);
    expect(after.failure_rate).toBeGreaterThan(0);
    expect(after.confidence).toBeLessThan(before.confidence);
    expect(Date.parse(after.review_due as string)).toBeLessThan(
      Date.parse(before.review_due as string),
    );
    expect(after.last_result).toBe('failed');
  });

  it('requires real-GHL fieldwork and sales use when the skill says so', () => {
    const base = [
      evidence({ skill: GAMMA.id, kind: 'sales_use', at: at(1), exercise: 'EX-WRITE_IT-one' }),
      evidence({ skill: GAMMA.id, kind: 'sales_use', at: at(2), exercise: 'EX-SAY_IT-one' }),
    ];
    const noFieldwork = evaluateSkill(GAMMA, base, NOW);
    expect(noFieldwork.state).toBe('INDEPENDENT');
    expect(noFieldwork.missing_requirements).toEqual(['real_ghl_fieldwork']);
    const withUnprovided = evaluateSkill(
      GAMMA,
      [...base, evidence({ skill: GAMMA.id, kind: 'fieldwork', at: at(3), realGhl: false })],
      NOW,
    );
    expect(withUnprovided.missing_requirements).toEqual(['real_ghl_fieldwork']);
    const done = evaluateSkill(
      GAMMA,
      [...base, evidence({ skill: GAMMA.id, kind: 'fieldwork', at: at(3), realGhl: true })],
      NOW,
    );
    expect(done.state).toBe('MASTERED');
  });

  it('only ever emits the eight states (MAS-001) and ignores other skills’ evidence', () => {
    const mixed = [
      evidence({ kind: 'exposure' }),
      beta({ kind: 'independent_exercise' }),
      evidence({ kind: 'guided_practice' }),
    ];
    const result = evaluateSkill(ALPHA, mixed, NOW);
    expect(MASTERY_STATES).toContain(result.state);
    expect(result.counts.evidence).toBe(2);
  });

  it('16. stamps the rules version and keeps the evidence versions untouched', () => {
    const record = beta({ kind: 'independent_exercise' });
    const result = evaluateSkill(BETA, [record], NOW);
    expect(result.rules_version).toBe(MASTERY_RULES_VERSION);
    expect(record.versions).toEqual({
      app: '0.1.0',
      content: '2026.09.02',
      content_hash: 'e15441abc7fc',
      simulator: '0.0.0',
      rules: MASTERY_RULES_VERSION,
    });
  });
});
