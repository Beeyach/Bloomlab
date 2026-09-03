import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getFeatureFlags } from '@bloomlab/shared';

import { App } from '../app/App';
import { db } from '../data/db';

/**
 * The CRM Lab as a learner meets it (CRM-001, CRM-003, CRM-004).
 *
 * Rendered through the real `App` at `/crm`, against the real content bundle and the real data
 * layer, so what is asserted is the screen a person actually gets rather than a component in a
 * harness. Nothing is mocked: the run is created by the Lab itself on first open.
 */

const flags = getFeatureFlags('production');

/** Never: points, levels, stars, streaks, XP (spec §70, §159). */
const GAMIFICATION = /\bXP\b|\bstars?\b|\blevel \d|\bpoints\b|\bstreak\b/i;
/** Never: a date lock (spec §7). */
const DATE_LOCK = /\bday \d+\b|locked until|unlocks on|available (on|from) \d/i;

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

/**
 * Opens the Lab and waits for the training account to be there.
 *
 * The account bar is the readiness signal rather than the heading, because the heading is also
 * rendered while the run is still being built. Contacts get one more wait, for the rows.
 */
async function openLab(path = '/crm') {
  const view = renderAt(path);
  await screen.findByText('Account time', {}, { timeout: 5000 });
  if (!path.includes('area=') || path.includes('area=contacts')) {
    await waitFor(() => expect(document.querySelector('[data-contact]')).not.toBeNull(), {
      timeout: 5000,
    });
  }
  return view;
}

const contactRow = (id: string) =>
  document.querySelector(`[data-contact="${id}"]`) as HTMLElement | null;

describe('the CRM Lab opens on the real account (CRM-001)', () => {
  it('lists the authored contacts, from the run and not from content', async () => {
    await openLab();
    expect(await screen.findByText('Maria Delgado')).toBeInTheDocument();
    expect(screen.getByText('Jordan Pike')).toBeInTheDocument();
    expect(screen.getByText('Aisha Bello')).toBeInTheDocument();
    expect(screen.getByText(/5 of 5 contacts/)).toBeInTheDocument();
  });

  it('says what is missing rather than leaving a gap', async () => {
    await openLab();
    const aisha = contactRow('aisha') as HTMLElement;
    expect(within(aisha).getByText('No phone')).toBeInTheDocument();
    expect(within(aisha).getByText('Unassigned')).toBeInTheDocument();
  });

  it('carries no gamification and no date lock', async () => {
    await openLab();
    expect(document.body.textContent).not.toMatch(GAMIFICATION);
    expect(document.body.textContent).not.toMatch(DATE_LOCK);
  });

  it('offers the three areas and switches between them', async () => {
    await openLab();
    const nav = screen.getByRole('navigation', { name: 'CRM areas' });
    fireEvent.click(within(nav).getByRole('button', { name: 'Setup' }));
    expect(await screen.findByRole('heading', { name: 'Custom fields' })).toBeInTheDocument();
    fireEvent.click(within(nav).getByRole('button', { name: 'Pipeline' }));
    expect(await screen.findByRole('list', { name: /Consultations stages/ })).toBeInTheDocument();
  });
});

describe('searching reads and never writes (CRM-001)', () => {
  it('filters the list without touching the account', async () => {
    await openLab();
    const before = await db.sim_events.count();
    fireEvent.change(screen.getByLabelText(/Search contacts/), { target: { value: 'jordan' } });
    await waitFor(() => expect(screen.getByText(/1 of 5 contacts/)).toBeInTheDocument());
    expect(screen.queryByText('Maria Delgado')).not.toBeInTheDocument();
    expect(await db.sim_events.count()).toBe(before);
  });

  it('says so plainly when nothing matches', async () => {
    await openLab();
    fireEvent.change(screen.getByLabelText(/Search contacts/), { target: { value: 'zzzz' } });
    expect(await screen.findByText('No contact matches that.')).toBeInTheDocument();
  });
});

