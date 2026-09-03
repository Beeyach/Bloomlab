/**
 * The mastery rules, in one place, versioned (spec §28–§34, TA§68–§70; MAS-001 … MAS-011).
 *
 * Every number the engine uses lives here so a rule change is a visible diff and every stored
 * evaluation records which rule set produced it (`rules_version`). Nothing below is a score
 * threshold: states are earned by kinds of evidence, assistance and repetition.
 */

export const MASTERY_RULES_VERSION = '2026.09.02-r2';

/** The eight states (spec §29). NEEDS_REFRESH is an overlay on an earned ladder state. */
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

/** The ladder in order; a skill's earned state is the highest rung whose rule holds. */
export const MASTERY_LADDER = [
  'UNSEEN',
  'LEARNING',
  'GUIDED',
  'PRACTICED',
  'INDEPENDENT',
  'PRESSURE_TESTED',
  'MASTERED',
] as const;
export type LadderState = (typeof MASTERY_LADDER)[number];

export const ladderRank = (state: LadderState): number => MASTERY_LADDER.indexOf(state);

/** Assistance meter (spec §34, MAS-007). Tracked quietly; never shown as a grade. */
export const ASSISTANCE_LEVELS = ['independent', 'light', 'guided', 'heavy'] as const;
export type AssistanceLevel = (typeof ASSISTANCE_LEVELS)[number];

export const assistanceRank = (level: AssistanceLevel): number => ASSISTANCE_LEVELS.indexOf(level);

/** Hint levels (spec §28, EXR-022). */
export const HINT_LEVELS = ['nudge', 'concept_reminder', 'worked_example'] as const;
export type HintLevel = (typeof HINT_LEVELS)[number];

/**
 * How hint use rolls up into an assistance level (MAS-007, MAS-011):
 * - a worked example is heavy assistance, always;
 * - a concept reminder, or three or more nudges, is guided;
 * - one or two nudges is light assistance;
 * - no hints is independent.
 * A guided-practice exercise (or an exercise authored in `guided` mode) is guided at least.
 */
export const ASSISTANCE_RULES = {
  worked_example: 'heavy',
  concept_reminder: 'guided',
  nudges_for_guided: 3,
  nudges_for_light: 1,
} as const;

/** What a piece of evidence represents (spec §30; the user's list for Phase 6). */
export const EVIDENCE_KINDS = [
  /** Read a learning unit, watched a simulation. Never more than LEARNING on its own. */
  'exposure',
  /** A quiz. Never more than LEARNING on its own (MAS-002). */
  'quiz',
  /** Guided practice: an exercise authored as guided, or done with heavy help. */
  'guided_practice',
  /** A deterministic exercise (BUILD IT, FIX IT, RUN THE LEAD, EDGE CASE, …). */
  'deterministic_exercise',
  /** An exercise authored as independent (no lesson at hand, hints reduce independence). */
  'independent_exercise',
  /** A pressure test (REBUILD BLIND, timed or no-hint variants). */
  'pressure_test',
  /** EXPLAIN IT: explaining the system to an audience. */
  'explanation',
  /** The selling families: PROSPECT IT, AUDIT IT, WRITE IT, SAY IT, PRICE IT, NEGOTIATE IT. */
  'sales_use',
  /** FIELDWORK: real work in GHL with evidence submitted. */
  'fieldwork',
  /** Real-GHL proof attached to any attempt (screenshots, configuration answers, test results). */
  'real_ghl',
  /** A short retrieval challenge injected into a later session (spec §32). */
  'retrieval',
] as const;
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

export const EVIDENCE_RESULTS = ['passed', 'failed', 'partial', 'exposed'] as const;
export type EvidenceResult = (typeof EVIDENCE_RESULTS)[number];

/** Kinds that are attempts at doing the skill (everything except exposure and quizzes). */
export const PRACTICE_KINDS: readonly EvidenceKind[] = [
  'guided_practice',
  'deterministic_exercise',
  'independent_exercise',
  'pressure_test',
  'explanation',
  'sales_use',
  'fieldwork',
  'real_ghl',
  'retrieval',
];

/** Kinds whose unassisted pass counts as an independent demonstration. Guided practice never does. */
export const INDEPENDENT_KINDS: readonly EvidenceKind[] = [
  'deterministic_exercise',
  'independent_exercise',
  'pressure_test',
  'explanation',
  'sales_use',
  'fieldwork',
  'real_ghl',
  'retrieval',
];

/** Kinds that leave a skill at LEARNING no matter how many there are (spec §29, MAS-002). */
export const EXPOSURE_ONLY_KINDS: readonly EvidenceKind[] = ['exposure', 'quiz'];

