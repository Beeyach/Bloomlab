import { beforeEach, describe, expect, it } from 'vitest';

import { gradeExercise, type GradingContext, type GradingEvent } from '@bloomlab/exercise-engine';

import { content } from '../content/bundle';
import { db } from '../data/db';
import { recordEvidence } from '../data/learning';
import { blocksOf } from './markdownBlocks';

/**
 * The authored no-show recovery build, graded against normalized fixture runs.
 *
 * It is the exercise with the widest set of authored checks — architecture, event, timing, state
 * and two critical negatives — so it proves the grader against real content rather than against
 * a fixture written to suit the grader. The contexts here stand in for what the Phase 10
 * simulator will produce; the product never grades from them (EXR-024).
 */
const buildIt = content.exercises.find(
  (exercise) => exercise.id === 'EX-BUILD_IT-no-show-recovery',
)!;

const NO_SHOW = '2026-09-03T15:30:00Z';

const events = (rows: { type: string; at: string; fields?: GradingEvent['fields'] }[]) =>
  rows.map((row, index) => ({ ...row, index, fields: row.fields ?? {} }));

/** A build that does everything the exercise asked for. */
function goodRun(): GradingContext {
  return {
    state: { opportunities: { 'opp-maria': { stage: 'Lost' } } },
    events: events([
      {
        type: 'workflow.enrolled',
        at: NO_SHOW,
        fields: { contact_id: 'maria', trigger_status: 'no_show' },
      },
      {
        type: 'sms.sent',
        at: '2026-09-03T15:34:00Z',
        fields: { contact_id: 'maria', purpose: 'rebooking' },
      },
      { type: 'notification.sent', at: '2026-09-03T15:35:00Z', fields: { contact_id: 'maria' } },
    ]),
    references: { 'appointment.no_show': NO_SHOW },
    architecture: {
      workflows: [
        {
          id: 'wf-no-show-recovery',
          trigger: { ghl_feature_id: 'GHL-WF-APPOINTMENT-STATUS' },
          nodes: [
            { id: 'n1', type: 'branch', ghl_feature_id: 'GHL-WF-IF-ELSE' },
            { id: 'n2', type: 'action', ghl_feature_id: 'GHL-WF-SEND-SMS' },
            { id: 'n3', type: 'action', ghl_feature_id: 'GHL-WF-SEND-INTERNAL-NOTIFICATION' },
            { id: 'n4', type: 'wait', ghl_feature_id: 'GHL-WF-WAIT' },
            { id: 'n5', type: 'action', ghl_feature_id: 'GHL-WF-CREATE-UPDATE-OPPORTUNITY' },
          ],
          settings: { allow_reentry: false },
        },
      ],
    },
    provides: ['state', 'events', 'references', 'architecture', 'learner'],
  };
}

const withEvents = (extra: Parameters<typeof events>[0]): GradingContext => {
  const base = goodRun();
  return {
    ...base,
    events: events(
      [...base.events, ...extra].map(({ type, at, fields }) => ({ type, at, fields })),
    ),
  };
};

