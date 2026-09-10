import { describe, expect, it } from 'vitest';

import { freshDatabase } from './testing';
import { ensureDevice } from './device';
import { createNotesStore } from './notes';
import { listOperations, takeOperations } from './syncQueue';
import { createSyncableStore } from './stores';
import { LOCAL_SYNC_ENTITIES, type SyncEnvelope } from './types';
import { ENVELOPE_FIELDS } from '@bloomlab/shared';

const draft = (body: string) => ({ body, target_kind: 'general' as const, target_ref: null });

describe('syncable store (DATA-001 write path)', () => {
  it.each(LOCAL_SYNC_ENTITIES)(
    '%s writes and tombstones carry the complete sync envelope',
    async (entity) => {
      const database = freshDatabase();
      // Envelope contract, not entity-specific validation (covered by each consumer/Worker schema).
      const store = createSyncableStore<SyncEnvelope>(entity, database);
      const created = await store.create({});
      const deleted = await store.remove(created.id);
      for (const row of [created, deleted]) {
        for (const field of ENVELOPE_FIELDS) expect(Object.hasOwn(row, field)).toBe(true);
        expect(row.id && row.learner_id && row.device_id && row.updated_at).toBeTruthy();
        expect(row.revision).toBeGreaterThan(0);
      }
      expect(deleted.deleted_at).not.toBeNull();
      expect((await listOperations(database))[0]?.payload).toEqual(deleted);
    },
  );

  it('creates a record with a full envelope and queues an upsert in the same transaction', async () => {
    const database = freshDatabase();
    const notes = createNotesStore(database);

    const note = await notes.create(draft('First thought'));
    const device = await ensureDevice(database);

    expect(note.revision).toBe(1);
    expect(note.device_id).toBe(device.device_id);
    expect(note.learner_id).toBe(device.learner_id);
    expect(note.deleted_at).toBeNull();
    expect(note.created_at).toBe(note.updated_at);
    expect(await notes.get(note.id)).toEqual(note);

    const queue = await listOperations(database);
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({
      entity: 'notes',
      entity_id: note.id,
      op: 'upsert',
      revision: 1,
      status: 'pending',
      attempts: 0,
      payload: note,
    });
  });

  it('patches immutably, advances the revision, and coalesces pending queue rows', async () => {
    const database = freshDatabase();
    const notes = createNotesStore(database);
    const created = await notes.create(draft('v1'));

    const patched = await notes.patch(created.id, { body: 'v2' });
    const again = await notes.patch(created.id, { body: 'v3' });

    expect(created.body).toBe('v1');
    expect(patched.revision).toBe(2);
    expect(again.revision).toBe(3);
    expect(again.created_at).toBe(created.created_at);
    expect(again.updated_at >= created.updated_at).toBe(true);
    expect((await notes.get(created.id))?.body).toBe('v3');

    const queue = await listOperations(database);
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({ op: 'upsert', revision: 3, payload: { body: 'v3' } });
  });

  it('leaves in-flight operations alone and queues a fresh row behind them', async () => {
    const database = freshDatabase();
    const notes = createNotesStore(database);
    const note = await notes.create(draft('v1'));

    const claimed = await takeOperations(10, database);
    expect(claimed.map((op) => op.status)).toEqual(['syncing']);

    await notes.patch(note.id, { body: 'v2' });
    const queue = await listOperations(database);
    expect(queue.map((op) => [op.status, op.revision])).toEqual([
      ['syncing', 1],
      ['pending', 2],
    ]);
  });

  it('soft-deletes so the deletion can sync, and hides deleted rows from list()', async () => {
    const database = freshDatabase();
    const notes = createNotesStore(database);
    const keep = await notes.create(draft('keep'));
    const gone = await notes.create(draft('gone'));

    const deleted = await notes.remove(gone.id);
    expect(deleted.deleted_at).not.toBeNull();
    expect(deleted.revision).toBe(2);
    expect(await database.notes.count()).toBe(2);
    expect((await notes.list()).map((n) => n.id)).toEqual([keep.id]);
    expect((await notes.list({ includeDeleted: true })).map((n) => n.id)).toContain(gone.id);

    const op = (await listOperations(database)).find((row) => row.entity_id === gone.id);
    expect(op).toMatchObject({ op: 'delete', revision: 2, status: 'pending' });
    // The tombstone travels with the operation so the deletion can sync (SYNC-007 deleted_at).
    expect(op?.payload).toMatchObject({ id: gone.id, deleted_at: deleted.deleted_at });
  });

  it('lists newest first and rejects patches to unknown ids', async () => {
    const database = freshDatabase();
    const notes = createNotesStore(database);
    const a = await notes.create(draft('a'));
    await new Promise((resolve) => setTimeout(resolve, 2));
    const b = await notes.create(draft('b'));
    expect((await notes.list()).map((n) => n.id)).toEqual([b.id, a.id]);
    await expect(notes.patch('missing', { body: 'x' })).rejects.toThrow(/does not exist/);
    expect(await listOperations(database)).toHaveLength(2);
  });
});
