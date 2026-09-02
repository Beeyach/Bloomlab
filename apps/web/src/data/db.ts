import Dexie, { type EntityTable } from 'dexie';

import type {
  DeviceRecord,
  NoteRecord,
  SyncOperation,
  SyncStateRecord,
  WorkspaceRecord,
} from './types';

export const DB_NAME = 'bloomlab';
export const DB_VERSION = 1;

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

  constructor(name: string = DB_NAME) {
    super(name);
    this.version(DB_VERSION).stores({
      device: '&device_id',
      notes: '&id, updated_at, deleted_at, [target_kind+target_ref]',
      workspace: '&key',
      sync_queue: '++seq, [entity+entity_id], status',
      sync_state: '&entity',
    });
  }
}

/** The application database. Tests construct their own `BloomlabDatabase` with a unique name. */
export const db = new BloomlabDatabase();
