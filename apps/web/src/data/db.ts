import Dexie, { type EntityTable, type Table } from 'dexie';

import type {
  CampaignProgressRecord,
  DeviceRecord,
  ExerciseAttemptRecord,
  NoteRecord,
  ReviewQueueRecord,
  SkillEvidenceRecord,
  SkillProgressRecord,
  SyncConflictRecord,
  SyncOperation,
  SyncShadowRecord,
  SyncStateRecord,
  WorkspaceRecord,
} from './types';

export const DB_NAME = 'bloomlab';
export const DB_VERSION = 3;

/**
 * The IndexedDB database behind every local-first flow (DATA-002). Dexie is the whole data
 * layer: no ORM on top, and localStorage never holds application data.
 *
 * Only tables with a consumer exist. Later phases add theirs with a new `version()` block
 * (curriculum cache in Phase 5, simulator projects and events in Phase 10, and so on).
 */
export class BloomlabDatabase extends Dexie {
  declare device: EntityTable<DeviceRecord, 'device_id'>;
  declare notes: EntityTable<NoteRecord, 'id'>;
  declare workspace: EntityTable<WorkspaceRecord, 'key'>;
  declare sync_queue: EntityTable<SyncOperation, 'seq'>;
  declare sync_state: EntityTable<SyncStateRecord, 'entity'>;
  // Compound primary keys: `[entity, entity_id]`.
  declare sync_shadow: Table<SyncShadowRecord, [string, string]>;
  declare sync_conflicts: Table<SyncConflictRecord, [string, string]>;
  // Phase 6: learning records (spec §93 Learning domain, synced by kind).
  declare skill_evidence: EntityTable<SkillEvidenceRecord, 'id'>;
  declare exercise_attempts: EntityTable<ExerciseAttemptRecord, 'id'>;
  declare skill_progress: EntityTable<SkillProgressRecord, 'id'>;
  declare campaign_progress: EntityTable<CampaignProgressRecord, 'id'>;
  declare review_queue: EntityTable<ReviewQueueRecord, 'id'>;

  constructor(name: string = DB_NAME) {
    super(name);
    // v1 (Phase 3): local-first tables and the outbox.
    this.version(1).stores({
      device: '&device_id',
      notes: '&id, updated_at, deleted_at, [target_kind+target_ref]',
      workspace: '&key',
      sync_queue: '++seq, [entity+entity_id], status',
      sync_state: '&entity',
    });
    // v2 (Phase 4): the server-confirmed state per record and unresolved conflicts.
    this.version(2).stores({
      sync_shadow: '&[entity+entity_id]',
      sync_conflicts: '&[entity+entity_id], detected_at',
    });
    // v3 (Phase 6): evidence and attempts (append-only) and the derived progress rows.
    this.version(DB_VERSION).stores({
      skill_evidence: '&id, skill_id, occurred_at, updated_at',
      exercise_attempts: '&id, exercise_id, updated_at',
      skill_progress: '&id, skill_id, updated_at',
      campaign_progress: '&id, campaign_id, updated_at',
      review_queue: '&id, skill_id, due_at, updated_at',
    });
  }
}

/** The application database. Tests construct their own `BloomlabDatabase` with a unique name. */
export const db = new BloomlabDatabase();
