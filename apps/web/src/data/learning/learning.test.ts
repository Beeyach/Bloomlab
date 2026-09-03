import { describe, expect, it } from 'vitest';

import { MASTERY_RULES_VERSION } from '@bloomlab/mastery-engine';

import { content } from '../../content/bundle';
import { ensureDevice } from '../device';
import { listOperations } from '../syncQueue';
import { FakeSyncServer } from '../sync/fakeServer';
import { syncNow } from '../sync/engine';
import { createSyncKey, linkThisDevice } from '../sync/link';
import { freshDatabase } from '../testing';
import { recordEvidence } from './evidence';
import { derivedId } from './ids';
import { evaluateLearner, recomputeProgress } from './progress';
import { buildLearnerSession } from './session';

const SKILL = 'SK-STRATEGIZE-funnel-math';
const NEXT = 'SK-STRATEGIZE-bottleneck-diagnosis';
const NOW = new Date('2026-09-15T12:00:00Z');

const solo = (
  skill: string,
  occurred_at: string,
  extra: Partial<Parameters<typeof recordEvidence>[0]> = {},
) => ({
  skill_ids: [skill],
  kind: 'independent_exercise' as const,
  result: 'passed' as const,
  source: { type: 'exercise' as const, id: 'EX-WHAT_WOULD_YOU_BUILD-glowhaus-leads' },
  exercise_id: 'EX-WHAT_WOULD_YOU_BUILD-glowhaus-leads',
  exercise_type: 'WHAT_WOULD_YOU_BUILD',
  mode: 'independent' as const,
  occurred_at,
  ...extra,
});

describe('learner records on the local-first path (DATA-001, DATA-002, MAS-003)', () => {
  it('17. evidence, attempt and derived progress persist through IndexedDB with outbox rows', async () => {
    const database = freshDatabase();
    const { attempt, evidence } = await recordEvidence(
      solo(SKILL, '2026-09-10T10:00:00Z'),
      database,
      { now: NOW },
    );

    expect(attempt?.exercise_id).toBe('EX-WHAT_WOULD_YOU_BUILD-glowhaus-leads');
    expect(evidence).toHaveLength(1);
    expect(evidence[0]?.attempt_id).toBe(attempt?.id);
    expect(await database.skill_evidence.count()).toBe(1);
    expect(await database.exercise_attempts.count()).toBe(1);

    const device = await ensureDevice(database);
    const progress = await database.skill_progress.get(derivedId('sp', SKILL, device.learner_id));
    expect(progress).toMatchObject({
      skill_id: SKILL,
      state: 'INDEPENDENT',
      ladder_state: 'INDEPENDENT',
    });
    expect(progress?.rules_version).toBe(MASTERY_RULES_VERSION);

    const queued = await listOperations(database);
    expect(queued.map((op) => op.entity).sort()).toEqual(
      [
        'campaign_progress',
        'exercise_attempts',
        'review_queue',
        'skill_evidence',
        'skill_progress',
      ].sort(),
    );
  });

  it('16. stamps app, content (version + hash), simulator and rules versions on every record', async () => {
    const database = freshDatabase();
    const { attempt, evidence } = await recordEvidence(
      solo(SKILL, '2026-09-10T10:00:00Z'),
      database,
      { now: NOW },
    );
    const expected = {
      app: '0.1.0',
      content: content.content_version,
      content_hash: content.content_hash,
      simulator: '0.0.0',
      rules: MASTERY_RULES_VERSION,
    };
    expect(evidence[0]?.versions).toEqual(expected);
    expect(attempt?.versions).toEqual(expected);
  });

  it('rejects an incomplete evidence record and writes nothing (MAS-003)', async () => {
    const database = freshDatabase();
    await expect(
      recordEvidence({ ...solo(SKILL, '2026-09-10T10:00:00Z'), difficulty: 9 }, database, {
        now: NOW,
      }),
    ).rejects.toThrow(/incomplete/);
    expect(await database.skill_evidence.count()).toBe(0);
    expect(await database.exercise_attempts.count()).toBe(0);
    expect(await listOperations(database)).toHaveLength(0);
  });

  it('never rewrites stored evidence when the content changes (DATA-011, CNT-007)', async () => {
    const database = freshDatabase();
    const { evidence } = await recordEvidence(solo(SKILL, '2026-09-10T10:00:00Z'), database, {
      now: NOW,
    });
    const stored = await database.skill_evidence.get(evidence[0]?.id as string);

    // A later release: new content version and hash, a registry record changed.
    const later = {
      ...content,
      content_version: '2027.01.01',
      content_hash: 'f'.repeat(64),
      ghl_features: content.ghl_features.map((f) => ({ ...f, status: 'deprecated' as const })),
    };
    await recomputeProgress(database, { bundle: later, now: NOW });

    expect(await database.skill_evidence.get(evidence[0]?.id as string)).toEqual(stored);
    expect(stored?.versions.content).toBe(content.content_version);
    const device = await ensureDevice(database);
    const progress = await database.skill_progress.get(derivedId('sp', SKILL, device.learner_id));
    expect(progress?.content_version).toBe('2027.01.01');
    expect(progress?.state).toBe('INDEPENDENT');
  });

  it('lesson exposure is recorded without an attempt and leaves the skill at LEARNING (PRD-003)', async () => {
    const database = freshDatabase();
    const { attempt } = await recordEvidence(
      {
        skill_ids: [SKILL],
        kind: 'exposure',
        result: 'exposed',
        source: { type: 'learning_unit', id: 'LU-funnel-math-basics' },
      },
      database,
      { now: NOW },
    );
    expect(attempt).toBeNull();
    const snapshot = await evaluateLearner(database, { now: NOW });
    expect(snapshot.evaluations.get(SKILL)?.state).toBe('LEARNING');
  });

  it('unlocks the dependent skill and resolves the gate as evidence arrives', async () => {
    const database = freshDatabase();
    const before = await evaluateLearner(database, { now: NOW });
    const fieldReady = (s: typeof before) =>
      s.campaigns.find((c) => c.campaign_id === 'CAMP-FIELD_READY');
    expect(
      fieldReady(before)
        ?.gates.find((g) => g.gate === 'GATE-1')
        ?.skills.find((s) => s.skill_id === NEXT)?.available,
    ).toBe(false);

    await recordEvidence(solo(SKILL, '2026-09-10T10:00:00Z'), database, { now: NOW });
    const after = await evaluateLearner(database, { now: NOW });
    expect(
      fieldReady(after)
        ?.gates.find((g) => g.gate === 'GATE-1')
        ?.skills.find((s) => s.skill_id === NEXT)?.available,
    ).toBe(true);
    expect(fieldReady(after)?.current_gate).toBe('GATE-1');
    const row = await database.campaign_progress.toArray();
    expect(
      row.find((r) => r.campaign_id === 'CAMP-FIELD_READY')?.gates.find((g) => g.gate === 'GATE-1')
        ?.status,
    ).toBe('in_progress');
  });

  it('builds a session from the real content and the learner’s evidence', async () => {
    const database = freshDatabase();
    const plan = await buildLearnerSession('30m', database, { now: NOW });
    expect(plan.budget_minutes).toBe(30);
    expect(plan.blocks[0]?.kind).toBe('campaign');
    expect(plan.blocks[0]?.items[0]).toMatchObject({
      kind: 'unit',
      content_id: 'LU-funnel-math-basics',
    });
    expect(plan.continue_available).toBe(true);
  });
});

