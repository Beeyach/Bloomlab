export { APP_VERSION } from './version';
export {
  RUNTIME_ENVIRONMENTS,
  parseRuntimeEnvironment,
  type RuntimeEnvironment,
} from './environment';
export {
  FEATURE_FLAGS,
  getFeatureFlags,
  isFeatureEnabled,
  type FeatureFlag,
  type FeatureFlagSet,
} from './featureFlags';
export {
  ENVELOPE_FIELDS,
  SYNC_ENTITIES,
  SYNC_ENTITY_KINDS,
  isSyncEntity,
  type ApiError,
  type DeviceSummary,
  type DevicesResponse,
  type LinkRequest,
  type LinkResponse,
  type PullChange,
  type PullRequest,
  type PullResponse,
  type PushOperation,
  type PushOutcome,
  type PushRequest,
  type PushResponse,
  type SyncEntity,
  type SyncEnvelope,
  type SyncKind,
  type SyncRecord,
} from './sync';
export { decideMerge, type MergeDecision } from './syncMerge';
export {
  SYNC_KEY_BYTES,
  SYNC_KEY_PREFIX,
  decodeSyncKey,
  formatSyncKey,
  generateSyncKey,
  normalizeSyncKey,
  type SyncKeyCheck,
} from './syncKey';
export type {
  AiMode,
  AiCategory,
  AiGrading,
  AiEvaluationRequest,
  AiEvaluationResponse,
  AiSettings,
} from './ai';
