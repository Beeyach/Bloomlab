import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { getFeatureFlags } from '@bloomlab/shared';

import { App } from '../app/App';
import { content } from '../content/bundle';
import { db, type BloomlabDatabase } from '../data/db';
import { evaluateLearner, recordEvidence } from '../data/learning';
import { syncNow } from '../data/sync/engine';
import { FakeSyncServer } from '../data/sync/fakeServer';
import { createSyncKey, linkThisDevice } from '../data/sync/link';
import { freshDatabase } from '../data/testing';
import {
  NORMAL_RUN,
  attemptKey,
  loadAttempt,
  resolveRunContext,
  saveResponse,
  startAttempt,
  type AttemptContext,
} from './attempt';
import {
  RetrievalTargetError,
  attemptHistory,
  attemptsInContext,
  finalizeAttempt,
  skillsForAttempt,
} from './finalize';

/**
 * Retrieval context (D-072): the exercise is the vehicle, the skill is the capability under
 * review. A normal run and a review of one capability are separate contexts with separate
 * drafts and separate current results, and a review writes evidence for its own capability only.
 */

const flags = getFeatureFlags('production');
/** Teaches two capabilities and is gradable from the learner's own answer. */
const VEHICLE = 'EX-WHAT_WOULD_YOU_BUILD-glowhaus-leads';
const vehicle = content.exercises.find((exercise) => exercise.id === VEHICLE)!;
const A = vehicle.skills[0]!;
const B = vehicle.skills[1]!;
const ANSWER = 'Reception forgets to follow up. I would need to know the show rate first.';

const review = (skillId = A): AttemptContext => ({ run: 'retrieval', skill_id: skillId });

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App flags={flags} />
    </MemoryRouter>,
  );
}

async function answer(context: AttemptContext, database: BloomlabDatabase = db) {
  await startAttempt(vehicle, context, {}, database);
  await saveResponse(VEHICLE, context, { text: ANSWER }, database);
  return (await loadAttempt(VEHICLE, context, database))!;
}

const evidenceFor = async (skillId: string, database: BloomlabDatabase = db) =>
  (await database.skill_evidence.toArray()).filter((row) => row.skill_id === skillId);

const DAY = 86_400_000;
const at = (days: number) => new Date(Date.parse('2026-09-01T10:00:00Z') + days * DAY);

/** An unassisted independent pass, the way the exercise runner would record one. */
const independentPass = (skillId: string, days: number, database: BloomlabDatabase = db) =>
  recordEvidence(
    {
      skill_ids: [skillId],
      kind: 'independent_exercise',
      result: 'passed',
      source: { type: 'exercise', id: VEHICLE },
      exercise_id: VEHICLE,
      exercise_type: vehicle.type,
      mode: 'independent',
      occurred_at: at(days).toISOString(),
    },
    database,
  );

/** A retrieval, scoped exactly as `finalizeAttempt` scopes one: the reviewed capability only. */
const retrieval = (
  skillId: string,
  days: number,
  result: 'passed' | 'failed',
  database: BloomlabDatabase = db,
) =>
  recordEvidence(
    {
      skill_ids: [skillId],
      kind: 'retrieval',
      result,
      source: { type: 'retrieval', id: VEHICLE },
      exercise_id: VEHICLE,
      exercise_type: vehicle.type,
      mode: null,
      occurred_at: at(days).toISOString(),
    },
    database,
  );

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
});

describe('the attempt key distinguishes a run from a review', () => {
  it('keys a normal run by the exercise and a review by the capability it reviews', () => {
    expect(attemptKey(VEHICLE)).toBe(`exercise.attempt.${VEHICLE}`);
    // A normal run keeps the plain key whatever capability the learner arrived from.
    expect(attemptKey(VEHICLE, { run: 'normal', skill_id: A })).toBe(attemptKey(VEHICLE));
    expect(attemptKey(VEHICLE, review(A))).toBe(`exercise.attempt.${VEHICLE}:retrieval:${A}`);
    expect(attemptKey(VEHICLE, review(B))).not.toBe(attemptKey(VEHICLE, review(A)));
    expect(attemptKey(VEHICLE, review(A))).not.toBe(attemptKey(VEHICLE));
  });

  it('honours a retrieval only when it names a capability the exercise teaches', () => {
    expect(resolveRunContext(vehicle, { run: 'retrieval', skill: A })).toEqual(review(A));
    // No skill, or one this exercise does not teach: an ordinary run, never a review of everything.
    expect(resolveRunContext(vehicle, { run: 'retrieval', skill: null }).run).toBe('normal');
    expect(
      resolveRunContext(vehicle, { run: 'retrieval', skill: 'SK-AUTOMATE-wait-logic' }).run,
    ).toBe('normal');
    expect(resolveRunContext(vehicle, { run: null, skill: A })).toEqual({
      run: 'normal',
      skill_id: A,
    });
  });

  it('refuses to start a review that names no capability of the exercise', async () => {
    await expect(
      startAttempt(vehicle, { run: 'retrieval', skill_id: null }, {}, db),
    ).rejects.toThrow(/must name a capability/);
    await expect(
      startAttempt(vehicle, { run: 'retrieval', skill_id: 'SK-AUTOMATE-wait-logic' }, {}, db),
    ).rejects.toThrow(/must name a capability/);
  });
});

