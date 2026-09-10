import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { content } from '../content/bundle';
import { captureRunReplay, type RunReplay } from './runReplay';
import { Replay } from './ActualRunReplay';

const replay: RunReplay = {
  prediction: { tag: 'my prediction' },
  events: [
    {
      type: 'workflow.enrolled',
      at: '2026-09-10T12:00:00Z',
      index: 0,
      fields: { contact_id: 'maria' },
    },
    {
      type: 'sms.sent',
      at: '2026-09-10T12:00:00Z',
      index: 1,
      fields: {
        contact_id: 'maria',
        body: 'Actual observed message, not the authored expectation.',
      },
    },
    {
      type: 'tag.added',
      at: '2026-09-10T12:00:00Z',
      index: 2,
      fields: { contact_id: 'maria', tag: 'actual-tag' },
    },
  ],
};
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('EXR-006 actual in-runner execution replay', () => {
  it('snapshots only observed subject events and the learner prediction, without expected answers', () => {
    const exercise = content.exercises.find(
      (e) => e.id === 'EX-RUN_THE_LEAD-booking-confirmation',
    )!;
    const events = structuredClone([
      ...replay.events,
      { ...replay.events[1]!, index: 3, fields: { contact_id: 'other' } },
    ]);
    const snapshot = captureRunReplay(
      exercise,
      { events, state: {}, references: {}, architecture: null, provides: ['events'] },
      replay.prediction,
    );
    events[0]!.type = 'mutated.later';
    expect(snapshot.events).toEqual(replay.events);
    expect(snapshot.prediction).toEqual(replay.prediction);
    expect(JSON.stringify(snapshot)).not.toContain('booked');
  });
  it('animates the actual sequence and offers pause/replay/full execution without writing state', () => {
    vi.useFakeTimers();
    render(<Replay replay={replay} fresh />);
    const rows = () =>
      within(screen.getByRole('list', { name: 'Observed execution events' })).getAllByRole(
        'listitem',
      );
    expect(rows()).toHaveLength(1);
    act(() => vi.advanceTimersByTime(650));
    expect(rows()).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Pause execution' }));
    act(() => vi.advanceTimersByTime(1300));
    expect(rows()).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Show full execution' }));
    expect(rows()).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: 'Replay execution' }));
    expect(rows()).toHaveLength(1);
    expect(screen.getByText(/my prediction/)).toBeInTheDocument();
  });
  it('shows all observed events immediately under reduced motion', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
    );
    render(<Replay replay={replay} fresh />);
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.queryByRole('button', { name: 'Replay execution' })).not.toBeInTheDocument();
    expect(screen.getByTestId('actual-run-replay')).toHaveAttribute('data-playing', 'false');
  });
});
