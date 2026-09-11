import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { processEvent, stateHash, type SimulatorScenario } from '@bloomlab/simulator-core';
import { db, type BloomlabDatabase } from '../data/db';
import { ensureDevice } from '../data/device';
import { stampCreate } from '../data/envelope';
import { recomputeProgress } from '../data/learning/progress';
import { freshDatabase } from '../data/testing';
import { createNotesStore } from '../data/notes';
import { savedWork } from '../portfolio/fixtures';
import { content } from '../content/bundle';
import { loadRun, markCheckpoint, saveRun, startRun } from '../simulator/store';
import { createBackup } from './export';
import { cancelRestore, confirmRestore, previewRestore } from './restore';
import { RestoreData } from './RestoreData';

let source: BloomlabDatabase;
let target: BloomlabDatabase;
beforeEach(async () => {
  cleanup();
  vi.restoreAllMocks();
  source = freshDatabase();
  target = freshDatabase();
  const owner = await ensureDevice(source);
  const device = await ensureDevice(target);
  await target.device.put({ ...device, learner_id: owner.learner_id });
});
afterEach(() => {
  source.close();
  target.close();
});
const snapshot = async (database: BloomlabDatabase) =>
  Promise.all(database.tables.map(async (table) => [table.name, await table.toArray()]));
const noteBackup = async () => {
  await createNotesStore(source).create(
    { body: 'Recover this note', target_kind: 'general', target_ref: null },
    'recover-note',
  );
  return createBackup(source);
};

