import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { getFeatureFlags } from '@bloomlab/shared';

import { App } from '../app/App';
import { content, CONTENT_VERSION } from '../content/bundle';
import { db, type BloomlabDatabase } from '../data/db';
import { ensureDevice } from '../data/device';
import { evaluateLearner, recomputeProgress, recordEvidence } from '../data/learning';
import { unitCompletionId } from '../data/learning/ids';
import { listOperations } from '../data/syncQueue';
import { syncNow } from '../data/sync/engine';
import { FakeSyncServer } from '../data/sync/fakeServer';
import { createSyncKey, linkThisDevice } from '../data/sync/link';
import { freshDatabase } from '../data/testing';
import { completeUnit, findUnitCompletion } from './completion';
import { funnelOutcome, liftRate } from './funnelMath';

const flags = getFeatureFlags('production');
const UNIT = 'LU-funnel-math-basics';
const SKILL = 'SK-STRATEGIZE-funnel-math';
const unit = content.learning_units.find((candidate) => candidate.id === UNIT)!;
// Two taught skills, so "one completion per taught skill" is a real assertion.
const TAGS_UNIT = 'LU-tags-vs-custom-fields';
const tagsUnit = content.learning_units.find((candidate) => candidate.id === TAGS_UNIT)!;
const EXERCISE_SKILL = 'SK-STRATEGIZE-funnel-math';
const EXERCISE = 'EX-WHAT_WOULD_YOU_BUILD-glowhaus-leads';

const completionRows = async (database: BloomlabDatabase, unitId = TAGS_UNIT) =>
  (await database.skill_evidence.toArray()).filter(
    (row) =>
      row.deleted_at === null && row.source.type === 'learning_unit' && row.source.id === unitId,
  );

const attempt = (database: BloomlabDatabase, occurred_at: string) =>
  recordEvidence(
    {
      skill_ids: [EXERCISE_SKILL],
      kind: 'independent_exercise',
      result: 'passed',
      source: { type: 'exercise', id: EXERCISE },
      exercise_id: EXERCISE,
      exercise_type: 'WHAT_WOULD_YOU_BUILD',
      mode: 'independent',
      occurred_at,
    },
    database,
  );

/** Two devices on one sync key, both caught up: the state before either goes offline. */
async function pairedDevices() {
  const server = new FakeSyncServer();
  const a = freshDatabase();
  const b = freshDatabase();
  const key = createSyncKey();
  await linkThisDevice(key.display, a, server);
  await linkThisDevice(key.canonical, b, server);
  await syncNow(a, server);
  await syncNow(b, server);
  return { server, a, b };
}

/** Push, pull and recompute both devices until nothing is left in either outbox. */
async function settle(server: FakeSyncServer, a: BloomlabDatabase, b: BloomlabDatabase) {
  for (let round = 0; round < 3; round += 1) {
    await syncNow(a, server);
    await syncNow(b, server);
    await recomputeProgress(a);
    await recomputeProgress(b);
  }
  await syncNow(a, server);
  await syncNow(b, server);
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App flags={flags} />
    </MemoryRouter>,
  );
}

const openUnit = async () => {
  renderAt(`/academy/${UNIT}?skill=${SKILL}`);
  const title = await screen.findByRole('heading', { level: 1, name: unit.title });
  // The body is a lazy chunk: wait for its first section before asserting on the content.
  await screen.findByRole('heading', { level: 2, name: 'The four numbers' });
  return title;
};

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
});

