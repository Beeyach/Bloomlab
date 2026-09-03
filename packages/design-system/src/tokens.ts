/**
 * TypeScript mirror of tokens.css (DES-014). CSS variables are the runtime source; these
 * values exist for JS consumers (breakpoint logic, motion timing, tests) and are checked
 * against tokens.css by tokens.test.ts so the two never drift.
 */

/** Palette (spec §65, DES-004). */
export const colors = {
  cloud: '#F8FAFF',
  snow: '#FFFFFF',
  mist: '#F0F3FC',
  'lilac-soft': '#EEEAFB',
  ink: '#18152B',
  'ink-deep': '#100D22',
  'ink-soft': '#5D5873',
  /** Spec #8F8AA5, darkened one step so it clears 3:1 (large text) on every light surface (D-017). */
  'ink-faint': '#86819C',
  sky: '#6EC8FF',
  bubblegum: '#FF82C8',
  lavender: '#A99BFF',
  aqua: '#75E6DE',
  lemon: '#FFE98A',
  peach: '#FFB49C',
  ice: '#CFF8FF',
} as const;

export type ColorToken = keyof typeof colors;

export const semanticColors = {
  success: '#56BFA1',
  warning: '#E5A94C',
  error: '#D85C72',
  info: '#5D90D9',
} as const;

export type SemanticColorToken = keyof typeof semanticColors;

/**
 * Role colours tuned for contrast (spec §65 allows tuning within the family; D-017).
 * `link`/`focus` are Info darkened until they clear WCAG AA on the light surfaces.
 */
export const roles = {
  link: '#3B69BD',
  focus: '#3B69BD',
} as const;

/** Role overrides inside InkSurface (dark workspaces). */
export const inkContext = {
  textSoft: '#C6C2D9',
  link: colors.aqua,
  focus: colors.aqua,
} as const;

/** Required review widths (spec §82, RSP-001). */
export const breakpoints = {
  xs: 320,
  sm: 390,
  md: 768,
  lg: 1024,
  xl: 1440,
} as const;

export type Breakpoint = keyof typeof breakpoints;

/** Motion timing in milliseconds (spec §69, MOT-002). */
export const motion = {
  fast: 120,
  base: 200,
  slow: 300,
  settle: 420,
  rewardMin: 1500,
  rewardMax: 3000,
} as const;

/** HoloMaterial physics (spec §68, HOL-003). */
export const holo = {
  tiltMaxDeg: 6,
  settleMs: 420,
} as const;

/** Information density steps (spec §72, DES-008); values are row padding in px. */
export const density = {
  low: 20,
  medium: 12,
  high: 6,
} as const;

export const typography = {
  display: "'Bricolage Grotesque Variable', 'Bricolage Grotesque', 'Inter Variable', sans-serif",
  ui: "'Inter Variable', Inter, system-ui, sans-serif",
} as const;

export const zIndex = {
  base: 0,
  raised: 10,
  sticky: 100,
  overlay: 1000,
  modal: 1100,
  toast: 1200,
} as const;

/** CSS variable prefixes, one per token category required by TA§3 / DES-014. */
export const TOKEN_CATEGORIES = {
  color: '--bl-color-',
  spacing: '--bl-space-',
  radius: '--bl-radius-',
  shadow: '--bl-shadow-',
  motion: '--bl-motion-',
  typography: '--bl-font-',
  holo: '--bl-holo-',
  density: '--bl-density-',
  zIndex: '--bl-z-',
  breakpoint: '--bl-bp-',
} as const;

export type TokenCategory = keyof typeof TOKEN_CATEGORIES;