describe('two devices (SYNC-001, SYNC-008, DATA-001)', () => {
  async function pair() {
    const server = new FakeSyncServer();
    const a = freshDatabase();
    const b = freshDatabase();
    const key = createSyncKey();
    await linkThisDevice(key.display, a, server);
    await linkThisDevice(key.canonical, b, server);
    return { server, a, b };
  }

  it('18. converge on the same evidence and the same derived progress', async () => {
    const { server, a, b } = await pair();
    await recordEvidence(solo(SKILL, '2026-09-10T10:00:00Z'), a, { now: NOW });
    await recordEvidence(solo(SKILL, '2026-09-11T10:00:00Z'), a, { now: NOW });
    expect((await syncNow(a, server)).status).toBe('synced');

    await syncNow(b, server);
    expect(await b.skill_evidence.count()).toBe(2);
    expect(await b.exercise_attempts.count()).toBe(2);
    // B recomputes from the pulled evidence and lands on the same row A wrote.
    await recomputeProgress(b, { now: NOW });
    const deviceB = await ensureDevice(b);
    const rowB = await b.skill_progress.get(derivedId('sp', SKILL, deviceB.learner_id));
    const rowA = await a.skill_progress.get(derivedId('sp', SKILL, deviceB.learner_id));
    // funnel-math also needs a pressure test, so two solo passes stop at INDEPENDENT — on both devices.
    expect(rowB?.state).toBe('INDEPENDENT');
    expect(rowB?.state).toBe(rowA?.state);
    expect(rowB?.counts).toEqual(rowA?.counts);
    expect(await listOperations(b)).toHaveLength(0);

    // B adds evidence while A is elsewhere; A picks it up and its own recompute agrees.
    await recordEvidence(
      solo(NEXT, '2026-09-12T10:00:00Z', {
        exercise_id: 'EX-AUDIT_IT-northwind-outside-in',
        source: { type: 'exercise', id: 'EX-AUDIT_IT-northwind-outside-in' },
      }),
      b,
      { now: NOW },
    );
    await syncNow(b, server);
    await syncNow(a, server);
    await recomputeProgress(a, { now: NOW });
    expect(await a.skill_evidence.count()).toBe(3);
    expect((await a.skill_progress.get(derivedId('sp', NEXT, deviceB.learner_id)))?.state).toBe(
      'INDEPENDENT',
    );
  });

  it('drops provisional derived rows at link time and rebuilds them for the real learner', async () => {
    const server = new FakeSyncServer();
    const database = freshDatabase();
    await recordEvidence(solo(SKILL, '2026-09-10T10:00:00Z'), database, { now: NOW });
    const provisional = await ensureDevice(database);
    expect(
      await database.skill_progress.get(derivedId('sp', SKILL, provisional.learner_id)),
    ).toBeTruthy();

    await linkThisDevice(createSyncKey().display, database, server);
    const linked = await ensureDevice(database);
    expect(await database.skill_progress.count()).toBe(0);
    expect((await listOperations(database)).map((op) => op.entity).sort()).toEqual([
      'exercise_attempts',
      'skill_evidence',
    ]);
    expect((await database.skill_evidence.toArray())[0]?.learner_id).toBe(linked.learner_id);

    await recomputeProgress(database, { now: NOW });
    expect(
      await database.skill_progress.get(derivedId('sp', SKILL, linked.learner_id)),
    ).toMatchObject({ state: 'INDEPENDENT' });
  });
});
