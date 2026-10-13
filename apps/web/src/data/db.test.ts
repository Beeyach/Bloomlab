import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';

import { BloomlabDatabase, DB_VERSION } from './db';
import { freshDatabase } from './testing';

describe('BloomlabDatabase', () => {
  it('opens IndexedDB with the local-first and sync tables and no ORM in between (DATA-002)', async () => {
    const database = freshDatabase();
    await database.open();
    expect(database.tables.map((table) => table.name).sort()).toEqual([
      'call_recordings',
      'campaign_progress',
      'client_progress',
      'device',
      'evidence_assets',
      'exercise_attempts',
      'notes',
      'portfolio_assets',
      'portfolio_projects',
      'review_queue',
      'sim_events',
      'sim_projects',
      'sim_snapshots',
      'skill_evidence',
      'skill_progress',
      'sync_conflicts',
      'sync_queue',
      'sync_shadow',
      'sync_state',
      'workspace',
    ]);
    expect(database.verno).toBe(DB_VERSION);
    expect(database.notes.schema.primKey.name).toBe('id');
    expect(database.sync_queue.schema.primKey.auto).toBe(true);
    expect(database.sync_shadow.schema.primKey.keyPath).toEqual(['entity', 'entity_id']);
    // Phase 10: a run's history is append-only and indexed by the run it belongs to.
    expect(database.sim_events.schema.primKey.name).toBe('id');
    expect(database.sim_events.schema.indexes.map((index) => index.name)).toContain('run_id');
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

  it('adds explicit owners to every legacy local and sync-bookkeeping row during v9 upgrade', async () => {
    const name = `legacy-ownership-${crypto.randomUUID()}`;
    const legacy = new Dexie(name);
    legacy.version(8).stores({
      device: '&device_id',
      workspace: '&key',
      call_recordings: '&recording_id, attempt_id, [attempt_id+turn]',
      evidence_assets: '&asset_id, attempt_id',
      sync_queue: '++seq, [entity+entity_id], status',
      sync_state: '&entity',
      sync_shadow: '&[entity+entity_id]',
      sync_conflicts: '&[entity+entity_id], detected_at',
    });
    await legacy.open();
    await legacy.table('device').put({ device_id: 'device-1', learner_id: 'learner-1' });
    for (const [table, row] of [
      ['workspace', { key: 'draft' }],
      ['call_recordings', { recording_id: 'recording-1' }],
      ['evidence_assets', { asset_id: 'asset-1' }],
      ['sync_queue', { entity: 'notes', entity_id: 'note-1', status: 'pending' }],
      ['sync_state', { entity: 'all' }],
      ['sync_shadow', { entity: 'notes', entity_id: 'note-1' }],
      ['sync_conflicts', { entity: 'notes', entity_id: 'note-1' }],
    ] as const)
      await legacy.table(table).put(row);
    legacy.close();

    const upgraded = new BloomlabDatabase(name);
    await upgraded.open();
    for (const table of [
      upgraded.workspace,
      upgraded.call_recordings,
      upgraded.evidence_assets,
      upgraded.sync_queue,
      upgraded.sync_state,
      upgraded.sync_shadow,
      upgraded.sync_conflicts,
    ])
      expect(await table.toCollection().first()).toMatchObject({ learner_id: 'learner-1' });
    for (const table of [upgraded.workspace, upgraded.call_recordings, upgraded.evidence_assets])
      expect(await table.toCollection().first()).toMatchObject({ device_id: 'device-1' });
    upgraded.close();
    await Dexie.delete(name);
  });
});
