/**
 * Domain vocab the design system renders. Declared locally so the package has no runtime
 * dependency on the engines; `semantic.test.tsx` asserts these stay identical to the
 * engine enums (`@bloomlab/mastery-engine`, `@bloomlab/content-schema`, `@bloomlab/exercise-engine`).
 */

export type MasteryState =
  | 'UNSEEN'
  | 'LEARNING'
  | 'GUIDED'
  | 'PRACTICED'
  | 'INDEPENDENT'
  | 'PRESSURE_TESTED'
  | 'MASTERED'
  | 'NEEDS_REFRESH';

/** Progress language per spec §159: state words, never scores or stars. */
export const MASTERY_LABELS: Record<MasteryState, string> = {
  UNSEEN: 'Unseen',
  LEARNING: 'Learning',
  GUIDED: 'Guided',
  PRACTICED: 'Practiced',
  INDEPENDENT: 'Independent',
  PRESSURE_TESTED: 'Pressure-tested',
  MASTERED: 'Mastered',
  NEEDS_REFRESH: 'Needs refresh',
};

export type Territory =
  | 'STRATEGIZE'
  | 'BUILD'
  | 'AUTOMATE'
  | 'ARCHITECT'
  | 'DIAGNOSE'
  | 'CONNECT'
  | 'SELL'
  | 'DELIVER'
  | 'SCALE'
  | 'JUDGMENT';

export const TERRITORY_LABELS: Record<Territory, string> = {
  STRATEGIZE: 'Strategize',
  BUILD: 'Build',
  AUTOMATE: 'Automate',
  ARCHITECT: 'Architect',
  DIAGNOSE: 'Diagnose',
  CONNECT: 'Connect',
  SELL: 'Sell',
  DELIVER: 'Deliver',
  SCALE: 'Scale',
  JUDGMENT: 'Judgment',
};

export type ExerciseType =
  | 'BUILD_IT'
  | 'FIX_IT'
  | 'RUN_THE_LEAD'
  | 'EDGE_CASE'
  | 'WHAT_WOULD_YOU_BUILD'
  | 'ARCHITECTURE_DECISION'
  | 'FUNNEL_AUTOPSY'
  | 'FUNNEL_ASSEMBLY'
  | 'PROSPECT_IT'
  | 'AUDIT_IT'
  | 'WRITE_IT'
  | 'SAY_IT'
  | 'PRICE_IT'
  | 'NEGOTIATE_IT'
  | 'EXPLAIN_IT'
  | 'REBUILD_BLIND'
  | 'FIELDWORK'
  | 'BOSS_CLIENT';

/** Exercise family names exactly as the spec writes them (§27). */
export const EXERCISE_LABELS: Record<ExerciseType, string> = {
  BUILD_IT: 'Build It',
  FIX_IT: 'Fix It',
  RUN_THE_LEAD: 'Run the Lead',
  EDGE_CASE: 'Edge Case',
  WHAT_WOULD_YOU_BUILD: 'What Would You Build?',
  ARCHITECTURE_DECISION: 'Architecture Decision',
  FUNNEL_AUTOPSY: 'Funnel Autopsy',
  FUNNEL_ASSEMBLY: 'Funnel Assembly',
  PROSPECT_IT: 'Prospect It',
  AUDIT_IT: 'Audit It',
  WRITE_IT: 'Write It',
  SAY_IT: 'Say It',
  PRICE_IT: 'Price It',
  NEGOTIATE_IT: 'Negotiate It',
  EXPLAIN_IT: 'Explain It',
  REBUILD_BLIND: 'Rebuild Blind',
  FIELDWORK: 'Fieldwork',
  BOSS_CLIENT: 'Boss Client',
};

export type AssistanceLevel = 'independent' | 'light' | 'guided' | 'heavy';

/** Assistance meter wording (spec §34): descriptive, never shaming. */
export const ASSISTANCE_LABELS: Record<AssistanceLevel, string> = {
  independent: 'Independent',
  light: 'Light assistance',
  guided: 'Guided',
  heavy: 'Heavy assistance',
};

/** Deterministic 32-bit FNV-1a hash for abstract identity marks. */
export function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

export function formatCurrency(value: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
  }).format(value);
}
