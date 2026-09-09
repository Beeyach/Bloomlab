import { beforeEach, describe, expect, it } from 'vitest';
import { evaluateCampaign, evaluateSkills, nextStepForSkill } from '@bloomlab/mastery-engine';
import { evidence } from '../../../../packages/mastery-engine/test/fixtures';
import { content } from '../content/bundle';
import { db } from '../data/db';
import { sessionContentOf } from '../data/learning/session';
import { NORMAL_RUN, saveResponse, startAttempt } from './attempt';
import { finalizeAttempt } from './finalize';

const campaign = content.campaigns.find((row) => row.id === 'CAMP-FIELD_READY')!;
const skills = new Map(content.skills.map((row) => [row.id, row]));
const now = new Date('2026-09-09T12:00:00Z');
beforeEach(async () => {
  await db.delete();
  await db.open();
});
describe('PRD-006 / CUR-003 placement', () => {
  it('authors exactly eight real, independently attempted assessments', () => {
    const assessments = content.exercises.filter((row) => row.placement_area);
    expect(new Set(assessments.map((row) => row.placement_area)).size).toBe(8);
    expect(assessments).toHaveLength(8);
    for (const row of assessments) {
      expect(row.hints).toEqual([]);
      expect(row.mode).toBe('independent');
      expect(row.expected_outcomes.length).toBeGreaterThan(0);
      expect(sessionContentOf(content).exercises[row.id]).toBeUndefined();
    }
  });
  it('different strong/weak profiles unlock different work ahead, without clearing pressure or fieldwork', () => {
    const strongMath = evidence({
      kind: 'independent_exercise',
      skill: 'SK-STRATEGIZE-funnel-math',
    });
    strongMath.source.type = 'placement';
    const weakMath = { ...strongMath, result: 'failed' as const };
    const evaluate = (rows: (typeof strongMath)[]) =>
      evaluateCampaign(campaign, skills, evaluateSkills(content.skills, rows, now));
    const strong = evaluate([strongMath]);
    const weak = evaluate([weakMath]);
    expect(strong.gates[0]!.cleared).toContain(strongMath.skill_id);
    expect(weak.gates[0]!.cleared).not.toContain(strongMath.skill_id);
    expect(strong.unlocked_skills).not.toEqual(weak.unlocked_skills);
    expect(strong.work_ahead).not.toEqual(weak.work_ahead);
    expect(strong.complete).toBe(false);
    const next = (row: typeof strongMath) =>
      nextStepForSkill({
        skill: skills.get(row.skill_id)!,
        evaluation: evaluateSkills(content.skills, [row], now).get(row.skill_id)!,
        content: sessionContentOf(content),
      });
    expect(next(strongMath)?.kind).toBe('exercise');
    expect(next(weakMath)?.kind).toBe('unit');
    expect(strong.gates[1]!.status).not.toBe('passed');
    expect(
      strong.gates[1]!.skills.find((row) => row.skill_id === strongMath.skill_id)!.missing,
    ).toContain('pressure_test');
  });
  it('finalizes actual placement input through the canonical evidence path', async () => {
    const exercise = content.exercises.find((row) => row.placement_area === 'funnel_reasoning')!;
    const attempt = await startAttempt(exercise, NORMAL_RUN, {}, db);
    await saveResponse(
      exercise.id,
      NORMAL_RUN,
      {
        prediction: {
          booking_rate: '50',
          show_rate: '50',
          close_rate: '20',
          cost_per_lead: '10',
          cost_per_customer: '200',
          average_order_value: '500',
        },
      },
      db,
    );
    await finalizeAttempt(exercise, attempt, db);
    const rows = await db.skill_evidence.toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.source.type).toBe('placement');
    expect(rows[0]!.result).toBe('passed');
    expect(rows[0]!.versions.content).toBe(content.content_version);
  });
});
