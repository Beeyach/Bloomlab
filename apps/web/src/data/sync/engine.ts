import type { PullChange, PushOperation, PushOutcome, SyncRecord } from '@bloomlab/shared';

import { db, type BloomlabDatabase } from '../db';
import { ensureDevice } from '../device';
import { nowIso } from '../envelope';
import { completeOperation, enqueueOperation, failOperation, takeOperations } from '../syncQueue';
import { LOCAL_SYNC_ENTITIES, type LocalSyncEntity, type SyncOperation } from '../types';
import { SyncApiError, syncApi, type SyncApi } from './api';
import { isLinked, unlinkThisDevice } from './link';

export const SYNC_STATE_KEY = 'all';
const PUSH_BATCH = 100;
const PULL_LIMIT = 200;

export interface SyncRunResult {
  status: 'not-linked' | 'synced' | 'failed';
  pushed: number;
  adopted: number;
  conflicts: number;
  pulled: number;
  error?: string;
}

const isLocalEntity = (entity: string): entity is LocalSyncEntity =>
  (LOCAL_SYNC_ENTITIES as readonly string[]).includes(entity);

async function hasPending(
  database: BloomlabDatabase,
  entity: string,
  id: string,
  learnerId: string,
): Promise<boolean> {
  return (
    (await database.sync_queue
      .where('[entity+entity_id]')
      .equals([entity, id])
      .filter((row) => row.status === 'pending' && row.learner_id === learnerId)
      .count()) > 0
  );
}

async function rememberServerState(
  database: BloomlabDatabase,
  entity: LocalSyncEntity,
  record: SyncRecord,
): Promise<void> {
  await database.sync_shadow.put({
    learner_id: record.learner_id,
    entity,
    entity_id: record.id,
    revision: record.revision,
    updated_at: record.updated_at,
  });
}

/** Writes a server record locally without queueing it back (it came from the server). */
async function adoptServerRecord(
  database: BloomlabDatabase,
  entity: LocalSyncEntity,
  record: SyncRecord,
): Promise<void> {
  await database.transaction('rw', database[entity], database.sync_shadow, async () => {
    await database[entity].put(record as never);
    await rememberServerState(database, entity, record);
  });
}

async function applyOutcome(
  database: BloomlabDatabase,
  op: SyncOperation,
  pushed: SyncRecord,
  outcome: PushOutcome,
  counters: SyncRunResult,
): Promise<void> {
  const entity = op.entity;
  if (!isLocalEntity(entity)) return;
  const seq = op.seq as number;
  switch (outcome.status) {
    case 'applied': {
      await database.transaction(
        'rw',
        database[entity],
        database.sync_shadow,
        database.sync_queue,
        async () => {
          const current = await database[entity].get(op.entity_id);
          // Adopt the server's revision unless the record moved on locally in the meantime.
          if (current && current.updated_at === pushed.updated_at) {
            await database[entity].put({ ...current, revision: outcome.revision } as never);
          }
          await database.sync_shadow.put({
            learner_id: pushed.learner_id,
            entity,
            entity_id: op.entity_id,
            revision: outcome.revision,
            updated_at: pushed.updated_at,
          });
          await completeOperation(seq, database);
        },
      );
      counters.pushed += 1;
      return;
    }
    case 'superseded': {
      // The server holds the valid latest state; take it unless a newer local edit is waiting.
      if (!(await hasPending(database, entity, op.entity_id, pushed.learner_id))) {
        await adoptServerRecord(database, entity, outcome.server);
      } else {
        await rememberServerState(database, entity, outcome.server);
      }
      await completeOperation(seq, database);
      counters.adopted += 1;
      return;
    }
    case 'conflict': {
      await database.transaction('rw', database.sync_conflicts, database.sync_queue, async () => {
        await database.sync_conflicts.put({
          learner_id: pushed.learner_id,
          entity,
          entity_id: op.entity_id,
          local: pushed,
          server: outcome.server,
          detected_at: nowIso(),
        });
        await completeOperation(seq, database);
      });
      counters.conflicts += 1;
      return;
    }
    case 'rejected':
      await failOperation(seq, outcome.reason, database);
      return;
  }
}

async function pushPending(
  database: BloomlabDatabase,
  api: SyncApi,
  token: string,
  learnerId: string,
  counters: SyncRunResult,
): Promise<void> {
  for (;;) {
    const batch = await takeOperations(PUSH_BATCH, database, learnerId);
    if (batch.length === 0) return;
    const operations: PushOperation[] = [];
    for (const op of batch) {
      if (!op.payload) {
        // Every operation carries its record (deletes carry the tombstone); anything else is a
        // programming error and must not sit in the queue as "syncing" forever.
        await failOperation(op.seq as number, 'Operation has no record', database);
        continue;
      }
      const shadow = await database.sync_shadow.get([op.entity, op.entity_id]);
      operations.push({
        seq: op.seq as number,
        entity: op.entity,
        base_revision: shadow?.revision ?? 0,
        record: op.payload as SyncRecord,
        ...(op.force ? { force: true } : {}),
      });
    }
    let outcomes: PushOutcome[];
    try {
      ({ outcomes } = await api.push(token, { operations }));
    } catch (error) {
      // Nothing was confirmed: everything goes back in line for the next attempt.
      await database.sync_queue.bulkPut(batch.map((op) => ({ ...op, status: 'pending' as const })));
      throw error;
    }
    for (const op of batch) {
      const outcome = outcomes.find((o) => o.seq === op.seq);
      if (!outcome) {
        await failOperation(op.seq as number, 'No outcome returned', database);
        continue;
      }
      await applyOutcome(database, op, op.payload as SyncRecord, outcome, counters);
    }
  }
}

