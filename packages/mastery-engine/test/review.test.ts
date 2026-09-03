import { beforeEach, describe, expect, it } from 'vitest';

import { REVIEW_RULES, evaluateSkill, reviewIntervalDays, scheduleReviews } from '../src/index.ts';
import { ALPHA, BETA, at, evidence, resetCounter } from './fixtures.ts';

beforeEach(resetCounter);

const DAY = 24 * 3600 * 1000;
const independentBeta = [evidence({ skill: BETA.id, kind: 'independent_exercise', at: at(1) })];

describe('review scheduling (spec §32, TA§69; MAS-005, MAS-009)', () => {
  it('12. review becomes due deterministically from the last demonstration', () => {
    const early = evaluateSkill(BETA, independentBeta, new Date(at(10)));
    expect(early.state).toBe('INDEPENDENT');
    expect(early.review_due).toBe(new Date(Date.parse(at(1)) + 21 * DAY).toISOString());
    expect(scheduleReviews([early], new Date(at(10))).due).toEqual([]);
    expect(scheduleReviews([early], new Date(at(10))).upcoming.map((i) => i.skill_id)).toEqual([
      BETA.id,
    ]);

    const later = evaluateSkill(BETA, independentBeta, new Date(at(25)));
    const schedule = scheduleReviews([later], new Date(at(25)));
    expect(schedule.due.map((i) => [i.skill_id, i.reason])).toEqual([[BETA.id, 'overdue']]);
    expect(later.state).toBe('INDEPENDENT');
  });

  it('shortens the interval by importance and recent failures (explicit numbers)', () => {
    expect(reviewIntervalDays('INDEPENDENT', 1, 0)).toBe(21);
    expect(reviewIntervalDays('INDEPENDENT', 1.5, 0)).toBe(14);
    expect(reviewIntervalDays('INDEPENDENT', 1, 0.5)).toBe(15.8);
    expect(reviewIntervalDays('MASTERED', 1, 0)).toBe(60);
    expect(reviewIntervalDays('LEARNING', 1, 0)).toBeNull();
    expect(reviewIntervalDays('INDEPENDENT', 4, 1)).toBe(REVIEW_RULES.min_interval_days);
  });

  it('13. overdue beyond the grace window becomes NEEDS_REFRESH without erasing the ladder', () => {
    const due = Date.parse(at(1)) + 21 * DAY;
    const withinGrace = evaluateSkill(BETA, independentBeta, new Date(due + 8 * DAY));
    expect(withinGrace.state).toBe('INDEPENDENT');
    const pastGrace = evaluateSkill(BETA, independentBeta, new Date(due + 15 * DAY));
    expect(pastGrace.state).toBe('NEEDS_REFRESH');
    expect(pastGrace.ladder_state).toBe('INDEPENDENT');
    expect(pastGrace.refresh_from).toBe('INDEPENDENT');
    expect(pastGrace.refresh_reason).toBe('overdue');
    expect(pastGrace.missing_requirements).toContain('refresh');
    expect(pastGrace.confidence).toBeLessThanOrEqual(0.5);
    expect(pastGrace.counts.independent_passes).toBe(1);
  });

  it('a failed retrieval re-queues the skill immediately', () => {
    const history = [
      ...independentBeta,
      evidence({ skill: BETA.id, kind: 'retrieval', result: 'failed', at: at(5) }),
    ];
    const result = evaluateSkill(BETA, history, new Date(at(6)));
    expect(result.state).toBe('NEEDS_REFRESH');
    expect(result.refresh_reason).toBe('failed_retrieval');
    expect(scheduleReviews([result], new Date(at(6))).due[0]?.reason).toBe('needs_refresh');
  });

  it('14. a passed retrieval restores the earned state without advancing it; history is intact', () => {
    const due = Date.parse(at(1)) + 21 * DAY;
    const later = new Date(due + 20 * DAY);
    const stale = evaluateSkill(BETA, independentBeta, later);
    expect(stale.state).toBe('NEEDS_REFRESH');
    const refreshed = [
      ...independentBeta,
      evidence({
        skill: BETA.id,
        kind: 'retrieval',
        at: new Date(later.getTime() - DAY).toISOString(),
      }),
    ];
    const restored = evaluateSkill(BETA, refreshed, later);
    expect(restored.state).toBe('INDEPENDENT');
    expect(restored.counts.evidence).toBe(2);
    expect(restored.counts.independent_passes).toBe(1);
    expect(restored.last_demonstrated).toBe(refreshed[1]?.occurred_at);
    expect(restored.refresh_from).toBeNull();
  });

  it('orders the queue by priority and never schedules skills below PRACTICED', () => {
    const now = new Date(at(30, 0, 10));
    const alpha = evaluateSkill(
      ALPHA,
      [
        evidence({ kind: 'independent_exercise', at: at(1) }),
        evidence({ kind: 'independent_exercise', result: 'failed', at: at(2) }),
      ],
      now,
    );
    const beta = evaluateSkill(BETA, independentBeta, now);
    const learning = evaluateSkill(BETA, [evidence({ skill: BETA.id, kind: 'exposure' })], now);
    const schedule = scheduleReviews([beta, alpha, learning], now);
    expect(schedule.due.map((i) => i.skill_id)).toEqual([ALPHA.id, BETA.id]);
    expect(schedule.due[0]?.priority).toBeGreaterThan(schedule.due[1]?.priority ?? 0);
    expect(schedule.due.concat(schedule.upcoming).some((i) => i.state === 'LEARNING')).toBe(false);
  });
});