describe('unfinished work never crosses contexts', () => {
  it('an unfinished normal draft is not resumed as a review', async () => {
    const normal = await answer(NORMAL_RUN);
    const reviewAttempt = await startAttempt(vehicle, review(A), {}, db);
    expect(reviewAttempt.attempt_id).not.toBe(normal.attempt_id);
    expect(reviewAttempt.run).toBe('retrieval');
    expect(reviewAttempt.skill_id).toBe(A);
    // The review starts empty; the normal draft is still there, untouched.
    expect(reviewAttempt.response.text).toBe('');
    expect((await loadAttempt(VEHICLE, NORMAL_RUN, db))?.response.text).toBe(ANSWER);
  });

  it('an unfinished review is not resumed as a normal run', async () => {
    const reviewAttempt = await answer(review(A));
    const normal = await startAttempt(vehicle, NORMAL_RUN, {}, db);
    expect(normal.attempt_id).not.toBe(reviewAttempt.attempt_id);
    expect(normal.run).toBe('normal');
    expect(normal.response.text).toBe('');
    expect((await loadAttempt(VEHICLE, review(A), db))?.response.text).toBe(ANSWER);
  });

  it('two reviews of different capabilities are two attempts', async () => {
    const first = await startAttempt(vehicle, review(A), {}, db);
    const second = await startAttempt(vehicle, review(B), {}, db);
    expect(second.attempt_id).not.toBe(first.attempt_id);
    expect(second.skill_id).toBe(B);
  });

  it('a review resumes itself across a reload of the same deep link', async () => {
    renderAt(`/exercise/${VEHICLE}?skill=${A}&run=retrieval`);
    await screen.findByRole('heading', { level: 1, name: vehicle.title });
    await waitFor(async () => expect(await loadAttempt(VEHICLE, review(A), db)).toBeDefined());
    const first = (await loadAttempt(VEHICLE, review(A), db))!;
    fireEvent.change(await screen.findByRole('textbox'), { target: { value: ANSWER } });
    await waitFor(async () =>
      expect((await loadAttempt(VEHICLE, review(A), db))?.response.text).toBe(ANSWER),
    );
    // Reload: the same review attempt, with its work.
    const again = await startAttempt(vehicle, review(A), {}, db);
    expect(again.attempt_id).toBe(first.attempt_id);
    expect(again.response.text).toBe(ANSWER);
    expect(await loadAttempt(VEHICLE, NORMAL_RUN, db)).toBeUndefined();
  });
});