async function applyChange(database: BloomlabDatabase, change: PullChange): Promise<boolean> {
  if (!isLocalEntity(change.entity)) return false;
  // A local edit is waiting (the push will reconcile it) or the learner still has to choose a
  // version: never paper over either with server state.
  const undecided = await database.sync_conflicts.get([change.entity, change.record.id]);
  if (
    undecided ||
    (await hasPending(database, change.entity, change.record.id, change.record.learner_id))
  ) {
    await rememberServerState(database, change.entity, change.record);
    return false;
  }
  await adoptServerRecord(database, change.entity, change.record);
  return true;
}

async function pullChanges(
  database: BloomlabDatabase,
  api: SyncApi,
  token: string,
  learnerId: string,
  counters: SyncRunResult,
): Promise<void> {
  let cursor = (await database.sync_state.get(SYNC_STATE_KEY))?.server_cursor ?? 0;
  for (;;) {
    const page = await api.pull(token, { cursor, limit: PULL_LIMIT });
    for (const change of page.changes) {
      if (await applyChange(database, change)) counters.pulled += 1;
    }
    cursor = page.cursor;
    await database.sync_state.put({
      entity: SYNC_STATE_KEY,
      learner_id: learnerId,
      last_synced_at: nowIso(),
      server_cursor: cursor,
      last_error: null,
    });
    if (!page.more) return;
  }
}

let running: Promise<SyncRunResult> | null = null;

/**
 * One sync round trip (spec §86, SYNC-010): push what this device changed, then pull what
 * other devices changed. Never throws; the result and `sync_state` say what happened. Calls
 * overlap-safe: a second call while one runs returns the running one.
 */
export function syncNow(
  database: BloomlabDatabase = db,
  api: SyncApi = syncApi,
): Promise<SyncRunResult> {
  if (running) return running;
  running = run(database, api).finally(() => {
    running = null;
  });
  return running;
}

async function run(database: BloomlabDatabase, api: SyncApi): Promise<SyncRunResult> {
  const counters: SyncRunResult = {
    status: 'synced',
    pushed: 0,
    adopted: 0,
    conflicts: 0,
    pulled: 0,
  };
  const device = await ensureDevice(database);
  if (!isLinked(device)) return { ...counters, status: 'not-linked' };
  const token = device.session_token as string;
  try {
    await pushPending(database, api, token, device.learner_id, counters);
    await pullChanges(database, api, token, device.learner_id, counters);
    return counters;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Sync failed';
    if (error instanceof SyncApiError && error.unauthorized) await unlinkThisDevice(database);
    const state = await database.sync_state.get(SYNC_STATE_KEY);
    await database.sync_state.put({
      entity: SYNC_STATE_KEY,
      learner_id: device.learner_id,
      last_synced_at: state?.last_synced_at ?? null,
      server_cursor: state?.server_cursor ?? null,
      last_error: message,
    });
    return { ...counters, status: 'failed', error: message };
  }
}

/**
 * The learner chose a side of a conflict (SYNC-009). `local` re-queues the local version with
 * `force`; `server` adopts the server version. Nothing was discarded before this point.
 */
export async function resolveConflict(
  entity: LocalSyncEntity,
  entityId: string,
  choice: 'local' | 'server',
  database: BloomlabDatabase = db,
): Promise<void> {
  const conflict = await database.sync_conflicts.get([entity, entityId]);
  if (!conflict) return;
  await database.transaction(
    'rw',
    database[entity],
    database.sync_conflicts,
    database.sync_queue,
    database.sync_shadow,
    async () => {
      if (choice === 'server') {
        await database[entity].put(conflict.server as never);
        await rememberServerState(database, entity, conflict.server as SyncRecord);
      } else {
        const local = (await database[entity].get(entityId)) ?? conflict.local;
        await database[entity].put(local as never);
        const op = await enqueueOperation(
          {
            entity,
            entity_id: entityId,
            op: local.deleted_at ? 'delete' : 'upsert',
            revision: local.revision,
            payload: local as Record<string, unknown>,
          },
          database,
        );
        await database.sync_queue.put({ ...op, force: true });
      }
      await database.sync_conflicts.delete([entity, entityId]);
    },
  );
}