describe('DATA-009 staged, owned, non-destructive backup restore', () => {
  it('restores all supported groups offline, queues real writes and reopens saved work and simulator state', async () => {
    const original = await savedWork(source, { capture: true });
    await source.client_progress.put(
      stampCreate(
        {
          schema_version: 1 as const,
          client_id: 'CL-glowhaus-medspa',
          relationship: 'prospect' as const,
          journal: [],
          engagements: {},
        },
        (await source.device.toCollection().first())!,
        'client:restore',
      ),
    );
    await noteBackup();
    const run = await startRun(
      content.scenarios.find(
        (s) => s.id === 'SC-glowhaus-no-show',
      )! as unknown as SimulatorScenario,
      source,
    );
    run.state = processEvent(run.state, {
      type: 'TAG_ADDED',
      at: run.state.clock.now,
      payload: { contact_id: 'maria', tag: 'restored' },
      origin: 'injected',
    });
    await saveRun(run, source);
    await markCheckpoint(run, 'Before restore', source);
    const backup = await createBackup(source);
    expect(backup.projects.sim_projects[0]!.account).toEqual(run.state.account);
    const before = await snapshot(target);
    const fetch = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    const preview = await previewRestore(JSON.stringify(backup), target);
    expect(await snapshot(target)).toEqual(before);
    expect(preview.add).toBeGreaterThan(5);
    const count = await confirmRestore(preview, target);
    expect(count).toBe(preview.add);
    expect(await target.sync_queue.count()).toBeGreaterThanOrEqual(count);
    expect(await target.sync_state.toArray()).toEqual([]);
    target.close();
    await target.open();
    expect((await target.exercise_attempts.get(original.attempt!.id))!.versions).toEqual(
      original.attempt!.versions,
    );
    expect((await target.notes.get('recover-note'))!.body).toBe('Recover this note');
    expect(stateHash((await loadRun(run.state.run_id, target))!.state)).toBe(stateHash(run.state));
    expect(await target.skill_progress.count()).toBeGreaterThan(0);
    expect(await target.portfolio_projects.count()).toBe(1);
    expect(await target.client_progress.count()).toBe(1);
    expect(fetch).not.toHaveBeenCalled();
    await expect(confirmRestore(preview, target)).rejects.toThrow('Review this backup again');
  });
  it.each([
    'malformed',
    'version',
    'missing group',
    'wrong record type',
    'unknown column',
    'duplicate',
  ])('rejects %s before any local change', async (kind) => {
    const backup = await noteBackup();
    let text = JSON.stringify(backup);
    if (kind === 'malformed') text = '{oops';
    if (kind === 'version') text = text.replace('"schema_version":1', '"schema_version":999');
    if (kind === 'missing group') text = JSON.stringify({ ...backup, evidence: undefined });
    if (kind === 'wrong record type') backup.notes[0]!.body = { text: 'wrong' };
    if (kind === 'unknown column') backup.notes[0]!.connection = 'not exported';
    if (kind === 'duplicate') backup.notes.push({ ...backup.notes[0]! });
    if (['wrong record type', 'unknown column', 'duplicate'].includes(kind))
      text = JSON.stringify(backup);
    const before = await snapshot(target);
    await expect(previewRestore(text, target)).rejects.toThrow();
    expect(await snapshot(target)).toEqual(before);
  });
  it.each(['__proto__', 'constructor', 'prototype', 'session_token', 'api_key', 'audio_bytes'])(
    'rejects nested unsafe %s',
    async (key) => {
      const backup = await noteBackup();
      const text = JSON.stringify(backup).replace(
        '"body":"Recover this note"',
        `"body":"Recover this note","extra":{"${key}":"canary"}`,
      );
      const before = await snapshot(target);
      await expect(previewRestore(text, target)).rejects.toThrow();
      expect(await snapshot(target)).toEqual(before);
      expect(({} as { canary?: string }).canary).toBeUndefined();
    },
  );
  it('refuses mixed/foreign learner records, without reassigning ownership or importing sessions', async () => {
    const backup = await noteBackup();
    backup.notes[0]!.learner_id = 'another-learner';
    const before = await snapshot(target);
    await expect(previewRestore(JSON.stringify(backup), target)).rejects.toThrow('another learner');
    expect(await snapshot(target)).toEqual(before);
  });
  it('keeps existing edits and tombstones, adds missing records, and makes duplicate restore a no-op', async () => {
    const backup = await noteBackup();
    await createNotesStore(target).create(
      { body: 'Newer local work', target_kind: 'general', target_ref: null },
      'recover-note',
    );
    await createNotesStore(target).remove('recover-note');
    await createNotesStore(source).create(
      { body: 'A missing note', target_kind: 'general', target_ref: null },
      'missing',
    );
    const newer = await createBackup(source);
    const kept = await target.notes.get('recover-note');
    const preview = await previewRestore(JSON.stringify(newer), target);
    expect(preview.keep).toBe(1);
    expect(preview.add).toBe(1);
    await confirmRestore(preview, target);
    expect(await target.notes.get('recover-note')).toEqual(kept);
    expect((await previewRestore(JSON.stringify(backup), target)).add).toBe(0);
    expect((await previewRestore(JSON.stringify(newer), target)).add).toBe(0);
  });
  it('cancel writes nothing and invalidates its confirmation', async () => {
    const preview = await previewRestore(JSON.stringify(await noteBackup()), target);
    const before = await snapshot(target);
    cancelRestore(preview);
    await expect(confirmRestore(preview, target)).rejects.toThrow('Review');
    expect(await snapshot(target)).toEqual(before);
  });
  it('validates dates and derived row schemas but recomputes, never trusts a serialized completion claim', async () => {
    await savedWork(source);
    await recomputeProgress(source);
    const backup = await createBackup(source);
    const broken = structuredClone(backup);
    broken.progress.skill_progress[0]!.state = { fake: 'MASTERED' };
    await expect(previewRestore(JSON.stringify(broken), target)).rejects.toThrow('schema');
    broken.progress = backup.progress;
    broken.evidence.exercise_attempts[0]!.completed_at = 'not-a-date';
    await expect(previewRestore(JSON.stringify(broken), target)).rejects.toThrow('schema');
    for (const row of backup.progress.campaign_progress) row.complete = true;
    await confirmRestore(await previewRestore(JSON.stringify(backup), target), target);
    expect((await target.campaign_progress.toArray()).every((row) => !row.complete)).toBe(true);
  });
  it('refuses a stale preview after a second tab/local change', async () => {
    const preview = await previewRestore(JSON.stringify(await noteBackup()), target);
    await createNotesStore(target).create({
      body: 'Second tab work',
      target_kind: 'general',
      target_ref: null,
    });
    const before = await snapshot(target);
    await expect(confirmRestore(preview, target)).rejects.toThrow('changed since');
    expect(await snapshot(target)).toEqual(before);
  });
  it('rolls back rows AND outbox after a partial write failure and can retry', async () => {
    await noteBackup();
    await createNotesStore(source).create(
      { body: 'Second', target_kind: 'general', target_ref: null },
      'second',
    );
    const preview = await previewRestore(JSON.stringify(await createBackup(source)), target);
    const before = await snapshot(target);
    let writes = 0;
    const failWrite = () => {
      if (++writes === 2) throw new Error('quota exhausted');
    };
    target.notes.hook('creating', failWrite);
    await expect(confirmRestore(preview, target)).rejects.toThrow('quota exhausted');
    expect(writes).toBe(2);
    expect(await snapshot(target)).toEqual(before);
    target.notes.hook('creating').unsubscribe(failWrite);
    expect(await confirmRestore(preview, target)).toBe(2);
  });
  it('rejects incomplete simulator history and dangling evidence references', async () => {
    const original = await savedWork(source);
    const backup = await createBackup(source);
    backup.evidence.exercise_attempts = [];
    await expect(previewRestore(JSON.stringify(backup), target)).rejects.toThrow(
      'missing or foreign attempt',
    );
    expect(await target.skill_evidence.get(original.evidence[0]!.id)).toBeUndefined();
    const run = await startRun(
      content.scenarios.find(
        (s) => s.id === 'SC-glowhaus-no-show',
      )! as unknown as SimulatorScenario,
      source,
    );
    const sim = await createBackup(source);
    sim.projects.sim_projects[0]!.log_length = 99;
    await expect(previewRestore(JSON.stringify(sim), target)).rejects.toThrow('history');
    expect(await target.sim_projects.get(run.state.run_id)).toBeUndefined();
  });
  it('shows explicit review/cancel/confirm, error and success without importing private media', async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
    await db.device.put((await source.device.toCollection().first())!);
    const text = JSON.stringify(await noteBackup());
    const file = new File([text], 'backup.json', { type: 'application/json' });
    Object.defineProperty(file, 'text', { value: async () => text });
    render(<RestoreData />);
    fireEvent.change(screen.getByLabelText('Choose Bloomlab backup'), {
      target: { files: [file] },
    });
    expect(await screen.findByRole('button', { name: 'Confirm restore' })).toBeEnabled();
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Review restore' })).toHaveFocus(),
    );
    expect(await db.notes.count()).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel restore' }));
    expect(screen.getByRole('status')).toHaveTextContent('cancelled');
    fireEvent.change(screen.getByLabelText('Choose Bloomlab backup'), {
      target: { files: [file] },
    });
    const confirm = await screen.findByRole('button', { name: 'Confirm restore' });
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Review restore' })).toHaveFocus(),
    );
    // A browser frame can run before React commits the async restore's enabled input.
    const frame = vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(performance.now());
      return 0;
    });
    try {
      fireEvent.click(confirm);
      await waitFor(() =>
        expect(screen.getByRole('status')).toHaveTextContent('Restored 1 missing records'),
      );
      await waitFor(() => expect(screen.getByLabelText('Choose Bloomlab backup')).toHaveFocus());
      expect(screen.getByLabelText('Choose Bloomlab backup')).toBeEnabled();
      expect(await db.evidence_assets.count()).toBe(0);
    } finally {
      frame.mockRestore();
    }
  });
});
