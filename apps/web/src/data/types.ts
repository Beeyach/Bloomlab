/**
 * Local-first data types (spec §86–§87, §91; DATA-001, DATA-002, SYNC-007).
 *
 * Every record that will sync carries the envelope from spec §91 / TA§14. Timestamps are ISO 8601
 * strings so they sort, diff and travel to D1 unchanged.
 */

import type { SyncEntity, SyncEnvelope } from '@bloomlab/shared';

export type { SyncEntity, SyncEnvelope };

/** Syncable entities that have a local table today. Grows phase by phase. */
export const LOCAL_SYNC_ENTITIES = ['notes'] as const satisfies readonly SyncEntity[];
export type LocalSyncEntity = (typeof LOCAL_SYNC_ENTITIES)[number];

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
