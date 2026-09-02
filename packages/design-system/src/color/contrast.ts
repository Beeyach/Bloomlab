/**
 * WCAG 2.x relative luminance and contrast ratio for hex colours (A11Y-004).
 * Used by tests to prove token pairings meet AA, and by the design gallery to show ratios.
 */

const HEX_RE = /^#?([0-9a-f]{6})$/i;

export function hexToRgb(hex: string): [number, number, number] {
  const match = HEX_RE.exec(hex.trim());
  if (!match?.[1]) throw new Error(`Expected a 6-digit hex colour, got ${JSON.stringify(hex)}`);
  const value = Number.parseInt(match[1], 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

function channelToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * channelToLinear(r) + 0.7152 * channelToLinear(g) + 0.0722 * channelToLinear(b);
}

/** Contrast ratio between two colours, 1 (identical) to 21 (black on white). */
export function contrastRatio(foreground: string, background: string): number {
  const l1 = relativeLuminance(foreground);
  const l2 = relativeLuminance(background);
  const [lighter, darker] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (lighter + 0.05) / (darker + 0.05);
}

/** WCAG 2.x AA thresholds. */
export const WCAG_AA = {
  /** Normal text (< 24px, or < 19px bold). */
  text: 4.5,
  /** Large text (≥ 24px, or ≥ 19px bold). */
  largeText: 3,
  /** Non-text UI: focus rings, borders of controls, icons that carry meaning. */
  ui: 3,
} as const;
