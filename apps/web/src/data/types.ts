/**
 * Local-first data types (spec §86–§87, §91; DATA-001, DATA-002, SYNC-007).
 *
 * Every record that will sync carries the envelope from spec §91 / TA§14. Timestamps are ISO 8601
 * strings so they sort, diff and travel to D1 unchanged.
 */

/** The fields every syncable entity carries (SYNC-007). */
export interface SyncEnvelope {
  id: string;
  learner_id: string;
  created_at: string;
  updated_at: string;
  /** Starts at 1 and grows by one per local write; Phase 4 merges on it. */
  revision: number;
  /** The device that made the last write. */
  device_id: string;
  /** Soft delete: set instead of removing the row, so the deletion can sync. */
  deleted_at: string | null;
}

/** Syncable entities the local database knows about. Grows phase by phase. */
export const SYNC_ENTITIES = ['notes'] as const;
export type SyncEntity = (typeof SYNC_ENTITIES)[number];

export type NoteTargetKind = 'general' | 'skill' | 'topic' | 'scenario' | 'client';

/** A learner note attached to something (or to nothing). */
export interface NoteRecord extends SyncEnvelope {
  body: string;
  target_kind: NoteTargetKind;
  target_ref: string | null;
}

/** This browser's identity. Local-only until Phase 4 registers it as a device session. */
export interface DeviceRecord {
  device_id: string;
  /** `local:<uuid>` until the Bloomlab Sync Key exists (Phase 4). */
  learner_id: string;
  label: string;
  created_at: string;
  last_seen_at: string;
  /** Result of `navigator.storage.persist()`; null when the API is unavailable. */
  storage_persisted: boolean | null;
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
  /** The full record for upserts, null for deletes. */
  payload: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  status: SyncOperationStatus;
  attempts: number;
  last_error: string | null;
}

/** Per-entity sync bookkeeping (cursor + last successful sync). */
export interface SyncStateRecord {
  entity: SyncEntity;
  last_synced_at: string | null;
  server_cursor: string | null;
}

/** Local-only checkpoint of in-progress work (TA§7: simulator session, unfinished exercise…). */
export interface WorkspaceRecord {
  key: string;
  value: unknown;
  updated_at: string;
}
