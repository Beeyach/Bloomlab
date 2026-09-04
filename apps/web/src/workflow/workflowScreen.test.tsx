import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getFeatureFlags } from '@bloomlab/shared';

import { App } from '../app/App';
import { db } from '../data/db';

/**
 * The Workflow Lab as a learner meets it (WFL-001, WFL-002, WFL-004, WFL-005, WFL-011).
 *
 * Rendered through the real `App` at `/workflow`, against the real content bundle, the real data
 * layer and the real engine on the direct path (jsdom has no worker). The scenario's authored
 * Booking Confirmation is the workflow the Lab opens; the test edits it, saves, runs Maria through
 * it, and reads the execution the engine produced.
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
});

afterEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
});

async function openLab(path = '/workflow') {
  const view = renderAt(path);
  await screen.findByText('Account time', {}, { timeout: 8000 });
  await waitFor(() => expect(document.querySelector('[data-node="trigger"]')).not.toBeNull(), {
    timeout: 8000,
  });
  return view;
}

const node = (id: string) => document.querySelector(`[data-node="${id}"]`) as HTMLElement | null;

describe('the Workflow Lab opens on the real account (WFL-001)', () => {
  it('shows the authored workflow as nodes, with real feature names and one config line each', async () => {
    await openLab();
    expect(node('trigger')).toHaveTextContent('Customer Booked Appointment');
    expect(node('n1')).toHaveTextContent('Send SMS');
    expect(node('n1')).toHaveTextContent(/booked at Glowhaus/);
    expect(node('n2')).toHaveTextContent('Add Contact Tag');
    expect(node('n2')).toHaveTextContent('booked');
    expect(node('n3')).toHaveTextContent('End');
    expect(document.body.textContent).not.toMatch(GAMIFICATION);
  });

  it('generates the palette from the registry and never makes a non-running feature look runnable', async () => {
    await openLab();
    const palette = screen.getByTestId('palette');
    expect(within(palette).getByText('Send SMS')).toBeInTheDocument();
    expect(within(palette).getByText('If/Else')).toBeInTheDocument();
    const goal = palette.querySelector('[data-palette="GHL-WF-GOAL-EVENT"]') as HTMLElement;
    expect(goal).toHaveAttribute('data-runnable', 'false');
    expect(within(goal).getByText('Practised in GHL')).toBeInTheDocument();
    expect(within(goal).queryByRole('button', { name: 'Add' })).toBeNull();
  });
});

describe('editing is drafts, saving is an event (WFL-002)', () => {
  it('adds a step, undoes and redoes it, saves it as a new version, and shows the version in history', async () => {
    await openLab();
    fireEvent.click(node('n2') as HTMLElement);
    const palette = screen.getByTestId('palette');
    const wait = palette.querySelector('[data-palette="GHL-WF-WAIT"]') as HTMLElement;
    fireEvent.click(within(wait).getByRole('button', { name: 'Add' }));
    await waitFor(() => expect(node('n4')).not.toBeNull());
    expect(node('n4')).toHaveTextContent('Wait');
    expect(screen.getByText('Unsaved draft')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('undo'));
    await waitFor(() => expect(node('n4')).toBeNull());
    fireEvent.click(screen.getByTestId('redo'));
    await waitFor(() => expect(node('n4')).not.toBeNull());

    fireEvent.click(screen.getByTestId('save'));
    await waitFor(() => expect(screen.queryByText('Unsaved draft')).toBeNull(), { timeout: 8000 });
    const history = screen.getByTestId('history');
    expect(within(history).getByText(/Version 2 · updated · 4 steps/)).toBeInTheDocument();
  });
});

describe('a test contact runs through the engine (WFL-004)', () => {
  it('runs Maria, lights the nodes and lists what the engine recorded', async () => {
    await openLab();
    const test = screen.getByTestId('test-panel');
    fireEvent.change(within(test).getByLabelText('Test contact'), { target: { value: 'maria' } });
    fireEvent.click(within(test).getByTestId('run-test'));
    const timeline = screen.getByTestId('timeline');
    await waitFor(
      () =>
        expect(
          within(timeline).getByText(/Enrolled by Customer Booked Appointment/),
        ).toBeInTheDocument(),
      {
        timeout: 8000,
      },
    );
    expect(within(timeline).getByText(/Send SMS done/)).toBeInTheDocument();
    expect(within(timeline).getByText(/Add Contact Tag done/)).toBeInTheDocument();
    expect(within(timeline).getByText(/Run completed/)).toBeInTheDocument();
    expect(node('n1')).toHaveAttribute('data-status', 'done');
    expect(node('n3')).toHaveAttribute('data-status', 'done');
    // A refusal never appears for a good run, and the account moved: one more run.
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('on a phone the Lab is a vertical step editor (WFL-006, RSP-004)', () => {
  const original = window.matchMedia;
  beforeEach(() => {
    window.matchMedia = ((query: string) =>
      ({
        matches: query.includes('max-width: 767px'),
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList) as typeof window.matchMedia;
  });
  afterEach(() => {
    window.matchMedia = original;
  });

  it('lists the steps in order, opens a step in a sheet, and adds from a sheet palette', async () => {
    await openLab();
    const list = screen.getByRole('list', { name: 'Workflow steps, in order' });
    expect(within(list).getAllByRole('button').length).toBeGreaterThanOrEqual(4);
    expect(screen.queryByTestId('workflow-canvas')).toBeNull();
    fireEvent.click(node('n1') as HTMLElement);
    const inspector = await screen.findByTestId('inspector');
    expect((within(inspector).getByLabelText(/template/) as HTMLTextAreaElement).value).toContain(
      'booked at Glowhaus',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add step' }));
    expect(await screen.findByTestId('palette')).toBeInTheDocument();
    // The test, timeline and history are tabs rather than a second column.
    expect(screen.getByRole('tab', { name: 'Timeline' })).toBeInTheDocument();
  });
});
