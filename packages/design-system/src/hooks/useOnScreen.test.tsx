import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CallParticipant } from '../semantic/CallParticipant';
import { StatusPill } from '../semantic/StatusPill';

type IOCallback = (entries: Array<{ isIntersecting: boolean }>) => void;

/** Minimal IntersectionObserver stub that lets a test push visibility changes. */
function stubIntersectionObserver() {
  const callbacks: IOCallback[] = [];
  class FakeIntersectionObserver {
    constructor(callback: IOCallback) {
      callbacks.push(callback);
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
  return {
    setVisible(visible: boolean) {
      act(() => {
        for (const callback of callbacks) callback([{ isIntersecting: visible }]);
      });
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('live animations stop off-screen (MOT-004)', () => {
  it('StatusPill pulses only while on screen', () => {
    const io = stubIntersectionObserver();
    render(<StatusPill label="Running" tone="execution" live />);
    const glyph = screen.getByText('Running').querySelector('svg');
    expect(glyph?.className.baseVal).toMatch(/pulse/);
    io.setVisible(false);
    expect(glyph?.className.baseVal).not.toMatch(/pulse/);
    io.setVisible(true);
    expect(glyph?.className.baseVal).toMatch(/pulse/);
  });

  it('CallParticipant speaking ring animates only while on screen', () => {
    const io = stubIntersectionObserver();
    const { container } = render(<CallParticipant name="Dana" audio="speaking" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toMatch(/speaking/);
    io.setVisible(false);
    expect(root.className).not.toMatch(/speaking/);
  });

  it('treats environments without IntersectionObserver as visible', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    render(<StatusPill label="Running" tone="execution" live />);
    expect(screen.getByText('Running').querySelector('svg')?.className.baseVal).toMatch(/pulse/);
  });
});