describe('a finished attempt is the result of its own context only', () => {
  it("a completed normal attempt does not become the review's result", async () => {
    await finalizeAttempt(vehicle, await answer(NORMAL_RUN), db);
    expect(await attemptsInContext(VEHICLE, NORMAL_RUN, db)).toHaveLength(1);
    expect(await attemptsInContext(VEHICLE, review(A), db)).toHaveLength(0);
    // The review route opens a fresh challenge rather than showing the normal run's result.
    renderAt(`/exercise/${VEHICLE}?skill=${A}&run=retrieval`);
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Your answer' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { level: 2, name: 'Partly evaluated' }),
    ).not.toBeInTheDocument();
  });

  it("a completed review does not become the normal run's result", async () => {
    await finalizeAttempt(vehicle, await answer(review(A)), db);
    expect(await attemptsInContext(VEHICLE, review(A), db)).toHaveLength(1);
    expect(await attemptsInContext(VEHICLE, NORMAL_RUN, db)).toHaveLength(0);
    renderAt(`/exercise/${VEHICLE}`);
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Your answer' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { level: 2, name: 'Partly evaluated' }),
    ).not.toBeInTheDocument();
  });

  it('a review of one capability is not the result of a review of another', async () => {
    await finalizeAttempt(vehicle, await answer(review(A)), db);
    expect(await attemptsInContext(VEHICLE, review(A), db)).toHaveLength(1);
    expect(await attemptsInContext(VEHICLE, review(B), db)).toHaveLength(0);
  });

  it('keeps the whole history queryable, and hides none of it', async () => {
    await finalizeAttempt(vehicle, await answer(NORMAL_RUN), db);
    await finalizeAttempt(vehicle, await answer(review(A)), db);
    await finalizeAttempt(vehicle, await answer(review(B)), db);
    const all = await attemptHistory(VEHICLE, db);
    expect(all).toHaveLength(3);
    expect(all.filter((row) => row.source.type === 'retrieval')).toHaveLength(2);
    expect(await db.exercise_attempts.count()).toBe(3);
  });

  it('Try again is a new attempt inside the same context', async () => {
    await finalizeAttempt(vehicle, await answer(review(A)), db);
    renderAt(`/exercise/${VEHICLE}?skill=${A}&run=retrieval`);
    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    await waitFor(async () => expect(await loadAttempt(VEHICLE, review(A), db)).toBeDefined());
    const next = (await loadAttempt(VEHICLE, review(A), db))!;
    expect(next.run).toBe('retrieval');
    expect(next.skill_id).toBe(A);
    expect(next.response.text).toBe('');
    // The finished review stays in its own history.
    expect(await attemptsInContext(VEHICLE, review(A), db)).toHaveLength(1);
    expect(await loadAttempt(VEHICLE, NORMAL_RUN, db)).toBeUndefined();
  });
});

describe('a review writes evidence for the reviewed capability only (D-072)', () => {
  it('scopes the skills of a retrieval attempt, and refuses an invalid target', () => {
    expect(skillsForAttempt(vehicle, { run: 'normal', skill_id: A })).toEqual([A, B]);
    expect(skillsForAttempt(vehicle, { run: 'retrieval', skill_id: A })).toEqual([A]);
    expect(() => skillsForAttempt(vehicle, { run: 'retrieval', skill_id: null })).toThrow(
      RetrievalTargetError,
    );
    expect(() =>
      skillsForAttempt(vehicle, {
        run: 'retrieval',
        skill_id: 'SK-AUTOMATE-wait-logic',
      }),
    ).toThrow(RetrievalTargetError);
  });

  it('records one row for the reviewed capability and nothing for the other', async () => {
    const { attempt } = await finalizeAttempt(vehicle, await answer(review(A)), db);
    expect(attempt.skill_ids).toEqual([A]);
    expect(attempt.source).toEqual({ type: 'retrieval', id: VEHICLE });
    expect(await evidenceFor(A, db)).toHaveLength(1);
    expect((await evidenceFor(A, db))[0]?.kind).toBe('retrieval');
    // The exercise teaches B too; reviewing A says nothing about B.
    expect(await evidenceFor(B, db)).toHaveLength(0);
    expect(await db.skill_evidence.count()).toBe(1);
  });

  it("leaves the other capability's state and review clock untouched", async () => {
    await independentPass(A, 0);
    await independentPass(A, 1);
    await independentPass(B, 0);
    await independentPass(B, 1);
    const before = await evaluateLearner(db, { now: at(2) });
    const beforeB = before.evaluations.get(B)!;

    await finalizeAttempt(vehicle, await answer(review(A)), db);
    const after = await evaluateLearner(db, { now: at(2) });
    const afterB = after.evaluations.get(B)!;

    expect(afterB.state).toBe(beforeB.state);
    expect(afterB.review_due).toBe(beforeB.review_due);
    expect(afterB.last_demonstrated).toBe(beforeB.last_demonstrated);
    expect(afterB.counts).toEqual(beforeB.counts);
    // And the review never counts as a demonstration for the capability it reviewed either.
    expect(after.evaluations.get(A)?.counts.independent_demonstrations).toBe(
      before.evaluations.get(A)?.counts.independent_demonstrations,
    );
  });

  it('a normal run of the same exercise still credits both capabilities', async () => {
    const { attempt } = await finalizeAttempt(vehicle, await answer(NORMAL_RUN), db);
    expect(attempt.skill_ids).toEqual([A, B]);
    expect(attempt.source).toEqual({ type: 'exercise', id: VEHICLE });
    expect(await evidenceFor(A, db)).toHaveLength(1);
    expect(await evidenceFor(B, db)).toHaveLength(1);
    expect((await evidenceFor(B, db))[0]?.kind).toBe('independent_exercise');
  });
});

