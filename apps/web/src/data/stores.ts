import type { Table } from 'dexie';

import { db, type BloomlabDatabase } from './db';
import { ensureDevice } from './device';
import { randomId, stampCreate, stampDelete, stampUpdate } from './envelope';
import { enqueueOperation } from './syncQueue';
import type { LocalSyncEntity, SyncEnvelope } from './types';

/** The record minus its envelope: what callers supply and are allowed to change. */
export type Draft<T extends SyncEnvelope> = Omit<T, keyof SyncEnvelope>;

export interface SyncableStore<T extends SyncEnvelope> {
  get(id: string): Promise<T | undefined>;
  /** Newest first; soft-deleted rows are hidden unless asked for. */
  list(options?: { includeDeleted?: boolean }): Promise<T[]>;
  create(draft: Draft<T>, id?: string): Promise<T>;
  patch(id: string, changes: Partial<Draft<T>>): Promise<T>;
  remove(id: string): Promise<T>;
}

/**
 * The one write path for syncable entities (DATA-001): every create, patch and remove updates
 * the IndexedDB row and its outbox entry in a single transaction, stamps the envelope, and
 * returns immediately. Nothing here talks to the network.
 */
export function createSyncableStore<T extends SyncEnvelope>(
  entity: LocalSyncEntity,
  database: BloomlabDatabase = db,
): SyncableStore<T> {
  const table = database[entity] as unknown as Table<T, string>;
  const tables = [table, database.sync_queue, database.device];

  const write = <R>(work: () => Promise<R>) => database.transaction('rw', tables, work);

  const record = (value: T) => value as unknown as Record<string, unknown>;

  return {
    get: (id) => table.get(id),

    async list({ includeDeleted = false } = {}) {
      const rows = await table.orderBy('updated_at').reverse().toArray();
      return includeDeleted ? rows : rows.filter((row) => row.deleted_at === null);
    },

    create: (draft, id = randomId()) =>
      write(async () => {
        const writer = await ensureDevice(database);
        const created = stampCreate(draft, writer, id) as unknown as T;
        await table.add(created);
        await enqueueOperation(
          { entity, entity_id: created.id, op: 'upsert', revision: 1, payload: record(created) },
          database,
        );
        return created;
      }),

    patch: (id, changes) =>
      write(async () => {
        const existing = await table.get(id);
        if (!existing) throw new Error(`${entity} ${id} does not exist`);
        const writer = await ensureDevice(database);
        const updated = stampUpdate(existing, changes as Partial<T>, writer);
        await table.put(updated);
        await enqueueOperation(
          {
            entity,
            entity_id: id,
            op: 'upsert',
            revision: updated.revision,
            payload: record(updated),
          },
          database,
        );
        return updated;
      }),

    remove: (id) =>
      write(async () => {
        const existing = await table.get(id);
        if (!existing) throw new Error(`${entity} ${id} does not exist`);
        const writer = await ensureDevice(database);
        const deleted = stampDelete(existing, writer);
        await table.put(deleted);
        // The tombstone travels with the operation: the other devices need `deleted_at`.
        await enqueueOperation(
          {
            entity,
            entity_id: id,
            op: 'delete',
            revision: deleted.revision,
            payload: record(deleted),
          },
          database,
        );
        return deleted;
      }),
  };
}
