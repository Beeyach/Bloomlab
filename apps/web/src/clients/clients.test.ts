import { describe, expect, it } from 'vitest';
import Dexie from 'dexie';
import { ClientProgressRecordSchema, INDUSTRIES } from '@bloomlab/content-schema';
import { content } from '../content/bundle';
import { BloomlabDatabase } from '../data/db';
import { freshDatabase } from '../data/testing';
import { ensureDevice } from '../data/device';
import { createSyncKey, linkThisDevice } from '../data/sync/link';
import { syncNow, resolveConflict } from '../data/sync/engine';
import { FakeSyncServer } from '../data/sync/fakeServer';
import { createBackup } from '../backup/export';
import { clientProgressId, ensureClients, saveClientNote, selectProjectAttempt } from './store';
import { projectProgress, eligibleProjectAttempt } from './progression';
import { projectEvidence } from './fixtures';

const boss = content.projects.find((row) => row.boss_client)!;
const client = 'CL-glowhaus-medspa';
async function view(database: BloomlabDatabase, project = boss) {
  return projectProgress(
    project,
    await database.client_progress.get(clientProgressId(project.client)),
    await database.exercise_attempts.toArray(),
    await database.skill_evidence.toArray(),
    (await ensureDevice(database)).learner_id,
    content,
  );
}
describe('Persistent clients and saved project evidence', () => {
  it('creates twenty distinct client industries idempotently and retains notes across reopen', async () => {
    const db = freshDatabase();
    await ensureClients(db);
    await ensureClients(db);
    expect(content.clients).toHaveLength(20);
    expect(new Set(content.clients.map((row) => row.industry))).toEqual(new Set(INDUSTRIES));
    expect(new Set(content.clients.map((row) => row.problems[0])).size).toBe(20);
    expect(await db.client_progress.count()).toBe(20);
    await saveClientNote(
      client,
      'Verify the calendar owner before promising a date.',
      'discovery',
      db,
    );
    const name = db.name;
    db.close();
    const reopened = new BloomlabDatabase(name);
    const row = await reopened.client_progress.get(clientProgressId(client));
    expect(row?.journal[0]?.text).toContain('calendar owner');
    expect(
      ClientProgressRecordSchema.safeParse({ ...row, hidden_state: { trust: 99 } }).success,
    ).toBe(false);
    expect((await createBackup(reopened)).projects.client_progress).toHaveLength(20);
    reopened.close();
  });
  it('upgrades version 7 without losing old work and replays previously skipped sync history', async () => {
    const name = `upgrade-${crypto.randomUUID()}`;
    const old = new Dexie(name);
    old.version(7).stores({ notes: '&id, updated_at', sync_state: '&entity' });
    await old.table('notes').put({ id: 'n', body: 'preserve', updated_at: '2026-09-09' });
    await old.table('sync_state').put({ entity: 'all', server_cursor: 55 });
    old.close();
    const db = new BloomlabDatabase(name);
    await db.open();
    expect((await db.notes.get('n'))?.body).toBe('preserve');
    expect((await db.sync_state.get('all'))?.server_cursor).toBe(0);
    expect(await db.client_progress.count()).toBe(0);
    db.close();
  });
  it('syncs local relationships, isolates another learner and asks before divergent snapshots are replaced', async () => {
    const a = freshDatabase(),
      b = freshDatabase(),
      stranger = freshDatabase(),
      server = new FakeSyncServer();
    await ensureClients(a);
    await saveClientNote(client, 'Before linking', 'prospect', a);
    const key = createSyncKey();
    await linkThisDevice(key.display, a, server);
    await linkThisDevice(key.display, b, server);
    await syncNow(a, server);
    await syncNow(b, server);
    expect((await b.client_progress.get(clientProgressId(client)))?.journal[0]?.text).toBe(
      'Before linking',
    );
    await saveClientNote(client, 'A chooses a scoped pilot', 'proposal', a);
    await saveClientNote(client, 'B needs more discovery', 'discovery', b);
    await syncNow(a, server);
    expect((await syncNow(b, server)).conflicts).toBe(1);
    const conflict = await b.sync_conflicts.get(['client_progress', clientProgressId(client)]);
    expect(JSON.stringify(conflict?.local)).toContain('B needs');
    expect(JSON.stringify(conflict?.server)).toContain('A chooses');
    await resolveConflict('client_progress', clientProgressId(client), 'server', b);
    expect((await b.client_progress.get(clientProgressId(client)))?.journal.at(-1)?.text).toBe(
      'A chooses a scoped pilot',
    );
    await linkThisDevice(createSyncKey().display, stranger, server);
    await syncNow(stranger, server);
    expect(await stranger.client_progress.count()).toBe(0);
    a.close();
    b.close();
    stranger.close();
  });
  it('walks all five serious starter projects using explicitly controlled valid evidence', async () => {
    const projects = content.projects.filter((row) => row.tier === 'field_ready');
    expect(projects).toHaveLength(5);
    for (const project of projects) {
      const db = freshDatabase();
      await ensureClients(db);
      expect(project.stages.length).toBeGreaterThanOrEqual(3);
      let tick = 0;
      while (!(await view(db, project)).complete) {
        const next = (await view(db, project)).next!;
        for (const id of next.missing) {
          const at = new Date(Date.UTC(2026, 8, 9, 12, ++tick)).toISOString();
          const { attempt } = await projectEvidence(db, id, { at, choice: 'single_location' });
          await selectProjectAttempt(project.id, next.id, id, attempt!.id, db);
        }
        expect(tick).toBeLessThan(60);
      }
      expect((await view(db, project)).stages.every((stage) => stage.complete)).toBe(true);
      db.close();
    }
  });
  it('an earlier scope decision changes the later required QA work; changing it invalidates downstream selections', async () => {
    const db = freshDatabase();
    await ensureClients(db);
    let tick = 0;
    for (const stage of boss.stages.slice(0, 7))
      for (const id of stage.exercises) {
        const { attempt } = await projectEvidence(db, id, {
          choice: 'two_locations',
          at: new Date(Date.UTC(2026, 8, 9, 12, ++tick)).toISOString(),
        });
        await selectProjectAttempt(boss.id, stage.id, id, attempt!.id, db);
      }
    const expanded = await view(db);
    expect(expanded.next?.id).toBe('qa');
    expect(expanded.next?.missing).toContain('EX-WHAT_WOULD_YOU_BUILD-second-location-qa');
    for (const id of boss.stages[7]!.exercises) {
      const { attempt } = await projectEvidence(db, id, {
        at: new Date(Date.UTC(2026, 8, 9, 12, ++tick)).toISOString(),
      });
      await selectProjectAttempt(boss.id, 'qa', id, attempt!.id, db);
    }
    expect((await view(db)).next?.missing).toEqual(['EX-WHAT_WOULD_YOU_BUILD-second-location-qa']);
    const { attempt } = await projectEvidence(db, 'EX-ARCHITECTURE_DECISION-boss-scope', {
      choice: 'single_location',
      at: new Date(Date.UTC(2026, 8, 9, 12, tick + 1)).toISOString(),
    });
    await selectProjectAttempt(boss.id, 'architecture', attempt!.exercise_id!, attempt!.id, db);
    const changed = await view(db);
    expect(changed.next?.id).toBe('pricing');
    expect(changed.stages[7]?.exercises).not.toContain(
      'EX-WHAT_WOULD_YOU_BUILD-second-location-qa',
    );
    const old = (await db.exercise_attempts.toArray()).find(
      (row) => row.exercise_id === 'EX-PRICE_IT-glowhaus-two-locations',
    )!;
    await expect(
      selectProjectAttempt(boss.id, 'pricing', old.exercise_id!, old.id, db),
    ).rejects.toThrow(/preceding stage/);
    db.close();
  });
  it('rejects assisted, failed, orphan, other-owner and stale evidence for capstone progress', async () => {
    const db = freshDatabase();
    await ensureClients(db);
    const id = boss.stages[0]!.exercises[0]!;
    const { attempt, evidence } = await projectEvidence(db, id);
    const owner = (await ensureDevice(db)).learner_id;
    expect(eligibleProjectAttempt(boss, id, attempt!, evidence, owner, content)).toBe(true);
    for (const change of [
      { learner_id: 'other' },
      { result: 'failed' as const },
      { hints_used: ['nudge' as const] },
      { versions: { ...attempt!.versions, content: 'old' } },
    ])
      expect(
        eligibleProjectAttempt(boss, id, { ...attempt!, ...change }, evidence, owner, content),
      ).toBe(false);
    expect(eligibleProjectAttempt(boss, id, attempt!, [], owner, content)).toBe(false);
    await expect(selectProjectAttempt(boss.id, 'pricing', id, attempt!.id, db)).rejects.toThrow(
      /earlier/,
    );
    db.close();
  });
});
