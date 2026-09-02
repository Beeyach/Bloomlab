import { describe, expect, it } from 'vitest';

import { BloomlabDatabase, DB_VERSION } from './db';

export const freshDatabase = () => new BloomlabDatabase(`test-${crypto.randomUUID()}`);

describe('BloomlabDatabase', () => {
  it('opens IndexedDB with the Phase 3 tables and no ORM in between (DATA-002)', async () => {
    const database = freshDatabase();
    await database.open();
    expect(database.tables.map((table) => table.name).sort()).toEqual([
      'device',
      'notes',
      'sync_queue',
      'sync_state',
      'workspace',
    ]);
    expect(database.verno).toBe(DB_VERSION);
    expect(database.notes.schema.primKey.name).toBe('id');
    expect(database.sync_queue.schema.primKey.auto).toBe(true);
    database.close();
  });

  it('keeps localStorage out of the data path', async () => {
    const database = freshDatabase();
    await database.notes.add({
      id: 'n1',
      learner_id: 'local:x',
      created_at: '2026-09-02T00:00:00.000Z',
      updated_at: '2026-09-02T00:00:00.000Z',
      revision: 1,
      device_id: 'd1',
      deleted_at: null,
      body: 'hello',
      target_kind: 'general',
      target_ref: null,
    });
    expect(await database.notes.count()).toBe(1);
    expect(localStorage.length).toBe(0);
    database.close();
  });
});
