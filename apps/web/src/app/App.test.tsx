import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { getFeatureFlags } from '@bloomlab/shared';

import { App } from './App';

const productionFlags = getFeatureFlags('production');
const localFlags = getFeatureFlags('local');

function renderAt(path: string, flags: typeof productionFlags) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App flags={flags} />
    </MemoryRouter>,
  );
}

function stubHealth(body: unknown, status = 200) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('App routing', () => {
  it('renders the Command Center at / inside the rail', async () => {
    renderAt('/', productionFlags);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'What should I do next?' }),
    ).toBeInTheDocument();
    const rail = screen.getByRole('navigation', { name: 'Primary' });
    expect(within(rail).getByRole('link', { name: 'Home' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(rail).getByRole('link', { name: 'Campaign' })).toHaveAttribute(
      'href',
      '/campaign',
    );
    expect(within(rail).getByRole('link', { name: 'Skill Map' })).toHaveAttribute(
      'href',
      '/skills',
    );
  });

  it('shows not-found for unknown paths', async () => {
    renderAt('/does-not-exist', productionFlags);
    expect(
      await screen.findByRole('heading', { level: 1, name: /nothing at this address/i }),
    ).toBeInTheDocument();
  });

  it('keeps /system unreachable by URL when system_diagnostics is off', async () => {
    renderAt('/system', productionFlags);
    expect(
      await screen.findByRole('heading', { level: 1, name: /nothing at this address/i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /system diagnostics/i })).not.toBeInTheDocument();
  });

  it('hides the developer rail links when the flags are off', async () => {
    renderAt('/', productionFlags);
    await screen.findByRole('heading', { level: 1, name: 'What should I do next?' });
    expect(screen.queryByRole('link', { name: 'System' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Design' })).not.toBeInTheDocument();
  });

  it('shows the developer rail links locally', async () => {
    renderAt('/', localFlags);
    await screen.findByRole('heading', { level: 1, name: 'What should I do next?' });
    expect(screen.getByRole('link', { name: 'System' })).toHaveAttribute('href', '/system');
    expect(screen.getByRole('link', { name: 'Design' })).toHaveAttribute('href', '/design');
  });

  it('renders /system with API health when the flag is on', async () => {
    stubHealth({
      ok: true,
      environment: 'local',
      versions: { app: '0.1.0', content: null, simulator: '0.0.0' },
    });
    renderAt('/system', localFlags);
    expect(
      await screen.findByRole('heading', { level: 1, name: /system diagnostics/i }),
    ).toBeInTheDocument();
    expect(await screen.findByText('API reachable')).toBeInTheDocument();
    expect(screen.getByText('system_diagnostics')).toBeInTheDocument();
  });

  it('keeps /design unreachable in production and renders the gallery locally', async () => {
    renderAt('/design', productionFlags);
    expect(
      await screen.findByRole('heading', { level: 1, name: /nothing at this address/i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /design gallery/i })).not.toBeInTheDocument();
  });

  it('renders every gallery section when design_gallery is on', async () => {
    renderAt('/design', localFlags);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Design gallery' }),
    ).toBeInTheDocument();
    for (const name of [
      'Palette',
      'Typography',
      'Surfaces',
      'Buttons',
      'Forms',
      'Holo material',
      'Motion',
      'Panels',
      'Semantic components',
    ]) {
      expect(screen.getByRole('heading', { level: 2, name })).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: /Lumen Coaching/ })).toBeInTheDocument();
  });

  it('shows an error state with retry when the API is unreachable', async () => {
    stubHealth({ error: 'boom' }, 503);
    renderAt('/system', localFlags);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /API unreachable: API responded 503/,
    );
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});

describe('the phone navigation keeps every area named and reachable (DES-009, RSP-003)', () => {
  const AREAS = [
    ['Home', '/'],
    ['Campaign', '/campaign'],
    ['Skill Map', '/skills'],
    ['Workflow', '/workflow'],
    ['CRM', '/crm'],
    ['Inbox', '/conversations'],
    ['Playground', '/playground'],
  ];

  it('offers four areas in the bar and the rest behind a labelled More that opens, navigates and closes', async () => {
    renderAt('/', productionFlags);
    await screen.findByRole('heading', { level: 1, name: 'What should I do next?' });
    const rail = screen.getByRole('navigation', { name: 'Primary' });
    // Every area is a labelled link in the rail, whatever the width composes.
    for (const [name, href] of AREAS) {
      expect(within(rail).getByRole('link', { name })).toHaveAttribute('href', href);
    }
    const more = within(rail).getByRole('button', { name: 'More' });
    expect(more).toHaveAttribute('aria-expanded', 'false');
    const menu = screen.getByTestId('rail-more-menu');
    expect(menu).toHaveAttribute('hidden');
    fireEvent.click(more);
    expect(more).toHaveAttribute('aria-expanded', 'true');
    expect(menu).not.toHaveAttribute('hidden');
    const list = within(menu).getByRole('list', { name: 'More areas' });
    for (const name of ['CRM', 'Inbox', 'Playground']) {
      expect(within(list).getByRole('link', { name })).toBeInTheDocument();
    }
    // The bar itself never repeats them: they are the secondary items, shown in the list only.
    expect(within(list).queryByRole('link', { name: 'Home' })).toBeNull();
    // Escape closes it; navigating from it closes it too.
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(menu).toHaveAttribute('hidden');
    fireEvent.click(more);
    fireEvent.click(within(list).getByRole('link', { name: 'Playground' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: /Playground/ }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('rail-more-menu')).toHaveAttribute('hidden');
    expect(within(rail).getByRole('button', { name: 'More' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('marks More as the active area when the page is one of the areas it holds', async () => {
    renderAt('/crm', productionFlags);
    const rail = screen.getByRole('navigation', { name: 'Primary' });
    const more = within(rail).getByRole('button', { name: 'More' });
    expect(more.className).toMatch(/active/);
    expect(within(rail).getByRole('link', { name: 'Home' })).not.toHaveAttribute(
      'aria-current',
      'page',
    );
  });
});
