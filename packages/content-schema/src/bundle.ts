import type { FieldReadyCoverage } from './schemas/fieldReady.ts';
import type { ContentType, Territory } from './ids.ts';
import type {
  Campaign,
  Client,
  Exercise,
  GhlFeature,
  GlossaryEntry,
  LearningUnit,
  Portfolio,
  Project,
  Rubric,
  Scenario,
  Skill,
  VoiceCharacter,
} from './schemas/index.ts';

/**
 * The compiled curriculum bundle (spec §100, CNT-006): what the app and the Worker consume.
 * Everything here is plain JSON, sorted by ID, produced by `compileSources` at build time.
 */

export const ISSUE_CODES = [
  // files
  'FIELD_READY_COVERAGE',
  'FIELD_READY_GHL_CURRENT',
  'ADVANCED_COVERAGE',
  'ADVANCED_GHL_CURRENT',
  'ADVANCED_AI_ORDER',
  'INVALID_FORMAT',
  'PARSE_ERROR',
  'SCHEMA',
  'ID_MISMATCH',
  'DUPLICATE_ID',
  'MANIFEST',
  'LOCK_MISMATCH',
  // references
  'MISSING_SKILL',
  'MISSING_PREREQUISITE',
  'PREREQUISITE_CYCLE',
  'TERRITORY_MISMATCH',
  'MISSING_GHL_FEATURE',
  'MISSING_CLIENT',
  'MISSING_VOICE_CHARACTER',
  'VOICE_CLIENT_MISMATCH',
  'MISSING_SCENARIO',
  'MISSING_WORKFLOW',
  'MISSING_CAMPAIGN',
  'MISSING_PROJECT',
  'MISSING_EXERCISE',
  'MISSING_RUBRIC',
  'MISSING_PORTFOLIO',
  // semantics
  'CAMPAIGN_PREREQUISITE_ORDER',
  'CAMPAIGN_MISSING_PREREQUISITE',
  'ASSESSES_NOT_IN_CAMPAIGN',
  'REAL_GHL_AS_SIMULATOR_ACTION',
  'WORKFLOW_GRAPH_INVALID',
  'REMOVED_FEATURE_REFERENCED',
  'FEATURE_TYPE_MISMATCH',
  'SCENARIO_CLIENT_MISMATCH',
  'RUBRIC_TYPE_MISMATCH',
  'HIDDEN_FACT_EXPOSED',
  'PRICING_ECONOMICS_MISSING',
  'PRICING_HOURS_MISMATCH',
  'PORTFOLIO_PROJECT_MISMATCH',
  'DUPLICATE_PROGRESSION_NUMBER',
  'MDX_SYNTAX',
  'UNKNOWN_EMBED',
  'EMBED_MISSING_ATTRIBUTE',
  // warnings
  'ORPHAN_SKILL',
  'SKILL_NO_UNIT',
  'SKILL_NO_PRACTICE',
  'FEATURE_NEEDS_REVIEW_USED',
  'DEPRECATED_FEATURE_USED',
  'FEATURE_STALE',
  'UNIT_NO_EMBEDS',
  'GATE_WITHOUT_PROJECT',
  'GATE_WITHOUT_SKILLS',
] as const;

export type IssueCode = (typeof ISSUE_CODES)[number];

export interface ContentIssue {
  level: 'error' | 'warning';
  code: IssueCode;
  /** Source path relative to the content root, or null for whole-tree problems. */
  file: string | null;
  id?: string;
  /** Dotted path inside the record, when known (e.g. `gates.3.skills.1`). */
  path?: string;
  message: string;
}

export interface SkillGraph {
  /** Every skill ID in prerequisite order (prerequisites first). */
  order: string[];
  /** Longest prerequisite chain above each skill (roots are 0). */
  depth: Record<string, number>;
  /** Skills that list the key as a prerequisite. */
  dependents: Record<string, string[]>;
  /** Skill IDs per territory; every territory is present, possibly empty. */
  territories: Record<Territory, string[]>;
}

export interface CampaignPathGate {
  gate: string;
  number: number;
  name: string;
  /** Gate skills in prerequisite order. */
  skills: string[];
  assesses: string[];
  projects: string[];
}

export interface CampaignPath {
  campaign: string;
  gates: CampaignPathGate[];
  /** Every skill the campaign trains, in path order. */
  ordered_skills: string[];
  /** Prerequisites satisfied by `requires_campaigns` rather than by this campaign. */
  inherited_skills: string[];
}

export interface ContentIndexes {
  exercises_by_skill: Record<string, string[]>;
  units_by_skill: Record<string, string[]>;
  features_by_skill: Record<string, string[]>;
  skills_by_feature: Record<string, string[]>;
  exercises_by_feature: Record<string, string[]>;
  exercises_by_scenario: Record<string, string[]>;
  scenarios_by_client: Record<string, string[]>;
  exercises_by_client: Record<string, string[]>;
  projects_by_client: Record<string, string[]>;
  campaigns_by_skill: Record<string, string[]>;
}

/** One row of the Skill × Learn / Guided / … matrix (spec §137, CUR-033). Values are counts. */
export interface ContentCoverageRow {
  skill: string;
  title: string;
  territory: Territory;
  tier: string;
  learn: number;
  guided: number;
  practice: number;
  fix: number;
  independent: number;
  pressure: number;
  fieldwork: number;
  sales_use: number;
  /** Columns the skill's own mastery requirements say it needs but content does not provide. */
  gaps: string[];
}

/** One row of the GHL Feature × Skill / Simulator / … matrix (spec §138, GHL-007). */
export interface GhlCoverageRow {
  feature: string;
  official_name: string;
  status: string;
  fidelity: string;
  skills: string[];
  /** Referenced by a simulator exercise or a scenario workflow (so the Workflow Lab must offer it). */
  simulator: boolean;
  exercises: string[];
  fieldwork: string[];
  last_verified: string;
}

export interface FreshnessRow {
  feature: string;
  official_name: string;
  status: string;
  last_verified: string;
  days_since_verified: number;
  reason: 'needs_review' | 'stale' | 'deprecated';
}

export interface SearchEntry {
  type: ContentType;
  id: string;
  title: string;
  keywords: string[];
}

export interface ContentBundle {
  content_version: string;
  content_hash: string;
  schema_version: number;
  counts: Record<ContentType, number>;
  skills: Skill[];
  ghl_features: GhlFeature[];
  campaigns: Campaign[];
  learning_units: LearningUnit[];
  exercises: Exercise[];
  scenarios: Scenario[];
  clients: Client[];
  voice_characters: VoiceCharacter[];
  rubrics: Rubric[];
  projects: Project[];
  portfolio: Portfolio[];
  glossary: GlossaryEntry[];
  graph: SkillGraph;
  campaign_paths: CampaignPath[];
  indexes: ContentIndexes;
  coverage: {
    field_ready?: FieldReadyCoverage;
    advanced?: { topic: string; units: string[]; exercises: string[] }[];
    content: ContentCoverageRow[];
    ghl: GhlCoverageRow[];
  };
  freshness: FreshnessRow[];
  search: SearchEntry[];
  warnings: ContentIssue[];
}

/** The small slice the Worker needs (health, attempt stamping) without the whole bundle. */
export interface ContentVersionInfo {
  content_version: string;
  content_hash: string;
  schema_version: number;
  counts: Record<ContentType, number>;
}

export function versionInfoOf(bundle: ContentBundle): ContentVersionInfo {
  return {
    content_version: bundle.content_version,
    content_hash: bundle.content_hash,
    schema_version: bundle.schema_version,
    counts: bundle.counts,
  };
}
