import { describe, expect, it } from 'vitest';

import { freshDatabase } from '../testing';
import { ensureDevice } from '../device';
import { createNotesStore } from '../notes';
import { listOperations } from '../syncQueue';
import { SYNC_STATE_KEY, resolveConflict, syncNow } from './engine';
import { FakeSyncServer } from './fakeServer';
import { createSyncKey, isLinked, linkThisDevice } from './link';

const draft = (body: string) => ({ body, target_kind: 'general' as const, target_ref: null });

async function twoDevices(server = new FakeSyncServer()) {
  const a = freshDatabase();
  const b = freshDatabase();
  const key = createSyncKey();
  await linkThisDevice(key.display, a, server);
  await linkThisDevice(key.canonical, b, server);
  return { a, b, key, server, notesA: createNotesStore(a), notesB: createNotesStore(b) };
}

describe('linking (SYNC-001, SYNC-004, D-027)', () => {
  it('re-keys the device and every local record from the provisional learner to the real one', async () => {
    const server = new FakeSyncServer();
    const database = freshDatabase();
    const notes = createNotesStore(database);
    const before = await ensureDevice(database);
    const note = await notes.create(draft('written before linking'));
    expect(note.learner_id).toBe(before.learner_id);
    expect(before.learner_id).toMatch(/^local:/);

    const { device, created } = await linkThisDevice(createSyncKey().display, database, server);
    expect(created).toBe(true);
    expect(isLinked(device)).toBe(true);
    expect(device.learner_id).toBe('learner-1');
    expect(device.session_token).toMatch(/^token-/);
    expect(device.sync_key).toHaveLength(52);
    expect((await notes.get(note.id))?.learner_id).toBe('learner-1');
    expect((await listOperations(database))[0]?.payload?.learner_id).toBe('learner-1');
  });

  it('rejects a malformed key without touching the device', async () => {
    const database = freshDatabase();
    await expect(linkThisDevice('BLM-NOPE', database, new FakeSyncServer())).rejects.toThrow(
      /52 characters/,
    );
    expect(isLinked(await ensureDevice(database))).toBe(false);
  });
});

describe('syncNow (DATA-001, SYNC-007, SYNC-010)', () => {
  it('does nothing until the device is linked', async () => {
    const database = freshDatabase();
    const result = await syncNow(database, new FakeSyncServer());
    expect(result.status).toBe('not-linked');
  });

  it('pushes local writes, adopts the server revision, and records the sync', async () => {
    const { a, notesA, server } = await twoDevices();
    const note = await notesA.create(draft('first'));
    await notesA.patch(note.id, { body: 'first, edited' });
    expect(await listOperations(a)).toHaveLength(1); // coalesced

    const result = await syncNow(a, server);
    expect(result).toMatchObject({ status: 'synced', pushed: 1, conflicts: 0 });
    expect(await listOperations(a)).toHaveLength(0);
    expect((await notesA.get(note.id))?.revision).toBe(1);
    expect(await a.sync_shadow.get(['notes', note.id])).toMatchObject({ revision: 1 });
    const state = await a.sync_state.get(SYNC_STATE_KEY);
    expect(state?.last_synced_at).not.toBeNull();
    expect(state?.server_cursor).toBe(1);
  });

  it('delivers one device’s note to the other', async () => {
    const { a, b, notesA, notesB, server } = await twoDevices();
    const note = await notesA.create(draft('shared'));
    await syncNow(a, server);

    const result = await syncNow(b, server);
    expect(result).toMatchObject({ status: 'synced', pulled: 1 });
    expect((await notesB.get(note.id))?.body).toBe('shared');
    expect(await b.sync_shadow.get(['notes', note.id])).toMatchObject({ revision: 1 });
    expect(await listOperations(b)).toHaveLength(0); // adopted, not re-queued
  });

  it('keeps a pending local edit ahead of an incoming server change', async () => {
    const { a, b, notesA, notesB, server } = await twoDevices();
    const note = await notesA.create(draft('v1'));
    await syncNow(a, server);
    await syncNow(b, server);

    await notesB.patch(note.id, { body: 'b edit' }); // pending on b
    await notesA.patch(note.id, { body: 'a edit' });
    await syncNow(a, server); // server now at revision 2 (a edit)

    // b's pull must not overwrite its unsent edit; the push then reports the divergence.
    const result = await syncNow(b, server);
    expect(result.conflicts).toBe(1);
    expect((await notesB.get(note.id))?.body).toBe('b edit');
  });

  it('stores divergent snapshot edits as a conflict and resolves either way (SYNC-009)', async () => {
    const { a, b, notesA, notesB, server } = await twoDevices();
    const note = await notesA.create(draft('v1'));
    await syncNow(a, server);
    await syncNow(b, server);

    await notesA.patch(note.id, { body: 'a edit' });
    await notesB.patch(note.id, { body: 'b edit' });
    await syncNow(a, server);
    const result = await syncNow(b, server);
    expect(result).toMatchObject({ status: 'synced', conflicts: 1 });

    const conflict = await b.sync_conflicts.get(['notes', note.id]);
    expect(conflict?.local.body).toBe('b edit');
    expect(conflict?.server.body).toBe('a edit');
    expect((await notesB.get(note.id))?.body).toBe('b edit'); // nothing discarded yet

    // Keep the local version: it is re-queued with force and wins on the server.
    await resolveConflict('notes', note.id, 'local', b);
    expect(await b.sync_conflicts.count()).toBe(0);
    expect((await listOperations(b))[0]?.force).toBe(true);
    await syncNow(b, server);
    await syncNow(a, server);
    expect((await notesA.get(note.id))?.body).toBe('b edit');
    expect((await notesA.get(note.id))?.revision).toBe(3);
  });

  it('can also keep the server version of a conflict', async () => {
    const { a, b, notesA, notesB, server } = await twoDevices();
    const note = await notesA.create(draft('v1'));
    await syncNow(a, server);
    await syncNow(b, server);
    await notesA.patch(note.id, { body: 'a edit' });
    await notesB.patch(note.id, { body: 'b edit' });
    await syncNow(a, server);
    await syncNow(b, server);

    await resolveConflict('notes', note.id, 'server', b);
    expect((await notesB.get(note.id))?.body).toBe('a edit');
    expect(await b.sync_conflicts.count()).toBe(0);
    expect(await listOperations(b)).toHaveLength(0);
  });

  it('puts operations back in line when the server is unreachable and reports the failure', async () => {
    const { a, notesA, server } = await twoDevices();
    await notesA.create(draft('offline write'));
    server.offline = true;

    const result = await syncNow(a, server);
    expect(result.status).toBe('failed');
    expect(result.error).toMatch(/could not be reached/);
    const [op] = await listOperations(a);
    expect(op?.status).toBe('pending');
    expect((await a.sync_state.get(SYNC_STATE_KEY))?.last_error).toMatch(/could not be reached/);

    server.offline = false;
    expect((await syncNow(a, server)).status).toBe('synced');
    expect(await listOperations(a)).toHaveLength(0);
  });

  it('unlinks the device when the server no longer accepts its session', async () => {
    const { a, notesA, server } = await twoDevices();
    await notesA.create(draft('x'));
    const device = await ensureDevice(a);
    await server.revoke(device.session_token as string, device.device_id);

    const result = await syncNow(a, server);
    expect(result.status).toBe('failed');
    expect(isLinked(await ensureDevice(a))).toBe(false);
    expect((await listOperations(a))[0]?.status).toBe('pending'); // kept for after re-linking
  });
});
