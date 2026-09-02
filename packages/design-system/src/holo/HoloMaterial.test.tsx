import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('HoloMaterial', () => {
  it('renders the five material layers under the content', () => {
    render(<HoloMaterial data-testid="holo">Skill</HoloMaterial>);
    const holo = screen.getByTestId('holo');
    expect(holo.querySelectorAll('span[aria-hidden="true"]')).toHaveLength(5);
    expect(holo).toHaveTextContent('Skill');
    expect(holo).toHaveAttribute('data-variant', 'collectible');
  });

  it('follows the pointer within [-1, 1] and settles to neutral on leave (HOL-003)', async () => {
    render(<HoloMaterial data-testid="holo">Skill</HoloMaterial>);
    const holo = screen.getByTestId('holo');
    mockRect(holo);

    fireEvent.pointerEnter(holo, { pointerType: 'mouse', clientX: 150, clientY: 25 });
    fireEvent.pointerMove(holo, { pointerType: 'mouse', clientX: 150, clientY: 25 });

    await waitFor(() => expect(holo.style.getPropertyValue('--holo-nx')).toBe('0.500'));
    expect(holo.style.getPropertyValue('--holo-ny')).toBe('-0.500');
    expect(holo).toHaveAttribute('data-tracking', 'true');

    fireEvent.pointerMove(holo, { pointerType: 'mouse', clientX: 900, clientY: -400 });
    await waitFor(() => expect(holo.style.getPropertyValue('--holo-nx')).toBe('1.000'));
    expect(holo.style.getPropertyValue('--holo-ny')).toBe('-1.000');

    fireEvent.pointerLeave(holo, { pointerType: 'mouse' });
    expect(holo.style.getPropertyValue('--holo-nx')).toBe('0');
    expect(holo.style.getPropertyValue('--holo-ny')).toBe('0');
    expect(holo).not.toHaveAttribute('data-tracking');
  });

  it('responds to touch only while pressed and settles on release (HOL-004)', async () => {
    render(<HoloMaterial data-testid="holo">Skill</HoloMaterial>);
    const holo = screen.getByTestId('holo');
    mockRect(holo);

    // A hover-less touch move (no button pressed) must not move the reflection.
    fireEvent.pointerMove(holo, { pointerType: 'touch', buttons: 0, clientX: 150, clientY: 25 });
    expect(holo.style.getPropertyValue('--holo-nx')).toBe('');

    fireEvent.pointerDown(holo, { pointerType: 'touch', buttons: 1, clientX: 150, clientY: 25 });
    await waitFor(() => expect(holo.style.getPropertyValue('--holo-nx')).toBe('0.500'));

    fireEvent.pointerUp(holo, { pointerType: 'touch' });
    expect(holo.style.getPropertyValue('--holo-nx')).toBe('0');
    expect(holo).not.toHaveAttribute('data-tracking');
  });

  it('does no pointer work under reduced motion (MOT-003)', () => {
    mockReducedMotion(true);
    render(<HoloMaterial data-testid="holo">Skill</HoloMaterial>);
    const holo = screen.getByTestId('holo');
    mockRect(holo);
    fireEvent.pointerEnter(holo, { pointerType: 'mouse', clientX: 150, clientY: 25 });
    fireEvent.pointerMove(holo, { pointerType: 'mouse', clientX: 150, clientY: 25 });
    expect(holo.style.getPropertyValue('--holo-nx')).toBe('');
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
    expect(holo.style.getPropertyValue('--holo-nx')).toBe('');
    expect(holo).toHaveAttribute('data-variant', 'soft');
  });
});
