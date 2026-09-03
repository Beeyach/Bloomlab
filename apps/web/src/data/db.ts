import Dexie, { type EntityTable, type Table } from 'dexie';

import type {
  DeviceRecord,
  NoteRecord,
  SyncConflictRecord,
  SyncOperation,
  SyncShadowRecord,
  SyncStateRecord,
  WorkspaceRecord,
} from './types';

export const DB_NAME = 'bloomlab';
export const DB_VERSION = 2;

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
    this.version(DB_VERSION).stores({
      sync_shadow: '&[entity+entity_id]',
      sync_conflicts: '&[entity+entity_id], detected_at',
    });
  }
}

/** The application database. Tests construct their own `BloomlabDatabase` with a unique name. */
export const db = new BloomlabDatabase();
