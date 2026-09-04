import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getFeatureFlags } from '@bloomlab/shared';

import type { SimulatorScenario, Workflow } from '@bloomlab/simulator-core';

import { App } from '../app/App';
import { content } from '../content/bundle';
import { db } from '../data/db';
import { listRuns, loadRun, startRun } from '../simulator/store';
import { blankWorkflow, saveWorkflow } from './commands';

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

const scenario = (content.scenarios as unknown as SimulatorScenario[]).find(
  (row) => row.id === 'SC-glowhaus-no-show',
) as SimulatorScenario;

/** A recovery that listens to Appointment Status and admits only no-shows. */
const noShowOnly = (): Workflow => ({
  ...blankWorkflow('wf-no-show-only', 'No-show only'),
  trigger: {
    ghl_feature_id: 'GHL-WF-APPOINTMENT-STATUS',
    filters: [{ field: 'appointment_status', operator: 'is', value: 'no_show' }],
  },
  nodes: [
    {
      id: 'n1',
      type: 'action',
      ghl_feature_id: 'GHL-WF-SEND-SMS',
      label: null,
      position: { x: 0, y: 0 },
      config: { template: 'Sorry we missed you, {{contact.first_name}}.', purpose: 'rebooking' },
    },
    {
      id: 'n2',
      type: 'end',
      ghl_feature_id: null,
      label: null,
      config: {},
      position: { x: 0, y: 1 },
    },
  ],
  edges: [{ from: 'n1', to: 'n2', branch: null }],
});

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

/** Every node's shown status, so two presentations of one run can be compared. */
const statuses = () =>
  Object.fromEntries(
    [...document.querySelectorAll('[data-node]')].map((el) => [
      el.getAttribute('data-node'),
      el.getAttribute('data-status'),
    ]),
  );

