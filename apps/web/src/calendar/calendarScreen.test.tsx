import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getFeatureFlags } from '@bloomlab/shared';

import { App } from '../app/App';
import { db } from '../data/db';

/**
 * The Calendar Lab as a learner meets it (CAL-001, CAL-003).
 *
 * Rendered through the real `App` at `/calendar`, against the real content bundle, the real data
 * layer and the real engine on the direct path (jsdom has no worker). Nothing is stubbed: the
 * settings changed here are saved as an account event, the schedule redraws from the engine's own
 * answer, and booking, confirming and cancelling put real events through the shared run.
 */

const flags = getFeatureFlags('production');

const GAMIFICATION = /\bXP\b|\bstars?\b|\blevel \d|\bpoints\b|\bstreak\b/i;

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <App flags={flags} />
    </MemoryRouter>,
  );

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
  await db.device.put({
    device_id: 'device-1',
    learner_id: 'local:test',
    label: 'Test device',
    created_at: '2026-09-08T09:00:00Z',
    last_seen_at: '2026-09-08T09:00:00Z',
    storage_persisted: null,
  });
});

afterEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
});

async function openLab(path = '/calendar') {
  const view = renderAt(path);
  await screen.findByRole('heading', { name: 'Calendar Lab' }, { timeout: 8000 });
  await waitFor(() => expect(screen.getByTestId('calendar-week')).not.toBeNull(), {
    timeout: 8000,
  });
  return view;
}

/** Saves, and waits for the account to hold the new version — not merely for the button. */
async function saveAndWait() {
  fireEvent.click(screen.getByTestId('calendar-save'));
  await screen.findByText(/Saved · version \d+/, {}, { timeout: 8000 });
}

const slotTimes = () =>
  [...screen.getByTestId('calendar-week').querySelectorAll('[data-testid^="slot-"]')].map((node) =>
    node.getAttribute('data-testid')?.slice('slot-'.length),
  );

describe('the Lab opens on the shared account', () => {
  it('shows the scenario’s calendar, its schedule and what is already booked', async () => {
    await openLab();
    expect(screen.getByTestId('calendar-picker')).toHaveValue('consultation');
    expect(screen.getByTestId('calendar-summary').textContent).toContain('30 minutes');
    expect(screen.getByTestId('calendar-summary').textContent).toContain('no buffer');
    // Nadia and Marcus are already in the diary, drawn on the day they are on.
    expect(screen.getByTestId('appointment-appt-nadia')).not.toBeNull();
    expect(screen.getByTestId('appointment-appt-marcus')).not.toBeNull();
    expect(slotTimes()).toContain('2026-09-08T09:00:00-05:00');
  });

  it('says nothing about points, stars or levels', async () => {
    await openLab();
    expect(document.body.textContent ?? '').not.toMatch(GAMIFICATION);
  });
});

