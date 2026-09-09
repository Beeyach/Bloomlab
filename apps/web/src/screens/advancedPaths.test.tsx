import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, expect, it, vi } from 'vitest';
import { content } from '../content/bundle';
import { db } from '../data/db';
import { ensureDevice } from '../data/device';
import { recordEvidence } from '../data/learning/evidence';
import * as progress from '../data/learning/progress';
import { fieldReadyCompletion } from '../clients/completion';
import CampaignScreen from './CampaignScreen';

beforeEach(async () => {
  cleanup();
  vi.restoreAllMocks();
  await Promise.all(db.tables.map((table) => table.clear()));
});
const show = (path = '/campaign') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <CampaignScreen />
    </MemoryRouter>,
  );

it('keeps loading explicit until device evidence is available', async () => {
  show();
  expect(screen.getByText('Reading your progress…')).toBeInTheDocument();
  await ensureDevice();
  await waitFor(() => expect(screen.queryByText('Reading your progress…')).toBeNull());
  expect(screen.getByText(/0 of 12 gates passed/)).toBeInTheDocument();
});

it('shows all seven post-Field-Ready choices, one recommendation, foundations and real graph links', async () => {
  await ensureDevice();
  show('/campaign?path=CAMP-GHL_AI_SPECIALIST');
  await screen.findByText(/0 of 5 gates passed/);
  const select = screen.getByRole('combobox', { name: 'Campaign or path' });
  expect(within(select).getAllByRole('option')).toHaveLength(content.campaigns.length);
  expect(within(select).getAllByRole('option', { name: /Recommended/ })).toHaveLength(1);
  for (const path of content.campaigns.filter((path) => path.post_field_ready)) {
    fireEvent.change(select, { target: { value: path.id } });
    expect(screen.getByRole('heading', { level: 1, name: path.title })).toBeInTheDocument();
    expect(screen.getByTestId('path-boundary')).toHaveTextContent(
      'does not mark Field Ready complete',
    );
    expect(screen.getByRole('navigation', { name: 'Path foundations' })).toHaveTextContent(
      'Field Ready',
    );
    const id = path.gates[0]!.skills[0]!;
    expect(document.querySelector(`a[href="/skills/${id}"]`)).not.toBeNull();
  }
});

it('recovers from an unknown bookmark and storage error without fabricating progress', async () => {
  await ensureDevice();
  const read = vi
    .spyOn(progress, 'evaluateLearner')
    .mockRejectedValueOnce(new Error('storage refused'));
  show('/campaign?path=does-not-exist');
  expect(await screen.findByRole('alert')).toHaveTextContent('could not be read');
  expect(screen.getByText(/That path is not in this content build/)).toBeInTheDocument();
  expect(screen.queryByText(/gates passed/)).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await screen.findByText(/0 of 12 gates passed/);
  expect(read).toHaveBeenCalledTimes(2);
});

it('shares one evidence record across paths without earning Field Ready or inventing a second progress store', async () => {
  await ensureDevice();
  const skill = 'SK-JUDGMENT-ai-boundaries';
  const exercise = content.exercises.find((exercise) => exercise.skills.includes(skill))!;
  await recordEvidence({
    skill_ids: [skill],
    kind: 'independent_exercise',
    result: 'passed',
    source: { type: 'exercise', id: exercise.id },
    exercise_id: exercise.id,
    exercise_type: exercise.type,
    mode: 'independent',
  });
  show('/campaign?path=CAMP-GHL_AI_SPECIALIST');
  await screen.findByText(/1 of 5 gates passed/);
  const before = await db.skill_evidence.count();
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'CAMP-BLOOMWIRED_OPERATOR' } });
  const row = document.querySelector(`a[href="/skills/${skill}"]`)!.closest('li')!;
  expect(row).toHaveTextContent('Passed');
  expect(await db.skill_evidence.count()).toBe(before);
  expect(fieldReadyCompletion(await progress.evaluateLearner(), content).complete).toBe(false);
  expect(screen.getByTestId('path-boundary')).toHaveTextContent(
    'does not mark Field Ready complete',
  );
});
