import type {
  AssistanceLevel,
  EvidenceKind,
  EvidenceResult,
  HintLevel,
  LadderState,
  MasteryState,
  SessionLength,
} from './rules.ts';

/** The release triplet plus the content hash and the rule set (spec §101, MAS-003, INF-013). */
export interface EvidenceVersions {
  app: string;
  content: string;
  content_hash: string;
  simulator: string;
  rules: string;
}

/** Real-GHL proof (spec §30 "real-GHL evidence where required", FLD-*). */
export interface RealGhlEvidence {
  required: boolean;
  provided: boolean;
  /** What was submitted: screenshot, configuration_answers, explanation, test_results. */
  evidence: string[];
}

export interface EvidenceSource {
  type: 'learning_unit' | 'exercise' | 'retrieval' | 'fieldwork' | 'placement' | 'manual';
  /** Learning unit id, exercise id, … — null for a manual entry. */
  id: string | null;
}

/** Exercise authoring modes that shape the evidence (content-schema `EXERCISE_MODES`). */
export type ExerciseMode = 'guided' | 'practice' | 'independent' | 'pressure';

/**
 * One piece of mastery evidence (spec §30, MAS-003): skill, exercise, result, score,
 * assistance, difficulty, critical failures, date, simulator version, content version and
 * real-GHL evidence. Append-only: never edited after it is written.
 */
export interface SkillEvidence {
  id: string;
  learner_id: string;
  skill_id: string;
  kind: EvidenceKind;
  source: EvidenceSource;
  exercise_id: string | null;
  exercise_type: string | null;
  attempt_id: string | null;
  result: EvidenceResult;
  /** 0–100 when the source grades numerically; null otherwise. */
  score: number | null;
  assistance: AssistanceLevel;
  hints_used: HintLevel[];
  difficulty: number;
  critical_failures: string[];
  occurred_at: string;
  versions: EvidenceVersions;
  real_ghl: RealGhlEvidence | null;
  mode: ExerciseMode | null;
}

/** The slice of a content skill the engine reads (structurally satisfied by `Skill`). */
export interface SkillDefinition {
  id: string;
  title?: string;
  territory?: string;
  tier?: string;
  prerequisites: string[];
  mastery_requirements: {
    independent_evidence: number;
    pressure_test: boolean;
    fieldwork_required: boolean;
    sales_use?: boolean;
  };
}

export type MissingRequirement =
  | 'practice'
  | 'independent_evidence'
  | 'pressure_test'
  | 'real_ghl_fieldwork'
  | 'sales_use'
  | 'refresh';

export interface EvidenceCounts {
  evidence: number;
  exposures: number;
  attempts: number;
  passes: number;
  guided_passes: number;
  practiced_passes: number;
  independent_passes: number;
  /** Distinct independent demonstrations (different exercise or day). */
  independent_demonstrations: number;
  pressure_passes: number;
  fieldwork_passes: number;
  sales_use_passes: number;
  failures: number;
}

/** What the mastery engine says about one skill (TA§68 outputs and the fields behind them). */
export interface SkillEvaluation {
  skill_id: string;
  /** The state to show: the ladder state, or NEEDS_REFRESH overlaid on it. */
  state: MasteryState;
  /** The earned rung of the ladder; never lowered by time or by review. */
  ladder_state: LadderState;
  /** When `state` is NEEDS_REFRESH: the ladder state it refreshes back to. */
  refresh_from: LadderState | null;
  confidence: number;
  missing_requirements: MissingRequirement[];
  review_priority: number;
  review_due: string | null;
  refresh_reason: 'overdue' | 'failed_retrieval' | null;
  last_demonstrated: string | null;
  last_attempt_at: string | null;
  last_result: EvidenceResult | null;
  failure_rate: number;
  importance: number;
  counts: EvidenceCounts;
  rules_version: string;
}

export interface ReviewItem {
  skill_id: string;
  due_at: string;
  priority: number;
  reason: 'due' | 'overdue' | 'needs_refresh';
  last_demonstrated: string | null;
  state: MasteryState;
}

export interface ReviewSchedule {
  /** Due now, highest priority first. Never blocks anything (MAS-005). */
  due: ReviewItem[];
  /** Scheduled but not yet due, soonest first. */
  upcoming: ReviewItem[];
}

