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

const prop = (el: HTMLElement, name: string) => el.style.getPropertyValue(name);

afterEach(() => {
  vi.restoreAllMocks();
});

describe('HoloMaterial pointer physics (HOL-003)', () => {
  it('derives percent position, edge distance and rim angle from the pointer', async () => {
    render(<HoloMaterial data-testid="holo">Skill</HoloMaterial>);
    const holo = screen.getByTestId('holo');
    mockRect(holo);

    // Top-right quadrant: 75% across, 25% down.
    fireEvent.pointerEnter(holo, { pointerType: 'mouse', clientX: 150, clientY: 25 });
    await waitFor(() => expect(prop(holo, '--holo-px')).toBe('75.0'));
    expect(prop(holo, '--holo-py')).toBe('25.0');
    expect(prop(holo, '--holo-hyp')).toBe('0.707');
    // Clockwise from the top: up-and-right is 45°.
    expect(prop(holo, '--holo-angle')).toBe('45.0deg');

    // Far corner clamps distance to 1.
    fireEvent.pointerMove(holo, { pointerType: 'mouse', clientX: 400, clientY: 400 });
    await waitFor(() => expect(prop(holo, '--holo-hyp')).toBe('1.000'));
    expect(prop(holo, '--holo-px')).toBe('100.0');
    expect(prop(holo, '--holo-angle')).toBe('135.0deg');
  });

  it('returns every pointer property to neutral on leave so the settle transition runs', () => {
    render(<HoloMaterial data-testid="holo">Skill</HoloMaterial>);
    const holo = screen.getByTestId('holo');
    mockRect(holo);
    fireEvent.pointerEnter(holo, { pointerType: 'mouse', clientX: 150, clientY: 25 });
    fireEvent.pointerLeave(holo, { pointerType: 'mouse' });
    expect(prop(holo, '--holo-nx')).toBe('0');
    expect(prop(holo, '--holo-ny')).toBe('0');
    expect(prop(holo, '--holo-px')).toBe('50');
    expect(prop(holo, '--holo-py')).toBe('50');
    expect(prop(holo, '--holo-hyp')).toBe('0');
    expect(prop(holo, '--holo-angle')).toBe('135deg');
    expect(holo).not.toHaveAttribute('data-tracking');
  });

  it('renders bands, grain, glare and rim layers beneath the content', () => {
    render(<HoloMaterial data-testid="holo">Skill</HoloMaterial>);
    const holo = screen.getByTestId('holo');
    const layers = [...holo.querySelectorAll(':scope > span[aria-hidden="true"]')].map(
      (l) => l.className,
    );
    expect(layers).toHaveLength(5);
    expect(layers.join(' ')).toMatch(/pearl/);
    expect(layers.join(' ')).toMatch(/bands/);
    expect(layers.join(' ')).toMatch(/grain/);
    expect(layers.join(' ')).toMatch(/glare/);
    expect(layers.join(' ')).toMatch(/rim/);
    expect(holo.lastElementChild).toHaveTextContent('Skill');
  });
});
