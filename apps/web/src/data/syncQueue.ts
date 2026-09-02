import { db, type BloomlabDatabase } from './db';
import { nowIso } from './envelope';
import type { SyncEntity, SyncOperation, SyncOperationKind } from './types';

export interface EnqueueInput {
  entity: SyncEntity;
  entity_id: string;
  op: SyncOperationKind;
  revision: number;
  payload: Record<string, unknown> | null;
}

/**
 * Records a change in the outbox (spec §86 "sync queue"). Call it inside the transaction that
 * writes the record, so the checkpoint and its queue entry commit together.
 *
 * Coalescing: a record that changes again while its previous change is still *pending* keeps
 * one queue row carrying the latest revision, so the queue never replays every keystroke
 * (SYNC-007 "meaningful state"). An operation already in flight is left alone and a fresh row
 * follows it.
 */
export async function enqueueOperation(
  input: EnqueueInput,
  database: BloomlabDatabase = db,
): Promise<SyncOperation> {
  const at = nowIso();
  const pending = await database.sync_queue
    .where('[entity+entity_id]')
    .equals([input.entity, input.entity_id])
    .filter((row) => row.status === 'pending')
    .first();
  if (pending) {
    const merged: SyncOperation = {
      ...pending,
      op: input.op,
      revision: input.revision,
      payload: input.payload,
      updated_at: at,
    };
    await database.sync_queue.put(merged);
    return merged;
  }
  const created: SyncOperation = {
    ...input,
    created_at: at,
    updated_at: at,
    status: 'pending',
    attempts: 0,
    last_error: null,
  };
  const seq = await database.sync_queue.add(created);
  return { ...created, seq };
}

/** Everything not yet confirmed by the server, oldest first. */
export function listOperations(database: BloomlabDatabase = db): Promise<SyncOperation[]> {
  return database.sync_queue.orderBy('seq').toArray();
}

export function countOperations(database: BloomlabDatabase = db): Promise<number> {
  return database.sync_queue.count();
}

/** Claims up to `limit` pending operations for a sync attempt (Phase 4 transport). */
export async function takeOperations(
  limit: number,
  database: BloomlabDatabase = db,
): Promise<SyncOperation[]> {
  return database.transaction('rw', database.sync_queue, async () => {
    const batch = await database.sync_queue
      .orderBy('seq')
      .filter((row) => row.status === 'pending')
      .limit(limit)
      .toArray();
    const claimed = batch.map((row) => ({
      ...row,
      status: 'syncing' as const,
      updated_at: nowIso(),
    }));
    await database.sync_queue.bulkPut(claimed);
    return claimed;
  });
}

/** The server accepted the operation: it leaves the queue. */
export async function completeOperation(
  seq: number,
  database: BloomlabDatabase = db,
): Promise<void> {
  await database.sync_queue.delete(seq);
}

/** The attempt failed: keep the operation, remember why, and let the next attempt retry it. */
export async function failOperation(
  seq: number,
  error: string,
  database: BloomlabDatabase = db,
): Promise<void> {
  await database.transaction('rw', database.sync_queue, async () => {
    const row = await database.sync_queue.get(seq);
    if (!row) return;
    await database.sync_queue.put({
      ...row,
      status: 'failed',
      attempts: row.attempts + 1,
      last_error: error,
      updated_at: nowIso(),
    });
  });
}

/** Puts failed and abandoned in-flight operations back in line. */
export async function resetOperations(database: BloomlabDatabase = db): Promise<number> {
  return database.transaction('rw', database.sync_queue, async () => {
    const stuck = await database.sync_queue.filter((row) => row.status !== 'pending').toArray();
    await database.sync_queue.bulkPut(
      stuck.map((row) => ({ ...row, status: 'pending' as const, updated_at: nowIso() })),
    );
    return stuck.length;
  });
}