describe('Academy unit rendering (CUR-036, DES-020)', () => {
  it('renders the compiled MDX as typography-led sections with a contents list', async () => {
    await openUnit();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    const sections = screen
      .getAllByRole('heading', { level: 2 })
      .map((heading) => heading.textContent);
    expect(sections.slice(0, 3)).toEqual([
      'The four numbers',
      'Where the money leaks',
      'Say it back',
    ]);
    expect(document.getElementById('where-the-money-leaks')?.tagName).toBe('H2');
    const contents = screen.getByRole('navigation', { name: 'In this unit' });
    expect(within(contents).getByRole('link', { name: /Where the money leaks/ })).toHaveAttribute(
      'href',
      '#where-the-money-leaks',
    );
    expect(screen.getByText(/Academy · Strategize · 18 min read/)).toBeInTheDocument();
    // Authored prose, not JSX: a sentence from the MDX body.
    expect(screen.getByText(/Glowhaus Med Spa gets about 140 leads a month/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\bXP\b|\bstars?\b|\bpoints\b|Lesson \d/i);
  });

  it('renders the funnel diagram with an accessible description and the depth and callout embeds', async () => {
    await openUnit();
    const figure = document.querySelector('[data-embed="diagram-funnel"]') as HTMLElement;
    expect(figure.tagName).toBe('FIGURE');
    const labelledBy = figure.getAttribute('aria-labelledby')!;
    const caption = document.getElementById(labelledBy)!;
    expect(caption.textContent).toContain(
      '140 leads become 64 bookings, 37 consultations and 13 sales',
    );
    // 76 people never book — the largest loss in people, whatever the cheapest fix is.
    expect(caption.textContent).toContain(
      'The biggest loss is between leads and the next stage: 76 people',
    );
    const stages = within(figure).getAllByRole('listitem');
    expect(stages.map((stage) => stage.textContent)).toEqual([
      'Leads14046% book →',
      'Booked6458% show →',
      'Showed3735% buy →',
      'Bought13$410 each',
    ]);
    expect(stages[0]).toHaveAttribute('data-leak', 'true');
    expect(stages[1]).not.toHaveAttribute('data-leak');

    const depth = document.querySelector('[data-embed="depth"]') as HTMLDetailsElement;
    expect(depth.open).toBe(false);
    expect(
      within(depth).getByText('Why show rate is usually the cheapest fix'),
    ).toBeInTheDocument();
    expect(document.querySelector('[data-embed="callout"]')).toHaveTextContent('Idea');
    expect(document.querySelector('[data-embed="exercise"]')).toHaveTextContent(
      'arrives with Phase 9',
    );
  });

  it('opening a unit records nothing', async () => {
    await openUnit();
    await screen.findByRole('button', { name: 'Finish this unit' });
    expect(await db.skill_evidence.count()).toBe(0);
    expect(await db.exercise_attempts.count()).toBe(0);
  });
});

describe('Funnel-math interactive', () => {
  it('is pure arithmetic that matches the unit prose', () => {
    const input = {
      leads: 140,
      booking: 0.46,
      show: 0.58,
      close: 0.35,
      ticket: 410,
      ad_spend: 2400,
    };
    const base = funnelOutcome(input);
    expect(Math.round(base.sales)).toBe(13);
    expect(Math.round(base.revenue)).toBe(5360);
    expect(base.leak.key).toBe('leads');
    expect(Math.round(base.leak.lost)).toBe(76);
    expect(liftRate(input, 'booking', 0.6).extraSales).toBe(4);
    expect(liftRate(input, 'show', 0.8).extraSales).toBe(5);
  });

  it('changes the outcome deterministically when a rate moves, and resets', async () => {
    await openUnit();
    const results = screen.getByTestId('funnel-results');
    expect(results).toHaveTextContent('13 sales');
    expect(results).toHaveTextContent('$5,360 a month');
    expect(results).toHaveTextContent('$2,960 after $2,400 of ads');
    expect(results).toHaveTextContent('Biggest leak: 76 people lost after leads.');
    expect(results).toHaveTextContent('Booking rate to 60%17 sales (+4)');
    expect(results).toHaveTextContent('Show rate to 80%18 sales (+5)');

    const show = screen.getByRole('slider', { name: /Show rate/ }) as HTMLInputElement;
    fireEvent.change(show, { target: { value: '80' } });
    expect(results).toHaveTextContent('18 sales');
    expect(results).toHaveTextContent('52 show');
    expect(results).toHaveTextContent('$7,393 a month');
    expect(results).toHaveTextContent('Show rate to 80%already there');

    const booking = screen.getByRole('slider', { name: /Booking rate/ }) as HTMLInputElement;
    fireEvent.change(booking, { target: { value: '90' } });
    // With most leads booking, the people who show but do not buy become the biggest leak.
    expect(results).toHaveTextContent('Biggest leak: 66 people lost after showed.');

    fireEvent.click(screen.getByRole('button', { name: "Reset to the unit's numbers" }));
    expect(results).toHaveTextContent('13 sales');
  });

  it('the slider, the disclosure and the finish button are native focusable controls; Enter finishes the unit', async () => {
    // Arrow keys on a range input are browser behaviour jsdom does not implement; the Academy probe
    // (scripts/review/academy-probe.mjs) presses them in Chrome. Here: focus, value change, Enter.
    const user = userEvent.setup();
    await openUnit();
    const show = screen.getByRole('slider', { name: /Show rate/ }) as HTMLInputElement;
    show.focus();
    expect(show).toHaveFocus();
    fireEvent.change(show, { target: { value: '60' } });
    expect(screen.getByTestId('funnel-results')).toHaveTextContent('14 sales');

    const depth = document.querySelector('[data-embed="depth"]') as HTMLDetailsElement;
    const summary = depth.querySelector('summary') as HTMLElement;
    summary.focus();
    expect(summary).toHaveFocus();
    fireEvent.click(summary);
    expect(depth.open).toBe(true);

    const finish = await screen.findByRole('button', { name: 'Finish this unit' });
    finish.focus();
    await user.keyboard('{Enter}');
    await screen.findByText(/You finished this unit today/);
    expect(await db.skill_evidence.count()).toBe(1);
  });
});

describe('Unit completion is exposure evidence (PRD-003, MAS-003)', () => {
  it('records exposure through recordEvidence and moves the skill from UNSEEN to LEARNING only', async () => {
    const before = await evaluateLearner(db);
    expect(before.evaluations.get(SKILL)?.state).toBe('UNSEEN');

    await openUnit();
    fireEvent.click(await screen.findByRole('button', { name: 'Finish this unit' }));
    await screen.findByText(/You finished this unit today/);

    const rows = await db.skill_evidence.toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      skill_id: SKILL,
      kind: 'exposure',
      result: 'exposed',
      source: { type: 'learning_unit', id: UNIT },
      score: null,
    });
    expect(rows[0]?.versions.content).toBe(CONTENT_VERSION);
    expect(rows[0]?.versions.app).toBeTruthy();
    expect(rows[0]?.versions.rules).toBeTruthy();
    expect(await db.exercise_attempts.count()).toBe(0);

    const after = await evaluateLearner(db);
    const evaluation = after.evaluations.get(SKILL)!;
    expect(evaluation.state).toBe('LEARNING');
    expect(evaluation.ladder_state).toBe('LEARNING');
    expect(evaluation.counts.independent_passes).toBe(0);
    expect(evaluation.counts.practiced_passes).toBe(0);
    expect(screen.getByTestId('next-step')).toHaveTextContent('No suitable next exercise');
    expect(screen.queryByRole('button', { name: 'Finish this unit' })).not.toBeInTheDocument();
  });

  it('survives a reload and never records a duplicate on reopening or finishing again', async () => {
    const first = await completeUnit(unit);
    expect(first.recorded).toBe(true);
    const again = await completeUnit(unit);
    expect(again.recorded).toBe(false);
    expect(again.occurred_at).toBe(first.occurred_at);
    expect(await db.skill_evidence.count()).toBe(1);
    // The completion's id is derived from unit, skill and learner, not random (D-062).
    const device = await ensureDevice(db);
    const row = (await db.skill_evidence.toArray())[0]!;
    expect(row.id).toBe(unitCompletionId(UNIT, SKILL, device.learner_id));

    await openUnit();
    expect(await screen.findByText(/You finished this unit today/)).toBeInTheDocument();
    expect(screen.getByText('Recorded')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Finish this unit' })).not.toBeInTheDocument();
    expect(await db.skill_evidence.count()).toBe(1);
  });

  it('exposure and quizzes can never produce independent or mastered state', async () => {
    await completeUnit(unit);
    for (const day of ['2026-09-01', '2026-09-02', '2026-09-03']) {
      await recordEvidence({
        skill_ids: [SKILL],
        kind: 'exposure',
        result: 'exposed',
        source: { type: 'learning_unit', id: UNIT },
        occurred_at: `${day}T10:00:00Z`,
      });
      await recordEvidence({
        skill_ids: [SKILL],
        kind: 'quiz',
        result: 'passed',
        score: 1,
        source: { type: 'learning_unit', id: UNIT },
        occurred_at: `${day}T11:00:00Z`,
      });
    }
    const snapshot = await evaluateLearner(db);
    const evaluation = snapshot.evaluations.get(SKILL)!;
    expect(evaluation.state).toBe('LEARNING');
    expect(evaluation.counts.independent_passes).toBe(0);
    expect(evaluation.counts.independent_demonstrations).toBe(0);
    expect(evaluation.missing_requirements).toContain('practice');
  });

  it('written offline on one device, it syncs and the other device converges on LEARNING', async () => {
    const server = new FakeSyncServer();
    const a = freshDatabase();
    const b = freshDatabase();
    const key = createSyncKey();
    await linkThisDevice(key.display, a, server);
    await linkThisDevice(key.canonical, b, server);

    // No network is involved in completing: the write is local and queued.
    await completeUnit(unit, a);
    expect(await a.sync_queue.count()).toBeGreaterThan(0);
    expect((await syncNow(a, server)).status).toBe('synced');
    await syncNow(b, server);

    expect(await findUnitCompletion(UNIT, b)).not.toBeNull();
    const snapshot = await evaluateLearner(b);
    expect(snapshot.evaluations.get(SKILL)?.state).toBe('LEARNING');
  });
});

