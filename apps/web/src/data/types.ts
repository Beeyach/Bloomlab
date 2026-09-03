/**
 * Local-first data types (spec §86–§87, §91; DATA-001, DATA-002, SYNC-007).
 *
 * Every record that will sync carries the envelope from spec §91 / TA§14. Timestamps are ISO 8601
 * strings so they sort, diff and travel to D1 unchanged.
 */

import type { GradeReport } from '@bloomlab/exercise-engine';
import type {
  AssistanceLevel,
  EvidenceCounts,
  EvidenceKind,
  EvidenceResult,
  EvidenceSource,
  EvidenceVersions,
  ExerciseMode,
  GateStatus,
  HintLevel,
  LadderState,
  MasteryState,
  MissingRequirement,
  RealGhlEvidence,
} from '@bloomlab/mastery-engine';
import type { SyncEntity, SyncEnvelope } from '@bloomlab/shared';

export type { SyncEntity, SyncEnvelope };

/** Syncable entities that have a local table today. Grows phase by phase. */
export const LOCAL_SYNC_ENTITIES = [
  'notes',
  'skill_evidence',
  'exercise_attempts',
  'skill_progress',
  'campaign_progress',
  'review_queue',
  // Phase 10: simulator saves. `sim_projects` is the run header (snapshot merge, so two devices
  // editing one run raise a conflict rather than silently picking a winner); `sim_events` and
  // `sim_snapshots` are append-only, which is exactly what an authoritative history wants.
  'sim_projects',
  'sim_events',
  'sim_snapshots',
] as const satisfies readonly SyncEntity[];
export type LocalSyncEntity = (typeof LOCAL_SYNC_ENTITIES)[number];

/** Derived rows: recomputed from evidence on every device, never authored (Phase 6). */
export const DERIVED_SYNC_ENTITIES = [
  'skill_progress',
  'campaign_progress',
  'review_queue',
] as const satisfies readonly LocalSyncEntity[];

/**
 * One piece of mastery evidence (spec §30, MAS-003), append-only. Same shape as the engine's
 * `SkillEvidence` plus the sync envelope; `versions` is the release triplet it was written under.
 */
