import { render, screen } from '@testing-library/react';
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
  it('renders the foundation home at /', async () => {
    renderAt('/', productionFlags);
    expect(await screen.findByRole('heading', { level: 1, name: 'Bloomlab' })).toBeInTheDocument();
    expect(screen.getByText('0.1.0')).toBeInTheDocument();
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

  it('hides the /system link on home when the flag is off', async () => {
    renderAt('/', productionFlags);
    await screen.findByRole('heading', { level: 1, name: 'Bloomlab' });
    expect(screen.queryByRole('link', { name: /system diagnostics/i })).not.toBeInTheDocument();
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

  it('shows an error state with retry when the API is unreachable', async () => {
    stubHealth({ error: 'boom' }, 503);
    renderAt('/system', localFlags);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /API unreachable: API responded 503/,
    );
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