describe('Unit completion is idempotent across devices (D-062, SYNC-008)', () => {
  it('two devices that finish the same unit offline converge on one completion per taught skill', async () => {
    const { server, a, b } = await pairedDevices();
    expect(await completionRows(a)).toHaveLength(0);
    expect(await completionRows(b)).toHaveLength(0);

    // Both offline: neither device can see the other's completion when it writes its own.
    await completeUnit(tagsUnit, a);
    await completeUnit(tagsUnit, b);
    expect(await completionRows(a)).toHaveLength(2);
    expect(await completionRows(b)).toHaveLength(2);

    await settle(server, a, b);

    for (const database of [a, b]) {
      const rows = await completionRows(database);
      // Two rows, one per taught skill — not four, and not two per skill.
      expect(rows).toHaveLength(2);
      expect(rows.map((row) => row.skill_id).sort()).toEqual([...tagsUnit.skills].sort());
      expect(new Set(rows.map((row) => row.id)).size).toBe(2);
      expect(await listOperations(database)).toHaveLength(0);

      const snapshot = await evaluateLearner(database);
      for (const skillId of tagsUnit.skills) {
        const evaluation = snapshot.evaluations.get(skillId)!;
        expect(evaluation.state).toBe('LEARNING');
        expect(evaluation.counts.evidence).toBe(1);
        expect(evaluation.counts.independent_passes).toBe(0);
        expect(evaluation.counts.independent_demonstrations).toBe(0);
      }
    }

    // Both devices hold the same rows, and no conflict was raised for the learner to resolve.
    const idsA = (await completionRows(a)).map((row) => row.id).sort();
    const idsB = (await completionRows(b)).map((row) => row.id).sort();
    expect(idsA).toEqual(idsB);
    expect(await a.sync_conflicts.count()).toBe(0);
    expect(await b.sync_conflicts.count()).toBe(0);
  });

  it('a completion recorded before linking is re-keyed by the sync key and still converges', async () => {
    const server = new FakeSyncServer();
    const a = freshDatabase();
    const b = freshDatabase();

    // A finishes the unit while it still holds a provisional local learner (D-027).
    const provisionalDevice = await ensureDevice(a);
    expect(provisionalDevice.learner_id.startsWith('local:')).toBe(true);
    await completeUnit(tagsUnit, a);
    const provisionalIds = (await completionRows(a)).map((row) => row.id).sort();
    expect(provisionalIds).toEqual(
      tagsUnit.skills
        .map((skillId) => unitCompletionId(TAGS_UNIT, skillId, provisionalDevice.learner_id))
        .sort(),
    );

    // B is already linked and finishes the same unit offline.
    const key = createSyncKey();
    await linkThisDevice(key.display, b, server);
    await completeUnit(tagsUnit, b);

    // A links: the completion moves onto the real learner's id, and its queued write follows.
    await linkThisDevice(key.canonical, a, server);
    const linked = await ensureDevice(a);
    expect(linked.learner_id).toBe((await ensureDevice(b)).learner_id);
    expect(linked.learner_id.startsWith('local:')).toBe(false);

    const rekeyed = await completionRows(a);
    expect(rekeyed).toHaveLength(2);
    for (const row of rekeyed) {
      expect(row.id).toBe(unitCompletionId(TAGS_UNIT, row.skill_id, linked.learner_id));
      expect(row.learner_id).toBe(linked.learner_id);
    }
    const queued = await listOperations(a);
    expect(queued.some((operation) => provisionalIds.includes(operation.entity_id))).toBe(false);
    expect(rekeyed.every((row) => queued.some((operation) => operation.entity_id === row.id))).toBe(
      true,
    );

    await settle(server, a, b);

    for (const database of [a, b]) {
      expect(await completionRows(database)).toHaveLength(2);
      expect(await listOperations(database)).toHaveLength(0);
      const snapshot = await evaluateLearner(database);
      for (const skillId of tagsUnit.skills) {
        expect(snapshot.evaluations.get(skillId)?.state).toBe('LEARNING');
      }
    }
  });

  it('ordinary evidence is still append-only: two exercise attempts stay two rows', async () => {
    const { server, a, b } = await pairedDevices();
    await attempt(a, '2026-09-01T10:00:00Z');
    await attempt(b, '2026-09-02T10:00:00Z');
    await settle(server, a, b);

    for (const database of [a, b]) {
      const rows = (await database.skill_evidence.toArray()).filter(
        (row) => row.source.type === 'exercise',
      );
      // Two attempts at the same exercise are two facts; the union keeps both.
      expect(rows).toHaveLength(2);
      expect(new Set(rows.map((row) => row.id)).size).toBe(2);
      expect(rows.every((row) => !row.id.startsWith('ue:'))).toBe(true);
      expect(await database.exercise_attempts.count()).toBe(2);
      const snapshot = await evaluateLearner(database);
      expect(snapshot.evaluations.get(EXERCISE_SKILL)?.counts.independent_passes).toBe(2);
    }
  });
});

