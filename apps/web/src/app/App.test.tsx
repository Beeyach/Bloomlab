import { render, screen, within } from '@testing-library/react';
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
