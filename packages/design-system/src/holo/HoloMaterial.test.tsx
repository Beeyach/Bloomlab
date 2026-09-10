import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { HoloMaterial } from './HoloMaterial';

function mockRect(element: HTMLElement) {
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    width: 200,
    height: 100,
    right: 200,
    bottom: 100,
    toJSON: () => ({}),
  } as DOMRect);
}

function mockReducedMotion(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

const prop = (el: HTMLElement, name: string) => el.style.getPropertyValue(name);
// The pose eases toward its target over several frames; give convergence room.
const settled = { timeout: 3000 };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('HoloMaterial', () => {
  it('cancels active physics immediately when reduced motion changes live or the card leaves the viewport', async () => {
    let reduced = false;
    let changed = () => {};
    let intersect!: (entries: { isIntersecting: boolean }[]) => void;
    vi.stubGlobal('matchMedia', () => ({
      get matches() {
        return reduced;
      },
      addEventListener: (_: string, callback: () => void) => {
        changed = callback;
      },
      removeEventListener: vi.fn(),
    }));
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: typeof intersect) {
          intersect = callback;
        }
        observe() {}
        disconnect() {}
      },
    );
    render(<HoloMaterial data-testid="live-holo">Skill</HoloMaterial>);
    const holo = screen.getByTestId('live-holo');
    mockRect(holo);
    fireEvent.pointerMove(holo, { pointerType: 'mouse', clientX: 150, clientY: 25 });
    await waitFor(() => expect(prop(holo, '--holo-lift')).toBe('1.000'), settled);
    act(() => {
      reduced = true;
      changed();
    });
    expect(holo).not.toHaveAttribute('data-tracking');
    expect(prop(holo, '--holo-lift')).toBe('0.000');
    act(() => {
      reduced = false;
      changed();
    });
    fireEvent.pointerMove(holo, { pointerType: 'mouse', clientX: 150, clientY: 25 });
    expect(holo).toHaveAttribute('data-tracking');
    act(() => intersect([{ isIntersecting: false }]));
    expect(holo).not.toHaveAttribute('data-tracking');
    expect(prop(holo, '--holo-lift')).toBe('0.000');
    fireEvent.pointerMove(holo, { pointerType: 'mouse', clientX: 150, clientY: 25 });
    expect(holo).not.toHaveAttribute('data-tracking');
  });
  it('renders bands, grain, glare and rim over a pearl base, under the content', () => {
    render(<HoloMaterial data-testid="holo">Skill</HoloMaterial>);
    const holo = screen.getByTestId('holo');
    const layers = [...holo.querySelectorAll(':scope > span[aria-hidden="true"]')].map(
      (l) => l.className,
    );
    expect(layers).toHaveLength(5);
    for (const name of ['pearl', 'bands', 'grain', 'glare', 'rim']) {
      expect(layers.join(' ')).toMatch(new RegExp(name));
    }
    expect(holo.lastElementChild).toHaveTextContent('Skill');
    expect(holo).toHaveAttribute('data-variant', 'collectible');
  });

  it('eases toward the pointer, clamps to [-1, 1], and derives light and lift (HOL-003)', async () => {
    render(<HoloMaterial data-testid="holo">Skill</HoloMaterial>);
    const holo = screen.getByTestId('holo');
    mockRect(holo);

    // Top-right quadrant: 75% across, 25% down.
    fireEvent.pointerEnter(holo, { pointerType: 'mouse', clientX: 150, clientY: 25 });
    fireEvent.pointerMove(holo, { pointerType: 'mouse', clientX: 150, clientY: 25 });
    expect(holo).toHaveAttribute('data-tracking', 'true');
    await waitFor(() => expect(prop(holo, '--holo-nx')).toBe('0.500'), settled);
    expect(prop(holo, '--holo-ny')).toBe('-0.500');
    expect(prop(holo, '--holo-px')).toBe('75.0');
    expect(prop(holo, '--holo-py')).toBe('25.0');
    expect(prop(holo, '--holo-hyp')).toBe('0.707');
    // Clockwise from the top: up-and-right is 45°.
    expect(prop(holo, '--holo-angle')).toBe('45.0deg');
    expect(prop(holo, '--holo-lift')).toBe('1.000');

    // Far outside the card clamps to the corner.
    fireEvent.pointerMove(holo, { pointerType: 'mouse', clientX: 900, clientY: -400 });
    await waitFor(() => expect(prop(holo, '--holo-nx')).toBe('1.000'), settled);
    expect(prop(holo, '--holo-ny')).toBe('-1.000');
    expect(prop(holo, '--holo-hyp')).toBe('1.000');
  });

  it('eases back to neutral on leave and only then stops tracking (HOL-003)', async () => {
    render(<HoloMaterial data-testid="holo">Skill</HoloMaterial>);
    const holo = screen.getByTestId('holo');
    mockRect(holo);
    fireEvent.pointerEnter(holo, { pointerType: 'mouse', clientX: 150, clientY: 25 });
    await waitFor(() => expect(prop(holo, '--holo-nx')).toBe('0.500'), settled);

    fireEvent.pointerLeave(holo, { pointerType: 'mouse' });
    // Settling is gradual: still tracking and not yet neutral right after leave.
    expect(holo).toHaveAttribute('data-tracking', 'true');
    await waitFor(() => expect(holo).not.toHaveAttribute('data-tracking'), settled);
    expect(prop(holo, '--holo-nx')).toBe('0.000');
    expect(prop(holo, '--holo-ny')).toBe('0.000');
    expect(prop(holo, '--holo-px')).toBe('50.0');
    expect(prop(holo, '--holo-hyp')).toBe('0.000');
    expect(prop(holo, '--holo-angle')).toBe('135.0deg');
    expect(prop(holo, '--holo-lift')).toBe('0.000');
  });

  it('responds to touch only while pressed and settles on release (HOL-004)', async () => {
    render(<HoloMaterial data-testid="holo">Skill</HoloMaterial>);
    const holo = screen.getByTestId('holo');
    mockRect(holo);

    // A hover-less touch move (no button pressed) must not move the reflection.
    fireEvent.pointerMove(holo, { pointerType: 'touch', buttons: 0, clientX: 150, clientY: 25 });
    expect(prop(holo, '--holo-nx')).toBe('');

    fireEvent.pointerDown(holo, { pointerType: 'touch', buttons: 1, clientX: 150, clientY: 25 });
    await waitFor(() => expect(prop(holo, '--holo-nx')).toBe('0.500'), settled);

    fireEvent.pointerUp(holo, { pointerType: 'touch' });
    await waitFor(() => expect(holo).not.toHaveAttribute('data-tracking'), settled);
    expect(prop(holo, '--holo-nx')).toBe('0.000');
  });

  it('does no pointer work under reduced motion (MOT-003)', () => {
    mockReducedMotion(true);
    render(<HoloMaterial data-testid="holo">Skill</HoloMaterial>);
    const holo = screen.getByTestId('holo');
    mockRect(holo);
    fireEvent.pointerEnter(holo, { pointerType: 'mouse', clientX: 150, clientY: 25 });
    fireEvent.pointerMove(holo, { pointerType: 'mouse', clientX: 150, clientY: 25 });
    expect(prop(holo, '--holo-nx')).toBe('');
    expect(holo).not.toHaveAttribute('data-tracking');
  });

  it('can be rendered static', () => {
    render(
      <HoloMaterial data-testid="holo" interactive={false} variant="soft">
        Skill
      </HoloMaterial>,
    );
    const holo = screen.getByTestId('holo');
    mockRect(holo);
    fireEvent.pointerMove(holo, { pointerType: 'mouse', clientX: 150, clientY: 25 });
    expect(prop(holo, '--holo-nx')).toBe('');
    expect(holo).toHaveAttribute('data-variant', 'soft');
  });
});

