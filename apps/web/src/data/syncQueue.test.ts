import { describe, expect, it } from 'vitest';

import { freshDatabase } from './db.test';
import {
  completeOperation,
  countOperations,
  enqueueOperation,
  failOperation,
  listOperations,
  resetOperations,
  takeOperations,
} from './syncQueue';

const upsert = (id: string, revision = 1) => ({
  entity: 'notes' as const,
  entity_id: id,
  op: 'upsert' as const,
  revision,
  payload: { id, revision },
});

describe('sync queue primitives (SYNC-007 groundwork)', () => {
  it('claims pending operations in order, completes and fails them', async () => {
    const database = freshDatabase();
    await enqueueOperation(upsert('a'), database);
    await enqueueOperation(upsert('b'), database);
    await enqueueOperation(upsert('c'), database);
    expect(await countOperations(database)).toBe(3);

    const batch = await takeOperations(2, database);
    expect(batch.map((op) => op.entity_id)).toEqual(['a', 'b']);
    expect(batch.every((op) => op.status === 'syncing')).toBe(true);

    await completeOperation(batch[0]!.seq!, database);
    await failOperation(batch[1]!.seq!, 'HTTP 503', database);

    const rows = await listOperations(database);
    expect(rows.map((op) => [op.entity_id, op.status, op.attempts, op.last_error])).toEqual([
      ['b', 'failed', 1, 'HTTP 503'],
      ['c', 'pending', 0, null],
    ]);
  });

  it('coalesces repeated pending changes to one row and resets stuck rows', async () => {
    const database = freshDatabase();
    await enqueueOperation(upsert('a', 1), database);
    await enqueueOperation(upsert('a', 2), database);
    await enqueueOperation(upsert('a', 3), database);
    const [only] = await listOperations(database);
    expect(await countOperations(database)).toBe(1);
    expect(only).toMatchObject({ revision: 3, payload: { revision: 3 } });

    await takeOperations(1, database);
    await failOperation(only!.seq!, 'offline', database);
    expect(await resetOperations(database)).toBe(1);
    expect((await listOperations(database))[0]?.status).toBe('pending');
  });
});