describe('Phase 7 navigation into the Academy', () => {
  it('Continue opens the unit directly when the engine says the next step is a unit', async () => {
    renderAt('/');
    const object = (await screen.findByRole('heading', { level: 2, name: 'Funnel math' })).closest(
      'section',
    ) as HTMLElement;
    expect(object).toHaveTextContent('Next · Read');
    fireEvent.click(within(object).getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('heading', { level: 1, name: unit.title })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Finish this unit' })).toBeInTheDocument();
  });

  it('a session-plan unit item opens the Academy', async () => {
    renderAt('/');
    await screen.findByRole('button', { name: 'Continue' });
    fireEvent.click(screen.getByRole('button', { name: 'Build my session' }));
    const plan = await screen.findByTestId('session-plan');
    const first = within(plan).getAllByRole('link')[0]!;
    expect(first).toHaveAttribute('href', `/academy/${UNIT}?skill=${SKILL}`);
    fireEvent.click(first);
    expect(await screen.findByRole('heading', { level: 1, name: unit.title })).toBeInTheDocument();
  });

  it('the capability sheet offers the real unit', async () => {
    renderAt(`/skills/${SKILL}`);
    const dialog = await screen.findByRole('dialog', { name: 'Funnel math' });
    expect(within(dialog).getByRole('link', { name: 'Read this unit' })).toHaveAttribute(
      'href',
      `/academy/${UNIT}?skill=${SKILL}`,
    );
  });

  it('completing the unit updates the next step on the Command Center', async () => {
    await completeUnit(unit);
    renderAt('/');
    const object = (await screen.findByRole('heading', { level: 2, name: 'Funnel math' })).closest(
      'section',
    ) as HTMLElement;
    expect(object).toHaveTextContent('Started, nothing passed yet.');
    expect(object).not.toHaveTextContent('Next · Read');
    expect(object).toHaveTextContent('No suitable next exercise is authored');
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Recent evidence' })).toBeInTheDocument(),
    );
    expect(screen.getByText('Read')).toBeInTheDocument();
  });
});
