// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { colors, inkContext, roles, semanticColors } from '../tokens';
import { contrastRatio, hexToRgb, relativeLuminance, WCAG_AA } from './contrast';

const LIGHT_SURFACES = {
  cloud: colors.cloud,
  snow: colors.snow,
  mist: colors.mist,
  'lilac-soft': colors['lilac-soft'],
} as const;

const ACCENTS = {
  sky: colors.sky,
  bubblegum: colors.bubblegum,
  lavender: colors.lavender,
  aqua: colors.aqua,
  lemon: colors.lemon,
  peach: colors.peach,
  ice: colors.ice,
} as const;

function expectAtLeast(ratio: number, threshold: number, label: string) {
  expect(ratio, `${label}: ${ratio.toFixed(2)}:1 < ${threshold}:1`).toBeGreaterThanOrEqual(
    threshold,
  );
}

describe('contrast maths', () => {
  it('parses hex and computes luminance', () => {
    expect(hexToRgb('#FFFFFF')).toEqual([255, 255, 255]);
    expect(hexToRgb('000000')).toEqual([0, 0, 0]);
    expect(relativeLuminance('#FFFFFF')).toBeCloseTo(1, 5);
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 5);
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
  });

  it('rejects malformed colours', () => {
    expect(() => hexToRgb('#FFF')).toThrow(/6-digit hex/);
  });
});

describe('token pairings meet WCAG AA (A11Y-004)', () => {
  it('primary text on every light surface', () => {
    for (const [name, bg] of Object.entries(LIGHT_SURFACES)) {
      expectAtLeast(contrastRatio(colors.ink, bg), WCAG_AA.text, `ink on ${name}`);
    }
  });

  it('secondary text (ink-soft) on every light surface', () => {
    for (const [name, bg] of Object.entries(LIGHT_SURFACES)) {
      expectAtLeast(contrastRatio(colors['ink-soft'], bg), WCAG_AA.text, `ink-soft on ${name}`);
    }
  });

  it('faint text is large-text / decorative only, and clears the large-text bar', () => {
    for (const [name, bg] of Object.entries(LIGHT_SURFACES)) {
      expectAtLeast(
        contrastRatio(colors['ink-faint'], bg),
        WCAG_AA.largeText,
        `ink-faint on ${name}`,
      );
    }
    // Documented: it does not reach normal-text AA, so components never use it for small text.
    expect(contrastRatio(colors['ink-faint'], colors.cloud)).toBeLessThan(WCAG_AA.text);
  });

  it('links and focus rings on light surfaces', () => {
    for (const [name, bg] of Object.entries(LIGHT_SURFACES)) {
      expectAtLeast(contrastRatio(roles.link, bg), WCAG_AA.text, `link on ${name}`);
      expectAtLeast(contrastRatio(roles.focus, bg), WCAG_AA.ui, `focus on ${name}`);
    }
  });

  it('ink text on every accent background', () => {
    for (const [name, bg] of Object.entries(ACCENTS)) {
      expectAtLeast(contrastRatio(colors.ink, bg), WCAG_AA.text, `ink on ${name}`);
    }
  });

  it('text inside ink surfaces', () => {
    for (const bg of [colors.ink, colors['ink-deep']]) {
      expectAtLeast(contrastRatio(colors.snow, bg), WCAG_AA.text, `snow on ${bg}`);
      expectAtLeast(contrastRatio(inkContext.textSoft, bg), WCAG_AA.text, `ink text-soft on ${bg}`);
      expectAtLeast(contrastRatio(colors['ink-faint'], bg), WCAG_AA.text, `ink-faint on ${bg}`);
      expectAtLeast(contrastRatio(inkContext.link, bg), WCAG_AA.text, `ink link on ${bg}`);
      expectAtLeast(contrastRatio(inkContext.focus, bg), WCAG_AA.ui, `ink focus on ${bg}`);
    }
  });

  it('semantic colours that outline controls clear the non-text bar', () => {
    // Error outlines invalid inputs and problem surfaces; info outlines nothing yet but is used
    // for status pills' glyphs. Success and warning only ever appear as glyphs beside text
    // (A11Y-005), which WCAG treats as decorative, so they carry no ratio requirement.
    expectAtLeast(
      contrastRatio(semanticColors.error, colors.snow),
      WCAG_AA.ui,
      'error outline on snow',
    );
    expectAtLeast(
      contrastRatio(semanticColors.info, colors.snow),
      WCAG_AA.ui,
      'info glyph on snow',
    );
    for (const hex of Object.values(semanticColors)) {
      // None of them is legible as small text on light surfaces — components must not use them so.
      expect(contrastRatio(hex, colors.cloud)).toBeLessThan(WCAG_AA.text);
    }
  });
});
