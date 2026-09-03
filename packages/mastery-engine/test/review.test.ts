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

  it('14. a passed retrieval restores the earned state; history is intact', () => {
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
    expect(restored.state).toBe('MASTERED');
    expect(restored.counts.evidence).toBe(2);
    expect(restored.counts.independent_passes).toBe(2);
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
