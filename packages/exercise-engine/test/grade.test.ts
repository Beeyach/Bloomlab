import { describe, expect, it } from 'vitest';

import {
  EXERCISE_GRADER_VERSION,
  dimensionOf,
  gradeExercise,
  isFullyGradable,
  requiredSources,
} from '../src/index.ts';
import { architecture, assertion, context, events, exercise, providing } from './fixtures.ts';

/** `n` state assertions against a state tree of flags, so a score is easy to reason about. */
const flags = (passing: number, failing: number) => ({
  assertions: [
    ...Array.from({ length: passing }, (_, i) =>
      assertion({ id: `p${i}`, type: 'state', path: `f.p${i}`, operator: 'equals', value: true }),
    ),
    ...Array.from({ length: failing }, (_, i) =>
      assertion({ id: `f${i}`, type: 'state', path: `f.f${i}`, operator: 'equals', value: true }),
    ),
  ],
  state: {
    f: {
      ...Object.fromEntries(Array.from({ length: passing }, (_, i) => [`p${i}`, true])),
      ...Object.fromEntries(Array.from({ length: failing }, (_, i) => [`f${i}`, false])),
    },
  },
});

describe('scoring (D-067)', () => {
  it('scores the share of required checks that passed and respects the threshold', () => {
    const { assertions, state } = flags(8, 2);
    const report = gradeExercise({
      exercise: exercise({
        expected_outcomes: assertions,
        grading: { mode: 'deterministic', pass_threshold: 70 },
      }),
      context: context({ state }),
    });
    expect(report.score).toBe(80);
    expect(report.outcome).toBe('passed');
    expect(report.reason).toBe('threshold_met');
    expect(report.counts).toMatchObject({ scored_total: 10, scored_passed: 8 });
  });

  it('fails below the threshold without inventing a critical failure', () => {
    const { assertions, state } = flags(6, 4);
    const report = gradeExercise({
      exercise: exercise({
        expected_outcomes: assertions,
        grading: { mode: 'deterministic', pass_threshold: 70 },
      }),
      context: context({ state }),
    });
    expect(report.score).toBe(60);
    expect(report.outcome).toBe('failed');
    expect(report.reason).toBe('below_threshold');
    expect(report.failed_critical).toEqual([]);
  });

  it('passes exactly on the threshold', () => {
    const { assertions, state } = flags(7, 3);
    const report = gradeExercise({
      exercise: exercise({
        expected_outcomes: assertions,
        grading: { mode: 'deterministic', pass_threshold: 70 },
      }),
      context: context({ state }),
    });
    expect(report.score).toBe(70);
    expect(report.outcome).toBe('passed');
  });

  it('counts quality with required and leaves bonus out of the denominator', () => {
    const state = { f: { a: true, b: false, c: true } };
    const report = gradeExercise({
      exercise: exercise({
        expected_outcomes: [
          assertion({ id: 'r1', type: 'state', path: 'f.a', operator: 'equals', value: true }),
          assertion({
            id: 'q1',
            tier: 'quality',
            type: 'state',
            path: 'f.b',
            operator: 'equals',
            value: true,
          }),
          assertion({
            id: 'b1',
            tier: 'bonus',
            type: 'state',
            path: 'f.c',
            operator: 'equals',
            value: true,
          }),
        ],
      }),
      context: context({ state }),
    });
    expect(report.counts.scored_total).toBe(2);
    expect(report.score).toBe(50);
    expect(report.tiers.required.map((r) => r.id)).toEqual(['r1']);
    expect(report.tiers.quality.map((r) => r.id)).toEqual(['q1']);
    expect(report.tiers.bonus.map((r) => r.id)).toEqual(['b1']);
    expect(report.tiers.bonus[0]?.passed).toBe(true);
  });

  it('groups every result into the four tiers, with critical always critical', () => {
    const report = gradeExercise({
      exercise: exercise({
        expected_outcomes: [
          assertion({ id: 'r1', type: 'state', path: 'f.a', operator: 'exists' }),
        ],
        critical_failures: [assertion({ id: 'c1', type: 'negative', event: 'sms.sent' })],
      }),
      context: context({ state: { f: { a: 1 } } }),
    });
    expect(Object.keys(report.tiers)).toEqual(['critical', 'required', 'quality', 'bonus']);
    expect(report.tiers.critical[0]?.tier).toBe('critical');
    expect(report.counts.critical_total).toBe(1);
  });
});

