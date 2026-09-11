import { fakeEvaluation } from '../ai/testGateway';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EXERCISE_GRADER_VERSION } from '@bloomlab/exercise-engine';
import { getFeatureFlags } from '@bloomlab/shared';
import type { SimulatorScenario } from '@bloomlab/simulator-core';

import { App } from '../app/App';
import { content } from '../content/bundle';
import { db, type BloomlabDatabase } from '../data/db';
import { evaluateLearner, recomputeProgress } from '../data/learning';
import { syncNow } from '../data/sync/engine';
import { FakeSyncServer } from '../data/sync/fakeServer';
import { createSyncKey, linkThisDevice } from '../data/sync/link';
import { listOperations } from '../data/syncQueue';
import { freshDatabase } from '../data/testing';
import {
  NORMAL_RUN,
  commitRunPrediction,
  discardAttempt,
  loadAttempt,
  revealHint,
  saveResponse,
  startAttempt,
} from './attempt';
import {
  evidenceKindFor,
  finalizeAttempt,
  NotGradableError,
  RuntimeUnavailableError,
} from './finalize';
import { canGradeNow, missingSources } from './runtime';
import { startRun, type StoredRun } from '../simulator/store';
import { bookAppointment, resetWorkflowRun } from '../workflow/commands';
import { loadWorkspace } from '../data/workspace';
import { runReplayKey, type RunReplay } from './runReplay';

const flags = getFeatureFlags('production');
const DECISION = 'EX-ARCHITECTURE_DECISION-treatment-interest';
const DECISION_SKILL = 'SK-ARCHITECT-tags-vs-custom-fields';
const BUILD_IT = 'EX-BUILD_IT-no-show-recovery';
const OPEN_ENDED = 'EX-WHAT_WOULD_YOU_BUILD-glowhaus-leads';
const REBUILD = 'EX-REBUILD_BLIND-appointment-reminders';
const FIX_IT = 'EX-FIX_IT-double-reminder';
const RUN_THE_LEAD = 'EX-RUN_THE_LEAD-booking-confirmation';

const byId = (id: string) => content.exercises.find((candidate) => candidate.id === id)!;
const decision = byId(DECISION);

const GAMIFICATION = /\bXP\b|\bstars?\b|\bpoints\b|level up|\bstreak\b|superstar|welcome back/i;

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App flags={flags} />
    </MemoryRouter>,
  );
}

const openRunner = async (id = DECISION, query = `?skill=${DECISION_SKILL}`) => {
  renderAt(`/exercise/${id}${query}`);
  return screen.findByRole('heading', { level: 1, name: byId(id).title });
};

/** Answer the architecture decision the way the exercise's own checks expect. */
async function answerDecision(
  database: BloomlabDatabase = db,
  text = 'A contact custom field: reminder templates print it as a merge field.',
) {
  await startAttempt(decision, { run: 'normal', skill_id: DECISION_SKILL }, {}, database);
  await saveResponse(DECISION, NORMAL_RUN, { choice: 'contact_custom_field', text }, database);
  return (await loadAttempt(DECISION, NORMAL_RUN, database))!;
}

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
});

describe('the runner is data-driven (EXR-001)', () => {
  it('resolves any authored exercise from the compiled bundle through one route', async () => {
    for (const id of [DECISION, BUILD_IT, REBUILD, OPEN_ENDED]) {
      const { unmount } = render(
        <MemoryRouter initialEntries={[`/exercise/${id}`]}>
          <App flags={flags} />
        </MemoryRouter>,
      );
      expect(
        await screen.findByRole('heading', { level: 1, name: byId(id).title }),
      ).toBeInTheDocument();
      unmount();
    }
  });

  it('branches on the family, never on an exercise id', async () => {
    // Product behaviour keys off exercise.type; an id in runner code would make a new exercise
    // a code change instead of a content change (EXR-001).
    const root = process.cwd().endsWith(join('apps', 'web'))
      ? process.cwd()
      : join(process.cwd(), 'apps', 'web');
    const directory = join(root, 'src', 'exercise');
    const sources = readdirSync(directory).filter(
      (name) => /.tsx?$/.test(name) && !name.includes('.test.'),
    );
    expect(sources.length).toBeGreaterThan(5);
    const ids = content.exercises.map((exercise) => exercise.id);
    for (const name of sources) {
      const text = readFileSync(join(directory, name), 'utf8');
      for (const id of ids) {
        expect(text, `${name} hardcodes ${id}`).not.toContain(id);
      }
    }
  });

  it('shows a real error state for an unknown exercise instead of crashing', async () => {
    renderAt('/exercise/EX-BUILD_IT-does-not-exist');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'No exercise at this address.' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open the Skill Map' })).toBeInTheDocument();
  });
});

