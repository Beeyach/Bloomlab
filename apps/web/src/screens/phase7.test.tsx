import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { getFeatureFlags } from '@bloomlab/shared';

import { App } from '../app/App';
import { db } from '../data/db';
import { recordEvidence, setFocus } from '../data/learning';

const flags = getFeatureFlags('production');
const FUNNEL_MATH = 'SK-STRATEGIZE-funnel-math';
const BOTTLENECK = 'SK-STRATEGIZE-bottleneck-diagnosis';
const EXERCISE = 'EX-WHAT_WOULD_YOU_BUILD-glowhaus-leads';
/** Never: points, levels, stars, streaks, XP (spec §70, §159). */
const GAMIFICATION = /\bXP\b|\bstars?\b|\blevel \d|\bpoints\b|\bstreak\b/i;
/** Never: a date lock (spec §7). */
const DATE_LOCK = /\bday \d+\b|locked until|unlocks on|available (on|from) \d/i;

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App flags={flags} />
    </MemoryRouter>,
  );
}

const pass = (skill: string, occurred_at: string) =>
  recordEvidence({
    skill_ids: [skill],
    kind: 'independent_exercise',
    result: 'passed',
    source: { type: 'exercise', id: EXERCISE },
    exercise_id: EXERCISE,
    exercise_type: 'WHAT_WOULD_YOU_BUILD',
    mode: 'independent',
    occurred_at,
  });

const pressure = (skill: string, occurred_at: string) =>
  recordEvidence({
    skill_ids: [skill],
    kind: 'pressure_test',
    result: 'passed',
    source: { type: 'exercise', id: EXERCISE },
    exercise_id: EXERCISE,
    exercise_type: 'WHAT_WOULD_YOU_BUILD',
    mode: 'pressure',
    occurred_at,
  });

const fail = (skill: string, occurred_at: string) =>
  recordEvidence({
    skill_ids: [skill],
    kind: 'deterministic_exercise',
    result: 'failed',
    source: { type: 'exercise', id: EXERCISE },
    exercise_id: EXERCISE,
    exercise_type: 'WHAT_WOULD_YOU_BUILD',
    mode: 'practice',
    occurred_at,
  });

const recently = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString();

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
});

describe('Command Center (DES-010, PRD-012)', () => {
  it('answers "what next" for a new learner from the campaign, in capability words', async () => {
    renderAt('/');
    const object = (await screen.findByRole('heading', { level: 2, name: 'Funnel math' })).closest(
      'section',
    ) as HTMLElement;
    expect(object).toHaveTextContent('Field Ready campaign · Gate 1 · Funnel Thinking');
    expect(object).toHaveTextContent('Not started.');
    expect(object).toHaveTextContent('Next · Read');
    expect(object).toHaveTextContent('Gate 1: 0 of 2 capabilities demonstrated');
    expect(object).toHaveTextContent('0 capabilities demonstrated across the map');
    expect(within(object).getByRole('button', { name: 'Continue' })).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: 'Due for retrieval' })).toBeInTheDocument();
    expect(screen.getByText(/Nothing due\./)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Work ahead' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Needs another run' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Recent evidence' })).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(GAMIFICATION);
    expect(document.body.textContent).not.toMatch(DATE_LOCK);
    expect(document.body.textContent).not.toMatch(/welcome back/i);
  });

  it('opens the next step directly: the unit when the engine says read, the capability otherwise', async () => {
    renderAt('/');
    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }));
    // A new learner's next step for Funnel math is its unit (Phase 8), not the capability sheet.
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Start with the next decision' }),
    ).toBeInTheDocument();
  });

  it('moves on after evidence and lists recent evidence and repairs', async () => {
    // Gate 1 asks for two independent demonstrations and a pressure test per capability.
    await pass(FUNNEL_MATH, recently(3));
    await pass(FUNNEL_MATH, recently(2));
    await pressure(FUNNEL_MATH, recently(1));
    await fail(BOTTLENECK, recently(0));
    renderAt('/');
    const object = (
      await screen.findByRole('heading', { level: 2, name: 'Bottleneck diagnosis' })
    ).closest('section') as HTMLElement;
    expect(object).toHaveTextContent('Gate 1: 1 of 2 capabilities demonstrated');
    expect(object).toHaveTextContent('1 capability demonstrated across the map');

    const repair = screen.getByRole('heading', { name: 'Needs another run' })
      .parentElement as HTMLElement;
    expect(within(repair).getByRole('link', { name: 'Bottleneck diagnosis' })).toHaveAttribute(
      'href',
      `/skills/${BOTTLENECK}`,
    );
    const recent = screen.getByRole('heading', { name: 'Recent evidence' })
      .parentElement as HTMLElement;
    expect(within(recent).getAllByText('Demonstrated')).toHaveLength(3);
    expect(within(recent).getByText('Needs another run')).toBeInTheDocument();
  });

  it("follows the learner's focus and clears it", async () => {
    await setFocus(BOTTLENECK);
    renderAt('/');
    const object = (
      await screen.findByRole('heading', { level: 2, name: 'Bottleneck diagnosis' })
    ).closest('section') as HTMLElement;
    expect(object).toHaveTextContent('Your focus');
    fireEvent.click(within(object).getByRole('button', { name: 'Clear focus' }));
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Funnel math' }),
    ).toBeInTheDocument();
  });
});