describe('critical failure overrides the score (MAS-004)', () => {
  const cancelledGotAReminder = context({
    events: events([
      {
        type: 'sms.sent',
        at: '2026-09-03T10:00:00Z',
        fields: { contact_id: 'maria', appointment_status: 'cancelled' },
      },
    ]),
  });
  const critical = assertion({
    id: 'c1',
    type: 'negative',
    event: 'sms.sent',
    where: { appointment_status: 'cancelled' },
    description: 'A cancelled appointment must not receive a reminder.',
  });

  it('95 per cent with one failed critical check is FAILED', () => {
    const { assertions, state } = flags(19, 1);
    const report = gradeExercise({
      exercise: exercise({ expected_outcomes: assertions, critical_failures: [critical] }),
      context: { ...cancelledGotAReminder, state },
    });
    expect(report.score).toBe(95);
    expect(report.outcome).toBe('failed');
    expect(report.reason).toBe('critical_failure');
    expect(report.failed_critical).toEqual(['c1']);
    expect(report.tiers.critical[0]?.description).toBe(
      'A cancelled appointment must not receive a reminder.',
    );
    expect(report.tiers.critical[0]?.observed).toContain('1 occurred');
  });

  it('100 per cent with one failed critical check is still FAILED', () => {
    const { assertions, state } = flags(4, 0);
    const report = gradeExercise({
      exercise: exercise({ expected_outcomes: assertions, critical_failures: [critical] }),
      context: { ...cancelledGotAReminder, state },
    });
    expect(report.score).toBe(100);
    expect(report.outcome).toBe('failed');
    expect(report.reason).toBe('critical_failure');
  });

  it('passing the threshold with every critical check satisfied is PASSED', () => {
    const { assertions, state } = flags(8, 2);
    const report = gradeExercise({
      exercise: exercise({ expected_outcomes: assertions, critical_failures: [critical] }),
      context: context({ state, events: events([]) }),
    });
    expect(report.outcome).toBe('passed');
    expect(report.failed_critical).toEqual([]);
    expect(report.counts.critical_passed).toBe(1);
  });

  it('reports every failed critical id, not just the first', () => {
    const report = gradeExercise({
      exercise: exercise({
        expected_outcomes: flags(1, 0).assertions,
        critical_failures: [
          critical,
          assertion({
            id: 'c2',
            type: 'negative',
            event: 'sms.sent',
            where: { contact_id: 'maria' },
          }),
        ],
      }),
      context: { ...cancelledGotAReminder, state: flags(1, 0).state },
    });
    expect(report.failed_critical).toEqual(['c1', 'c2']);
  });
});

describe('what the grader refuses to judge', () => {
  const buildIt = exercise({
    expected_outcomes: [
      assertion({
        id: 'a1',
        type: 'architecture',
        requirement: 'trigger_exists',
        ghl_feature: 'GHL-WF-APPOINTMENT-STATUS',
      }),
      assertion({
        id: 'a2',
        type: 'state',
        path: 'prediction.tag',
        operator: 'equals',
        value: 'booked',
      }),
    ],
  });

  it('names the sources an exercise needs and whether a run can supply them', () => {
    expect(requiredSources(buildIt).sort()).toEqual(['architecture', 'learner']);
    expect(isFullyGradable(buildIt, ['learner'])).toBe(false);
    expect(isFullyGradable(buildIt, ['learner', 'architecture'])).toBe(true);
  });

  it('is partial, never passed, when a source is missing', () => {
    const report = gradeExercise({
      exercise: buildIt,
      context: { ...providing('learner'), state: { prediction: { tag: 'booked' } } },
    });
    expect(report.outcome).toBe('partial');
    expect(report.reason).toBe('unevaluated_assertions');
    expect(report.counts.unevaluated).toBe(1);
    expect(report.tiers.required[0]?.missing_source).toBe('architecture');
    // The half it could read was still read.
    expect(report.tiers.required[1]?.passed).toBe(true);
  });

  it('is partial while a rubric is owed, and names it', () => {
    const report = gradeExercise({
      exercise: exercise({
        expected_outcomes: flags(2, 0).assertions,
        grading: { mode: 'mixed', rubric: 'SYSTEM_DESIGN_RUBRIC_V1', pass_threshold: 70 },
      }),
      context: context({ state: flags(2, 0).state }),
    });
    expect(report.score).toBe(100);
    expect(report.outcome).toBe('partial');
    expect(report.reason).toBe('rubric_pending');
    expect(report.rubric_pending).toBe('SYSTEM_DESIGN_RUBRIC_V1');
  });

  it('a deterministic failure still fails even when a rubric is owed', () => {
    const report = gradeExercise({
      exercise: exercise({
        expected_outcomes: flags(2, 0).assertions,
        critical_failures: [assertion({ id: 'c1', type: 'negative', event: 'sms.sent' })],
        grading: { mode: 'mixed', rubric: 'SYSTEM_DESIGN_RUBRIC_V1', pass_threshold: 70 },
      }),
      context: context({
        state: flags(2, 0).state,
        events: events([{ type: 'sms.sent', at: '2026-09-03T10:00:00Z' }]),
      }),
    });
    expect(report.outcome).toBe('failed');
    expect(report.reason).toBe('critical_failure');
  });

  it('is partial when the exercise authored nothing to score', () => {
    const report = gradeExercise({ exercise: exercise({}), context: context() });
    expect(report.score).toBeNull();
    expect(report.outcome).toBe('partial');
    expect(report.reason).toBe('nothing_to_grade');
  });
});

