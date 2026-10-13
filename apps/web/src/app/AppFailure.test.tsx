import { fireEvent, render, screen } from '@testing-library/react';
import { Link, MemoryRouter, Outlet } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

const fixture = vi.hoisted(() => ({ broken: true }));
vi.mock('../screens/NotFound', () => ({
  NotFound: () => {
    if (fixture.broken) throw new Error('Controlled unknown-route render failure');
    return <h1>Nothing at this address.</h1>;
  },
}));
vi.mock('./RootLayout', () => ({
  RootLayout: () => (
    <>
      <nav aria-label="Primary">
        <Link to="/">Home</Link>
      </nav>
      <main>
        <Outlet />
      </main>
    </>
  ),
}));
vi.mock('./routes', () => ({
  enabledRoutes: () => [{ id: 'home', path: '/', Component: () => <h1>Home screen</h1> }],
}));

describe('unknown-route failure isolation', () => {
  beforeEach(() => {
    fixture.broken = true;
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it('keeps navigation and recovers to another route when the unknown-route screen throws', async () => {
    render(
      <MemoryRouter initialEntries={['/unknown']}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('This screen hit a problem.');
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).not.toHaveTextContent('Controlled');
    fireEvent.click(screen.getByRole('link', { name: 'Home' }));
    expect(await screen.findByRole('heading', { name: 'Home screen' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('retries the unknown-route screen after its failure is repaired', () => {
    render(
      <MemoryRouter initialEntries={['/unknown']}>
        <App />
      </MemoryRouter>,
    );
    fixture.broken = false;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByRole('heading', { name: 'Nothing at this address.' })).toBeInTheDocument();
  });
});
