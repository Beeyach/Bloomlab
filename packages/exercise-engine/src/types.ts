import type { AssistanceLevel, HintLevel } from '@bloomlab/mastery-engine';

/**
 * The deterministic exercise grader's contract (spec §27, TA§31–§33; EXR-001 … EXR-003).
 *
 * Nothing here knows about React, the DOM, IndexedDB, the network or the simulator package. A
 * runtime — the Phase 10 simulator, a fieldwork submission, or the runner's own capture of what
 * the learner wrote — translates its own state into a `GradingContext`, and the grader turns
 * that plus the authored exercise into a `GradeReport`. Grading never reads the wall clock.
 */

/** One thing that happened during a run, in simulator time. */
export interface GradingEvent {
  /** Event name as authored: `sms.sent`, `tag.added`, `workflow.enrolled`. */
  type: string;
  /** When it happened, ISO 8601, in the run's own clock — never `Date.now()`. */
  at: string;
  /**
   * Position in the run's emitted order. Two events with the same timestamp are ordered by this,
   * so sequence and timing results never depend on sort stability.
   */
  index: number;
  /** Flat fields the authored `where` conditions match on (`contact_id`, `purpose`, …). */
  fields: Record<string, string | number | boolean | null>;
}

/**
 * A funnel as the grader sees it (EXR-011): steps in order, blocks in order, and for a capture
 * block the account entity it is connected to. No styling, no layout, nothing visual — the same
 * reason a workflow arrives without node coordinates.
 */
export interface GradingFunnel {
  id: string;
  name?: string;
  steps: GradingFunnelStep[];
}

export interface GradingFunnelStep {
  id: string;
  name?: string;
  /** `capture` · `offer` · `booking` · `checkout` · `confirmation` · `content`. */
  purpose: string;
  blocks: GradingFunnelBlock[];
}

export interface GradingFunnelBlock {
  id: string;
  /** `headline` · `problem` · `outcome` · `proof` · `benefits` · `objections` · `cta` · … */
  role: string;
  /** The account entity a capture block uses, when it has been connected to one. */
  reference_id?: string | null;
  /** Whether that entity is actually in the account the funnel belongs to. */
  reference_resolved?: boolean;
}

/** A workflow as the grader sees it: normalized, with no visual positions (EXR-002). */
export interface GradingWorkflow {
  id: string;
  name?: string;
  /** The trigger's verified GHL feature id, e.g. `GHL-WF-APPOINTMENT-STATUS`. */
  trigger: { ghl_feature_id: string; filters?: Record<string, unknown>[] } | null;
  nodes: GradingNode[];
  settings?: { allow_reentry?: boolean };
}

export interface GradingNode {
  id: string;
  /** `action` · `wait` · `branch` · `goal` · `end`, as the workflow schema authors them. */
  type: string;
  /** The verified GHL feature this node performs, when it performs one. */
  ghl_feature_id?: string | null;
  label?: string | null;
}

/** Everything an architecture assertion may inspect. Node coordinates are deliberately absent. */
export interface GradingArchitecture {
  workflows: GradingWorkflow[];
  /** The funnels the learner built, when a runtime can say which those are (EXR-011, D-121). */
  funnels?: GradingFunnel[];
}

/** Where each part of a grading context comes from; used to refuse a grade rather than fake one. */
export const CONTEXT_SOURCES = [
  'state',
  'events',
  'references',
  'architecture',
  'learner',
] as const;
export type ContextSource = (typeof CONTEXT_SOURCES)[number];

/**
 * State roots that hold what the learner supplied rather than what a runtime produced. A `state`
 * assertion on `prediction.tag`, `decision.choice`, `answer.names_missing_information` or
 * `written.hypothesis_mentions` is gradable from the runner alone; one on `contacts.maria.tags`
 * needs a simulator.
 *
 * `written` arrived with Phase 15 for exercises that ask for more than one long-form answer and
 * need them kept apart (EXR-010, D-143). Adding a root does not change how anything already
 * authored is judged: an exercise with no written fields has an empty `written` and every earlier
 * assertion reads exactly what it read before.
 */
export const LEARNER_STATE_ROOTS = [
  'prediction',
  'decision',
  'answer',
  'written',
  /**
   * Phase 16's selling families (EXR-012 … EXR-018, CONV-002). Each root is one projection of
   * what the learner actually did: the businesses they judged, the findings they wrote and how
   * they supported them, the messages they sent, the two explanations, and the thread they held.
   * The runner computes them once, from pure functions the work area shows its feedback from, so
   * a figure a learner reads and the figure a check reads are the same figure.
   */
  'prospects',
  'audit',
  'message',
  'explanation',
  'conversation',
  /**
   * Phase 17's deal (EXR-016, PRI-002). What the learner quoted, what follows from it, and what
   * the scenario's own economics say about it. Same rule as the sales roots: one function
   * produces the figures the deal desk shows and the figures a check reads.
   */
  'price',
  'negotiation',
] as const;

export interface GradingContext {
  /**
   * The state tree assertions address by path. A runtime merges its own state with the learner's
   * `prediction` / `decision` / `answer` roots; both are addressed the same way.
   */
  state: Record<string, unknown>;
  events: GradingEvent[];
  /** Named instants timing assertions measure against: `appointment.start`, `appointment.no_show`. */
  references: Record<string, string>;
  architecture: GradingArchitecture | null;
  /**
   * What this context actually supplies. An assertion needing a source that is absent is reported
   * as unevaluated, and the report can never be a pass (EXR-024: no fake grading).
   */
  provides: readonly ContextSource[];
}

/** Which bucket an assertion belongs to (EXR-003). */
export const ASSERTION_TIERS = ['critical', 'required', 'quality', 'bonus'] as const;
export type AssertionTier = (typeof ASSERTION_TIERS)[number];

