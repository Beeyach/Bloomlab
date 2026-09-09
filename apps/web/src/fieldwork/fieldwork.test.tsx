import { FakeSyncServer } from '../data/sync/fakeServer';
import { createSyncKey, linkThisDevice } from '../data/sync/link';
import { syncNow } from '../data/sync/engine';
import { freshDatabase } from '../data/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { reasoningItems, type Exercise } from '@bloomlab/content-schema';
import { validateEvidence } from '@bloomlab/mastery-engine';
import type { EvidenceAsset } from '@bloomlab/shared';
import { content } from '../content/bundle';
import { db, BloomlabDatabase } from '../data/db';
import { ensureDevice } from '../data/device';
import { startAttempt, NORMAL_RUN, editFieldwork, loadAttempt } from '../exercise/attempt';
import { finalizeAttempt } from '../exercise/finalize';
import { stripEnvelope } from '../data/learning/shape';
import { emptyFieldwork, completionMissing } from './proof';
import { checkpointProof } from './checkpoint';
import { selectEvidence, uploadEvidence, deleteEvidence } from './assets';
import { Fieldwork } from './Fieldwork';
const exercise = content.exercises.find((e) => e.id === 'EX-FIELDWORK-snapshot-no-show-system')!;
const png = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN1kAAAAASUVORK5CYII=',
  ),
  (c) => c.charCodeAt(0),
);
function file() {
  return {
    size: png.length,
    type: 'image/png',
    arrayBuffer: async () => png.slice().buffer,
  } as Blob;
}
function filled(e: Exercise = exercise) {
  const p = emptyFieldwork(e);
  p.phase = 'proof';
  for (const group of ['configuration', 'explanations'] as const)
    for (const item of e.fieldwork!.proof![group])
      p[group][item.key] = 'Manually inspected the training setup.';
  for (const item of e.fieldwork!.proof!.tests)
    p.tests[item.key] = {
      observed: 'Inspected expected assets and destination settings.',
      status: 'passed',
    };
  return p;
}
beforeEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(db.tables.map((t) => t.clear()));
});
async function imageAttempt() {
  const attempt = await startAttempt(exercise);
  const id = crypto.randomUUID();
  const device = await ensureDevice();
  await db.device.put({ ...device, session_token: 'controlled-session' });
  const asset: EvidenceAsset = {
    asset_id: id,
    attempt_id: attempt.attempt_id,
    exercise_id: exercise.id,
    item_key: 'destination_workflow',
    status: 'ready',
    deleted_at: null,
    checksum: 'checksum',
    mime_type: 'image/png',
    byte_length: png.length,
    width: 1,
    height: 1,
  };
  const p = filled();
  p.screenshots.destination_workflow = id;
  await editFieldwork(exercise, NORMAL_RUN, () => p);
  // fake-indexeddb lacks browser Blob structured cloning; browser probe verifies the actual Blob.
  await db.evidence_assets.add({
    asset_id: id,
    attempt_id: attempt.attempt_id,
    exercise_id: exercise.id,
    item_key: 'destination_workflow',
    blob: new Blob([png]),
    status: 'uploaded',
    upload_started: true,
  });
  const fetch = vi
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async () => new Response(JSON.stringify(asset)));
  return { attempt, id, p, asset, fetch };
}
describe('FLD-001 durable proof/checkpoint/finalization', () => {
  it('keeps typed proof across database reopen; failed required test and missing screenshot prevent a pass', async () => {
    const attempt = await startAttempt(exercise);
    const p = filled();
    p.tests.assets_loaded!.status = 'failed';
    await editFieldwork(exercise, NORMAL_RUN, () => p);
    const reopened = new BloomlabDatabase(db.name);
    await reopened.open();
    expect((await loadAttempt(exercise.id, NORMAL_RUN, reopened))?.response.fieldwork).toEqual(p);
    reopened.close();
    await expect(checkpointProof(exercise, NORMAL_RUN, attempt.attempt_id)).rejects.toThrow(
      'Fix/retest',
    );
    await expect(finalizeAttempt(exercise, attempt)).rejects.toThrow();
    expect(await db.skill_evidence.count()).toBe(0);
  });
  it('allows no-screenshot authoring and finishes with AI Off without any network dependency', async () => {
    const e = structuredClone(exercise);
    e.fieldwork!.proof!.screenshots = [];
    const attempt = await startAttempt(e);
    const p = filled(e);
    await editFieldwork(e, NORMAL_RUN, () => p);
    const fetch = vi.spyOn(globalThis, 'fetch');
    await checkpointProof(e, NORMAL_RUN, attempt.attempt_id);
    await editFieldwork(e, NORMAL_RUN, (p) => ({
      ...p,
      confirmed: true,
      reasoning: Object.fromEntries(
        reasoningItems(e.fieldwork!).map((i) => [i.key, 'My authored reasoning.']),
      ),
    }));
    expect((await finalizeAttempt(e, attempt)).report.outcome).toBe('passed');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('requires live private assets then writes one attempt and one valid fieldwork evidence per skill on concurrent submit/reload', async () => {
    const { attempt, asset, fetch } = await imageAttempt();
    await checkpointProof(exercise, NORMAL_RUN, attempt.attempt_id);
    const saving = editFieldwork(exercise, NORMAL_RUN, (p) => ({
      ...p,
      confirmed: true,
      reasoning: Object.fromEntries(
        reasoningItems(exercise.fieldwork!).map((i) => [
          i.key,
          'I checked each destination dependency.',
        ]),
      ),
    }));
    const [one, two] = await Promise.all([
      finalizeAttempt(exercise, attempt),
      finalizeAttempt(exercise, attempt),
    ]);
    await saving;
    expect(one.attempt.id).toBe(two.attempt.id);
    expect(one.report.outcome).toBe('passed');
    const retry = await finalizeAttempt(exercise, attempt);
    expect(retry.recorded).toBe(false);
    expect(await db.exercise_attempts.count()).toBe(1);
    expect(await db.skill_evidence.count()).toBe(exercise.skills.length);
    const evidence = (await db.skill_evidence.toArray())[0]!;
    expect(validateEvidence(stripEnvelope(evidence))).toEqual([]);
    expect(evidence).toMatchObject({
      kind: 'fieldwork',
      source: { type: 'fieldwork' },
      real_ghl: { required: true, provided: true },
    });
    expect(evidence.real_ghl?.evidence).toContain(`asset:${asset.asset_id}`);
    const outbox = JSON.stringify(await db.sync_queue.toArray());
    expect(outbox).not.toMatch(/"blob"|base64|image\/png/);
    expect(outbox).toContain(asset.asset_id);
    for (const [path, init] of fetch.mock.calls) {
      expect(String(path)).toMatch(/^\/api\/evidence\/assets\//);
      expect(init?.redirect).toBe('error');
    }
  });
  it('syncs the canonical response and proof references to a second device, never local image bytes', async () => {
    const { attempt, asset } = await imageAttempt();
    const server = new FakeSyncServer();
    const other = freshDatabase();
    const key = createSyncKey();
    await linkThisDevice(key.display, db, server);
    await linkThisDevice(key.canonical, other, server);
    await checkpointProof(exercise, NORMAL_RUN, attempt.attempt_id);
    await editFieldwork(exercise, NORMAL_RUN, (p) => ({
      ...p,
      confirmed: true,
      reasoning: Object.fromEntries(
        reasoningItems(exercise.fieldwork!).map((i) => [i.key, 'Manual reasoning recorded.']),
      ),
    }));
    await finalizeAttempt(exercise, attempt);
    expect((await syncNow(db, server)).status).toBe('synced');
    await syncNow(other, server);
    expect(
      (await other.exercise_attempts.toArray())[0]?.response?.fieldwork?.screenshots
        .destination_workflow,
    ).toBe(asset.asset_id);
    expect((await other.skill_evidence.toArray())[0]?.real_ghl?.provided).toBe(true);
    expect(await other.evidence_assets.count()).toBe(0);
    other.close();
  });
  it('refuses deleted or wrong-attempt assets at submission without minting evidence', async () => {
    const { attempt, asset, fetch } = await imageAttempt();
    await checkpointProof(exercise, NORMAL_RUN, attempt.attempt_id);
    await editFieldwork(exercise, NORMAL_RUN, (p) => ({
      ...p,
      confirmed: true,
      reasoning: Object.fromEntries(
        reasoningItems(exercise.fieldwork!).map((i) => [i.key, 'Reasoning recorded.']),
      ),
    }));
    fetch.mockResolvedValue(
      new Response(
        JSON.stringify({ ...asset, status: 'deleted', deleted_at: new Date().toISOString() }),
      ),
    );
    await expect(finalizeAttempt(exercise, attempt)).rejects.toThrow('missing or deleted');
    expect(await db.skill_evidence.count()).toBe(0);
  });
  it('does not reveal reasoning in the build or proof phase and shows save errors without dropping answers', async () => {
    const attempt = await startAttempt(exercise);
    render(
      <MemoryRouter>
        <Fieldwork
          exercise={exercise}
          attempt={attempt}
          context={NORMAL_RUN}
          submitting={false}
          submissionError={null}
          onSubmit={() => undefined}
        />
      </MemoryRouter>,
    );
    expect(
      screen.queryByRole('textbox', { name: reasoningItems(exercise.fieldwork!)[0]!.prompt }),
    ).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Capture proof' }));
    const field = await screen.findByRole('textbox', {
      name: exercise.fieldwork!.proof!.configuration[0]!.prompt,
    });
    fireEvent.change(field, { target: { value: 'A saved configuration description.' } });
    await waitFor(async () =>
      expect(
        (await loadAttempt(exercise.id))?.response.fieldwork?.configuration.asset_inventory,
      ).toContain('saved configuration'),
    );
    expect(
      screen.queryByRole('textbox', { name: reasoningItems(exercise.fieldwork!)[0]!.prompt }),
    ).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Save proof checkpoint' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Complete the proof first');
    expect(field).toHaveValue('A saved configuration description.');
  });
  it('a fresh attempt never inherits the previous finished proof or revealed reasoning', async () => {
    const attempt = await startAttempt(exercise);
    const previous = filled();
    previous.phase = 'reasoning';
    previous.checkpoint = '2026-09-08';
    previous.reasoning.custom_value_choice = 'Previous answer';
    render(
      <MemoryRouter>
        <Fieldwork
          exercise={exercise}
          attempt={attempt}
          saved={previous}
          context={NORMAL_RUN}
          submitting={false}
          submissionError={null}
          onSubmit={() => undefined}
        />
      </MemoryRouter>,
    );
    expect(screen.getByRole('button', { name: 'Capture proof' })).toBeInTheDocument();
    expect(
      screen.queryByRole('textbox', { name: reasoningItems(exercise.fieldwork!)[0]!.prompt }),
    ).toBeNull();
  });
  it('a failed local final write keeps proof editable and permits the same submission retry', async () => {
    const { attempt } = await imageAttempt();
    await checkpointProof(exercise, NORMAL_RUN, attempt.attempt_id);
    await editFieldwork(exercise, NORMAL_RUN, (p) => ({
      ...p,
      confirmed: true,
      reasoning: Object.fromEntries(
        reasoningItems(exercise.fieldwork!).map((i) => [i.key, 'Reasoning recorded.']),
      ),
    }));
    const add = vi
      .spyOn(db.exercise_attempts, 'add')
      .mockRejectedValueOnce(new Error('storage full'));
    await expect(finalizeAttempt(exercise, attempt)).rejects.toThrow('storage full');
    add.mockRestore();
    expect((await loadAttempt(exercise.id))?.submitted).toBeUndefined();
    expect(await db.skill_evidence.count()).toBe(0);
    await editFieldwork(exercise, NORMAL_RUN, (p) => ({
      ...p,
      reasoning: {
        ...p.reasoning,
        custom_value_choice: 'Corrected answer after storage recovery.',
      },
    }));
    expect((await finalizeAttempt(exercise, attempt)).report.outcome).toBe('passed');
    expect(await db.exercise_attempts.count()).toBe(1);
  });
  it('rejects unsupported local images before storing or networking', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch');
    await expect(
      selectEvidence({ ...file(), type: 'text/html' } as Blob, {
        asset_id: crypto.randomUUID(),
        attempt_id: crypto.randomUUID(),
        exercise_id: exercise.id,
        item_key: 'destination_workflow',
      }),
    ).rejects.toThrow('PNG');
    expect(await db.evidence_assets.count()).toBe(0);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('retains the same local object when upload fails and retries without uploading an already saved asset', async () => {
    const { id, asset, fetch } = await imageAttempt();
    await db.evidence_assets.update(id, { status: 'local' });
    fetch.mockRejectedValueOnce(new Error('offline'));
    await expect(uploadEvidence(id)).rejects.toThrow('offline');
    expect(await db.evidence_assets.get(id)).toMatchObject({
      status: 'local',
      upload_started: true,
    });
    await uploadEvidence(id);
    await uploadEvidence(id);
    expect(fetch.mock.calls.filter(([, init]) => init?.method === 'PUT')).toHaveLength(2);
    fetch.mockResolvedValueOnce(new Response(JSON.stringify({ ...asset, status: 'deleted' })));
    await deleteEvidence(id);
    expect(await db.evidence_assets.get(id)).toMatchObject({ status: 'deleted', blob: null });
  });
  it('invalidates old content checkpoints and does not count missing reasoning or confirmation', () => {
    const p = filled();
    p.checkpoint = '2026-09-08';
    p.contract = 'old';
    expect(completionMissing(exercise, p).join(' ')).toMatch(/changed.*Confirm/s);
  });
});