/** The slice of a content campaign the engine reads (structurally satisfied by `Campaign`). */
export interface CampaignDefinition {
  id: string;
  title?: string;
  requires_campaigns: string[];
  gates: {
    id: string;
    number: number;
    name: string;
    placement: boolean;
    skills: string[];
    assesses: string[];
    pass_criteria: {
      independent_evidence_per_skill: number;
      pressure_test_required: boolean;
      fieldwork_required: boolean;
    };
    projects: string[];
    projects_required?: boolean;
  }[];
}

export type GateStatus = 'locked' | 'available' | 'in_progress' | 'passed' | 'optional';

export interface GateSkillStatus {
  skill_id: string;
  state: MasteryState;
  /** Every prerequisite is at least INDEPENDENT on the ladder (refresh never blocks). */
  available: boolean;
  /** Meets this gate's pass criteria. */
  passes: boolean;
  missing: MissingRequirement[];
  unsatisfied_prerequisites: string[];
}

export interface GateEvaluation {
  missing_projects?: string[];
  gate: string;
  number: number;
  name: string;
  status: GateStatus;
  skills: GateSkillStatus[];
  /** Placement gates: assessed skills already demonstrated independently. */
  cleared: string[];
  passed_count: number;
  total: number;
}

export interface CampaignEvaluation {
  campaign_id: string;
  gates: GateEvaluation[];
  /** The first gate that is not passed (placement gates never count as the current gate). */
  current_gate: string | null;
  /** Skills of the current gate that are available and not yet passing, in path order. */
  next_required: string[];
  /** Available, not-yet-passing skills in later gates: the learner may work ahead (spec §7). */
  work_ahead: string[];
  /** Every skill whose prerequisites are satisfied. */
  unlocked_skills: string[];
  passed_gates: string[];
  complete: boolean;
  rules_version: string;
}

/** Exercise facts the session builder needs (from the compiled content bundle). */
export interface ExerciseSummary {
  id: string;
  type: string;
  mode: ExerciseMode;
  estimated_minutes: number;
  skills: string[];
  fieldwork_required: boolean;
}

export interface SessionContent {
  units_by_skill: Record<string, string[]>;
  unit_minutes: Record<string, number>;
  exercises_by_skill: Record<string, string[]>;
  exercises: Record<string, ExerciseSummary>;
}

export interface SessionFocus {
  skill_id?: string;
  territory?: string;
}

export interface SessionInput {
  length: SessionLength;
  now: Date;
  skills: SkillDefinition[];
  evaluations: SkillEvaluation[];
  campaign: CampaignEvaluation | null;
  /** Skills in campaign path order (from the compiled campaign path); used for tie-breaks. */
  path_order: string[];
  review: ReviewSchedule;
  recent_evidence: SkillEvidence[];
  content: SessionContent;
  focus?: SessionFocus | null;
  /** Exercise ids of pending fieldwork (from gates requiring fieldwork) and the active project. */
  pending_fieldwork?: string[];
  active_project?: { id: string; next_exercises: string[] } | null;
  /** Item ids already completed in this sitting: "Continue" builds the next session without them. */
  exclude?: string[];
}

export type SessionItemKind = 'unit' | 'exercise' | 'retrieval';

export interface SessionItem {
  /** Stable id: `<kind>:<content id>:<skill id>`. */
  id: string;
  kind: SessionItemKind;
  /** Learning unit id, exercise id, or the skill id for a bare retrieval prompt. */
  content_id: string;
  skill_id: string;
  minutes: number;
  reason: string;
}

export type SessionBlockKind =
  'retrieval' | 'repair' | 'focus' | 'campaign' | 'fieldwork' | 'project';

export interface SessionBlock {
  kind: SessionBlockKind;
  title: string;
  items: SessionItem[];
}

export interface SessionPlan {
  length: SessionLength;
  budget_minutes: number;
  planned_minutes: number;
  blocks: SessionBlock[];
  /** Share of recent passes that needed guided or heavy assistance (spec §34). */
  assistance_dependence: number;
  /** The learner can always continue: nothing here is a lock (spec §7, §33). */
  continue_available: true;
  rules_version: string;
  /** Why the plan looks the way it does, in order of decisions taken. */
  notes: string[];
}
