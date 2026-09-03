/**
 * Every constant the deterministic grader uses, in one place, under one version. A change to any
 * of it is a version bump and a visible diff; attempts keep the version that judged them.
 */

/** Bumped whenever grading behaviour changes (date-based, like the mastery rules). */
export const EXERCISE_GRADER_VERSION = '2026.09.04-r1';

export const SCORING_RULES = {
  /**
   * Which tiers make up the score. `critical` is a gate, never a number; `bonus` is reported and
   * deliberately excluded from the denominator so an unearned bonus cannot lower a score.
   * Phase 12 (EXR-023) introduces the weighted dimensional model for workflow builds; until an
   * assertion can name the dimension it belongs to, every scored check counts once (D-067).
   */
  scored_tiers: ['required', 'quality'] as const,
  /** `expected_outcomes` without an authored tier are required (backward compatible). */
  default_expected_tier: 'required' as const,
  /** `critical_failures` are always critical, whatever they may say. */
  critical_tier: 'critical' as const,
};

export const TIMING_RULES = {
  /**
   * When several events of the type occur, the one closest to the target instant is judged; ties
   * break on (timestamp, emitted index) so the result never depends on sort stability.
   */
  choose: 'closest_to_target' as const,
};

export const SEQUENCE_RULES = {
  /**
   * `before` passes when its earliest occurrence precedes the earliest occurrence of `after`.
   * Equal timestamps are ordered by emitted index. A missing event on either side fails.
   */
  compare: 'earliest_occurrence' as const,
};
