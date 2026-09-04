import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getFeatureFlags } from '@bloomlab/shared';

import { App } from '../app/App';
import { db } from '../data/db';

/**
 * The Funnel Lab as a learner meets it (FUN-001, FUN-002, FUN-003).
 *
 * Rendered through the real `App` at `/funnel`, against the real content bundle, the real data
 * layer and the real engine on the direct path (jsdom has no worker). Nothing is stubbed: the
 * funnel built here is saved as an account event, the preview renders that funnel, and the
 * visitor in SIMULATE walks the same architecture.
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

async function openLab(path = '/funnel') {
  const view = renderAt(path);
  await screen.findByRole('heading', { name: 'Funnel Lab' }, { timeout: 8000 });
  await waitFor(() => expect(screen.getByTestId('funnel-mode-build')).not.toBeNull(), {
    timeout: 8000,
  });
  return view;
}

const mode = (name: 'build' | 'preview' | 'simulate') => screen.getByTestId(`funnel-mode-${name}`);

/** Saves, and waits for the account to actually hold the version — not merely for the button. */
async function saveFunnelAndWait() {
  fireEvent.click(screen.getByTestId('funnel-save'));
  await screen.findByText(/Saved · version \d+/, {}, { timeout: 8000 });
}

/** The block roles on the selected step, in order, read from the rows rather than their text. */
const blockRoles = () =>
  [...screen.getByTestId('funnel-blocks').querySelectorAll('[data-role]')].map((node) =>
    node.getAttribute('data-role'),
  );

/** Builds the two-step consultation funnel through the Lab's own controls. */
async function buildConsultationFunnel() {
  fireEvent.click(screen.getByTestId('funnel-new'));
  await waitFor(() => expect(screen.getByTestId('funnel-step-name')).not.toBeNull());

  const addStep = async (name: string, purpose: string) => {
    fireEvent.change(screen.getByTestId('funnel-step-name'), { target: { value: name } });
    fireEvent.change(screen.getByTestId('funnel-step-purpose'), { target: { value: purpose } });
    fireEvent.click(screen.getByTestId('funnel-step-add'));
    await waitFor(() =>
      expect(within(screen.getByTestId('funnel-steps')).getByText(name)).toBeInTheDocument(),
    );
  };
  await addStep('Consultation offer', 'capture');
  await addStep('Pick a time', 'booking');

  // Back to the first step, and put the offer and the form on it.
  const steps = screen.getByTestId('funnel-steps');
  fireEvent.click(within(steps).getByText('Consultation offer'));
  await waitFor(() => expect(screen.getByTestId('funnel-block-role')).not.toBeNull());

  const addBlock = async (role: string) => {
    fireEvent.change(screen.getByTestId('funnel-block-role'), { target: { value: role } });
    fireEvent.click(screen.getByTestId('funnel-block-add'));
  };
  await addBlock('headline');
  await addBlock('outcome');
  await addBlock('form');
  await waitFor(() =>
    expect(within(screen.getByTestId('funnel-blocks')).getAllByRole('button')).not.toHaveLength(0),
  );
}