describe('the default test fires the trigger and the engine decides (WFL-004)', () => {
  it('books Maria through Customer Booked Appointment, enrols her by the trigger, and plays the trace', async () => {
    await openLab();
    const test = screen.getByTestId('test-panel');
    fireEvent.change(within(test).getByLabelText('Test contact'), { target: { value: 'maria' } });
    const triggerTest = within(test).getByTestId('trigger-test');
    expect(triggerTest).toHaveTextContent('Customer Booked Appointment');
    expect(triggerTest).toHaveTextContent('The engine decides whether the event matches');
    fireEvent.click(within(test).getByTestId('run-test'));
    const outcome = await screen.findByTestId('trigger-outcome', {}, { timeout: 8000 });
    expect(outcome).toHaveAttribute('data-outcome', 'enrolled');
    expect(outcome).toHaveTextContent('Customer Booked Appointment fired and enrolled Maria');

    const timeline = screen.getByTestId('timeline');
    await waitFor(
      () =>
        expect(
          within(timeline).getByText(/Enrolled by Customer Booked Appointment/),
        ).toBeInTheDocument(),
      { timeout: 8000 },
    );
    // The trigger row says what it matched on; nothing says "started by hand".
    expect(within(timeline).getByText(/calendar: consultation/)).toBeInTheDocument();
    expect(within(timeline).queryByText(/Started at the first step/)).toBeNull();
    // The first execution plays on its own (WFL-012): the panel is playing and a row is current.
    await waitFor(() => expect(timeline).toHaveAttribute('data-playing', 'true'));
    await waitFor(() =>
      expect(timeline.querySelector('ol li[data-current="true"]')).not.toBeNull(),
    );
    // Nothing beyond the playhead is revealed while it plays: the End step waits its turn.
    expect(node('n3')).not.toHaveAttribute('data-status', 'done');
    expect(within(timeline).getByRole('button', { name: 'Pause playback' })).toBeInTheDocument();

    // Skipping only moves the highlight; the account was already what the engine made it.
    fireEvent.click(within(timeline).getByTestId('skip-playback'));
    await waitFor(() => expect(timeline).not.toHaveAttribute('data-playing'));
    const rows = timeline.querySelectorAll('ol li');
    expect(rows[rows.length - 1]).toHaveAttribute('data-current', 'true');
    expect(within(timeline).getByText(/Send SMS done/)).toBeInTheDocument();
    expect(within(timeline).getByText(/Add Contact Tag done/)).toBeInTheDocument();
    expect(within(timeline).getByText(/Run completed/)).toBeInTheDocument();
    const skipped = statuses();
    expect(skipped.n1).toBe('done');
    expect(skipped.n3).toBe('done');
    // Replay is still there afterwards, and walking the whole trace ends in the same picture.
    fireEvent.click(within(timeline).getByRole('button', { name: 'Replay the run step by step' }));
    await waitFor(() => expect(timeline).toHaveAttribute('data-playing', 'true'));
    await waitFor(() => expect(timeline).not.toHaveAttribute('data-playing'), { timeout: 15000 });
    expect(statuses()).toEqual(skipped);
    expect(screen.queryByRole('alert')).toBeNull();
  }, 30000);

  it('the rows played are exactly the execution records the engine wrote for that run', async () => {
    await openLab();
    const test = screen.getByTestId('test-panel');
    fireEvent.change(within(test).getByLabelText('Test contact'), { target: { value: 'maria' } });
    fireEvent.click(within(test).getByTestId('run-test'));
    await screen.findByTestId('trigger-outcome', {}, { timeout: 8000 });
    const timeline = screen.getByTestId('timeline');
    await waitFor(() => expect(timeline.querySelectorAll('ol li').length).toBeGreaterThan(0));
    const projects = await listRuns();
    const newest = projects.sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0]!;
    const run = (await loadRun(newest.id))!;
    const watched = Object.values(run.state.account.workflow_runs).find(
      (row) => row.workflow_id === 'wf-booking-confirmation' && row.contact_id === 'maria',
    )!;
    const records = run.state.execution.filter((row) => row.workflow_run_id === watched.id);
    expect(timeline.querySelectorAll('ol li')).toHaveLength(records.length);
    expect(records[0]).toMatchObject({ kind: 'trigger', data: { enrolled_by: 'trigger' } });
  });

  it('starting at the first step is labelled as such and never reads as the trigger firing', async () => {
    await openLab();
    const test = screen.getByTestId('test-panel');
    fireEvent.change(within(test).getByLabelText('Test contact'), { target: { value: 'maria' } });
    fireEvent.click(within(test).getByTestId('start-first-step'));
    const outcome = await screen.findByTestId('trigger-outcome', {}, { timeout: 8000 });
    expect(outcome).toHaveAttribute('data-outcome', 'direct');
    expect(outcome).toHaveTextContent('The trigger was not fired');
    const timeline = screen.getByTestId('timeline');
    await waitFor(
      () =>
        expect(
          within(timeline).getByText(/Started at the first step \(test\)/),
        ).toBeInTheDocument(),
      { timeout: 8000 },
    );
    expect(
      within(timeline).getByText(/Customer Booked Appointment was not fired/),
    ).toBeInTheDocument();
    expect(within(timeline).queryByText(/Enrolled by/)).toBeNull();
  });

  it('Appointment Status filtered to no-shows ignores a cancellation and enrols on a no-show', async () => {
    // A saved recovery workflow, made before the Lab opens, so the Lab resumes that account.
    let seeded = await startRun(scenario);
    seeded = (await saveWorkflow(seeded, scenario, noShowOnly(), { createWorker: null })) as never;
    await openLab('/workflow?workflow=wf-no-show-only');
    const test = screen.getByTestId('test-panel');
    fireEvent.change(within(test).getByLabelText('Test contact'), { target: { value: 'maria' } });
    const triggerTest = within(test).getByTestId('trigger-test');
    expect(triggerTest).toHaveTextContent('filters: appointment status is no_show');
    fireEvent.change(within(triggerTest).getByLabelText('What happens'), {
      target: { value: 'APPOINTMENT_STATUS_CHANGED' },
    });
    fireEvent.change(within(triggerTest).getByLabelText('New status'), {
      target: { value: 'cancelled' },
    });
    fireEvent.click(within(test).getByTestId('run-test'));
    let outcome = await screen.findByTestId('trigger-outcome', {}, { timeout: 8000 });
    expect(outcome).toHaveAttribute('data-outcome', 'not_enrolled');
    expect(outcome).toHaveTextContent(
      'Appointment Status did not enrol Maria: the filters (appointment status is no_show) did not match',
    );
    expect(within(screen.getByTestId('timeline')).getByText(/No run yet/)).toBeInTheDocument();

    // Book her again (the cancelled one is gone as a live appointment) and no-show it.
    fireEvent.change(within(triggerTest).getByLabelText('What happens'), {
      target: { value: 'APPOINTMENT_BOOKED' },
    });
    expect(screen.queryByTestId('trigger-outcome')).not.toBeNull();
    fireEvent.click(within(test).getByTestId('run-test'));
    // The booking is a fresh event: the previous outcome clears, then the trigger reports again.
    await waitFor(() => expect(screen.queryByTestId('trigger-outcome')).toBeNull());
    await waitFor(
      () => expect(screen.getByTestId('trigger-outcome')).toHaveTextContent('did not enrol'),
      { timeout: 8000 },
    );
    expect(screen.queryByRole('alert')?.textContent ?? '').toBe('');
    fireEvent.change(within(triggerTest).getByLabelText('What happens'), {
      target: { value: 'APPOINTMENT_STATUS_CHANGED' },
    });
    const appointmentField = within(triggerTest).getByLabelText('Appointment') as HTMLSelectElement;
    const booked = [...appointmentField.options].find((option) => option.text.includes('booked'))!;
    fireEvent.change(appointmentField, { target: { value: booked.value } });
    fireEvent.change(within(triggerTest).getByLabelText('New status'), {
      target: { value: 'no_show' },
    });
    fireEvent.click(within(test).getByTestId('run-test'));
    await waitFor(
      () =>
        expect(screen.getByTestId('trigger-outcome')).toHaveAttribute('data-outcome', 'enrolled'),
      { timeout: 8000 },
    );
    outcome = screen.getByTestId('trigger-outcome');
    expect(outcome).toHaveTextContent('Appointment Status fired and enrolled Maria');
    const timeline = screen.getByTestId('timeline');
    await waitFor(() =>
      expect(within(timeline).getByText(/Enrolled by Appointment Status/)).toBeInTheDocument(),
    );
    expect(within(timeline).getByText(/appointment status: no_show/)).toBeInTheDocument();
    void seeded;
  }, 30000);
});

describe('reduced motion shows the whole trace at once (WFL-012, MOT-002)', () => {
  const original = window.matchMedia;
  beforeEach(() => {
    window.matchMedia = ((query: string) =>
      ({
        matches: query.includes('prefers-reduced-motion'),
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

  it('the first test presents the final trace without travel, and the picture matches a played run', async () => {
    await openLab();
    const test = screen.getByTestId('test-panel');
    fireEvent.change(within(test).getByLabelText('Test contact'), { target: { value: 'maria' } });
    fireEvent.click(within(test).getByTestId('run-test'));
    await screen.findByTestId('trigger-outcome', {}, { timeout: 8000 });
    const timeline = screen.getByTestId('timeline');
    await waitFor(() => expect(timeline.querySelectorAll('ol li').length).toBeGreaterThan(0));
    expect(timeline).not.toHaveAttribute('data-playing');
    const rows = timeline.querySelectorAll('ol li');
    expect(rows[rows.length - 1]).toHaveAttribute('data-current', 'true');
    expect(statuses()).toMatchObject({ n1: 'done', n2: 'done', n3: 'done' });
    expect(
      within(timeline).getByRole('button', { name: 'Replay the run step by step' }),
    ).toBeInTheDocument();
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
