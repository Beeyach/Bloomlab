import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { breakpoints, colors, motion, semanticColors, TOKEN_CATEGORIES } from './tokens';

const css = readFileSync(fileURLToPath(new URL('./tokens.css', import.meta.url)), 'utf8');

/** Reads the value of a CSS custom property declared on :root in tokens.css. */
function cssVar(name: string): string | undefined {
  const match = css.match(new RegExp(`${name}:\\s*([^;]+);`));
  return match?.[1]?.replace(/\s+/g, ' ').trim();
}

describe('design tokens', () => {
  it('declares every spec §65 palette colour with the exact hex value', () => {
    for (const [name, hex] of Object.entries(colors)) {
      expect(cssVar(`--bl-color-${name}`)?.toUpperCase()).toBe(hex.toUpperCase());
    }
  });

  it('declares every spec §65 semantic colour with the exact hex value', () => {
    for (const [name, hex] of Object.entries(semanticColors)) {
      expect(cssVar(`--bl-color-${name}`)?.toUpperCase()).toBe(hex.toUpperCase());
    }
  });

  it('declares at least one variable for every TA§3 token category', () => {
    for (const prefix of Object.values(TOKEN_CATEGORIES)) {
      expect(css, `missing category ${prefix}`).toMatch(new RegExp(`${prefix}[a-z0-9-]+:`));
    }
  });

  it('keeps breakpoints in sync with the required review widths', () => {
    expect(cssVar('--bl-bp-xs')).toBe(`${breakpoints.xs}px`);
    expect(cssVar('--bl-bp-sm')).toBe(`${breakpoints.sm}px`);
    expect(cssVar('--bl-bp-md')).toBe(`${breakpoints.md}px`);
    expect(cssVar('--bl-bp-lg')).toBe(`${breakpoints.lg}px`);
    expect(cssVar('--bl-bp-xl')).toBe(`${breakpoints.xl}px`);
  });

  it('keeps motion timing within the spec §69 ranges and in sync with tokens.ts', () => {
    expect(cssVar('--bl-motion-fast')).toBe(`${motion.fast}ms`);
    expect(cssVar('--bl-motion-slow')).toBe(`${motion.slow}ms`);
    expect(cssVar('--bl-motion-settle')).toBe(`${motion.settle}ms`);
    expect(motion.fast).toBeGreaterThanOrEqual(120);
    expect(motion.slow).toBeLessThanOrEqual(300);
    expect(motion.settle).toBeGreaterThanOrEqual(350);
    expect(motion.settle).toBeLessThanOrEqual(500);
  });

  it('disables holographic tilt under reduced motion', () => {
    const reduced = css.slice(css.indexOf('prefers-reduced-motion'));
    expect(reduced).toMatch(/--bl-holo-tilt-max:\s*0deg/);
  });
});