/**
 * The five dimensions a workflow build is scored on (EXR-023, spec §31). An exercise that authors
 * `grading.weights` is scored per dimension; an assertion names its dimension or is placed by its
 * type (`dimensionOf`).
 */
export const SCORING_DIMENSIONS = [
  'correctness',
  'edge_cases',
  'architecture',
  'maintainability',
  'explanation',
] as const;
export type ScoringDimension = (typeof SCORING_DIMENSIONS)[number];
export type GradingWeights = Record<ScoringDimension, number>;

export type AssertionType = 'state' | 'event' | 'timing' | 'architecture' | 'negative' | 'sequence';

/** The authored assertion shape the grader reads (structurally satisfied by the content schema). */
export interface AssertionDefinition {
  id: string;
  description: string;
  type: AssertionType;
  tier?: AssertionTier;
  /** Which scored dimension this check counts toward; derived from the type when absent. */
  dimension?: ScoringDimension;
  // state
  path?: string;
  operator?: 'equals' | 'contains' | 'not_contains' | 'exists' | 'absent' | 'gte' | 'lte';
  value?: string | number | boolean;
  // event / negative / timing
  event?: string;
  count?: { exactly?: number; min?: number; max?: number };
  where?: Record<string, string | number | boolean>;
  relative_to?: string;
  offset_minutes?: number;
  tolerance_minutes?: number;
  // architecture
  requirement?:
    | 'trigger_exists'
    | 'action_exists'
    | 'branch_exists'
    | 'feature_used'
    | 'feature_not_used'
    | 'node_count_max'
    | 'reentry_disabled'
    | 'funnel_step_exists'
    | 'funnel_step_order'
    | 'funnel_block_exists'
    | 'funnel_block_absent'
    | 'funnel_block_order'
    | 'funnel_reference_connected'
    | 'funnel_step_count_max';
  ghl_feature?: string;
  /** Funnel architecture: the block role a requirement is about. */
  role?: string;
  /** Funnel architecture: the step purpose a requirement is about, or a block's containing step. */
  purpose?: string;
  // sequence, and the two funnel order requirements
  before?: string;
  after?: string;
}

/** The slice of an authored exercise the grader needs (structurally satisfied by `Exercise`). */
export interface ExerciseDefinition {
  id: string;
  type: string;
  mode: string;
  expected_outcomes: readonly AssertionDefinition[];
  critical_failures: readonly AssertionDefinition[];
  grading: {
    mode: 'deterministic' | 'rubric' | 'mixed';
    rubric?: string;
    pass_threshold: number;
    /** When present, the score is the weighted mean of the dimensions that have checks (EXR-023). */
    weights?: GradingWeights;
  };
}

/** What one assertion decided, and why (EXR-002: never merely "wrong"). */
export interface AssertionResult {
  id: string;
  description: string;
  type: AssertionType;
  tier: AssertionTier;
  /** The dimension this result was scored under (EXR-023). */
  dimension: ScoringDimension;
  passed: boolean;
  /** What the exercise asked for, in words: "exactly 1 sms.sent where contact_id=maria". */
  expected: string;
  /** What the run actually showed: "2 matching events". */
  observed: string;
  /** Machine-readable detail for diagnostics and later UI. */
  detail?: Record<string, unknown>;
  /** The context could not supply what this assertion reads; it is not a pass and not a fail. */
  unevaluated?: boolean;
  /** Which source was missing, when unevaluated. */
  missing_source?: ContextSource;
}

export type GradeOutcome = 'passed' | 'failed' | 'partial';

export type GradeReason =
  /** A critical assertion failed; the numeric score cannot override it (MAS-004). */
  | 'critical_failure'
  | 'required_failure'
  | 'below_threshold'
  | 'threshold_met'
  /** The exercise names a rubric, which a later phase evaluates (AI-006, Phase 19). */
  | 'rubric_pending'
  /** At least one assertion needs a runtime this context does not provide. */
  | 'unevaluated_assertions'
  /** The exercise authored no scorable assertion. */
  | 'nothing_to_grade';

export interface GradeReport {
  rubric_evaluation?: {
    run_id: string;
    rubric_id: string;
    rubric_version: number;
    result: {
      score: number;
      rubric_results: { id: string; passed: boolean; reason: string }[];
      critical_issue: string | null;
      strengths: string[];
      improvements: string[];
      next_probe: string;
      confidence: number;
    };
  };
  exercise_id: string;
  /** The rules that judged this attempt; stored with it so a later change cannot rewrite it. */
  grader_version: string;
  outcome: GradeOutcome;
  reason: GradeReason;
  /**
   * 0–100, or null when nothing could be scored. Without weights: the share of scored checks that
   * passed. With weights: the weighted mean of each present dimension's pass share (EXR-023).
   */
  score: number | null;
  /** Per-dimension detail when the exercise is weighted; null for a flat score. */
  dimensions: Record<ScoringDimension, DimensionScore> | null;
  pass_threshold: number;
  assistance: AssistanceLevel;
  hints_used: readonly HintLevel[];
  /** Ids of the critical assertions that failed — these travel into the evidence record. */
  failed_critical: string[];
  tiers: Record<AssertionTier, AssertionResult[]>;
  counts: {
    scored_total: number;
    scored_passed: number;
    critical_total: number;
    critical_passed: number;
    unevaluated: number;
  };
  /** The rubric still owed, when the exercise is rubric-graded or mixed. */
  rubric_pending: string | null;
}

export interface DimensionScore {
  weight: number;
  total: number;
  passed: number;
  /** 0–1, or null when the dimension has no scored check and so carries no weight this time. */
  ratio: number | null;
}
