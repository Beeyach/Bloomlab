import Dexie from 'dexie';
import { it, expect } from 'vitest';
import { BloomlabDatabase, DB_VERSION } from '../data/db';
it('v6 adds evidence assets without rewriting v5 workspaces or call recordings', async () => {
  const name = `fieldwork-upgrade-${crypto.randomUUID()}`;
  const reference = new BloomlabDatabase(`${name}-schema`);
  await reference.open();
  const schema = Object.fromEntries(
    reference.tables
      .filter(
        (t) => !['evidence_assets', 'portfolio_projects', 'portfolio_assets'].includes(t.name),
      )
      .map((t) => [
        t.name,
        [t.schema.primKey.src, ...t.schema.indexes.map((i) => i.src)].join(','),
      ]),
  );
  await reference.delete();
  const old = new Dexie(name);
  old.version(5).stores(schema);
  await old.open();
  await old.table('workspace').put({
    key: 'exercise.attempt.old',
    value: { text: 'Existing learner work' },
    updated_at: '2026-09-08',
  });
  await old
    .table('call_recordings')
    .put({ recording_id: 'retained-call', attempt_id: 'call-attempt', checksum: 'original' });
  old.close();
  const next = new BloomlabDatabase(name);
  await next.open();
  expect(next.verno).toBe(DB_VERSION);
  expect(await next.evidence_assets.count()).toBe(0);
  expect(await next.workspace.get('exercise.attempt.old')).toMatchObject({
    value: { text: 'Existing learner work' },
  });
  expect(await next.call_recordings.get('retained-call')).toMatchObject({ checksum: 'original' });
  await next.delete();
});