describe('Build my session (MAS-006 on the Command Center)', () => {
  it('builds a real plan for the chosen length and continues past finished items', async () => {
    renderAt('/');
    await screen.findByRole('button', { name: 'Continue' });
    expect(screen.getByRole('radio', { name: '1 hour' })).toBeChecked();
    fireEvent.click(screen.getByRole('radio', { name: '30 min' }));
    fireEvent.click(screen.getByRole('button', { name: 'Build my session' }));

    const plan = await screen.findByTestId('session-plan');
    expect(plan).toHaveTextContent(/\d+ of 30 min planned/);
    const items = within(plan).getAllByRole('link');
    expect(items.length).toBeGreaterThan(0);
    const first = items[0]?.textContent;
    expect(items[0]).toHaveAttribute(
      'href',
      expect.stringMatching(/^\/(skills\/SK-|academy\/LU-)/),
    );

    const continueButtons = screen.getAllByRole('button', { name: 'Continue' });
    fireEvent.click(continueButtons[continueButtons.length - 1] as HTMLElement);
    await waitFor(() => {
      const next = within(screen.getByTestId('session-plan')).queryAllByRole('link');
      expect(next[0]?.textContent ?? '').not.toBe(first);
    });
  });
});

describe('Campaign (PRD-007)', () => {
  it('shows gates in capability terms with a pace hint and no date locks', async () => {
    renderAt('/campaign');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Field Ready' }),
    ).toBeInTheDocument();
    // The campaign's kind and pace read as one metadata line under the title; there is no
    // eyebrow repeating the heading above it (DES-021).
    expect(
      screen.getByText('Campaign · Suggested pace: ~30 days at 3–5 hours/day'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Field Ready campaign')).not.toBeInTheDocument();

    const current = await screen.findByRole('listitem', { current: 'step' });
    expect(current).toHaveTextContent('Funnel Thinking');
    expect(within(current).getByText('Open')).toBeInTheDocument();
    expect(current).toHaveTextContent('0 of 2 capabilities demonstrated');
    expect(current).toHaveTextContent('2 independent demonstrations per capability');
    expect(within(current).getByRole('link', { name: /Funnel math/ })).toHaveAttribute(
      'href',
      `/skills/${FUNNEL_MATH}`,
    );
    expect(current).toHaveTextContent('after Funnel math');
    expect(screen.getAllByText('Placement').length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toMatch(DATE_LOCK);
    expect(document.body.textContent).not.toMatch(GAMIFICATION);
  });
});

describe('Skill Map (DES-011, PRD-013)', () => {
  it('shows ten territory objects with Judgment central and real counts', async () => {
    renderAt('/skills');
    const group = await screen.findByRole('group', { name: 'Territories' });
    const objects = within(group).getAllByRole('button');
    expect(objects).toHaveLength(10);
    expect(objects[4]).toHaveAttribute('data-territory', 'JUDGMENT');
    expect(objects.map((o) => o.getAttribute('data-territory'))).toEqual([
      'STRATEGIZE',
      'BUILD',
      'AUTOMATE',
      'ARCHITECT',
      'JUDGMENT',
      'DIAGNOSE',
      'CONNECT',
      'SELL',
      'DELIVER',
      'SCALE',
    ]);
    expect(objects[0]).toHaveTextContent('0 of 2 capabilities demonstrated');
    expect(document.body.textContent).not.toMatch(GAMIFICATION);
    expect(document.body.textContent).not.toMatch(DATE_LOCK);
  });

  it('opens a territory to its capabilities with locked and available states in words', async () => {
    renderAt('/skills');
    const group = await screen.findByRole('group', { name: 'Territories' });
    const strategize = within(group).getByRole('button', { name: /Strategize/ });
    fireEvent.click(strategize);
    expect(strategize).toHaveAttribute('aria-pressed', 'true');

    const panel = await screen.findByTestId('territory-panel');
    await within(panel).findByRole('button', { name: /Funnel math/ });
    const funnel = within(panel)
      .getByRole('button', { name: /Funnel math/ })
      .closest('li') as HTMLElement;
    expect(funnel).toHaveTextContent('Next required');
    const bottleneck = within(panel)
      .getByRole('button', { name: /Bottleneck diagnosis/ })
      .closest('li') as HTMLElement;
    expect(bottleneck).toHaveTextContent('Locked');
    expect(bottleneck).toHaveTextContent('after Funnel math');

    fireEvent.click(within(group).getByRole('button', { name: /Build/ }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Build' })).toBeInTheDocument();
    const form = (await screen.findByRole('button', { name: /Lead capture form/ })).closest(
      'li',
    ) as HTMLElement;
    expect(form).toHaveTextContent('Work ahead');
  });

  it('unlocks a capability once its prerequisite is demonstrated', async () => {
    await pass(FUNNEL_MATH, recently(2));
    renderAt(`/skills/${BOTTLENECK}`);
    const dialog = await screen.findByRole('dialog', { name: 'Bottleneck diagnosis' });
    expect(dialog).toHaveTextContent('Next required');
    // Phase 24 teaches customer-path reasoning before first practice.
    expect(dialog).toHaveTextContent('Start with the next decision');
    expect(dialog).toHaveTextContent('first exposure');
    expect(dialog).not.toHaveTextContent('Opens after');
    expect(within(dialog).getByRole('link', { name: /Funnel math/ })).toBeInTheDocument();
    expect(dialog).toHaveTextContent('demonstrated');
  });

  it("shows a skill's state, next step and evidence, and sets it as focus", async () => {
    await pass(FUNNEL_MATH, recently(4));
    renderAt(`/skills/${FUNNEL_MATH}`);
    const dialog = await screen.findByRole('dialog', { name: 'Funnel math' });
    expect(dialog).toHaveTextContent('Demonstrated independently 1 time.');
    expect(dialog).toHaveTextContent('Still needed:');
    expect(dialog).toHaveTextContent('Retrieval due in');
    // The builder offers the next step towards the evidence still owed, from the Phase 15
    // exercises this capability now has.
    expect(dialog).toHaveTextContent('Design the next step for eleven businesses');
    const evidence = within(dialog).getByRole('heading', { name: 'Evidence' })
      .parentElement as HTMLElement;
    expect(within(evidence).getByText('Demonstrated')).toBeInTheDocument();
    expect(evidence).toHaveTextContent('exercise, no hints · 4 days ago');
    expect(within(dialog).getByRole('heading', { name: 'Opens' })).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: /Bottleneck diagnosis/ })).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Set as focus' }));
    expect(await within(dialog).findByRole('button', { name: 'Clear focus' })).toBeInTheDocument();
    expect(dialog).toHaveTextContent('Your focus');
    expect(await db.workspace.get('learning.focus')).toMatchObject({
      value: { skill_id: FUNNEL_MATH },
    });
  });

  it('explains a locked capability without implying a date', async () => {
    renderAt(`/skills/${BOTTLENECK}`);
    const dialog = await screen.findByRole('dialog', { name: 'Bottleneck diagnosis' });
    expect(dialog).toHaveTextContent('Locked');
    expect(dialog).toHaveTextContent('Opens after Funnel math');
    expect(dialog.textContent).not.toMatch(DATE_LOCK);
  });
});
