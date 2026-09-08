import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import Dexie from 'dexie';
import {
  PORTFOLIO_ARTIFACT_KINDS,
  PortfolioProjectRecordSchema,
  PortfolioAssetRecordSchema,
  PortfolioSchema,
} from '@bloomlab/content-schema';
import { db, BloomlabDatabase } from '../data/db';
import { ensureDevice } from '../data/device';
import { freshDatabase } from '../data/testing';
import { FakeSyncServer } from '../data/sync/fakeServer';
import { createSyncKey, linkThisDevice } from '../data/sync/link';
import { syncNow, resolveConflict } from '../data/sync/engine';
import { createSyncableStore } from '../data/stores';
import { consultation, savedWork } from './fixtures';
import { collectPortfolio, saveReflection } from './store';
import { readPortfolio } from './view';
import PortfolioScreen from './PortfolioScreen';
import { captureArchitecture } from './capture';

beforeEach(async () => {
  cleanup();
  vi.restoreAllMocks();
  await Promise.all(db.tables.map((t) => t.clear()));
});
function renderPortfolio(detail = false) {
  return render(
    <MemoryRouter initialEntries={[detail ? `/portfolio/${consultation.id}` : '/portfolio']}>
      <Routes>
        <Route path="/portfolio/:templateId?" element={<PortfolioScreen />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('PORT-001 canonical portfolio', () => {
  it('persists ten normalized categories, idempotent contributions, and never mirrors templates or duplicates private blobs', async () => {
    await savedWork(db, { capture: true });
    await savedWork(db, { fieldwork: true });
    await Promise.all([collectPortfolio(), collectPortfolio()]);
    expect(await db.portfolio_projects.count()).toBe(1);
    expect(await db.portfolio_assets.count()).toBe(2);
    const project = (await db.portfolio_projects.toArray())[0]!;
    expect(Object.keys(project.artifacts).sort()).toEqual([...PORTFOLIO_ARTIFACT_KINDS].sort());
    expect(PortfolioProjectRecordSchema.safeParse(project).success).toBe(true);
    const before = JSON.stringify(await db.sync_queue.toArray());
    await collectPortfolio();
    expect(JSON.stringify(await db.sync_queue.toArray())).toBe(before);
    expect(before).not.toContain('data:image');
    expect(project).not.toHaveProperty('brief');
    const view = (await readPortfolio())[0]!;
    expect(Object.values(view.available).every(Boolean)).toBe(true);
    expect(view.realGhl).toHaveLength(1);
    expect(view.captures[0]!.capture.workflows[0]!.name).toBe('Recovery');
  });
  it.each(PORTFOLIO_ARTIFACT_KINDS)(
    'refuses disappearance of %s from persisted metadata',
    async (kind) => {
      await savedWork(db);
      await collectPortfolio();
      const p = (await db.portfolio_projects.toArray())[0]!;
      const copy = structuredClone(p);
      delete (copy.artifacts as Partial<typeof copy.artifacts>)[kind];
      expect(PortfolioProjectRecordSchema.safeParse(copy).success).toBe(false);
    },
  );
  it('does not claim missing builds, passes or GHL proof from partial or failed work', async () => {
    await savedWork(db, { result: 'partial' });
    await collectPortfolio();
    const v = (await readPortfolio())[0]!;
    expect(v.available.architecture).toBe(false);
    expect(v.available.funnel).toBe(false);
    expect(v.available.skills_demonstrated).toBe(false);
    expect(v.available.real_ghl_evidence).toBe(false);
    expect(v.available.learner_reasoning).toBe(true);
  });
  it('does not assemble an orphan attempt without saved evidence, or another learner’s evidence', async () => {
    const saved = await savedWork(db);
    await db.skill_evidence.clear();
    await collectPortfolio();
    expect(await db.portfolio_projects.count()).toBe(0);
    await db.skill_evidence.bulkPut(saved.evidence.map((e) => ({ ...e, learner_id: 'foreign' })));
    await collectPortfolio();
    expect(await db.portfolio_projects.count()).toBe(0);
  });
  it('preserves deleted source state and never resurrects a portfolio tombstone', async () => {
    const saved = await savedWork(db, { fieldwork: true });
    await collectPortfolio();
    const asset = saved.attempt!.response!.fieldwork!.screenshots.destination_workflow!;
    await db.evidence_assets.put({
      asset_id: asset,
      attempt_id: saved.attempt!.id,
      exercise_id: saved.attempt!.exercise_id!,
      item_key: 'destination_workflow',
      blob: null,
      status: 'deleted',
      upload_started: true,
    });
    expect((await readPortfolio())[0]!.available.screenshots).toBe(false);
    const p = (await db.portfolio_projects.toArray())[0]!;
    await createSyncableStore('portfolio_projects').remove(p.id);
    await collectPortfolio();
    expect(await readPortfolio()).toEqual([]);
  });
  it('captures only the submitted grader structure, without mutable account or webhook credentials', () => {
    const capture = captureArchitecture({
      workflows: [
        {
          id: 'wf',
          name: 'Actual',
          trigger: {
            ghl_feature_id: 'GHL-WF-APPOINTMENT-STATUS',
            filters: [{ secret: 'never-copy' }],
          },
          nodes: [{ id: 'n', type: 'action', ghl_feature_id: 'GHL-WF-SEND-SMS' }],
        },
      ],
    })!;
    expect(capture.workflows[0]!.name).toBe('Actual');
    expect(JSON.stringify(capture)).not.toContain('never-copy');
    expect(captureArchitecture(null)).toBeNull();
    expect(
      captureArchitecture({
        workflows: [{ id: 'wf', name: 'x'.repeat(501), trigger: null, nodes: [] }],
      }),
    ).toBeNull();
  });
  it('reopens and syncs the same metadata; simultaneous reflections require an explicit choice', async () => {
    const a = freshDatabase(),
      b = freshDatabase(),
      server = new FakeSyncServer(),
      key = createSyncKey().canonical;
    await linkThisDevice(key, a, server);
    await linkThisDevice(key, b, server);
    await savedWork(a, { capture: true });
    await collectPortfolio(a);
    const id = (await a.portfolio_projects.toArray())[0]!.id;
    await saveReflection(id, 'First reflection', a);
    await syncNow(a, server);
    await syncNow(b, server);
    expect((await readPortfolio(b))[0]!.record.reflection).toBe('First reflection');
    a.close();
    await a.open();
    expect((await readPortfolio(a))[0]!.captures).toHaveLength(1);
    await saveReflection(id, 'On A', a);
    await saveReflection(id, 'On B', b);
    await syncNow(a, server);
    await syncNow(b, server);
    expect(await b.sync_conflicts.count()).toBe(1);
    await resolveConflict('portfolio_projects', id, 'local', b);
    await syncNow(b, server);
    await syncNow(a, server);
    expect((await readPortfolio(a))[0]!.record.reflection).toBe('On B');
    a.close();
    b.close();
  });
  it('adds v7 without changing v6 rows and resets the skipped-entity pull cursor', async () => {
    const name = `migration-${crypto.randomUUID()}`;
    const old = new Dexie(name);
    old.version(6).stores({
      device: '&device_id',
      notes: '&id,updated_at',
      workspace: '&key',
      sync_queue: '++seq,[entity+entity_id],status',
      sync_state: '&entity',
      sync_shadow: '&[entity+entity_id]',
      sync_conflicts: '&[entity+entity_id]',
      skill_evidence: '&id,skill_id,occurred_at,updated_at',
      exercise_attempts: '&id,exercise_id,updated_at',
      skill_progress: '&id,skill_id,updated_at',
      campaign_progress: '&id,campaign_id,updated_at',
      review_queue: '&id,skill_id,due_at,updated_at',
      sim_projects: '&id,run_id,scenario_id,updated_at',
      sim_events: '&id,run_id,sequence,updated_at',
      sim_snapshots: '&id,run_id,log_length,updated_at',
      call_recordings: '&recording_id,attempt_id,[attempt_id+turn]',
      evidence_assets: '&asset_id,attempt_id',
    });
    await old.table('notes').put({ id: 'kept', body: 'Preserve' });
    await old.table('sync_state').put({ entity: 'all', server_cursor: 99, last_synced_at: null });
    old.close();
    const next = new BloomlabDatabase(name);
    await next.open();
    expect((await next.notes.get('kept'))!.body).toBe('Preserve');
    expect((await next.sync_state.get('all'))!.server_cursor).toBe(0);
    next.close();
  });
});
describe('PORT-002 truthful archive UI', () => {
  it('offers an empty archive with an actual campaign link', async () => {
    renderPortfolio();
    expect(await screen.findByText('Your archive starts with the work.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Find project/ })).toHaveAttribute('href', '/campaign');
  });
  it('shows the authored label on list and detail and every category, with saved reflection after remount', async () => {
    await savedWork(db, { capture: true });
    await savedWork(db, { fieldwork: true });
    renderPortfolio();
    expect(await screen.findByText('Simulation Project')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: consultation.title }));
    await screen.findByLabelText('Your project reflection');
    expect(document.querySelectorAll('[data-artifact]')).toHaveLength(10);
    expect(screen.getByText(/Manual real-GHL proof recorded at submission/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Your project reflection'), {
      target: { value: 'Check the fallback next.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save reflection' }));
    await screen.findByText('Reflection saved on this device.');
    cleanup();
    renderPortfolio(true);
    expect(await screen.findByLabelText('Your project reflection')).toHaveValue(
      'Check the fallback next.',
    );
    expect(document.body.textContent).not.toContain('pp:');
  });
  it('shows deleted private images truthfully without a read request', async () => {
    const saved = await savedWork(db, { fieldwork: true });
    const id = saved.attempt!.response!.fieldwork!.screenshots.destination_workflow!;
    await db.evidence_assets.put({
      asset_id: id,
      attempt_id: saved.attempt!.id,
      exercise_id: saved.attempt!.exercise_id!,
      item_key: 'destination_workflow',
      blob: null,
      status: 'deleted',
      upload_started: true,
    });
    const fetch = vi.spyOn(globalThis, 'fetch');
    renderPortfolio(true);
    expect(
      await screen.findByText('Screenshot deleted. Historical proof remains recorded.'),
    ).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });
  it('rejects outcome fields and unapproved truth labels in the content/state contracts', async () => {
    expect(PortfolioSchema.safeParse({ ...consultation, label: 'Client success' }).success).toBe(
      false,
    );
    expect(
      PortfolioSchema.safeParse({ ...consultation, client_outcomes: 'invented' }).success,
    ).toBe(false);
    await savedWork(db);
    await collectPortfolio();
    const p = (await db.portfolio_projects.toArray())[0]!;
    expect(
      PortfolioProjectRecordSchema.safeParse({ ...p, client_outcomes: 'invented' }).success,
    ).toBe(false);
    const a = (await db.portfolio_assets.toArray())[0]!;
    expect(
      PortfolioAssetRecordSchema.safeParse({ ...a, public_url: 'https://public.invalid' }).success,
    ).toBe(false);
  });
  it('preserves work and exposes a retry when local reads fail', async () => {
    await ensureDevice();
    const failingStorage = vi.spyOn(db, 'transaction').mockRejectedValue(new Error('quota'));
    renderPortfolio();
    expect(await screen.findByRole('alert')).toHaveTextContent('preserved');
    failingStorage.mockRestore();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() =>
      expect(screen.getByText('Your archive starts with the work.')).toBeInTheDocument(),
    );
  });
});