/**
 * The ladder rules (spec §29–§30, §34):
 * - LEARNING: any evidence at all.
 * - GUIDED: at least one pass of a practice kind, with any assistance (a worked example counts here).
 * - PRACTICED: at least one pass of an independent-capable kind with at most light assistance.
 * - INDEPENDENT: at least one pass of an independent-capable kind with no assistance at all.
 * - PRESSURE_TESTED: INDEPENDENT plus an unassisted pass of a pressure test.
 * - MASTERED: the skill's own `independent_evidence` count of unassisted passes (never fewer than
 *   `mastered_min_independent`), spread over `mastered_min_demonstrations` distinct demonstrations
 *   (different exercise or different day), plus every requirement the skill declares: pressure
 *   test, real-GHL fieldwork, sales use.
 * A pass with any critical failure is not a pass (spec §31, MAS-004).
 */
export const LADDER_RULES = {
  mastered_min_independent: 2,
  mastered_min_demonstrations: 2,
  practiced_max_assistance: 'light',
} as const;

/** Confidence in [0, 1]: a reading of how much the evidence supports the state (TA§68). */
export const CONFIDENCE_RULES = {
  base: {
    UNSEEN: 0,
    LEARNING: 0.1,
    GUIDED: 0.25,
    PRACTICED: 0.4,
    INDEPENDENT: 0.6,
    PRESSURE_TESTED: 0.75,
    MASTERED: 0.9,
  } as Record<LadderState, number>,
  /** Each unassisted pass beyond the first adds this, up to the cap. */
  extra_independent_bonus: 0.02,
  extra_independent_cap: 0.1,
  /** Subtracted in proportion to the failure rate over the recent attempt window. */
  recent_failure_penalty: 0.3,
  /** Subtracted once the review is overdue. */
  overdue_penalty: 0.1,
  /** A skill that needs refresh never reads more confident than this. */
  needs_refresh_cap: 0.5,
} as const;

/**
 * Review scheduling (spec §32, TA§69; MAS-005, MAS-009). Evidence-based, not an Anki clone:
 * interval by earned state, shortened by importance and by recent failures; overdue past the
 * grace window (or a failed retrieval) means NEEDS_REFRESH. The earned state is never erased —
 * a retrieval passed with at most light assistance restores it because the evidence history is
 * what is evaluated; a guided or worked-example pass does not (MAS-011).
 */
export const REVIEW_RULES = {
  /** Days from the last demonstration to the next review, by earned state. */
  interval_days: {
    PRACTICED: 10,
    INDEPENDENT: 21,
    PRESSURE_TESTED: 35,
    MASTERED: 60,
  } as Partial<Record<LadderState, number>>,
  /** Importance = 1 + these, from the skill's own requirements; the interval is divided by it. */
  importance: { pressure_test: 0.5, fieldwork_required: 0.5, sales_use: 0.25 },
  /** Interval × (1 − failure_shortening × failure_rate). */
  failure_shortening: 0.5,
  /** Attempts considered for the failure rate. */
  failure_window: 5,
  min_interval_days: 3,
  /** Overdue by more than this → NEEDS_REFRESH. */
  refresh_grace_days: 14,
  /** Priority: importance × (1 + overdue_days / this) + failure_rate × failure_weight + refresh bonus. */
  overdue_days_per_point: 7,
  failure_weight: 2,
  needs_refresh_bonus: 3,
  /** A retrieval challenge is short by design (spec §32). */
  retrieval_minutes: 5,
} as const;

/** Session builder (spec §33, TA§70; MAS-006). Deterministic: no AI decides what to study. */
export const SESSION_RULES = {
  budgets_minutes: { '30m': 30, '1h': 60, '2h': 120, deep: 240 } as const,
  /** Share of the budget offered to due retrieval first (never more than this; never blocking). */
  retrieval_share: 0.2,
  /** Share of the budget for repairing weak prerequisites and recently failed or assisted work. */
  repair_share: 0.25,
  /** Attempts in this window count as "recent" for weaknesses and assistance dependence. */
  recent_window_days: 14,
  /** Recent passes with guided or heavy assistance at or above this share → retry without hints. */
  assistance_dependence_threshold: 0.5,
  default_unit_minutes: 15,
  default_exercise_minutes: 20,
} as const;

export type SessionLength = keyof typeof SESSION_RULES.budgets_minutes;
export const SESSION_LENGTHS = Object.keys(SESSION_RULES.budgets_minutes) as SessionLength[];