describe('the split surface (D-086)', () => {
  it('renders one surface by default: the layers sit directly on the transformed root', () => {
    render(
      <HoloMaterial data-testid="card">
        <span>Face</span>
      </HoloMaterial>,
    );
    const card = screen.getByTestId('card');
    expect(card.dataset.surface).toBe('single');
    expect(card.querySelector('[data-layer="surface"]')).toBeNull();
    for (const layer of ['pearl', 'bands', 'grain', 'glare', 'rim', 'content']) {
      expect(card.querySelector(`:scope > [data-layer="${layer}"]`)).not.toBeNull();
    }
  });

  it('moves every layer inside one clipping element when asked to split', () => {
    render(
      <HoloMaterial surface="split" data-testid="card">
        <span>Face</span>
      </HoloMaterial>,
    );
    const card = screen.getByTestId('card');
    expect(card.dataset.surface).toBe('split');
    const surface = card.querySelector('[data-layer="surface"]');
    expect(surface).not.toBeNull();
    // The same layers, in the same order, one level deeper. Nothing is added or dropped.
    for (const layer of ['pearl', 'bands', 'grain', 'glare', 'rim', 'content']) {
      expect(card.querySelector(`:scope > [data-layer="${layer}"]`)).toBeNull();
      expect(surface?.querySelector(`:scope > [data-layer="${layer}"]`)).not.toBeNull();
    }
    expect(screen.getByText('Face')).toBeInTheDocument();
  });

  it('keeps the pointer physics on the root either way', async () => {
    render(
      <HoloMaterial surface="split" data-testid="card">
        <span>Face</span>
      </HoloMaterial>,
    );
    const card = screen.getByTestId('card');
    mockRect(card);
    fireEvent.pointerDown(card, { clientX: 200, clientY: 0, pointerType: 'touch' });
    await waitFor(() => expect(card.dataset.tracking).toBe('true'));
    await waitFor(() => expect(Number(prop(card, '--holo-nx'))).toBeGreaterThan(0.9), settled);
  });
});
