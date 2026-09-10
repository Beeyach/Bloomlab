import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SignatureMoment } from './SignatureMoment';

beforeEach(() => cleanup());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it('recognises only real active outcomes, never historical or missing evidence', () => {
  const view = render(
    <SignatureMoment kind="field-ready" active={false}>
      Evidence still needed
    </SignatureMoment>,
  );
  expect(screen.queryByRole('button')).toBeNull();
  expect(view.container.firstChild).toHaveAttribute('data-motion', 'static');
  view.rerender(
    <SignatureMoment kind="independent-pass" active={false}>
      Saved history
    </SignatureMoment>,
  );
  expect(screen.queryByRole('button')).toBeNull();
});
it('keeps result/next action available immediately and skips without delaying learning', () => {
  render(
    <SignatureMoment kind="independent-pass">
      <p>Independent — no assistance used</p>
      <button>Next work</button>
    </SignatureMoment>,
  );
  expect(screen.getByText('Independent — no assistance used')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Next work' })).toBeEnabled();
  const skip = screen.getByRole('button', { name: 'Skip recognition' });
  skip.focus();
  fireEvent.click(skip);
  expect(screen.queryByRole('button', { name: 'Skip recognition' })).toBeNull();
  expect(document.activeElement).toHaveTextContent('Independent — no assistance used');
});
it('settles major recognition after 1.8 seconds and preserves focus if the skip was focused', () => {
  vi.useFakeTimers();
  render(
    <SignatureMoment kind="field-ready">
      Training evidence complete; manual proof only
    </SignatureMoment>,
  );
  screen.getByRole('button', { name: 'Skip recognition' }).focus();
  act(() => vi.advanceTimersByTime(1799));
  expect(screen.getByRole('button', { name: 'Skip recognition' })).toBeInTheDocument();
  act(() => vi.advanceTimersByTime(1));
  expect(screen.queryByRole('button')).toBeNull();
  expect(document.activeElement).toHaveTextContent('Training evidence complete; manual proof only');
});
it('shows reduced-motion recognition immediately and never hides a failure or case', () => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  );
  const view = render(
    <SignatureMoment kind="independent-pass">Independent result</SignatureMoment>,
  );
  expect(screen.queryByRole('button')).toBeNull();
  for (const kind of ['failed-test', 'client-case'] as const) {
    view.rerender(<SignatureMoment kind={kind}>Readable immediately</SignatureMoment>);
    expect(screen.getByText('Readable immediately')).toBeVisible();
    expect(view.container.firstChild).toHaveAttribute('data-motion', 'static');
  }
});