describe('assistance and version', () => {
  it('rolls hints up through the mastery engine rules, never its own table', () => {
    const run = (hints: Parameters<typeof gradeExercise>[0]['hints_used']) =>
      gradeExercise({ exercise: exercise({}), context: context(), hints_used: hints }).assistance;
    expect(run([])).toBe('independent');
    expect(run(['nudge'])).toBe('light');
    expect(run(['nudge', 'nudge'])).toBe('light');
    expect(run(['nudge', 'nudge', 'nudge'])).toBe('guided');
    expect(run(['concept_reminder'])).toBe('guided');
    expect(run(['worked_example'])).toBe('heavy');
  });

  it('lets a runtime supply an assistance floor, and keeps the hints on the report', () => {
    const report = gradeExercise({
      exercise: exercise({}),
      context: context(),
      hints_used: ['nudge'],
      assistance: 'guided',
    });
    expect(report.assistance).toBe('guided');
    expect(report.hints_used).toEqual(['nudge']);
  });

  it('stamps the grader version on every report', () => {
    expect(gradeExercise({ exercise: exercise({}), context: context() }).grader_version).toBe(
      EXERCISE_GRADER_VERSION,
    );
  });
});

describe('determinism', () => {
  it('the same exercise and context always produce the same report', () => {
    const { assertions, state } = flags(3, 2);
    const subject = exercise({
      expected_outcomes: [
        ...assertions,
        assertion({
          id: 't1',
          type: 'timing',
          event: 'sms.sent',
          relative_to: 'appointment.start',
          offset_minutes: -1440,
          tolerance_minutes: 10,
        }),
        assertion({ id: 's1', type: 'sequence', before: 'sms.sent', after: 'tag.added' }),
      ],
      critical_failures: [assertion({ id: 'c1', type: 'negative', event: 'call.placed' })],
    });
    const run = context({
      state,
      events: events([
        { type: 'sms.sent', at: '2026-09-03T15:00:00Z', fields: { contact_id: 'maria' } },
        { type: 'tag.added', at: '2026-09-03T15:01:00Z', fields: { contact_id: 'maria' } },
      ]),
      references: { 'appointment.start': '2026-09-04T15:00:00Z' },
    });
    const first = JSON.stringify(gradeExercise({ exercise: subject, context: run }));
    for (let i = 0; i < 5; i += 1) {
      expect(JSON.stringify(gradeExercise({ exercise: subject, context: run }))).toBe(first);
    }
  });

  it('does not depend on the wall clock', () => {
    const subject = exercise({
      expected_outcomes: [
        assertion({
          id: 't1',
          type: 'timing',
          event: 'sms.sent',
          relative_to: 'appointment.start',
          offset_minutes: -1440,
          tolerance_minutes: 10,
        }),
      ],
    });
    const run = context({
      events: events([{ type: 'sms.sent', at: '2026-09-03T15:00:00Z' }]),
      references: { 'appointment.start': '2026-09-04T15:00:00Z' },
    });
    const before = gradeExercise({ exercise: subject, context: run });
    const realNow = Date.now;
    // Move the wall clock five years; a deterministic grade cannot notice.
    Date.now = () => realNow() + 5 * 365 * 24 * 60 * 60 * 1000;
    try {
      expect(JSON.stringify(gradeExercise({ exercise: subject, context: run }))).toBe(
        JSON.stringify(before),
      );
    } finally {
      Date.now = realNow;
    }
  });

  it('does not depend on the order assertions happen to be authored in', () => {
    const { assertions, state } = flags(2, 1);
    const forward = gradeExercise({
      exercise: exercise({ expected_outcomes: assertions }),
      context: context({ state }),
    });
    const backward = gradeExercise({
      exercise: exercise({ expected_outcomes: [...assertions].reverse() }),
      context: context({ state }),
    });
    expect(backward.score).toBe(forward.score);
    expect(backward.outcome).toBe(forward.outcome);
  });
});

