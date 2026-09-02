/** Mastery states (spec §29, MAS-001). The engine is Phase 6. */
export const MASTERY_STATES = [
  'UNSEEN',
  'LEARNING',
  'GUIDED',
  'PRACTICED',
  'INDEPENDENT',
  'PRESSURE_TESTED',
  'MASTERED',
  'NEEDS_REFRESH',
] as const;

export type MasteryState = (typeof MASTERY_STATES)[number];

/** Assistance meter states (spec §34, MAS-007). */
export const ASSISTANCE_LEVELS = ['independent', 'light', 'guided', 'heavy'] as const;

export type AssistanceLevel = (typeof ASSISTANCE_LEVELS)[number];
