import {
  SYNC_ENTITIES,
  generateSyncKey,
  type LinkResponse,
  type SyncRecord,
} from '@bloomlab/shared';
import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import worker from '../index';
import { applyRecord, getRecord, operationsSince, recordsById } from './db';

const at = '2026-09-10T10:00:00.000Z';
const record = (body: string): SyncRecord => ({
  id: 'shared-curriculum-id',
  learner_id: 'forged-owner',
  device_id: 'device-a',
  created_at: at,
  updated_at: at,
  revision: 1,
  deleted_at: null,
  body,
});

describe('learner-local primary keys (R5 DATA-001 / SYNC-007)', () => {
  it.each(SYNC_ENTITIES)(
    '%s isolates colliding IDs, updates, tombstones and pull logs',
    async (entity) => {
      // Worker storage is shared within this file; each case owns separate learners.
      const ownerA = `owner-a-${entity}`;
      const ownerB = `owner-b-${entity}`;
      const first = record('Learner A');
      const second = { ...record('Learner B'), device_id: 'device-b' };
      await applyRecord(env.DB, entity, ownerA, first, 1);
      await applyRecord(env.DB, entity, ownerB, second, 1);
      const originalB = await getRecord(env.DB, entity, ownerB, first.id);
      expect(originalB).toMatchObject({
        learner_id: ownerB,
        payload: '{"body":"Learner B"}',
        revision: 1,
      });
      expect(await getRecord(env.DB, entity, ownerA, first.id)).toMatchObject({
        payload: '{"body":"Learner A"}',
      });
      await applyRecord(env.DB, entity, ownerA, { ...first, body: 'A changed' }, 2);
      await applyRecord(env.DB, entity, ownerA, { ...first, body: 'A deleted', deleted_at: at }, 3);
      expect(await getRecord(env.DB, entity, ownerB, first.id)).toEqual(originalB);
      expect(await getRecord(env.DB, entity, ownerA, first.id)).toMatchObject({
        revision: 3,
        deleted_at: at,
      });
      expect(await getRecord(env.DB, entity, 'forged-owner', first.id)).toBeNull();
      expect((await recordsById(env.DB, entity, ownerB, [first.id])).get(first.id)).toEqual(
        originalB,
      );
      expect((await recordsById(env.DB, entity, 'third-owner', [first.id])).size).toBe(0);
      expect(await operationsSince(env.DB, ownerA, 0, 100)).toHaveLength(3);
      expect(await operationsSince(env.DB, ownerB, 0, 100)).toHaveLength(1);
      expect(await operationsSince(env.DB, 'third-owner', 0, 100)).toHaveLength(0);
    },
  );

  it('0007 preserves legacy rows, payload bytes, tombstones, indexes and cursor log in D1', async () => {
    const legacy = env.TEST_MIGRATIONS.find((migration) => migration.name.startsWith('0001_'))!;
    const migration = env.TEST_MIGRATIONS.find((item) => item.name.startsWith('0007_'))!;
    expect(migration.queries.filter((query) => /CREATE TABLE /i.test(query))).toHaveLength(
      SYNC_ENTITIES.length,
    );
    const before = new Map();
    for (const entity of SYNC_ENTITIES) {
      const create = legacy.queries.find((query) =>
        new RegExp(`CREATE TABLE ${entity} \\(`).test(query),
      );
      expect(create).toBeDefined();
      await env.DB.batch([env.DB.prepare(`DROP TABLE ${entity}`), env.DB.prepare(create!)]);
      for (const [id, deleted] of [
        ['kept', null],
        ['deleted', at],
      ] as const) {
        await env.DB.prepare(`INSERT INTO ${entity} VALUES (?,?,?,?,?,?,?,?)`)
          .bind(
            id,
            'legacy-owner',
            at,
            at,
            7,
            'legacy-device',
            deleted,
            '{ "unicode": "🌸", "spacing":  1 }',
          )
          .run();
      }
      before.set(
        entity,
        (await env.DB.prepare(`SELECT * FROM ${entity} ORDER BY id`).all()).results,
      );
    }
    await env.DB.prepare(
      'INSERT INTO sync_operations (learner_id,entity,entity_id,revision,device_id,applied_at) VALUES (?,?,?,?,?,?)',
    )
      .bind('legacy-owner', 'notes', 'kept', 7, 'legacy-device', at)
      .run();
    const log = await env.DB.prepare('SELECT * FROM sync_operations').all();
    // A late runtime constraint failure must roll back every table rebuild and row copy.
    await expect(
      env.DB.batch([
        ...migration.queries.map((query) => env.DB.prepare(query)),
        env.DB.prepare('INSERT INTO notes SELECT * FROM notes'),
      ]),
    ).rejects.toThrow(/UNIQUE constraint failed/);
    for (const entity of SYNC_ENTITIES) {
      expect((await env.DB.prepare(`SELECT * FROM ${entity} ORDER BY id`).all()).results).toEqual(
        before.get(entity),
      );
      const keys = (
        await env.DB.prepare(`PRAGMA table_info(${entity})`).all<{ name: string; pk: number }>()
      ).results
        .filter((column) => column.pk)
        .map((column) => column.name);
      expect(keys).toEqual(['id']);
    }
    expect((await env.DB.prepare('SELECT * FROM sync_operations').all()).results).toEqual(
      log.results,
    );
    await env.DB.batch(migration.queries.map((query) => env.DB.prepare(query)));
    expect((await env.DB.prepare('SELECT * FROM sync_operations').all()).results).toEqual(
      log.results,
    );
    for (const entity of SYNC_ENTITIES) {
      expect((await env.DB.prepare(`SELECT * FROM ${entity} ORDER BY id`).all()).results).toEqual(
        before.get(entity),
      );
      const columns = (
        await env.DB.prepare(`PRAGMA table_info(${entity})`).all<{ name: string; pk: number }>()
      ).results;
      expect(
        columns
          .filter((column) => column.pk)
          .sort((a, b) => a.pk - b.pk)
          .map((column) => column.name),
      ).toEqual(['learner_id', 'id']);
      expect(
        (
          await env.DB.prepare(`PRAGMA index_info(${entity}_learner)`).all<{ name: string }>()
        ).results.map((column) => column.name),
      ).toEqual(['learner_id', 'updated_at']);
      await applyRecord(env.DB, entity, 'new-owner', { ...record('new'), id: 'kept' }, 1);
      expect(await getRecord(env.DB, entity, 'legacy-owner', 'kept')).toMatchObject({
        revision: 7,
        payload: '{ "unicode": "🌸", "spacing":  1 }',
      });
    }
  });

  it('HTTP push/pull allows the same client ID for distinct authenticated learners', async () => {
    async function call(path: string, body: unknown, token?: string) {
      const response = await worker.fetch(
        new Request(`https://bloomlab.test/api/sync/${path}`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...(token ? { authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(body),
        }) as Request<unknown, IncomingRequestCfProperties>,
        env,
      );
      expect(response.status).toBe(200);
      return response.json();
    }
    const a = (await call('link', {
      secret: generateSyncKey(),
      device: { device_id: 'client-owner-a', label: 'A' },
    })) as LinkResponse;
    const b = (await call('link', {
      secret: generateSyncKey(),
      device: { device_id: 'client-owner-b', label: 'B' },
    })) as LinkResponse;
    for (const owner of [a, b]) {
      const row = {
        ...record('unused'),
        id: 'cp:CL-glowhaus-medspa',
        learner_id: a.learner_id,
        device_id: owner.device_id,
        schema_version: 1,
        client_id: 'CL-glowhaus-medspa',
        relationship: 'discovery',
        journal: [{ id: 'same-entry-id', at, text: owner.device_id }],
        engagements: {},
      };
      delete (row as Record<string, unknown>).body;
      expect(
        await call(
          'push',
          { operations: [{ seq: 1, entity: 'client_progress', base_revision: 0, record: row }] },
          owner.session_token,
        ),
      ).toMatchObject({ outcomes: [{ status: 'applied' }] });
    }
    for (const owner of [a, b]) {
      expect(await call('pull', { cursor: 0 }, owner.session_token)).toMatchObject({
        changes: [
          {
            record: {
              id: 'cp:CL-glowhaus-medspa',
              learner_id: owner.learner_id,
              journal: [{ text: owner.device_id }],
            },
          },
        ],
      });
    }
  });
});
