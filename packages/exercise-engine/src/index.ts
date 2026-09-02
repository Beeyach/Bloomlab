/** Exercise families the engine must support (spec §27). The runner itself is Phase 9. */
export const EXERCISE_TYPES = [
  'BUILD_IT',
  'FIX_IT',
  'RUN_THE_LEAD',
  'EDGE_CASE',
  'WHAT_WOULD_YOU_BUILD',
  'ARCHITECTURE_DECISION',
  'FUNNEL_AUTOPSY',
  'FUNNEL_ASSEMBLY',
  'PROSPECT_IT',
  'AUDIT_IT',
  'WRITE_IT',
  'SAY_IT',
  'PRICE_IT',
  'NEGOTIATE_IT',
  'EXPLAIN_IT',
  'REBUILD_BLIND',
  'FIELDWORK',
  'BOSS_CLIENT',
] as const;

export type ExerciseType = (typeof EXERCISE_TYPES)[number];

/** Hint levels; assistance is tracked per attempt (spec §28). */
export const HINT_LEVELS = ['nudge', 'concept_reminder', 'worked_example'] as const;

export type HintLevel = (typeof HINT_LEVELS)[number];
