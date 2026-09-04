import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getFeatureFlags } from '@bloomlab/shared';

import { App } from '../app/App';
import { db } from '../data/db';
import { ensureDevice } from '../data/device';

/**
 * The Playground (SIM-015), through the real App at `/playground`. Nothing is unlocked for a new
 * learner; starting a scenario unlocks what that scenario uses, and every unlocked feature says
 * whether the simulator runs it.
 */

const flags = getFeatureFlags('production');

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <App flags={flags} />
    </MemoryRouter>,
  );

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
  await ensureDevice();
});

afterEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
});

describe('the Playground exposes every unlocked feature without an exercise (SIM-015)', () => {
  it('starts with nothing unlocked, and unlocks what a started scenario uses', async () => {
    renderAt('/playground');
    expect(
      await screen.findByTestId('nothing-unlocked', {}, { timeout: 8000 }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open in Workflow Lab' })).toHaveAttribute(
      'href',
      expect.stringContaining('/workflow?scenario='),
    );

    fireEvent.change(screen.getByLabelText('Scenario'), {
      target: { value: 'SC-glowhaus-no-show' },
    });
    fireEvent.click(screen.getByTestId('open-run'));
    const list = await screen.findByRole('list', { name: 'Unlocked features' }, { timeout: 8000 });
    await waitFor(() => expect(within(list).getByText('Send SMS')).toBeInTheDocument());
    const sms = list.querySelector('[data-feature="GHL-WF-SEND-SMS"]') as HTMLElement;
    expect(within(sms).getByText('Simulated')).toBeInTheDocument();
    expect(within(sms).getByText(/Met in/)).toBeInTheDocument();
    expect(screen.getByText(/1 saved run/)).toBeInTheDocument();
    // No gamification words anywhere on the surface.
    expect(document.body.textContent).not.toMatch(/\bXP\b|\bpoints\b|\bstreak\b|\blevel \d/i);
  });
});
