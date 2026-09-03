/**
 * @bloomlab/content-schema — browser-safe entry: content types, ID conventions, Zod schemas
 * and the compiled-bundle types (spec §98–§101). The compiler lives in `./node`; the Vite
 * plugin in `./vite`.
 */
export {
  CONTENT_TYPES,
  EXERCISE_TYPES,
  ID_PATTERNS,
  TERRITORIES,
  isValidId,
  territoryOfSkillId,
  typeOfExerciseId,
  type ContentType,
  type ExerciseType,
  type Territory,
} from './ids.ts';
export * from './schemas/index.ts';
export {
  ISSUE_CODES,
  versionInfoOf,
  type CampaignPath,
  type CampaignPathGate,
  type ContentBundle,
  type ContentCoverageRow,
  type ContentIndexes,
  type ContentIssue,
  type ContentVersionInfo,
  type FreshnessRow,
  type GhlCoverageRow,
  type IssueCode,
  type SearchEntry,
  type SkillGraph,
} from './bundle.ts';
