import { beforeEach, describe, expect, it } from 'vitest';

import { evaluateCampaign, evaluateSkills } from '../src/index.ts';
import {
  ALPHA,
  BETA,
  CAMPAIGN,
  GAMMA,
  NOW,
  SKILLS,
  at,
  evidence,
  resetCounter,
} from './fixtures.ts';

beforeEach(resetCounter);

const skills = new Map(SKILLS.map((s) => [s.id, s]));
const campaignFor = (history: ReturnType<typeof evidence>[], now = NOW) =>
  evaluateCampaign(CAMPAIGN, skills, evaluateSkills(SKILLS, history, now));

describe('prerequisites and gates (spec §7, §11; PRD-002, PRD-003, CUR-002)', () => {
  it('starts with the first gate available, later gates locked, placement optional', () => {
    const result = campaignFor([]);
    expect(result.gates.map((g) => [g.gate, g.status])).toEqual([
      ['GATE-0', 'optional'],
      ['GATE-1', 'available'],
      ['GATE-2', 'locked'],
      ['GATE-3', 'locked'],
    ]);
    expect(result.current_gate).toBe('GATE-1');
    expect(result.next_required).toEqual([ALPHA.id]);
    expect(result.unlocked_skills).toEqual([ALPHA.id]);
  });

  it('8. a prerequisite unlocks the next skill immediately after qualifying evidence', () => {
    const exposed = campaignFor([evidence({ kind: 'exposure' })]);
    expect(exposed.gates[1]?.status).toBe('in_progress');
    expect(exposed.gates[2]?.status).toBe('locked');
    expect(exposed.gates[2]?.skills[0]?.unsatisfied_prerequisites).toEqual([ALPHA.id]);

    const independent = campaignFor([evidence({ kind: 'independent_exercise', at: at(1) })]);
    expect(independent.gates[2]?.status).toBe('available');
    expect(independent.gates[2]?.skills[0]?.available).toBe(true);
    expect(independent.unlocked_skills).toEqual([ALPHA.id, BETA.id]);
  });

  it('9. a gate resolves on its pass criteria: evidence count, pressure test, fieldwork', () => {
    const twoIndependent = [
      evidence({ kind: 'independent_exercise', at: at(1) }),
      evidence({ kind: 'independent_exercise', at: at(2), exercise: 'EX-BUILD_IT-two' }),
    ];
    const noPressure = campaignFor(twoIndependent);
    expect(noPressure.gates[1]?.status).toBe('in_progress');
    expect(noPressure.gates[1]?.skills[0]?.missing).toEqual(['pressure_test']);

    const passed = campaignFor([...twoIndependent, evidence({ kind: 'pressure_test', at: at(3) })]);
    expect(passed.gates[1]?.status).toBe('passed');
    expect(passed.passed_gates).toEqual(['GATE-1']);
    expect(passed.current_gate).toBe('GATE-2');
    expect(passed.next_required).toEqual([BETA.id]);
    expect(passed.gates[0]?.cleared).toEqual([ALPHA.id]);
  });

  it('10. the learner can work ahead as soon as prerequisites pass, before the current gate is done', () => {
    const result = campaignFor([evidence({ kind: 'independent_exercise', at: at(1) })]);
    expect(result.current_gate).toBe('GATE-1');
    expect(result.work_ahead).toEqual([BETA.id]);

    const ahead = campaignFor([
      evidence({ kind: 'independent_exercise', at: at(1) }),
      evidence({
        skill: BETA.id,
        kind: 'independent_exercise',
        at: at(2),
        exercise: 'EX-BUILD_IT-beta',
      }),
    ]);
    expect(ahead.current_gate).toBe('GATE-1');
    expect(ahead.gates[2]?.status).toBe('passed');
    expect(ahead.gates[3]?.status).toBe('available');
    expect(ahead.work_ahead).toEqual([GAMMA.id]);
  });

  it('11. the clock never blocks progression: two years later the gates read the same', () => {
    const history = [
      evidence({ kind: 'independent_exercise', at: at(1) }),
      evidence({
        skill: BETA.id,
        kind: 'independent_exercise',
        at: at(2),
        exercise: 'EX-BUILD_IT-beta',
      }),
    ];
    const strip = (result: ReturnType<typeof campaignFor>) =>
      result.gates.map((g) => [
        g.status,
        g.skills.map((s) => [s.available, s.passes, s.unsatisfied_prerequisites]),
      ]);
    const today = campaignFor(history, NOW);
    const later = campaignFor(history, new Date('2028-09-15T12:00:00Z'));
    expect(strip(later)).toEqual(strip(today));
    expect(later.current_gate).toBe(today.current_gate);
    expect(later.work_ahead).toEqual(today.work_ahead);
    // The refresh overlay shows (review is long overdue) but availability does not change.
    expect(later.gates[2]?.skills[0]?.state).toBe('NEEDS_REFRESH');
    expect(later.gates[3]?.skills[0]?.available).toBe(true);
  });

  it('a due review or NEEDS_REFRESH prerequisite never locks what depends on it (MAS-005)', () => {
    const history = [evidence({ kind: 'independent_exercise', at: at(1) })];
    const stale = campaignFor(history, new Date('2027-01-01T00:00:00Z'));
    expect(stale.gates[1]?.skills[0]?.state).toBe('NEEDS_REFRESH');
    expect(stale.gates[2]?.skills[0]?.available).toBe(true);
  });

  it('completes when every progression gate passes', () => {
    const history = [
      evidence({ kind: 'independent_exercise', at: at(1) }),
      evidence({ kind: 'independent_exercise', at: at(2), exercise: 'EX-BUILD_IT-two' }),
      evidence({ kind: 'pressure_test', at: at(3) }),
      evidence({
        skill: BETA.id,
        kind: 'independent_exercise',
        at: at(4),
        exercise: 'EX-BUILD_IT-beta',
      }),
      evidence({ skill: GAMMA.id, kind: 'sales_use', at: at(5), exercise: 'EX-WRITE_IT-one' }),
      evidence({ skill: GAMMA.id, kind: 'sales_use', at: at(6), exercise: 'EX-SAY_IT-one' }),
      evidence({ skill: GAMMA.id, kind: 'fieldwork', at: at(7), realGhl: true }),
    ];
    const result = campaignFor(history);
    expect(result.complete).toBe(true);
    expect(result.current_gate).toBeNull();
    expect(result.next_required).toEqual([]);
  });
});