describe('the challenge brief', () => {
  it('shows the authored objective, context and allowed features, and no gamification', async () => {
    await openRunner();
    expect(screen.getByText(/Architecture decision · Practice · 10 min/)).toBeInTheDocument();
    expect(screen.getByText(/Glowhaus's Meta lead form asks which treatment/)).toBeInTheDocument();
    const brief = screen.getByRole('heading', { level: 2, name: 'The job' }).parentElement!;
    expect(within(brief).getByText('Tags')).toBeInTheDocument();
    expect(within(brief).getByText('Custom Values')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(GAMIFICATION);
  });

  it('FIX IT leads with the symptom and never names the faulty node (EXR-005)', async () => {
    await openRunner(FIX_IT, '');
    expect(screen.getByText(/Something broke\. Find out why\./)).toBeInTheDocument();
    expect(screen.getByText(/Maria got two reminder texts yesterday/)).toBeInTheDocument();
    // The worked example names the culprit; it is not on screen until it is asked for.
    expect(document.body.textContent).not.toContain('Open Booking Tags');
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Your diagnosis' }),
    ).toBeInTheDocument();
  });

  it('REBUILD BLIND offers no hints, no worked example and no lesson (EXR-019)', async () => {
    await openRunner(REBUILD, '');
    expect(await screen.findByText('No hints this time.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Show the/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^Read / })).not.toBeInTheDocument();
    // The family says plainly that there is no worked example; none is offered anywhere.
    expect(screen.getByText(/No lesson, no hints, no worked example./)).toBeInTheDocument();
    const hints = screen.getByRole('heading', { level: 2, name: 'Assistance' }).parentElement!;
    expect(hints.querySelectorAll('button')).toHaveLength(0);
    expect(hints.textContent).not.toMatch(/Nudge|Concept reminder|Worked example/);
  });

  it('WHAT WOULD YOU BUILD asks openly and never names the feature (EXR-008)', async () => {
    await openRunner(OPEN_ENDED, '');
    expect(screen.getByText(/Priya says/)).toBeInTheDocument();
    expect(await screen.findByRole('textbox')).toBeInTheDocument();
    // Open response, no option list, and no GHL feature handed over anywhere on the page.
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    const brief = screen.getByRole('heading', { level: 2, name: 'The job' }).parentElement!;
    expect(brief.textContent).not.toMatch(/GHL-|custom field|custom value|tag\b/i);
    for (const feature of content.ghl_features) {
      expect(document.body.textContent).not.toContain(feature.official_name);
    }
  });
});

describe('what cannot be graded yet is not graded (EXR-024)', () => {
  it('a workflow build is gradable now that the Workflow Lab supplies every source it needs', async () => {
    // Phase 9 shipped this exercise un-runnable and said so; Phase 12 registers the runtime that
    // owns it, so nothing is missing and the runner offers the submit (EXR-004, EXR-024).
    expect(canGradeNow(byId(BUILD_IT))).toBe(true);
    expect(missingSources(byId(BUILD_IT))).toEqual([]);
    await openRunner(BUILD_IT, '');
    expect(await screen.findByRole('button', { name: 'Run it' })).toBeInTheDocument();
    expect(screen.queryByText('This one is not runnable yet.')).not.toBeInTheDocument();
  });

  it('refuses to finalize a build when the learner has no account for its scenario yet', async () => {
    const attempt = await startAttempt(byId(BUILD_IT), NORMAL_RUN, {}, db);
    // The runtime exists but has nothing to read: refused, never graded against nothing.
    await expect(finalizeAttempt(byId(BUILD_IT), attempt, db)).rejects.toBeInstanceOf(
      RuntimeUnavailableError,
    );
    expect(await db.exercise_attempts.count()).toBe(0);
    expect(await db.skill_evidence.count()).toBe(0);
    // The learner's work survives the refusal.
    expect(await loadAttempt(BUILD_IT, NORMAL_RUN, db)).not.toBeUndefined();
  });

  it('an exercise on a roleplay scenario is still refused as not gradable', async () => {
    const sayIt = content.exercises.find((row) => row.id === 'EX-SAY_IT-summit-discovery');
    if (!sayIt) throw new Error('fixture exercise missing');
    if (canGradeNow(sayIt)) return; // graded from the learner's own answer alone: nothing to refuse
    const attempt = await startAttempt(sayIt, NORMAL_RUN, {}, db);
    await expect(finalizeAttempt(sayIt, attempt, db)).rejects.toBeInstanceOf(NotGradableError);
  });

  it('RUN THE LEAD captures the prediction and grades it from the Lab’s account (EXR-006)', async () => {
    await openRunner(RUN_THE_LEAD, '');
    // The field comes from the authored assertion path, and its label never leaks the answer.
    const tag = await screen.findByLabelText('Tag');
    fireEvent.change(tag, { target: { value: 'booked' } });
    await waitFor(async () =>
      expect((await loadAttempt(RUN_THE_LEAD, NORMAL_RUN, db))?.response.prediction.tag).toBe(
        'booked',
      ),
    );
    expect(document.body.textContent).not.toContain('The learner predicted the booked tag');
    // The run comes from the Workflow Lab's account now; the runner offers it rather than a wait.
    expect(screen.queryByText('This one is not runnable yet.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Run it' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Commit prediction' }));
    const lab = await screen.findByRole('link', { name: 'Open Workflow Lab to execute it' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Run it' })).toBeEnabled());
    expect(tag).toBeDisabled();
    expect(lab).toHaveAttribute(
      'href',
      expect.stringMatching(
        /^\/workflow\?scenario=SC-glowhaus-no-show&exercise=EX-RUN_THE_LEAD-booking-confirmation&attempt=/,
      ),
    );
  });
});

describe('attempt lifecycle and idempotency (D-068)', () => {
  it('persists and locks the RUN THE LEAD checkpoint; a new attempt starts unlocked', async () => {
    const exercise = byId(RUN_THE_LEAD);
    const started = await startAttempt(exercise, NORMAL_RUN, {}, db);
    await saveResponse(RUN_THE_LEAD, NORMAL_RUN, { prediction: { tag: 'booked' } }, db);
    await commitRunPrediction(exercise, NORMAL_RUN, db, new Date('2026-09-10T12:00:00Z'));
    const committed = await loadAttempt(RUN_THE_LEAD, NORMAL_RUN, db);
    expect(committed?.attempt_id).toBe(started.attempt_id);
    expect(committed?.response.run_prediction).toMatchObject({
      committed_at: '2026-09-10T12:00:00.000Z',
      prediction: { tag: 'booked' },
      scenario_id: 'SC-glowhaus-no-show',
      run_id: null,
      run_generation: null,
      through_event_index: -1,
    });
    await expect(
      saveResponse(RUN_THE_LEAD, NORMAL_RUN, { prediction: { tag: 'changed later' } }, db),
    ).rejects.toThrow(/committed/);
    expect((await loadAttempt(RUN_THE_LEAD, NORMAL_RUN, db))?.response.prediction.tag).toBe(
      'booked',
    );

    await discardAttempt(RUN_THE_LEAD, NORMAL_RUN, db);
    const fresh = await startAttempt(exercise, NORMAL_RUN, {}, db);
    expect(fresh.attempt_id).not.toBe(started.attempt_id);
    expect(fresh.response.run_prediction).toBeUndefined();
    expect(fresh.response.prediction).toEqual({});
  });

  it('refuses pre-commit execution and accepts execution after a same-run reset generation', async () => {
    const exercise = byId(RUN_THE_LEAD);
    const scenario = content.scenarios.find(
      (row) => row.id === exercise.scenario,
    ) as unknown as SimulatorScenario;
    const direct = { database: db, createWorker: null };
    const executed = async (pending: ReturnType<typeof bookAppointment>): Promise<StoredRun> => {
      const result = await pending;
      if (!result.ok) throw new Error(result.refusal.message);
      return result.run;
    };
    let run = await startRun(scenario, db);
    run = await executed(
      bookAppointment(run, scenario, 'maria', 'consultation', '2026-09-05T15:00:00-05:00', direct),
    );
    const attempt = await startAttempt(exercise, NORMAL_RUN, {}, db);
    await saveResponse(RUN_THE_LEAD, NORMAL_RUN, { prediction: { tag: 'booked' } }, db);
    await commitRunPrediction(exercise, NORMAL_RUN, db);
    await expect(finalizeAttempt(exercise, attempt, db)).rejects.toThrow(
      /after committing the prediction/,
    );

    run = await resetWorkflowRun(scenario, run.state.run_id, db);
    await executed(
      bookAppointment(run, scenario, 'maria', 'consultation', '2026-09-05T16:00:00-05:00', direct),
    );
    const result = await finalizeAttempt(exercise, attempt, db);
    expect(result.report.outcome).toBe('passed');
    const replay = await loadWorkspace<RunReplay>(runReplayKey(attempt.attempt_id), db);
    expect(replay?.prediction).toEqual({ tag: 'booked' });
    expect(replay?.events.some((event) => event.type === 'sms.sent')).toBe(true);
  });
  it('opening records nothing and a reload resumes the same attempt', async () => {
    await openRunner();
    await waitFor(async () => expect(await loadAttempt(DECISION, NORMAL_RUN, db)).toBeDefined());
    const first = (await loadAttempt(DECISION, NORMAL_RUN, db))!;
    expect(await db.exercise_attempts.count()).toBe(0);
    expect(await db.skill_evidence.count()).toBe(0);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'half an answer' } });
    await waitFor(async () =>
      expect((await loadAttempt(DECISION, NORMAL_RUN, db))?.response.text).toBe('half an answer'),
    );
    // Reload: same attempt id, same unfinished work.
    const again = await startAttempt(decision, NORMAL_RUN, {}, db);
    expect(again.attempt_id).toBe(first.attempt_id);
    expect(again.response.text).toBe('half an answer');
  });

  it('finalizing twice writes one attempt and one evidence row per skill', async () => {
    const attempt = await answerDecision();
    const first = await finalizeAttempt(decision, attempt, db);
    const second = await finalizeAttempt(decision, attempt, db);
    expect(first.recorded).toBe(true);
    expect(second.recorded).toBe(false);
    expect(second.attempt.id).toBe(first.attempt.id);
    expect(await db.exercise_attempts.count()).toBe(1);
    expect(await db.skill_evidence.count()).toBe(decision.skills.length);
    const evidence = await db.skill_evidence.toArray();
    expect(evidence.map((row) => row.id).sort()).toEqual(
      decision.skills.map((skill) => `ea:${attempt.attempt_id}:${skill}`).sort(),
    );
  });

  it('records the real start and completion times, not one instant', async () => {
    const attempt = await answerDecision();
    const { attempt: row } = await finalizeAttempt(decision, attempt, db, {
      now: new Date(Date.parse(attempt.started_at) + 9 * 60_000),
    });
    expect(row.started_at).toBe(attempt.started_at);
    expect(Date.parse(row.completed_at) - Date.parse(row.started_at)).toBe(9 * 60_000);
  });

  it('Try again is a second attempt, and the first one stays', async () => {
    const one = await answerDecision(db, 'A tag, because it is quick.');
    await finalizeAttempt(decision, one, db);
    const two = await answerDecision(db, 'A contact custom field, printed as a merge field.');
    expect(two.attempt_id).not.toBe(one.attempt_id);
    await finalizeAttempt(decision, two, db);

    const attempts = await db.exercise_attempts.toArray();
    expect(attempts).toHaveLength(2);
    expect(new Set(attempts.map((row) => row.id)).size).toBe(2);
    expect(await db.skill_evidence.count()).toBe(2 * decision.skills.length);
    // The failed attempt was never rewritten into the pass.
    expect(attempts.map((row) => row.score).sort((a, b) => Number(a) - Number(b))).toEqual([
      50, 100,
    ]);
  });

  it('a grader or persistence failure never erases the work in progress', async () => {
    const attempt = await answerDecision();
    const broken = {
      ...db,
      exercise_attempts: {
        get: async () => undefined,
      },
    } as unknown as BloomlabDatabase;
    await expect(finalizeAttempt(decision, attempt, broken)).rejects.toBeTruthy();
    expect(await loadAttempt(DECISION, NORMAL_RUN, db)).toBeDefined();
  });
});

describe('hints and assistance (EXR-022, MAS-007)', () => {
  it('reveals one level at a time, records it, and survives a reload', async () => {
    await openRunner();
    await waitFor(async () => expect(await loadAttempt(DECISION, NORMAL_RUN, db)).toBeDefined());
    // The IndexedDB commit can complete before its live-query notification renders the drawer.
    expect(await screen.findByText('Independent')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show the nudge' }));
    await screen.findByText(/Is "interested in Laser" something that happened/);
    expect(await screen.findByText('Light')).toBeInTheDocument();
    expect((await loadAttempt(DECISION, NORMAL_RUN, db))?.hints_revealed).toEqual(['nudge']);

    fireEvent.click(screen.getByRole('button', { name: 'Show the concept reminder' }));
    await screen.findByText(/Three tags for one question/);
    expect(await screen.findByText('Guided')).toBeInTheDocument();
    expect((await loadAttempt(DECISION, NORMAL_RUN, db))?.hints_revealed).toEqual([
      'nudge',
      'concept_reminder',
    ]);
    // The exercise authors two hints; there is no third control to press.
    expect(
      screen.queryByRole('button', { name: /Show the worked example/ }),
    ).not.toBeInTheDocument();
  });

  it('carries the hints into the attempt and the evidence', async () => {
    await answerDecision();
    await revealHint(DECISION, NORMAL_RUN, 'nudge', db);
    await revealHint(DECISION, NORMAL_RUN, 'nudge', db);
    const withHint = (await loadAttempt(DECISION, NORMAL_RUN, db))!;
    expect(withHint.hints_revealed).toEqual(['nudge']);
    const { attempt: row, report } = await finalizeAttempt(decision, withHint, db);
    expect(row.hints_used).toEqual(['nudge']);
    expect(row.assistance).toBe('light');
    expect(report.assistance).toBe('light');
    const evidence = await db.skill_evidence.toArray();
    expect(evidence[0]?.hints_used).toEqual(['nudge']);
  });

  it('preserves the guided floor in the finalized attempt and evidence without hints', async () => {
    const started = await answerDecision();
    const { attempt: row, report } = await finalizeAttempt(
      { ...decision, mode: 'guided' },
      started,
      db,
    );
    expect(report.assistance).toBe('guided');
    expect(row.assistance).toBe('guided');
    expect((await db.skill_evidence.toArray())[0]?.assistance).toBe('guided');
  });

  it('a guided exercise is guided practice whatever the hint log says', async () => {
    const guided = byId(RUN_THE_LEAD);
    expect(guided.mode).toBe('guided');
    expect(evidenceKindFor(guided, 'normal')).toBe('guided_practice');
    expect(evidenceKindFor(byId(FIX_IT), 'normal')).toBe('pressure_test');
    expect(evidenceKindFor(byId(OPEN_ENDED), 'normal')).toBe('independent_exercise');
    expect(evidenceKindFor(byId(REBUILD), 'normal')).toBe('pressure_test');
    expect(evidenceKindFor(byId(REBUILD), 'retrieval')).toBe('retrieval');
  });
});

describe('grading, evidence and mastery', () => {
  it('a correct decision is graded, recorded and reflected in the learner state', async () => {
    const attempt = await answerDecision();
    const { report, attempt: row } = await finalizeAttempt(decision, attempt, db);
    expect(report.score).toBe(100);
    // Phase 19 combines the independently passing deterministic checks and fixture judgment.
    expect(report.outcome).toBe('passed');
    expect(report.reason).toBe('threshold_met');
    expect(report.rubric_pending).toBeNull();
    expect(row.result).toBe('passed');
    expect(row.grade?.grader_version).toBe(EXERCISE_GRADER_VERSION);
    expect(row.versions.content).toBe(content.content_version);

    const snapshot = await evaluateLearner(db);
    const evaluation = snapshot.evaluations.get(DECISION_SKILL)!;
    expect(evaluation.state).toBe('INDEPENDENT');
    expect(evaluation.counts.independent_passes).toBe(1);
  });

  it('a wrong decision reports where it diverged', async () => {
    await answerDecision(db, 'A tag for each treatment. Quick to filter on.');
    await saveResponse(DECISION, NORMAL_RUN, { choice: 'tag' }, db);
    const { report } = await finalizeAttempt(
      decision,
      (await loadAttempt(DECISION, NORMAL_RUN, db))!,
      db,
    );
    expect(report.score).toBe(0);
    const failed = report.tiers.required.find((result) => !result.passed)!;
    expect(failed.expected).toBe('decision.choice = "contact_custom_field"');
    expect(failed.observed).toBe('decision.choice = "tag"');
  });

  it('an open-ended answer is captured and its authored marker evaluated, with the exact rubric evaluated', async () => {
    const exercise = byId(OPEN_ENDED);
    await startAttempt(exercise, NORMAL_RUN, {}, db);
    await saveResponse(
      OPEN_ENDED,
      NORMAL_RUN,
      {
        text: 'Reception forgets to follow up. I would need to know the show rate before building.',
      },
      db,
    );
    const { report, attempt: row } = await finalizeAttempt(
      exercise,
      (await loadAttempt(OPEN_ENDED, NORMAL_RUN, db))!,
      db,
    );
    expect(report.tiers.required[0]?.passed).toBe(true);
    expect(report.outcome).toBe('passed');
    expect(report.rubric_pending).toBeNull();
    // The whole answer is preserved for the rubric that will judge it.
    expect(row.grade?.score).toBe(100);
    const evidence = await db.skill_evidence.toArray();
    expect(evidence.every((entry) => entry.result === 'passed')).toBe(true);
  });

  it('a retrieval run records retrieval evidence and never an independent demonstration (D-052)', async () => {
    const exercise = byId(OPEN_ENDED);
    const skill = exercise.skills[0]!;
    const review = { run: 'retrieval' as const, skill_id: skill };
    await startAttempt(exercise, review, {}, db);
    await saveResponse(
      OPEN_ENDED,
      review,
      { text: 'I would need to know the show rate first.' },
      db,
    );
    const { attempt: row } = await finalizeAttempt(
      exercise,
      (await loadAttempt(OPEN_ENDED, review, db))!,
      db,
    );
    expect(row.source).toEqual({ type: 'retrieval', id: OPEN_ENDED });
    // The vehicle's authored mode describes its normal use, not this review run.
    expect(row.mode).toBeNull();
    const evidence = await db.skill_evidence.toArray();
    expect(evidence[0]?.kind).toBe('retrieval');
    const snapshot = await evaluateLearner(db);
    expect(snapshot.evaluations.get(skill)?.counts.independent_demonstrations).toBe(0);
  });

  it('the Command Center and Skill Map move as soon as the attempt is recorded', async () => {
    const before = await evaluateLearner(db);
    expect(before.evaluations.get(DECISION_SKILL)?.state).toBe('UNSEEN');
    await finalizeAttempt(decision, await answerDecision(), db);
    await recomputeProgress(db);
    const row = await db.skill_progress.toArray();
    expect(row.find((entry) => entry.skill_id === DECISION_SKILL)?.state).toBe('INDEPENDENT');
  });
});

describe('the result view (spec §158)', () => {
  it('leads with the result, shows each check against what happened, and offers the next step', async () => {
    await finalizeAttempt(decision, await answerDecision(), db);
    await openRunner();
    expect(await screen.findByRole('heading', { level: 2, name: 'Passed' })).toBeInTheDocument();
    expect(screen.getByText(/100% · pass mark 70%/)).toBeInTheDocument();
    expect(screen.getAllByText(/SYSTEM_DESIGN_RUBRIC_V1/).length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { level: 3, name: /Required checks/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Assistance used' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { level: 3, name: 'Next' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    // No hint controls once the attempt is finished.
    expect(screen.queryByRole('button', { name: /Show the/ })).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(GAMIFICATION);
  });

  it('survives a reload: the same result, from the recorded attempt', async () => {
    await finalizeAttempt(decision, await answerDecision(), db);
    const { unmount } = renderAt(`/exercise/${DECISION}`);
    expect(await screen.findByRole('heading', { level: 2, name: 'Passed' })).toBeInTheDocument();
    unmount();
    await openRunner();
    expect(await screen.findByRole('heading', { level: 2, name: 'Passed' })).toBeInTheDocument();
  });

  it('Try again clears the work area and keeps the earlier attempt', async () => {
    await finalizeAttempt(decision, await answerDecision(), db);
    await openRunner();
    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Your decision' }),
    ).toBeInTheDocument();
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('');
    expect(await db.exercise_attempts.count()).toBe(1);
  });
});

describe('routing into the runner', () => {
  it('the Academy practice pointer opens the exercise', async () => {
    renderAt('/academy/LU-tags-vs-custom-fields');
    const link = await screen.findByRole('link', { name: 'Open this exercise' });
    expect(link).toHaveAttribute('href', `/exercise/${DECISION}?skill=${DECISION_SKILL}`);
  });

  it('the capability sheet runs the exercise when that is the next step', async () => {
    // Reading the unit first makes the exercise the engine's next step.
    await finalizeAttempt(decision, await answerDecision(), db);
    renderAt(`/skills/${DECISION_SKILL}`);
    const dialog = await screen.findByRole('dialog');
    const link = within(dialog).queryByTestId('open-exercise');
    if (link) expect(link).toHaveAttribute('href', expect.stringContaining('/exercise/'));
  });

  it('a deep link with a retrieval run keeps that context through a reload', async () => {
    renderAt(`/exercise/${OPEN_ENDED}?skill=${byId(OPEN_ENDED).skills[0]}&run=retrieval`);
    await screen.findByRole('heading', { level: 1, name: byId(OPEN_ENDED).title });
    expect(screen.getByText(/Retrieval/)).toBeInTheDocument();
    await waitFor(async () =>
      expect(
        (
          await loadAttempt(
            OPEN_ENDED,
            { run: 'retrieval', skill_id: byId(OPEN_ENDED).skills[0]! },
            db,
          )
        )?.run,
      ).toBe('retrieval'),
    );
  });
});

describe('completed attempts sync; separate attempts stay separate', () => {
  it('a device that works offline syncs its attempt, and the other device agrees', async () => {
    const server = new FakeSyncServer();
    const a = freshDatabase();
    const b = freshDatabase();
    const key = createSyncKey();
    await linkThisDevice(key.display, a, server);
    await linkThisDevice(key.canonical, b, server);

    // Offline: no network call is involved in finalizing.
    const attempt = await answerDecision(a);
    await finalizeAttempt(decision, attempt, a);
    expect(await a.exercise_attempts.count()).toBe(1);
    expect((await listOperations(a)).length).toBeGreaterThan(0);

    expect((await syncNow(a, server)).status).toBe('synced');
    await syncNow(b, server);
    await recomputeProgress(b);

    expect(await b.exercise_attempts.count()).toBe(1);
    expect(await b.skill_evidence.count()).toBe(decision.skills.length);
    const snapshotA = await evaluateLearner(a);
    const snapshotB = await evaluateLearner(b);
    expect(snapshotB.evaluations.get(DECISION_SKILL)?.state).toBe(
      snapshotA.evaluations.get(DECISION_SKILL)?.state,
    );
  });

  it('two attempts made on two devices are two facts, never merged', async () => {
    const server = new FakeSyncServer();
    const a = freshDatabase();
    const b = freshDatabase();
    const key = createSyncKey();
    await linkThisDevice(key.display, a, server);
    await linkThisDevice(key.canonical, b, server);

    await finalizeAttempt(decision, await answerDecision(a, 'A merge field on the contact.'), a);
    await finalizeAttempt(
      decision,
      await answerDecision(b, 'A contact custom field, merge field.'),
      b,
    );
    for (let round = 0; round < 3; round += 1) {
      await syncNow(a, server);
      await syncNow(b, server);
    }
    for (const database of [a, b]) {
      expect(await database.exercise_attempts.count()).toBe(2);
      expect(await database.skill_evidence.count()).toBe(2 * decision.skills.length);
    }
  });
});

vi.mock('../ai/client', () => ({
  evaluateSubmission: (...args: Parameters<typeof fakeEvaluation>) => fakeEvaluation(...args),
  classifyLanguage: vi.fn().mockResolvedValue(null),
}));