describe('CAL-001: a setting changes the schedule under your hands', () => {
  it('hides what is too soon once minimum notice is set', async () => {
    await openLab();
    expect(slotTimes()).toContain('2026-09-08T09:00:00-05:00');
    fireEvent.click(screen.getByTestId('group-availability'));
    fireEvent.change(screen.getByTestId('calendar-notice'), { target: { value: '240' } });
    expect(screen.getByTestId('calendar-save-state').textContent).toBe('Unsaved changes');
    // Before the save the schedule still shows what the account would really offer, and says so.
    expect(screen.getByTestId('calendar-stale')).not.toBeNull();
    await saveAndWait();
    await waitFor(() => expect(slotTimes()).not.toContain('2026-09-08T09:00:00-05:00'));
    expect(slotTimes()).toContain('2026-09-08T13:00:00-05:00');
  });

  it('reports an impossible definition without pretending to save it', async () => {
    await openLab();
    fireEvent.click(screen.getByTestId('group-basics'));
    fireEvent.change(screen.getByTestId('calendar-duration'), { target: { value: '0' } });
    await waitFor(() =>
      expect(screen.getByTestId('calendar-issues').textContent).toContain('longer than nothing'),
    );
    expect(screen.getByTestId('booking-blocked')).not.toBeNull();
  });

  it('adds a second host and shows who the calendar picked, and why', async () => {
    await openLab();
    fireEvent.click(screen.getByTestId('group-basics'));
    fireEvent.change(screen.getByTestId('calendar-type'), { target: { value: 'round_robin' } });
    fireEvent.click(screen.getByTestId('group-staff'));
    fireEvent.change(screen.getByTestId('staff-add'), { target: { value: 'ivy' } });
    await saveAndWait();
    // Theo is with Nadia at 11:00, so that opening comes back as Ivy's.
    await waitFor(() => expect(slotTimes()).toContain('2026-09-08T11:00:00-05:00'));
    const eleven = screen.getByTestId('slot-2026-09-08T11:00:00-05:00');
    expect(eleven.textContent).toContain('Ivy Chen');
    fireEvent.click(eleven);
    expect(screen.getByTestId('chosen-slot').textContent).toContain('Ivy Chen');
    expect(screen.getByTestId('chosen-slot').textContent).toContain('the only one free');
  });
});

describe('CAL-003: the lifecycle puts real events through the shared engine', () => {
  it('books, confirms and cancels, and the account reacts each time', async () => {
    await openLab();

    fireEvent.click(screen.getByTestId('slot-2026-09-10T13:00:00-05:00'));
    fireEvent.change(screen.getByTestId('booking-contact'), { target: { value: 'soraya' } });
    expect(screen.getByTestId('booking-what').textContent).toContain('Theo Marsh');
    fireEvent.click(screen.getByTestId('booking-book'));

    await waitFor(() =>
      expect(screen.getByTestId('calendar-chain').textContent).toContain('appointment.booked'),
    );
    // The booking enrolled the reminder — through the trigger, not through anything this test did.
    expect(screen.getByTestId('calendar-chain').textContent).toContain('workflow.enrolled');
    expect(screen.getByTestId('calendar-chain').textContent).toContain('Consultation Reminder');

    const rows = [
      ...screen.getByTestId('appointments').querySelectorAll('[data-testid^="appointment-row-"]'),
    ];
    const soraya = rows.find((node) => node.textContent?.includes('Soraya')) as HTMLElement;
    expect(soraya).toBeTruthy();
    const id = soraya.getAttribute('data-testid')?.slice('appointment-row-'.length) as string;

    fireEvent.click(screen.getByTestId(`appointment-row-${id}`));
    fireEvent.click(screen.getByTestId(`confirm-${id}`));
    await waitFor(() =>
      expect(screen.getByTestId('calendar-chain').textContent).toContain(
        'appointment.status_changed',
      ),
    );

    fireEvent.click(screen.getByTestId(`cancel-${id}`));
    await waitFor(() =>
      expect(screen.getByTestId('calendar-chain').textContent).toContain('appointment.cancelled'),
    );
    // A cancellation starts the recovery workflow, which is the whole of D-131.
    expect(screen.getByTestId('calendar-chain').textContent).toContain('Cancellation Recovery');
    // And the time it held is offered again.
    await waitFor(() => expect(slotTimes()).toContain('2026-09-10T13:00:00-05:00'));
  });

  it('survives a reload with the calendar the learner saved', async () => {
    const first = await openLab();
    fireEvent.click(screen.getByTestId('group-availability'));
    fireEvent.change(screen.getByTestId('calendar-post-buffer'), { target: { value: '15' } });
    await saveAndWait();
    first.unmount();

    await openLab();
    fireEvent.click(screen.getByTestId('group-availability'));
    await waitFor(() => expect(screen.getByTestId('calendar-post-buffer')).toHaveValue(15));
    expect(screen.getByTestId('calendar-summary').textContent).toContain('15 after');
  });
});
