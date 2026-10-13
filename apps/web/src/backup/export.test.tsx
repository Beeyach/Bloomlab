import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { db } from '../data/db';
import { ensureDevice } from '../data/device';
import { createNotesStore } from '../data/notes';
import { stampCreate } from '../data/envelope';
import { savedWork } from '../portfolio/fixtures';
import { createBackup, BackupSchema, BACKUP_GROUPS, safeBackupValue } from './export';
import { ExportData } from './ExportData';

beforeEach(async () => {
  cleanup();
  vi.restoreAllMocks();
  await Promise.all(db.tables.map((t) => t.clear()));
});
describe('DATA-008 versioned local export', () => {
  it('exports all six groups in their assigned locations with deterministic order, including tombstones and portfolio metadata', async () => {
    const device = await ensureDevice();
    await savedWork(db, { capture: true });
    const note = await createNotesStore().create({
      body: 'Learner note',
      target_kind: 'general',
      target_ref: null,
    });
    await createNotesStore().remove(note.id);
    await db.skill_progress.put(
      stampCreate({ skill_id: 'skill', state: 'LEARNING' }, device, 'progress') as never,
    );
    await db.sim_projects.put(
      stampCreate(
        { run_id: 'run', scenario_id: 'scenario', account: { workflows: {} } },
        device,
        'project',
      ) as never,
    );
    await db.sim_events.put(
      stampCreate(
        { run_id: 'run', generation: 'g', sequence: 1, event: { type: 'TIME_ADVANCED' } },
        device,
        'event',
      ),
    );
    await db.sim_snapshots.put(
      stampCreate(
        {
          run_id: 'run',
          generation: 'g',
          log_length: 1,
          label: 'Saved',
          checkpoint: { clock: { now: '2026-09-08' } },
        },
        device,
        'snapshot',
      ),
    );
    const at = new Date('2026-09-08T12:00:00.000Z');
    const result = await createBackup(db, at);
    expect(result.format).toBe('bloomlab-data');
    expect(result.schema_version).toBe(1);
    expect(result.progress.skill_progress[0]!.id).toBe('progress');
    expect(result.evidence.exercise_attempts).toHaveLength(1);
    expect(result.projects.sim_projects[0]!.id).toBe('project');
    expect(result.notes[0]!.deleted_at).not.toBeNull();
    expect(result.simulator_saves.sim_events[0]!.id).toBe('event');
    expect(result.simulator_saves.sim_snapshots[0]!.id).toBe('snapshot');
    expect(result.portfolio_metadata.portfolio_projects).toHaveLength(1);
    expect(result.portfolio_metadata.portfolio_assets).toHaveLength(1);
    expect(await createBackup(db, at)).toEqual(result);
    for (const group of BACKUP_GROUPS) {
      const broken = { ...result };
      delete (broken as Partial<typeof broken>)[group];
      expect(BackupSchema.safeParse(broken).success).toBe(false);
    }
    expect(BackupSchema.safeParse({ ...result, schema_version: 2 }).success).toBe(false);
  });
  it('excludes secrets, credentials, provider fields, raw media, foreign rows and unknown columns, including nested canaries', async () => {
    const device = await ensureDevice();
    await db.device.put({ ...device, session_token: 'session-canary', sync_key: 'key-canary' });
    const saved = await savedWork(db, { fieldwork: true });
    const attempt = saved.attempt!;
    await db.exercise_attempts.update(attempt.id, {
      response: {
        ...attempt.response,
        audio_bytes: [1, 2, 3],
        nested: {
          api_key: 'nested-secret',
          cookie: 'cookie-canary',
          blob: new Blob(['bytes']),
          headers: [{ name: 'Authorization', value: 'header-secret' }],
        },
        text: 'Bearer do-not-export',
      } as never,
      provider_credentials: 'provider-secret',
    } as never);
    await db.workspace.put({
      key: 'ai.settings',
      learner_id: device.learner_id,
      device_id: device.device_id,
      value: { secret: 'workspace-secret' },
      updated_at: new Date().toISOString(),
    });
    await db.call_recordings.put({
      recording_id: 'private',
      blob: new Blob(['raw-audio-canary']),
    } as never);
    const asset = attempt.response!.fieldwork!.screenshots.destination_workflow!;
    await db.evidence_assets.put({
      asset_id: asset,
      learner_id: device.learner_id,
      device_id: device.device_id,
      attempt_id: attempt.id,
      exercise_id: attempt.exercise_id!,
      item_key: 'destination_workflow',
      blob: new Blob(['raw-image-canary']),
      status: 'uploaded',
      upload_started: true,
    });
    await db.notes.put(
      stampCreate(
        { body: 'foreign-canary', target_kind: 'general', target_ref: null },
        { ...device, learner_id: 'foreign' },
        'foreign',
      ),
    );
    const fetch = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    const result = await createBackup();
    const json = JSON.stringify(result);
    for (const canary of [
      'session-canary',
      'key-canary',
      'nested-secret',
      'cookie-canary',
      'header-secret',
      'workspace-secret',
      'provider-secret',
      'raw-audio-canary',
      'raw-image-canary',
      'foreign-canary',
      'do-not-export',
    ])
      expect(json).not.toContain(canary);
    expect(result.evidence.private_assets[0]!.asset_id).toBe(asset);
    expect(fetch).not.toHaveBeenCalled();
    expect(safeBackupValue({ url: 'https://host.invalid/?token=secret' })).toEqual({
      url: '[private value omitted]',
    });
    expect(
      safeBackupValue({
        pre_buffer_minutes: 15,
        post_buffer_minutes: 30,
        buffer: [1, 2],
        audio_buffer: [3],
        pre_buffer_minutes_bytes: [4],
      }),
    ).toEqual({ pre_buffer_minutes: 15, post_buffer_minutes: 30 });
    expect(safeBackupValue({ pre_buffer_minutes: { bytes: [1] } })).toEqual({});
  });
  it('downloads a locally created JSON file and shows success without any provider request', async () => {
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:local-export');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const fetch = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    render(<ExportData />);
    fireEvent.click(screen.getByRole('button', { name: 'Export Bloomlab Data' }));
    expect(await screen.findByText(/Export prepared/)).toBeInTheDocument();
    expect(create).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(fetch).not.toHaveBeenCalled();
  });
  it('shows a truthful export error and retry without discarding saved work', async () => {
    await createNotesStore().create({
      body: 'Keep this',
      target_kind: 'general',
      target_ref: null,
    });
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
      throw new Error('download denied');
    });
    render(<ExportData />);
    fireEvent.click(screen.getByRole('button', { name: 'Export Bloomlab Data' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be prepared');
    expect(await db.notes.count()).toBe(1);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:retry');
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    fireEvent.click(screen.getByRole('button', { name: 'Export Bloomlab Data' }));
    expect(await screen.findByText(/Export prepared/)).toBeInTheDocument();
  });
});
