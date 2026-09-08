import { describe, expect, it } from 'vitest';

import { DB_VERSION } from './db';
import { freshDatabase } from './testing';

describe('BloomlabDatabase', () => {
  it('opens IndexedDB with the local-first and sync tables and no ORM in between (DATA-002)', async () => {
    const database = freshDatabase();
    await database.open();
    expect(database.tables.map((table) => table.name).sort()).toEqual([
      'call_recordings',
      'campaign_progress',
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
});