describe('the review clock moves only for the reviewed capability (D-051, D-052)', () => {
  it('a failed review forces NEEDS_REFRESH for that capability alone', async () => {
    await independentPass(A, 0);
    await independentPass(A, 1);
    await independentPass(B, 0);
    await independentPass(B, 1);
    const before = await evaluateLearner(db, { now: at(2) });
    expect(before.evaluations.get(A)?.state).toBe('INDEPENDENT');
    expect(before.evaluations.get(B)?.state).toBe('INDEPENDENT');

    await retrieval(A, 2, 'failed');
    const after = await evaluateLearner(db, { now: at(2) });
    const a = after.evaluations.get(A)!;
    expect(a.state).toBe('NEEDS_REFRESH');
    expect(a.refresh_reason).toBe('failed_retrieval');
    expect(a.refresh_from).toBe('INDEPENDENT');
    // B never entered the review.
    expect(after.evaluations.get(B)?.state).toBe('INDEPENDENT');
    expect(after.evaluations.get(B)?.refresh_reason).toBeNull();
    expect(await evidenceFor(B, db)).toHaveLength(2);
  });

  it('a qualifying review clears NEEDS_REFRESH for that capability alone', async () => {
    await independentPass(A, 0);
    await independentPass(A, 1);
    await independentPass(B, 0);
    await independentPass(B, 1);
    // Far enough past the interval and its grace that both are overdue.
    const overdue = await evaluateLearner(db, { now: at(90) });
    expect(overdue.evaluations.get(A)?.state).toBe('NEEDS_REFRESH');
    expect(overdue.evaluations.get(B)?.state).toBe('NEEDS_REFRESH');

    await retrieval(A, 90, 'passed');
    const after = await evaluateLearner(db, { now: at(90) });
    const a = after.evaluations.get(A)!;
    expect(a.state).toBe('INDEPENDENT');
    expect(a.last_demonstrated).toBe(at(90).toISOString());
    expect(a.counts.independent_demonstrations).toBe(
      overdue.evaluations.get(A)?.counts.independent_demonstrations,
    );
    // Reviewing A did not refresh B.
    expect(after.evaluations.get(B)?.state).toBe('NEEDS_REFRESH');
    expect(after.evaluations.get(B)?.last_demonstrated).toBe(
      overdue.evaluations.get(B)?.last_demonstrated,
    );
  });

  it('an assisted review does not reset the clock, and still touches only one capability', async () => {
    await independentPass(A, 0);
    await independentPass(A, 1);
    await independentPass(B, 0);
    const overdue = await evaluateLearner(db, { now: at(90) });
    await recordEvidence({
      skill_ids: [A],
      kind: 'retrieval',
      result: 'passed',
      source: { type: 'retrieval', id: VEHICLE },
      exercise_id: VEHICLE,
      hints_used: ['worked_example'],
      mode: null,
      occurred_at: at(90).toISOString(),
    });
    const after = await evaluateLearner(db, { now: at(90) });
    expect(after.evaluations.get(A)?.state).toBe('NEEDS_REFRESH');
    expect(after.evaluations.get(A)?.last_demonstrated).toBe(
      overdue.evaluations.get(A)?.last_demonstrated,
    );
    expect(await evidenceFor(B, db)).toHaveLength(1);
  });
});

describe('cross-device semantics are unchanged', () => {
  it('a review syncs as one scoped attempt, and separate attempts stay separate', async () => {
    const server = new FakeSyncServer();
    const a = freshDatabase();
    const b = freshDatabase();
    const key = createSyncKey();
    await linkThisDevice(key.display, a, server);
    await linkThisDevice(key.canonical, b, server);

    await finalizeAttempt(vehicle, await answer(review(A), a), a);
    await finalizeAttempt(vehicle, await answer(NORMAL_RUN, b), b);
    for (let round = 0; round < 3; round += 1) {
      await syncNow(a, server);
      await syncNow(b, server);
    }
    for (const database of [a, b]) {
      const attempts = await attemptHistory(VEHICLE, database);
      expect(attempts).toHaveLength(2);
      const reviewRow = attempts.find((row) => row.source.type === 'retrieval')!;
      const normalRow = attempts.find((row) => row.source.type === 'exercise')!;
      expect(reviewRow.skill_ids).toEqual([A]);
      expect(normalRow.skill_ids).toEqual([A, B]);
      // One review row for A, one normal row per skill: three evidence rows, none merged.
      expect(await database.skill_evidence.count()).toBe(3);
    }
  });
});