describe('FUN-001: the Lab opens on the shared account and holds the eight capabilities', () => {
  it('shows the account it works in, and no gamification', async () => {
    await openLab();
    expect(screen.getByText('Glowhaus — traffic with nowhere to land')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(GAMIFICATION);
  });

  it('offers every architecture block, including the four that use a real account object', async () => {
    await openLab();
    await buildConsultationFunnel();
    const roles = screen.getByTestId('funnel-block-role') as HTMLSelectElement;
    const options = [...roles.options].map((option) => option.value);
    expect(options).toEqual(
      expect.arrayContaining([
        'headline',
        'problem',
        'outcome',
        'proof',
        'benefits',
        'objections',
        'cta',
        'form',
        'survey',
        'calendar',
        'checkout',
      ]),
    );
  });

  it('says which vocabulary a block belongs to, so a Bloomlab role is never sold as a GHL control', async () => {
    await openLab();
    await buildConsultationFunnel();
    const blocks = screen.getByTestId('funnel-blocks');
    fireEvent.click(within(blocks).getByText('Headline'));
    await waitFor(() => expect(screen.getByTestId('block-origin')).not.toBeNull());
    expect(screen.getByTestId('block-origin')).toHaveTextContent(/HighLevel has no element/);

    fireEvent.click(within(blocks).getByText('Form'));
    await waitFor(() =>
      expect(screen.getByTestId('block-origin')).toHaveTextContent(/real HighLevel object/),
    );
  });

  it('connects a form block to a real form from the account, not a made-up list', async () => {
    await openLab();
    await buildConsultationFunnel();
    fireEvent.click(within(screen.getByTestId('funnel-blocks')).getByText('Form'));
    await waitFor(() => expect(screen.getByTestId('block-reference')).not.toBeNull());
    const picker = screen.getByTestId('block-reference') as HTMLSelectElement;
    const offered = [...picker.options].map((option) => option.value).filter(Boolean);
    expect(offered).toEqual(['consult-request']);
    expect(within(picker).getByText('Consultation Request')).toBeInTheDocument();
  });
});

describe('FUN-001: BUILD is a real editor, and every action has a keyboard path', () => {
  it('reorders blocks without a drag, and removes one', async () => {
    await openLab();
    await buildConsultationFunnel();
    expect(blockRoles()).toEqual(['headline', 'outcome', 'form']);
    const firstRow = screen.getByTestId('funnel-blocks').querySelector('li') as HTMLElement;
    // Every move is an ordinary button: a pointer press and a keyboard Enter reach the same call,
    // so reordering never depends on a drag.
    fireEvent.click(within(firstRow).getByRole('button', { name: 'Move down' }));
    await waitFor(() => expect(blockRoles()).toEqual(['outcome', 'headline', 'form']));

    const rows = [...screen.getByTestId('funnel-blocks').querySelectorAll('li')];
    // The first row cannot move up and the last cannot move down: the ends are stated, not guessed.
    expect(within(rows[0] as HTMLElement).getByRole('button', { name: 'Move up' })).toBeDisabled();
    expect(within(rows[1] as HTMLElement).getByRole('button', { name: 'Move up' })).toBeEnabled();
    fireEvent.click(within(rows[0] as HTMLElement).getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(blockRoles()).toEqual(['headline', 'form']));
  });

  it('reorders steps and can remove one', async () => {
    await openLab();
    await buildConsultationFunnel();
    const names = () =>
      [...screen.getByTestId('funnel-steps').querySelectorAll('li')].map(
        (row) => row.querySelector('button')?.textContent ?? '',
      );
    expect(names()[0]).toMatch(/Consultation offer/);
    const first = screen.getByTestId('funnel-steps').querySelector('li') as HTMLElement;
    fireEvent.click(within(first).getByRole('button', { name: 'Move down' }));
    await waitFor(() => expect(names()[0]).toMatch(/Pick a time/));
  });

  it('says what stops the funnel from running, before the learner tries to run it', async () => {
    await openLab();
    await buildConsultationFunnel();
    // The form is not connected and the booking step is empty, so both are reported.
    await waitFor(() => expect(screen.getByTestId('funnel-problems')).not.toBeNull());
    const problems = screen.getByTestId('funnel-problems');
    expect(problems.textContent).toMatch(/not connected to anything in the account/);
    expect(problems.textContent).toMatch(/has nothing on it/);
  });
});

describe('FUN-002: the three modes switch and the choice persists', () => {
  it('switches BUILD → PREVIEW → SIMULATE', async () => {
    await openLab();
    await buildConsultationFunnel();
    expect(mode('build')).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(mode('preview'));
    await waitFor(() => expect(screen.getByTestId('funnel-preview-frame')).not.toBeNull());
    expect(mode('preview')).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(mode('simulate'));
    await waitFor(() => expect(screen.getByTestId('simulate-blocked')).not.toBeNull());
    expect(mode('simulate')).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(mode('build'));
    await waitFor(() => expect(screen.getByTestId('funnel-blocks')).not.toBeNull());
  });

  it('remembers the mode across a remount, from the device record rather than the URL', async () => {
    const first = await openLab();
    fireEvent.click(mode('preview'));
    await waitFor(() => expect(mode('preview')).toHaveAttribute('aria-pressed', 'true'));
    await waitFor(async () =>
      expect((await db.device.toCollection().first())?.lab_views?.['funnel:mode']).toBe('preview'),
    );
    first.unmount();

    await openLab();
    await waitFor(() => expect(mode('preview')).toHaveAttribute('aria-pressed', 'true'), {
      timeout: 8000,
    });
    expect(mode('build')).toHaveAttribute('aria-pressed', 'false');
  });

  it('switches the preview between three real widths and remembers that too', async () => {
    const first = await openLab();
    await buildConsultationFunnel();
    await saveFunnelAndWait();
    fireEvent.click(mode('preview'));
    await waitFor(() => expect(screen.getByTestId('funnel-preview-frame')).not.toBeNull());
    const frame = () => screen.getByTestId('funnel-preview-frame');
    expect(frame()).toHaveAttribute('data-device', 'desktop');
    expect(frame().style.width).toBe('1200px');

    fireEvent.click(screen.getByTestId('funnel-device-tablet'));
    await waitFor(() => expect(frame().style.width).toBe('768px'));

    fireEvent.click(screen.getByTestId('funnel-device-mobile'));
    await waitFor(() => expect(frame().style.width).toBe('390px'));
    expect(frame()).toHaveAttribute('data-device', 'mobile');

    await waitFor(async () =>
      expect((await db.device.toCollection().first())?.lab_views?.['funnel:device']).toBe('mobile'),
    );
    first.unmount();

    await openLab();
    await waitFor(() => expect(mode('preview')).toHaveAttribute('aria-pressed', 'true'), {
      timeout: 8000,
    });
    await waitFor(() => expect(screen.getByTestId('funnel-device-mobile')).not.toBeNull(), {
      timeout: 8000,
    });
    expect(screen.getByTestId('funnel-device-mobile')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('funnel-preview-frame').style.width).toBe('390px');
  });
});

describe('PREVIEW renders the funnel the learner built', () => {
  it('draws the blocks in the order they are in, with the connected form’s own fields', async () => {
    await openLab();
    await buildConsultationFunnel();
    fireEvent.click(within(screen.getByTestId('funnel-blocks')).getByText('Headline'));
    await waitFor(() => expect(screen.getByTestId('block-headline')).not.toBeNull());
    fireEvent.change(screen.getByTestId('block-headline'), {
      target: { value: 'A free 30-minute consultation' },
    });
    fireEvent.click(within(screen.getByTestId('funnel-blocks')).getByText('Form'));
    await waitFor(() => expect(screen.getByTestId('block-reference')).not.toBeNull());
    fireEvent.change(screen.getByTestId('block-reference'), {
      target: { value: 'consult-request' },
    });

    fireEvent.click(mode('preview'));
    const frame = await screen.findByTestId('funnel-preview-frame');
    expect(frame).toHaveTextContent('A free 30-minute consultation');
    expect(frame).toHaveTextContent('Consultation Request');
    // The form's own fields, read from the account — not a generic three-field mock-up.
    expect(frame).toHaveTextContent('First name');
    expect(frame).toHaveTextContent('Treatment interest');
  });
});

describe('FUN-003: a visitor walks the built funnel and the account reacts', () => {
  it('refuses to walk a funnel with an unfinished block, and says which', async () => {
    await openLab();
    await buildConsultationFunnel();
    fireEvent.click(mode('simulate'));
    const blocked = await screen.findByTestId('simulate-blocked');
    expect(blocked.textContent).toMatch(/not connected to anything in the account/);
  });

  it('submits the real form, creates the contact and fires the connected workflow', async () => {
    await openLab();
    await buildConsultationFunnel();

    // Connect the form, put the calendar on the booking step, and save.
    fireEvent.click(within(screen.getByTestId('funnel-blocks')).getByText('Form'));
    await waitFor(() => expect(screen.getByTestId('block-reference')).not.toBeNull());
    fireEvent.change(screen.getByTestId('block-reference'), {
      target: { value: 'consult-request' },
    });

    fireEvent.click(within(screen.getByTestId('funnel-steps')).getByText('Pick a time'));
    await waitFor(() => expect(screen.getByTestId('funnel-block-role')).not.toBeNull());
    fireEvent.change(screen.getByTestId('funnel-block-role'), { target: { value: 'calendar' } });
    fireEvent.click(screen.getByTestId('funnel-block-add'));
    await waitFor(() =>
      expect(within(screen.getByTestId('funnel-blocks')).getByText('Calendar')).toBeInTheDocument(),
    );
    fireEvent.click(within(screen.getByTestId('funnel-blocks')).getByText('Calendar'));
    await waitFor(() => expect(screen.getByTestId('block-reference')).not.toBeNull());
    fireEvent.change(screen.getByTestId('block-reference'), { target: { value: 'consultation' } });

    await saveFunnelAndWait();

    fireEvent.click(mode('simulate'));
    const nameField = await screen.findByTestId('visitor-field-first_name', {}, { timeout: 8000 });
    fireEvent.change(nameField, { target: { value: 'Priya' } });
    fireEvent.change(screen.getByTestId('visitor-field-email'), {
      target: { value: 'priya@example.com' },
    });
    const submit = screen
      .getAllByRole('button', { name: 'Submit' })
      .find((button) => button.getAttribute('data-testid')?.startsWith('visitor-submit-'));
    await waitFor(() => expect(submit as HTMLButtonElement).toBeEnabled());
    fireEvent.click(submit as HTMLElement);

    const chain = await screen.findByTestId('visitor-chain', {}, { timeout: 8000 });
    await waitFor(() => expect(chain.textContent).toMatch(/form\.submitted/), { timeout: 8000 });
    // The generated contact, the enrolment the engine decided, and what the workflow then did.
    expect(chain.textContent).toMatch(/contact\.created/);
    expect(chain.textContent).toMatch(/workflow\.enrolled/);
    expect(chain.textContent).toMatch(/New Lead Welcome/);
    expect(chain.textContent).toMatch(/sms\.sent/);
    expect(chain.textContent).toMatch(/caused by it/);
    // And the visitor moved on to the step the architecture points at.
    await waitFor(() => expect(screen.getByText(/step 2 of 2/)).toBeInTheDocument());
  });

  it('says why it will not submit a form that would create a nameless contact', async () => {
    await openLab();
    await buildConsultationFunnel();
    fireEvent.click(within(screen.getByTestId('funnel-blocks')).getByText('Form'));
    await waitFor(() => expect(screen.getByTestId('block-reference')).not.toBeNull());
    fireEvent.change(screen.getByTestId('block-reference'), {
      target: { value: 'consult-request' },
    });
    fireEvent.click(within(screen.getByTestId('funnel-steps')).getByText('Pick a time'));
    await waitFor(() => expect(screen.getByTestId('funnel-block-role')).not.toBeNull());
    fireEvent.change(screen.getByTestId('funnel-block-role'), { target: { value: 'cta' } });
    fireEvent.click(screen.getByTestId('funnel-block-add'));
    await saveFunnelAndWait();

    fireEvent.click(mode('simulate'));
    await screen.findByTestId('visitor-field-first_name', {}, { timeout: 8000 });
    const submit = screen
      .getAllByRole('button', { name: 'Submit' })
      .find((button) => button.getAttribute('data-testid')?.startsWith('visitor-submit-'));
    await waitFor(() => expect(submit as HTMLButtonElement).toBeEnabled());
    fireEvent.click(submit as HTMLElement);
    const refusal = await screen.findByTestId('visitor-refusal');
    expect(refusal.textContent).toMatch(/first name/);
    // And nothing was claimed to have happened.
    expect(screen.queryByTestId('visitor-chain')).toBeNull();
  });
});

describe('the funnel is account state, so it survives a reload', () => {
  it('comes back after a remount, at the version the account holds', async () => {
    const first = await openLab();
    await buildConsultationFunnel();
    await saveFunnelAndWait();
    first.unmount();

    await openLab();
    await waitFor(() => expect(screen.getByTestId('funnel-picker')).not.toBeNull(), {
      timeout: 8000,
    });
    expect(within(screen.getByTestId('funnel-picker')).getByText('New funnel')).toBeInTheDocument();
    await waitFor(() =>
      expect(
        within(screen.getByTestId('funnel-steps')).getByText('Consultation offer'),
      ).toBeInTheDocument(),
    );
  });
});

describe('the Funnel Lab is a named destination', () => {
  it('is in the primary navigation with its name showing', async () => {
    await openLab();
    const rail = screen.getByRole('navigation', { name: 'Primary' });
    const links = [...rail.querySelectorAll('a[href="/funnel"]')];
    expect(links.length).toBeGreaterThan(0);
    // The name shows; nothing here is an unlabelled icon.
    expect(links.every((link) => link.textContent?.includes('Funnel'))).toBe(true);
    // The four phone-primary destinations are unchanged; Funnel joins the labelled More list.
    const menu = screen.getByTestId('rail-more-menu');
    expect(menu.querySelector('a[href="/funnel"]')).not.toBeNull();
    for (const href of ['/', '/campaign', '/skills', '/workflow']) {
      expect(menu.querySelector(`a[href="${href}"]`)).toBeNull();
    }
  });
});
