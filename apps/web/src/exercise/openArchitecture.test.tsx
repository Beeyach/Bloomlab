import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { getFeatureFlags } from '@bloomlab/shared';
import { App } from '../app/App';
import { content } from '../content/bundle';
import { db } from '../data/db';
import { NORMAL_RUN, loadAttempt, saveResponse, startAttempt } from './attempt';
import { gradeAttempt } from './finalize';

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
});
describe('R9 later-level architecture evidence boundaries', () => {
  it('renders a later open decision with all five data choices, no radios or forced choice field, and recovers writing', async () => {
    const exercise = content.exercises.find(
      (row) => row.id === 'EX-ARCHITECTURE_DECISION-veterinary-records',
    )!;
    expect(exercise.difficulty).toBeGreaterThan(2);
    expect(exercise.decision_options).toEqual([]);
    expect(
      [...exercise.expected_outcomes, ...exercise.critical_failures].some(
        (row) => row.type === 'state' && row.path === 'decision.choice',
      ),
    ).toBe(false);
    const view = render(
      <MemoryRouter initialEntries={['/exercise/' + exercise.id]}>
        <App flags={getFeatureFlags('production')} />
      </MemoryRouter>,
    );
    const input = await screen.findByTestId('write-facts');
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    for (const word of [
      'tags',
      'contact custom fields',
      'custom values',
      'opportunity fields',
      'custom objects',
    ])
      expect(document.body.textContent).toContain(word);
    fireEvent.change(input, {
      target: { value: 'A repeating pet is its own record; shared booking URL is a custom value.' },
    });
    await waitFor(async () =>
      expect((await loadAttempt(exercise.id, NORMAL_RUN))?.response.written?.facts).toContain(
        'own record',
      ),
    );
    view.unmount();
    render(
      <MemoryRouter initialEntries={['/exercise/' + exercise.id]}>
        <App flags={getFeatureFlags('production')} />
      </MemoryRouter>,
    );
    expect(await screen.findByTestId('write-facts')).toHaveValue(
      'A repeating pet is its own record; shared booking URL is a custom value.',
    );
  });
  it('allows different open architectures through objective checks but never substitutes them for semantic acceptance', async () => {
    const exercise = content.exercises.find(
      (row) => row.id === 'EX-WHAT_WOULD_YOU_BUILD-glowhaus-leads',
    )!;
    expect(exercise.allowed_features).toEqual([]);
    for (const text of [
      'I would ask Priya to verify response times first. Start with an owned manual callback queue and daily review; defer complex automation until volume and consent are established.',
      'Verify consent and booking abandonment first. Start with a small automated confirmation plus a staff handoff, then test cancellation and no-show paths. Do not automate diagnosis or unverified promises.',
    ]) {
      await startAttempt(exercise, NORMAL_RUN);
      await saveResponse(exercise.id, NORMAL_RUN, { text });
      const report = gradeAttempt(exercise, (await loadAttempt(exercise.id, NORMAL_RUN))!);
      expect(
        Object.values(report.tiers)
          .flat()
          .every((row) => row.passed),
      ).toBe(true);
      expect(report.outcome).toBe('partial');
      expect(report.rubric_pending).toBe('SYSTEM_DESIGN_RUBRIC_V1');
    }
  });
});