describe('weighted dimensions (EXR-023, D-113)', () => {
  const weights = {
    correctness: 45,
    edge_cases: 20,
    architecture: 15,
    maintainability: 10,
    explanation: 10,
  };

  it('places assertions by type when no dimension is authored', () => {
    expect(dimensionOf(assertion({ type: 'architecture', requirement: 'trigger_exists' }))).toBe(
      'architecture',
    );
    expect(dimensionOf(assertion({ type: 'negative', event: 'sms.sent' }))).toBe('edge_cases');
    expect(dimensionOf(assertion({ type: 'state', path: 'prediction.tag' }))).toBe('explanation');
    expect(dimensionOf(assertion({ type: 'state', path: 'contacts.maria.tags' }))).toBe(
      'correctness',
    );
    expect(dimensionOf(assertion({ type: 'event', event: 'sms.sent' }))).toBe('correctness');
    expect(
      dimensionOf(assertion({ type: 'event', event: 'sms.sent', dimension: 'maintainability' })),
    ).toBe('maintainability');
  });

  it('weights each present dimension by its share and ignores dimensions with no check', () => {
    // correctness: 1 of 2 · architecture: 1 of 1 · explanation: 0 of 1 · no edge or maintainability
    const report = gradeExercise({
      exercise: exercise({
        expected_outcomes: [
          assertion({ id: 'c1', type: 'state', path: 'f.a', operator: 'equals', value: true }),
          assertion({ id: 'c2', type: 'state', path: 'f.b', operator: 'equals', value: true }),
          assertion({
            id: 'ar',
            type: 'architecture',
            requirement: 'trigger_exists',
            ghl_feature: 'GHL-WF-APPOINTMENT-STATUS',
          }),
          assertion({
            id: 'ex',
            type: 'state',
            path: 'prediction.tag',
            operator: 'equals',
            value: 'booked',
          }),
        ],
        grading: { mode: 'deterministic', pass_threshold: 70, weights },
      }),
      context: context({
        state: { f: { a: true, b: false }, prediction: { tag: 'other' } },
        architecture: architecture(),
      }),
    });
    // (45·0.5 + 15·1 + 10·0) / (45 + 15 + 10) = 37.5 / 70 = 53.57 → 54
    expect(report.score).toBe(54);
    expect(report.dimensions?.correctness).toMatchObject({
      weight: 45,
      total: 2,
      passed: 1,
      ratio: 0.5,
    });
    expect(report.dimensions?.edge_cases).toMatchObject({ total: 0, ratio: null });
    expect(report.dimensions?.maintainability).toMatchObject({ total: 0, ratio: null });
    expect(report.outcome).toBe('failed');
    expect(report.reason).toBe('below_threshold');
  });

  it('a critical failure overrides a perfect weighted score', () => {
    const report = gradeExercise({
      exercise: exercise({
        expected_outcomes: [
          assertion({ id: 'c1', type: 'state', path: 'f.a', operator: 'equals', value: true }),
        ],
        critical_failures: [assertion({ id: 'k1', type: 'negative', event: 'sms.sent' })],
        grading: { mode: 'deterministic', pass_threshold: 70, weights },
      }),
      context: context({
        state: { f: { a: true } },
        events: events([{ type: 'sms.sent', at: '2026-09-03T09:00:00Z' }]),
      }),
    });
    expect(report.score).toBe(100);
    expect(report.outcome).toBe('failed');
    expect(report.reason).toBe('critical_failure');
    expect(report.failed_critical).toEqual(['k1']);
    expect(report.tiers.critical[0]?.dimension).toBe('edge_cases');
  });

  it('without weights the flat share still applies, and no dimension table is reported', () => {
    const { assertions, state } = flags(3, 1);
    const report = gradeExercise({
      exercise: exercise({ expected_outcomes: assertions }),
      context: context({ state }),
    });
    expect(report.score).toBe(75);
    expect(report.dimensions).toBeNull();
  });
});