export interface SkillEvidenceRecord extends SyncEnvelope {
  skill_id: string;
  kind: EvidenceKind;
  source: EvidenceSource;
  exercise_id: string | null;
  exercise_type: string | null;
  attempt_id: string | null;
  result: EvidenceResult;
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

/** One attempt at an exercise (or retrieval, fieldwork, placement); parent of its evidence rows. */
export interface ExerciseAttemptRecord extends SyncEnvelope {
  exercise_id: string | null;
  exercise_type: string | null;
  skill_ids: string[];
  source: EvidenceSource;
  started_at: string;
  completed_at: string;
  result: EvidenceResult;
  score: number | null;
  assistance: AssistanceLevel;
  hints_used: HintLevel[];
  difficulty: number;
  critical_failures: string[];
  mode: ExerciseMode | null;
  versions: EvidenceVersions;
  /**
   * What the deterministic grader decided, kept with the attempt so a later rules change cannot
   * rewrite history and the result view survives a reload (D-069). Absent on attempts recorded
   * before Phase 9 and on evidence entered by hand.
   */
  grade?: GradeReport | null;
}

/** Derived: the engine's evaluation of one skill, materialised for screens and sync. */
export interface SkillProgressRecord extends SyncEnvelope {
  skill_id: string;
  state: MasteryState;
  ladder_state: LadderState;
  refresh_from: LadderState | null;
  refresh_reason: 'overdue' | 'failed_retrieval' | null;
  confidence: number;
  missing_requirements: MissingRequirement[];
  review_priority: number;
  review_due: string | null;
  last_demonstrated: string | null;
  counts: EvidenceCounts;
  rules_version: string;
  content_version: string;
  computed_at: string;
}

/** Derived: where the learner stands in a campaign's gates. */
export interface CampaignProgressRecord extends SyncEnvelope {
  campaign_id: string;
  current_gate: string | null;
  gates: { gate: string; status: GateStatus; passed_count: number; total: number }[];
  passed_gates: string[];
  next_required: string[];
  work_ahead: string[];
  complete: boolean;
  rules_version: string;
  content_version: string;
  computed_at: string;
}

/** Derived: one row per skill that has ever been scheduled for review. */
export interface ReviewQueueRecord extends SyncEnvelope {
  skill_id: string;
  due_at: string;
  priority: number;
  reason: 'due' | 'overdue' | 'needs_refresh';
  status: 'due' | 'upcoming' | 'none';
  last_demonstrated: string | null;
  state: MasteryState;
  rules_version: string;
  computed_at: string;
}

export type NoteTargetKind = 'general' | 'skill' | 'topic' | 'scenario' | 'client';

/** A learner note attached to something (or to nothing). */
export interface NoteRecord extends SyncEnvelope {
  body: string;
  target_kind: NoteTargetKind;
  target_ref: string | null;
}

/** This browser's identity, and its device session once linked with a sync key (spec §89). */
export interface DeviceRecord {
  device_id: string;
  /** `local:<uuid>` until the device is linked; then the server's learner id. */
  learner_id: string;
  label: string;
  created_at: string;
  last_seen_at: string;
  /** Result of `navigator.storage.persist()`; null when the API is unavailable. */
  storage_persisted: boolean | null;
  /** Revocable session token from `/api/sync/link`; never the sync key (SYNC-004). */
  session_token?: string | null;
  /** The canonical sync key, kept so the learner can show, copy or re-download it. */
  sync_key?: string | null;
  linked_at?: string | null;
}

/** The last server-confirmed state of a record: what a push declares as its base (TA§14). */
export interface SyncShadowRecord {
  entity: SyncEntity;
  entity_id: string;
  revision: number;
  updated_at: string;
}

/** A divergence the server refused to merge silently (SYNC-009): both versions, until chosen. */
export interface SyncConflictRecord {
  entity: SyncEntity;
  entity_id: string;
  local: SyncEnvelope & Record<string, unknown>;
  server: SyncEnvelope & Record<string, unknown>;
  detected_at: string;
}

export type SyncOperationKind = 'upsert' | 'delete';
export type SyncOperationStatus = 'pending' | 'syncing' | 'failed';

/** One row of the outbox (spec §86 "sync queue"). Phase 4 drains it to the Worker. */
export interface SyncOperation {
  seq?: number;
  entity: SyncEntity;
  entity_id: string;
  op: SyncOperationKind;
  revision: number;
  /** The full record as written, including the tombstone of a soft delete. */
  payload: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  status: SyncOperationStatus;
  attempts: number;
  last_error: string | null;
  /** Set when the learner chose the local version of a conflict: apply regardless (SYNC-009). */
  force?: boolean;
}

/** Sync bookkeeping. One row, keyed `all`: the learner's change log is a single sequence. */
export interface SyncStateRecord {
  entity: string;
  last_synced_at: string | null;
  server_cursor: number | null;
  last_error?: string | null;
}

/** Local-only checkpoint of in-progress work (TA§7: simulator session, unfinished exercise…). */
export interface WorkspaceRecord {
  key: string;
  value: unknown;
  updated_at: string;
}

/**
 * One simulator run's header (SIM-013). The account, the clock, the queue and the generator's
 * position live here; the run's history lives in `sim_events`, and its checkpoints in
 * `sim_snapshots`, so a long run does not rewrite a large row on every event.
 */
export interface SimProjectRecord extends SyncEnvelope {
  scenario_id: string;
  run_id: string;
  /** The engine that produced this run (SIM-019). */
  simulator_version: string;
  clock_now: string;
  timezone: string;
  account: unknown;
  queue: unknown;
  random: unknown;
  sequence: number;
  queue_sequence: number;
  /** How many events the run had processed when it was saved. */
  log_length: number;
  execution: unknown;
  diagnostics: unknown;
}

/** One processed event, append-only, exactly as the engine logged it. */
export interface SimEventRecord extends SyncEnvelope {
  run_id: string;
  sequence: number;
  event: unknown;
}

/** One checkpoint, append-only (SIM-013). */
export interface SimSnapshotRecord extends SyncEnvelope {
  run_id: string;
  log_length: number;
  label: string;
  checkpoint: unknown;
}
