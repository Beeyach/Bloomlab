import { beforeEach, describe, expect, it } from 'vitest';

import {
  SESSION_LENGTHS,
  buildSession,
  evaluateCampaign,
  evaluateSkills,
  scheduleReviews,
  type SessionContent,
  type SessionInput,
} from '../src/index.ts';
import { ALPHA, BETA, CAMPAIGN, GAMMA, SKILLS, at, evidence, resetCounter } from './fixtures.ts';

beforeEach(resetCounter);

const CONTENT: SessionContent = {
  units_by_skill: { [ALPHA.id]: ['LU-alpha'], [BETA.id]: ['LU-beta'] },
  unit_minutes: { 'LU-alpha': 15, 'LU-beta': 20 },
  exercises_by_skill: {
    [ALPHA.id]: ['EX-BUILD_IT-alpha-guided', 'EX-EDGE_CASE-alpha-solo', 'EX-REBUILD_BLIND-alpha'],
    [BETA.id]: ['EX-BUILD_IT-beta-practice', 'EX-EDGE_CASE-beta-solo'],
    [GAMMA.id]: ['EX-WRITE_IT-gamma', 'EX-FIELDWORK-gamma'],
  },
  exercises: {
    'EX-BUILD_IT-alpha-guided': {
      id: 'EX-BUILD_IT-alpha-guided',
      type: 'BUILD_IT',
      mode: 'guided',
      estimated_minutes: 30,
      skills: [ALPHA.id],
      fieldwork_required: false,
    },
    'EX-EDGE_CASE-alpha-solo': {
      id: 'EX-EDGE_CASE-alpha-solo',
      type: 'EDGE_CASE',
      mode: 'independent',
      estimated_minutes: 15,
      skills: [ALPHA.id],
      fieldwork_required: false,
    },
    'EX-REBUILD_BLIND-alpha': {
      id: 'EX-REBUILD_BLIND-alpha',
      type: 'REBUILD_BLIND',
      mode: 'pressure',
      estimated_minutes: 30,
      skills: [ALPHA.id],
      fieldwork_required: false,
    },
    'EX-BUILD_IT-beta-practice': {
      id: 'EX-BUILD_IT-beta-practice',
      type: 'BUILD_IT',
      mode: 'practice',
      estimated_minutes: 25,
      skills: [BETA.id],
      fieldwork_required: false,
    },
    'EX-EDGE_CASE-beta-solo': {
      id: 'EX-EDGE_CASE-beta-solo',
      type: 'EDGE_CASE',
      mode: 'independent',
      estimated_minutes: 15,
      skills: [BETA.id],
      fieldwork_required: false,
    },
    'EX-WRITE_IT-gamma': {
      id: 'EX-WRITE_IT-gamma',
      type: 'WRITE_IT',
      mode: 'practice',
      estimated_minutes: 15,
      skills: [GAMMA.id],
      fieldwork_required: false,
    },
    'EX-FIELDWORK-gamma': {
      id: 'EX-FIELDWORK-gamma',
      type: 'FIELDWORK',
      mode: 'independent',
      estimated_minutes: 60,
      skills: [GAMMA.id],
      fieldwork_required: true,
    },
  },
};

const skills = new Map(SKILLS.map((s) => [s.id, s]));

function inputFor(
  history: ReturnType<typeof evidence>[],
  now: Date,
  overrides: Partial<SessionInput> = {},
): SessionInput {
  const evaluations = evaluateSkills(SKILLS, history, now);
  return {
    length: '1h',
    now,
    skills: SKILLS,
    evaluations: [...evaluations.values()],
    campaign: evaluateCampaign(CAMPAIGN, skills, evaluations),
    path_order: [ALPHA.id, BETA.id, GAMMA.id],
    review: scheduleReviews(evaluations.values(), now),
    recent_evidence: history,
    content: CONTENT,
    ...overrides,
  };
}

const flat = (plan: ReturnType<typeof buildSession>) =>
  plan.blocks.flatMap((b) => b.items.map((i) => `${b.kind}:${i.kind}:${i.content_id}`));