describe('editing goes through the event path (CRM-001)', () => {
  it('opens a contact and shows the nine areas without nine cards', async () => {
    await openLab();
    fireEvent.click(contactRow('maria') as HTMLElement);
    expect(await screen.findByRole('button', { name: 'Activity' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Notes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tasks' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Tags' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Custom fields' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Opportunities' })).toBeInTheDocument();
  });

  it('adds a tag as a simulator event', async () => {
    await openLab();
    fireEvent.click(contactRow('maria') as HTMLElement);
    await screen.findByRole('heading', { name: 'Tags' });
    fireEvent.change(screen.getByLabelText(/Add a tag/), { target: { value: 'from-the-lab' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add tag' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Remove tag from-the-lab' })).toBeInTheDocument(),
    );
    const events = await db.sim_events.toArray();
    expect(
      events.some((row) => (row.event as { type: string }).type === 'TAG_ADDED'),
    ).toBe(true);
  });

  it('sets do-not-disturb and records it', async () => {
    await openLab();
    fireEvent.click(contactRow('maria') as HTMLElement);
    await screen.findByText('Off');
    fireEvent.click(screen.getByRole('button', { name: 'Turn on' }));
    await waitFor(() =>
      expect(screen.getByText('On — no outbound messages')).toBeInTheDocument(),
    );
  });

  it('assigns an owner from the account’s own users', async () => {
    await openLab();
    fireEvent.click(contactRow('aisha') as HTMLElement);
    const owner = await screen.findByLabelText('Contact owner');
    expect(within(owner as HTMLSelectElement).getByText('Priya Raman')).toBeInTheDocument();
    fireEvent.change(owner, { target: { value: 'dana' } });
    await waitFor(() => expect((owner as HTMLSelectElement).value).toBe('dana'));
  });

  it('writes a note and shows it back', async () => {
    await openLab();
    fireEvent.click(contactRow('maria') as HTMLElement);
    fireEvent.click(await screen.findByRole('button', { name: 'Notes' }));
    fireEvent.change(await screen.findByLabelText(/New note/), {
      target: { value: 'Wrote this in the Lab.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add note' }));
    expect(await screen.findByText('Wrote this in the Lab.')).toBeInTheDocument();
  });

  it('creates a task and completes it', async () => {
    await openLab();
    fireEvent.click(contactRow('maria') as HTMLElement);
    fireEvent.click(await screen.findByRole('button', { name: 'Tasks' }));
    fireEvent.change(await screen.findByLabelText(/New task/), {
      target: { value: 'Ring back' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add task' }));
    await screen.findByText(/Ring back/);
    fireEvent.click(screen.getAllByRole('button', { name: 'Complete' })[0] as HTMLElement);
    await waitFor(() => expect(screen.getByText(/Ring back — done/)).toBeInTheDocument());
  });

  it('shows history that came out of the run', async () => {
    await openLab();
    fireEvent.click(contactRow('maria') as HTMLElement);
    await screen.findByRole('heading', { name: 'Tags' });
    fireEvent.change(screen.getByLabelText(/Add a tag/), { target: { value: 'traced' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add tag' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Remove tag traced' })).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Activity' }));
    expect(await screen.findByText('Tag added: traced')).toBeInTheDocument();
  });
});

describe('the pipeline moves without a drag (CRM-001, A11Y-004)', () => {
  it('renders the real deals in their stages', async () => {
    await openLab('/crm?area=pipeline');
    const board = await screen.findByRole('list', { name: /Consultations stages/ });
    expect(within(board).getByRole('heading', { name: 'Consult Booked' })).toBeInTheDocument();
    expect(document.querySelectorAll('[data-opportunity]').length).toBeGreaterThan(0);
  });

  it('moves a stage from a picker, which a keyboard can reach', async () => {
    await openLab('/crm?area=pipeline');
    fireEvent.click(document.querySelector('[data-opportunity="opp-maria"]') as HTMLElement);
    const stage = await screen.findByLabelText('Stage');
    expect((stage as HTMLSelectElement).value).toBe('Consult Booked');
    fireEvent.change(stage, { target: { value: 'Consult Done' } });
    await waitFor(() => expect((stage as HTMLSelectElement).value).toBe('Consult Done'));
  });

  it('lets an opportunity owner differ from the contact’s', async () => {
    await openLab('/crm?area=pipeline');
    fireEvent.click(document.querySelector('[data-opportunity="opp-maria"]') as HTMLElement);
    const owner = await screen.findByLabelText('Opportunity owner');
    fireEvent.change(owner, { target: { value: 'dana' } });
    await waitFor(() => expect((owner as HTMLSelectElement).value).toBe('dana'));
    const contact = await db.sim_projects.toArray();
    expect((contact[0]?.account as { contacts: Record<string, { owner_id: string }> })
      .contacts.maria?.owner_id).toBe('priya');
  });
});

describe('a refusal is shown, and nothing changes (CRM-001)', () => {
  it('states what was refused when a stage would strand deals', async () => {
    await openLab('/crm?area=setup');
    const stages = await screen.findByLabelText(/^Stages in Consultations/);
    fireEvent.change(stages, { target: { value: 'New Lead\nContacted\nWon\nLost' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save stages' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Bloomlab refused that change.');
    expect(alert).toHaveTextContent(/Consult Booked/);
  });
});

describe('setup defines the structure (CRM-001, CRM-003)', () => {
  it('defines a custom field that then appears on a contact', async () => {
    await openLab('/crm?area=setup');
    fireEvent.change(await screen.findByLabelText(/^Label/), { target: { value: 'Budget band' } });
    fireEvent.change(screen.getByLabelText(/^Key/), { target: { value: 'budget_band' } });
    fireEvent.click(screen.getByRole('button', { name: 'Define field' }));
    await waitFor(() => expect(screen.getByText(/budget_band/)).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Contacts' }));
    fireEvent.click((await screen.findByText('Maria Delgado')).closest('button') as HTMLElement);
    expect(await screen.findByLabelText('Budget band')).toBeInTheDocument();
  });

  it('never tells the learner their modelling is wrong (CRM-003)', async () => {
    await openLab();
    fireEvent.click(contactRow('jordan') as HTMLElement);
    await screen.findByRole('heading', { name: 'Tags' });
    // Jordan carries three stale interest tags. Adding a fourth is allowed and unremarked.
    fireEvent.change(screen.getByLabelText(/Add a tag/), { target: { value: 'wants-peel' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add tag' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Remove tag wants-peel' })).toBeInTheDocument(),
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/should use|use a custom field instead|wrong/i);
  });
});
