import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const root = process.cwd().endsWith(join('packages', 'design-system'))
  ? process.cwd()
  : join(process.cwd(), 'packages', 'design-system');
const css = readFileSync(join(root, 'src', 'holo', 'HoloMaterial.module.css'), 'utf8');

/** The block of declarations for one selector, so a rule cannot be matched from a neighbour. */
function block(selector: string): string {
  const start = css.indexOf(`${selector} {`);
  expect(start, `${selector} is declared`).toBeGreaterThan(-1);
  return css.slice(start, css.indexOf('}', start));
}

describe('the holographic card keeps its shape while it is touched (D-074)', () => {
  it('flattens the transform style, so `overflow: hidden` still clips the layers', () => {
    const root = block('.holo');
    expect(root).toContain('overflow: hidden');
    expect(root).toContain('border-radius: var(--bl-radius-xl)');
    // `preserve-3d` establishes a 3D rendering context, and a browser must then ignore this
    // element's overflow for its children — which let the square glare and grain layers paint
    // over the rounded corners under the pointer.
    expect(root).toContain('transform-style: flat');
    // The comment above the rule names it; no declaration may set it.
    expect(css).not.toMatch(/transform-style:s*preserve-3d/);
    // The tilt itself is the element's own transform and is unaffected.
    expect(root).toContain('perspective(900px)');
    expect(root).toContain('--bl-holo-tilt-max');
  });

  it('gives every layer the card’s own radius, so none can show a square edge', () => {
    expect(block('.layer')).toContain('border-radius: inherit');
    // The glare deliberately overhangs the card to travel; it must be clipped, never squared off.
    expect(block('.glare')).toContain('inset: -50%');
  });
});