describe('session builder (spec §33, TA§70; MAS-006)', () => {
  it('starts a brand-new learner with the first unit, then the guided exercise', () => {
    const plan = buildSession(inputFor([], new Date(at(1))));
    expect(flat(plan)).toEqual(['campaign:unit:LU-alpha']);
    expect(plan.planned_minutes).toBe(15);
    expect(plan.continue_available).toBe(true);
    const after = buildSession(
      inputFor([evidence({ kind: 'exposure', at: at(1) })], new Date(at(1))),
    );
    expect(flat(after)).toEqual(['campaign:exercise:EX-BUILD_IT-alpha-guided']);
  });

  it('15. prioritises due retrieval, then repair, then campaign work, within the budget', () => {
    const now = new Date(at(28));
    const history = [
      // alpha demonstrated twice long ago → review overdue
      evidence({ kind: 'independent_exercise', at: at(1), exercise: 'EX-EDGE_CASE-alpha-solo' }),
      evidence({ kind: 'independent_exercise', at: at(2), exercise: 'EX-EDGE_CASE-alpha-solo' }),
      // beta failed recently
      evidence({
        skill: BETA.id,
        kind: 'independent_exercise',
        result: 'failed',
        at: at(26),
        exercise: 'EX-EDGE_CASE-beta-solo',
      }),
    ];
    const plan = buildSession(inputFor(history, now));
    expect(plan.blocks.map((b) => b.kind)).toEqual(['retrieval', 'repair', 'campaign']);
    expect(plan.blocks[0]?.items[0]).toMatchObject({
      kind: 'retrieval',
      skill_id: ALPHA.id,
      minutes: 5,
    });
    // beta failed with no exposure yet: the repair step is its unit, then practice
    expect(plan.blocks[1]?.items[0]).toMatchObject({ kind: 'unit', skill_id: BETA.id });
    expect(plan.blocks[1]?.items[0]?.reason).toMatch(/failed recently/);
    expect(plan.blocks[2]?.items.map((i) => i.skill_id)).toContain(ALPHA.id);
    expect(plan.planned_minutes).toBeLessThanOrEqual(plan.budget_minutes);
    expect(plan.notes.length).toBeGreaterThan(0);
  });

  it('is deterministic and never calls anything outside its inputs', () => {
    const input = inputFor([evidence({ kind: 'exposure' })], new Date(at(2)));
    expect(buildSession(input)).toEqual(buildSession(input));
  });

  it('offers four lengths and Continue drops what was already done', () => {
    const history = [
      evidence({ kind: 'independent_exercise', at: at(1), exercise: 'EX-EDGE_CASE-alpha-solo' }),
    ];
    const budgets = SESSION_LENGTHS.map(
      (length) => buildSession(inputFor(history, new Date(at(2)), { length })).budget_minutes,
    );
    expect(budgets).toEqual([30, 60, 120, 240]);
    const first = buildSession(inputFor(history, new Date(at(2)), { length: '30m' }));
    const done = first.blocks.flatMap((b) => b.items.map((i) => i.id));
    const next = buildSession(inputFor(history, new Date(at(2)), { length: '30m', exclude: done }));
    expect(
      next.blocks.flatMap((b) => b.items.map((i) => i.id)).some((id) => done.includes(id)),
    ).toBe(false);
  });

  it('honours a learner-selected focus and repairs a weak prerequisite first', () => {
    const history = [evidence({ kind: 'guided_practice', at: at(1) })];
    const plan = buildSession(inputFor(history, new Date(at(2)), { focus: { skill_id: BETA.id } }));
    // alpha's next step was already planned in repair, so the campaign block has nothing left
    expect(plan.blocks.map((b) => b.kind)).toEqual(['repair', 'focus']);
    expect(plan.blocks[0]?.items[0]).toMatchObject({ skill_id: ALPHA.id });
    expect(plan.blocks[0]?.items[0]?.reason).toMatch(/weak prerequisite/);
    expect(plan.blocks[1]?.items[0]).toMatchObject({ kind: 'unit', content_id: 'LU-beta' });
  });

  it('asks for the pressure test, then fieldwork, once the evidence count is met', () => {
    const history = [
      evidence({ kind: 'independent_exercise', at: at(1), exercise: 'EX-EDGE_CASE-alpha-solo' }),
      evidence({ kind: 'independent_exercise', at: at(2), exercise: 'EX-EDGE_CASE-alpha-solo' }),
    ];
    const plan = buildSession(inputFor(history, new Date(at(3))));
    expect(flat(plan)[0]).toBe('campaign:exercise:EX-REBUILD_BLIND-alpha');
    const gammaHistory = [
      ...history,
      evidence({ kind: 'pressure_test', at: at(3), exercise: 'EX-REBUILD_BLIND-alpha' }),
      evidence({
        skill: BETA.id,
        kind: 'independent_exercise',
        at: at(4),
        exercise: 'EX-EDGE_CASE-beta-solo',
      }),
      evidence({ skill: GAMMA.id, kind: 'sales_use', at: at(5), exercise: 'EX-WRITE_IT-gamma' }),
      evidence({ skill: GAMMA.id, kind: 'sales_use', at: at(6), exercise: 'EX-WRITE_IT-gamma' }),
    ];
    const fieldwork = buildSession(inputFor(gammaHistory, new Date(at(7)), { length: '2h' }));
    expect(flat(fieldwork)).toContain('campaign:exercise:EX-FIELDWORK-gamma');
  });

  it('retries assisted passes without hints when assistance dependence is high', () => {
    const history = [
      evidence({
        kind: 'deterministic_exercise',
        at: at(1),
        hints: ['worked_example'],
        exercise: 'EX-BUILD_IT-alpha-guided',
      }),
      evidence({
        kind: 'deterministic_exercise',
        at: at(2),
        hints: ['concept_reminder'],
        exercise: 'EX-BUILD_IT-alpha-guided',
      }),
    ];
    const plan = buildSession(inputFor(history, new Date(at(3))));
    expect(plan.assistance_dependence).toBe(1);
    expect(plan.blocks[0]?.kind).toBe('repair');
    expect(plan.blocks[0]?.items[0]?.reason).toMatch(/without hints/);
  });
});