describe('the authored BUILD IT exercise, graded against a run (EXR-002)', () => {
  it('passes a build that satisfies every authored check', () => {
    const report = gradeExercise({ exercise: buildIt, context: goodRun() });
    expect(report.counts.scored_total).toBe(6);
    expect(report.score).toBe(100);
    expect(report.outcome).toBe('passed');
    expect(report.failed_critical).toEqual([]);
    // Every authored assertion type took part.
    expect(new Set(report.tiers.required.map((result) => result.type))).toEqual(
      new Set(['architecture', 'event', 'timing', 'state']),
    );
  });

  it('fails the whole attempt when the DND contact is texted, whatever the score', () => {
    const report = gradeExercise({
      exercise: buildIt,
      context: withEvents([
        {
          type: 'sms.sent',
          at: '2026-09-03T15:36:00Z',
          fields: { contact_id: 'lena', purpose: 'rebooking' },
        },
      ]),
    });
    expect(report.score).toBe(100);
    expect(report.outcome).toBe('failed');
    expect(report.reason).toBe('critical_failure');
    expect(report.failed_critical).toEqual(['c1']);
    const critical = report.tiers.critical.find((result) => result.id === 'c1')!;
    expect(critical.description).toBe('Lena is on DND and must never be texted.');
    expect(critical.expected).toBe('no sms.sent where contact_id=lena');
    expect(critical.observed).toContain('1 occurred');
  });

  it('fails when a cancelled appointment enters the workflow', () => {
    const report = gradeExercise({
      exercise: buildIt,
      context: withEvents([
        {
          type: 'workflow.enrolled',
          at: NO_SHOW,
          fields: { contact_id: 'maria', trigger_status: 'cancelled' },
        },
      ]),
    });
    expect(report.outcome).toBe('failed');
    expect(report.failed_critical).toEqual(['c2']);
  });

  it('reports exactly which check diverged when the text goes out twice', () => {
    const report = gradeExercise({
      exercise: buildIt,
      context: withEvents([
        {
          type: 'sms.sent',
          at: '2026-09-03T15:40:00Z',
          fields: { contact_id: 'maria', purpose: 'rebooking' },
        },
      ]),
    });
    const a2 = report.tiers.required.find((result) => result.id === 'a2')!;
    expect(a2.passed).toBe(false);
    expect(a2.expected).toBe('exactly 1 sms.sent where contact_id=maria, purpose=rebooking');
    expect(a2.observed).toBe('2 matching events');
    expect(report.score).toBe(83);
    expect(report.outcome).toBe('passed');
  });

  it('fails the timing check when the text is late, and says how late', () => {
    const base = goodRun();
    const report = gradeExercise({
      exercise: buildIt,
      context: {
        ...base,
        events: events(
          base.events.map((event) =>
            event.type === 'sms.sent' ? { ...event, at: '2026-09-03T16:30:00Z' } : event,
          ),
        ),
      },
    });
    const a3 = report.tiers.required.find((result) => result.id === 'a3')!;
    expect(a3.passed).toBe(false);
    expect(a3.observed).toBe('sms.sent 60 min late');
    // Five of six checks still hold, so the attempt clears the pass mark with one divergence named.
    expect(report.score).toBe(83);
    expect(report.outcome).toBe('passed');
    expect(report.reason).toBe('threshold_met');
  });

  it('fails the architecture check when the wrong trigger is used', () => {
    const base = goodRun();
    const report = gradeExercise({
      exercise: buildIt,
      context: {
        ...base,
        architecture: {
          workflows: [
            {
              ...base.architecture!.workflows[0]!,
              trigger: { ghl_feature_id: 'GHL-WF-CUSTOMER-BOOKED-APPOINTMENT' },
            },
          ],
        },
      },
    });
    const a1 = report.tiers.required.find((result) => result.id === 'a1')!;
    expect(a1.passed).toBe(false);
    expect(a1.expected).toBe('a workflow triggered by GHL-WF-APPOINTMENT-STATUS');
    expect(a1.observed).toContain('GHL-WF-CUSTOMER-BOOKED-APPOINTMENT');
  });
});

describe('a failed critical check reaches the learner record (MAS-004)', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
  });

  it('carries the assertion ids into the attempt and the evidence', async () => {
    const report = gradeExercise({
      exercise: buildIt,
      context: withEvents([
        { type: 'sms.sent', at: '2026-09-03T15:36:00Z', fields: { contact_id: 'lena' } },
      ]),
    });
    const { attempt, evidence } = await recordEvidence({
      skill_ids: buildIt.skills,
      kind: 'deterministic_exercise',
      result: 'failed',
      source: { type: 'exercise', id: buildIt.id },
      exercise_id: buildIt.id,
      exercise_type: buildIt.type,
      score: report.score,
      difficulty: buildIt.difficulty,
      critical_failures: report.failed_critical,
      mode: buildIt.mode,
      grade: report,
    });
    expect(attempt?.critical_failures).toEqual(['c1']);
    expect(attempt?.grade?.reason).toBe('critical_failure');
    expect(evidence.every((row) => row.critical_failures.includes('c1'))).toBe(true);
    // A pass with a critical failure is not a pass anywhere in the engine.
    expect(evidence.every((row) => row.result === 'failed')).toBe(true);
  });
});

describe('authored prose renders as authored (D-071)', () => {
  it('groups paragraphs, ordered lists and bullets the way the exercise wrote them', () => {
    expect(blocksOf(buildIt.instructions).map((block) => block.kind)).toEqual([
      'p',
      'p',
      'ol',
      'p',
    ]);
    const list = blocksOf(buildIt.instructions).find((block) => block.kind === 'ol')!;
    expect(list.lines).toHaveLength(3);
    expect(list.lines[0]).toContain('sends one rebooking text');
  });

  it('keeps a wrapped paragraph as one paragraph and never invents markup', () => {
    const blocks = blocksOf('One line\nwrapped here.\n\n- a\n- b\n');
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toEqual({ kind: 'p', lines: ['One line wrapped here.'] });
    expect(blocks[1]).toEqual({ kind: 'ul', lines: ['a', 'b'] });
    expect(blocksOf('<script>alert(1)</script>')[0]?.lines[0]).toBe('<script>alert(1)</script>');
  });
});
