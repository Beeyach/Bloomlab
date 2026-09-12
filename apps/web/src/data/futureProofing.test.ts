import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { content } from '../content/bundle';
import { localRecording } from '../call/local';
import { localEvidence } from '../fieldwork/assets';
import { BloomlabDatabase } from './db';
import { ensureDevice } from './device';
import { enqueueOperation } from './syncQueue';
import { LOCAL_SYNC_ENTITIES } from './types';

/** C2's exhaustive IndexedDB inventory. `device` is the identity anchor; every other row is
 * learner-owned data or bookkeeping and carries learner_id directly (not through a singleton). */
const INDEXED_DB_OWNERSHIP = {
  device: 'identity-anchor',
  workspace: 'explicit-local-owner',
  call_recordings: 'explicit-local-owner',
  evidence_assets: 'explicit-local-owner',
  sync_queue: 'explicit-bookkeeping-owner',
  sync_state: 'explicit-bookkeeping-owner',
  sync_shadow: 'explicit-bookkeeping-owner',
  sync_conflicts: 'explicit-bookkeeping-owner',
  notes: 'sync-envelope',
  client_progress: 'sync-envelope',
  portfolio_projects: 'sync-envelope',
  portfolio_assets: 'sync-envelope',
  skill_evidence: 'sync-envelope',
  exercise_attempts: 'sync-envelope',
  skill_progress: 'sync-envelope',
  campaign_progress: 'sync-envelope',
  review_queue: 'sync-envelope',
  sim_projects: 'sync-envelope',
  sim_events: 'sync-envelope',
  sim_snapshots: 'sync-envelope',
} as const;

const sourceFiles = (directory: string): string[] =>
  readdirSync(directory).flatMap((name) => {
    const path = resolve(directory, name);
    return statSync(path).isDirectory() ? sourceFiles(path) : path.endsWith('.ts') ? [path] : [];
  });

describe('PRD-009 learner-scope audit', () => {
  it('inventories every IndexedDB table and every sync entity without an unclassified singleton', async () => {
    const database = new BloomlabDatabase(`ownership-${crypto.randomUUID()}`);
    await database.open();
    expect(database.tables.map((table) => table.name).sort()).toEqual(
      Object.keys(INDEXED_DB_OWNERSHIP).sort(),
    );
    expect(
      Object.entries(INDEXED_DB_OWNERSHIP)
        .filter(([, owner]) => owner === 'sync-envelope')
        .map(([table]) => table)
        .sort(),
    ).toEqual([...LOCAL_SYNC_ENTITIES].sort());
    database.close();
  });

  it('puts the owner on local drafts, media and sync bookkeeping and refuses foreign local media', async () => {
    const database = new BloomlabDatabase(`ownership-${crypto.randomUUID()}`);
    const owner = await ensureDevice(database);
    await database.workspace.put({
      key: 'owned',
      learner_id: owner.learner_id,
      device_id: owner.device_id,
      value: {},
      updated_at: new Date().toISOString(),
    });
    await database.call_recordings.put({
      recording_id: 'foreign-recording',
      learner_id: 'learner:foreign',
      device_id: 'device:foreign',
      attempt_id: 'attempt',
      exercise_id: 'exercise',
      turn: 0,
      mime_type: 'audio/webm;codecs=opus',
      byte_length: 1,
      duration_ms: 1,
      checksum: 'foreign',
      created_at: new Date().toISOString(),
      uploaded: false,
      retain: false,
      blob: new Blob(['x']),
    });
    await database.evidence_assets.put({
      asset_id: 'foreign-evidence',
      learner_id: 'learner:foreign',
      device_id: 'device:foreign',
      attempt_id: 'attempt',
      exercise_id: 'exercise',
      item_key: 'proof',
      blob: null,
      status: 'deleted',
      upload_started: true,
    });
    const operation = await enqueueOperation(
      {
        entity: 'notes',
        entity_id: 'note',
        op: 'upsert',
        revision: 1,
        payload: { learner_id: owner.learner_id },
      },
      database,
    );
    expect(operation.learner_id).toBe(owner.learner_id);
    expect((await database.workspace.get('owned'))?.learner_id).toBe(owner.learner_id);
    expect(await localRecording('foreign-recording', database)).toBeUndefined();
    expect(await localEvidence('foreign-evidence', database)).toBeUndefined();
    database.close();
  });

  it('keeps pure learning engines free of browser persistence, named learners and mutable content', () => {
    const root = process.cwd();
    for (const packageName of ['mastery-engine', 'exercise-engine', 'simulator-core']) {
      const files = sourceFiles(resolve(root, 'packages', packageName, 'src'));
      for (const file of files) {
        const source = readFileSync(file, 'utf8');
        expect(source, file).not.toMatch(/\bAry\b|indexedDB|localStorage|sessionStorage/);
      }
    }
    for (const collection of [
      content.skills,
      content.learning_units,
      content.exercises,
      content.scenarios,
    ])
      expect(collection.some((record) => 'learner_id' in record)).toBe(false);
  });
});