describe('refresh round trip: NEEDS_REFRESH → unassisted retrieval → earned state preserved', () => {
  /** BETA needs two unassisted demonstrations and nothing else: MASTERED after days 1 and 3. */
  const mastered = [
    evidence({ skill: BETA.id, kind: 'independent_exercise', at: at(1) }),
    evidence({
      skill: BETA.id,
      kind: 'independent_exercise',
      at: at(3),
      exercise: 'EX-BUILD_IT-two',
    }),
  ];

  it('MASTERED skill: refresh clears, MASTERED is preserved, review_due advances by the MASTERED interval', () => {
    const settled = evaluateSkill(BETA, mastered, new Date(at(4)));
    expect(settled.state).toBe('MASTERED');
    const firstDue = Date.parse(at(3)) + 60 * DAY;
    expect(settled.review_due).toBe(new Date(firstDue).toISOString());

    // Overdue past the 14-day grace: NEEDS_REFRESH overlays MASTERED; nothing is lost.
    const staleNow = new Date(firstDue + 15 * DAY);
    const stale = evaluateSkill(BETA, mastered, staleNow);
    expect(stale.state).toBe('NEEDS_REFRESH');
    expect(stale.ladder_state).toBe('MASTERED');
    expect(stale.refresh_from).toBe('MASTERED');
    expect(stale.refresh_reason).toBe('overdue');
    expect(stale.counts.independent_passes).toBe(2);

    // The learner passes a retrieval with no hints the next day.
    const retrievalAt = new Date(staleNow.getTime() + DAY).toISOString();
    const refreshed = [
      ...mastered,
      evidence({ skill: BETA.id, kind: 'retrieval', at: retrievalAt }),
    ];
    const restored = evaluateSkill(BETA, refreshed, new Date(retrievalAt));

    expect(restored.state).toBe('MASTERED');
    expect(restored.ladder_state).toBe('MASTERED');
    expect(restored.refresh_from).toBeNull();
    expect(restored.refresh_reason).toBeNull();
    expect(restored.missing_requirements).not.toContain('refresh');
    expect(restored.last_demonstrated).toBe(retrievalAt);
    expect(restored.review_due).toBe(new Date(Date.parse(retrievalAt) + 60 * DAY).toISOString());
    expect(Date.parse(restored.review_due as string)).toBeGreaterThan(firstDue);
    expect(restored.confidence).toBeGreaterThan(stale.confidence);
    // History intact: every earlier row still counted, the retrieval added, nothing rewritten.
    expect(restored.counts.evidence).toBe(3);
    expect(restored.counts.independent_passes).toBe(2);
    expect(scheduleReviews([restored], new Date(retrievalAt)).due).toEqual([]);
  });

  it('INDEPENDENT skill: refresh clears and the rung is preserved while a requirement is still missing', () => {
    // ALPHA needs two demonstrations plus a pressure test; one pass leaves it INDEPENDENT.
    const one = [evidence({ kind: 'independent_exercise', at: at(1) })];
    const firstDue = Date.parse(at(1)) + 14 * DAY; // 21 days ÷ importance 1.5
    expect(evaluateSkill(ALPHA, one, new Date(at(2))).review_due).toBe(
      new Date(firstDue).toISOString(),
    );

    const staleNow = new Date(firstDue + 15 * DAY);
    const stale = evaluateSkill(ALPHA, one, staleNow);
    expect(stale.state).toBe('NEEDS_REFRESH');
    expect(stale.refresh_from).toBe('INDEPENDENT');

    const retrievalAt = new Date(staleNow.getTime() + DAY).toISOString();
    const restored = evaluateSkill(
      ALPHA,
      [...one, evidence({ kind: 'retrieval', at: retrievalAt })],
      new Date(retrievalAt),
    );
    expect(restored.state).toBe('INDEPENDENT');
    expect(restored.ladder_state).toBe('INDEPENDENT');
    expect(restored.refresh_from).toBeNull();
    expect(restored.missing_requirements).toEqual(['independent_evidence', 'pressure_test']);
    expect(restored.review_due).toBe(new Date(Date.parse(retrievalAt) + 14 * DAY).toISOString());
  });

  it('an assisted retrieval does not restore the earned state (MAS-011)', () => {
    const firstDue = Date.parse(at(3)) + 60 * DAY;
    const staleNow = new Date(firstDue + 15 * DAY);
    const retrievalAt = new Date(staleNow.getTime() + DAY).toISOString();
    const withWorkedExample = [
      ...mastered,
      evidence({ skill: BETA.id, kind: 'retrieval', at: retrievalAt, hints: ['worked_example'] }),
    ];
    const still = evaluateSkill(BETA, withWorkedExample, new Date(retrievalAt));
    expect(still.state).toBe('NEEDS_REFRESH');
    expect(still.ladder_state).toBe('MASTERED');
    expect(still.last_demonstrated).toBe(at(3));
    expect(still.review_due).toBe(new Date(firstDue).toISOString());
  });
});
