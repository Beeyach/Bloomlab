import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { NavigationHint } from './NavigationHint';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
function renderHints() {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: true })),
  );
  return render(
    <>
      <NavigationHint label="Home" enabled>
        <a href="/">Home icon</a>
      </NavigationHint>
      <NavigationHint label="Campaign" enabled>
        <a href="/campaign">Campaign icon</a>
      </NavigationHint>
    </>,
  );
}
it('replaces a focused tooltip immediately and retains it through focus scrolling', () => {
  renderHints();
  act(() => screen.getByRole('link', { name: 'Home icon' }).focus());
  expect(screen.getByRole('tooltip')).toHaveTextContent('Home');
  act(() => screen.getByRole('link', { name: 'Campaign icon' }).focus());
  expect(screen.getAllByRole('tooltip')).toHaveLength(1);
  expect(screen.getByRole('tooltip')).toHaveTextContent('Campaign');
  fireEvent.scroll(document);
  expect(screen.getByRole('tooltip')).toHaveTextContent('Campaign');
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('tooltip')).toBeNull();
});
it('allows pointer entry into the tooltip and dismisses after leaving it', () => {
  vi.useFakeTimers();
  renderHints();
  const link = screen.getByRole('link', { name: 'Home icon' });
  fireEvent.pointerEnter(link);
  const tooltip = screen.getByRole('tooltip');
  fireEvent.pointerLeave(link);
  fireEvent.pointerEnter(tooltip);
  act(() => vi.advanceTimersByTime(150));
  expect(screen.getByRole('tooltip')).toHaveTextContent('Home');
  fireEvent.pointerLeave(tooltip);
  act(() => vi.advanceTimersByTime(150));
  expect(screen.queryByRole('tooltip')).toBeNull();
});
