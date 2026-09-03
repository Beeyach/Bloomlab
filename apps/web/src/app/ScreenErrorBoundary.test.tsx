import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ScreenErrorBoundary } from './ScreenErrorBoundary';

function Screen({ broken }: { broken: boolean }) {
  if (broken) throw new Error('screen exploded');
  return <p>Screen content</p>;
}

function Harness() {
  const [broken, setBroken] = useState(true);
  return (
    <>
      <nav aria-label="Primary">rail</nav>
      <button type="button" onClick={() => setBroken(false)}>
        repair
      </button>
      <ScreenErrorBoundary resetKey="/x">
        <Screen broken={broken} />
      </ScreenErrorBoundary>
    </>
  );
}

describe('ScreenErrorBoundary (INF-011)', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps the shell when a screen throws, and retries on request', () => {
    render(<Harness />);
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('This screen hit a problem.');
    expect(alert).toHaveTextContent('Your progress is safe on this device.');
    expect(alert.textContent).not.toMatch(/exploded|stack/i);

    fireEvent.click(screen.getByRole('button', { name: 'repair' }));
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByText('Screen content')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('recovers when the route changes', () => {
    const { rerender } = render(
      <ScreenErrorBoundary resetKey="/a">
        <Screen broken />
      </ScreenErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    rerender(
      <ScreenErrorBoundary resetKey="/b">
        <Screen broken={false} />
      </ScreenErrorBoundary>,
    );
    expect(screen.getByText('Screen content')).toBeInTheDocument();
  });
});
