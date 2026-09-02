import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ExecutionTrack, RewardReveal } from './index';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('RewardReveal', () => {
  it('finishes on its own within the 1.5–3 s band and can be skipped early (MOT-002)', async () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    render(
      <RewardReveal durationMs={5000} onDone={onDone}>
        Field Ready
      </RewardReveal>,
    );
    expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(2999);
    });
    expect(onDone).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Skip' })).not.toBeInTheDocument();
  });

  it('skips immediately when asked', async () => {
    const onDone = vi.fn();
    render(<RewardReveal onDone={onDone}>Field Ready</RewardReveal>);
    await userEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('shows the end state at once under reduced motion (MOT-003)', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
    );
    const onDone = vi.fn();
    render(<RewardReveal onDone={onDone}>Field Ready</RewardReveal>);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Skip' })).not.toBeInTheDocument();
  });
});

describe('ExecutionTrack', () => {
  it('is an accessible progress bar clamped to 0–100', () => {
    render(<ExecutionTrack progress={1.4} label="Maria through No-show recovery" />);
    const bar = screen.getByRole('progressbar', { name: 'Maria through No-show recovery' });
    expect(bar).toHaveAttribute('aria-valuenow', '100');
  });
});
