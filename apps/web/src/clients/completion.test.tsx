import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { content } from '../content/bundle';
import { db } from '../data/db';
import { freshDatabase } from '../data/testing';
import { evaluateLearner } from '../data/learning/progress';
import { buildLearnerSession } from '../data/learning/session';
import { ensureClients, selectProjectAttempt, clientProgressId } from './store';
import { projectEvidence } from './fixtures';
import { projectProgress } from './progression';
import { fieldReadyCompletion } from './completion';
import FieldReadyScreen from './FieldReadyScreen';

beforeEach(async () => {
  cleanup();
  vi.restoreAllMocks();
  await Promise.all(db.tables.map((table) => table.clear()));
});
it('technically advances through Gates 1–12 only with valid skill and project evidence; no Phase 25 content is needed', async () => {
  const database = freshDatabase();
  await ensureClients(database);
  const campaign = content.campaigns.find((row) => row.id === 'CAMP-FIELD_READY')!;
  let tick = 0;
  const at = () => new Date(Date.UTC(2026, 8, 9, 12, ++tick)).toISOString();
  for (const gate of campaign.gates.filter((row) => !row.placement && row.skills.length)) {
    for (const skill of gate.skills) {
      const vehicles = content.exercises.filter(
        (row) =>
          row.skills.includes(skill) &&
          !row.placement_area &&
          ['independent', 'pressure'].includes(row.mode),
      );
      expect(vehicles.length, skill).toBeGreaterThan(0);
      for (let n = 0; n < gate.pass_criteria.independent_evidence_per_skill; n++)
        await projectEvidence(database, vehicles[n % vehicles.length]!.id, { at: at() });
      if (gate.pass_criteria.pressure_test_required)
        await projectEvidence(database, vehicles.find((row) => row.mode === 'pressure')!.id, {
          at: at(),
        });
      if (gate.pass_criteria.fieldwork_required)
        await projectEvidence(database, vehicles.find((row) => row.type === 'FIELDWORK')!.id, {
          at: at(),
        });
    }
    const snapshot = await evaluateLearner(database, { now: new Date(at()) });
    expect(
      snapshot.campaigns
        .find((row) => row.campaign_id === campaign.id)!
        .gates.find((row) => row.gate === gate.id)!.status,
      gate.id,
    ).toBe('passed');
  }
  const high = fieldReadyCompletion(
    await evaluateLearner(database, { now: new Date(at()) }),
    content,
  );
  expect(high.evidence.complete).toBe(true);
  expect(high.complete).toBe(false);
  expect(high.path?.current_gate).toBe('GATE-12');
  expect(high.path?.gates.at(-1)?.missing_projects).toHaveLength(5);
  for (const project of content.projects.filter((row) => row.tier === 'field_ready')) {
    for (const stage of project.stages) {
      const snapshot = await evaluateLearner(database, { now: new Date(at()) });
      const view = projectProgress(
        project,
        await database.client_progress.get(clientProgressId(project.client)),
        await database.exercise_attempts.toArray(),
        await database.skill_evidence.toArray(),
        snapshot.learner_id,
        content,
      );
      for (const id of view.stages.find((row) => row.id === stage.id)!.missing) {
        const { attempt } = await projectEvidence(database, id, {
          at: at(),
          choice: 'single_location',
        });
        await selectProjectAttempt(project.id, stage.id, id, attempt!.id, database);
      }
    }
  }
  const result = fieldReadyCompletion(
    await evaluateLearner(database, { now: new Date(at()) }),
    content,
  );
  expect(result.complete).toBe(true);
  expect(result.path?.passed_gates).toHaveLength(12);
  // Removing one domain's evidence cannot be compensated by the complete project set or other high scores.
  const snapshot = await evaluateLearner(database, { now: new Date(at()) });
  snapshot.evidence = snapshot.evidence.filter(
    (row) => row.skill_id !== 'SK-SELL-negotiation-basics',
  );
  expect(fieldReadyCompletion(snapshot, content).complete).toBe(false);
  expect(fieldReadyCompletion(snapshot, content).evidence.missing_areas).toContain('negotiation');
  database.close();
}, 30000);
it('offers the next saved project stage through the existing session builder', async () => {
  const database = freshDatabase();
  await ensureClients(database);
  const boss = content.projects.find((row) => row.boss_client)!;
  const id = boss.stages[0]!.exercises[0]!;
  const { attempt } = await projectEvidence(database, id);
  await selectProjectAttempt(boss.id, boss.stages[0]!.id, id, attempt!.id, database);
  const plan = await buildLearnerSession('deep', database);
  expect(
    plan.blocks
      .flatMap((block) => block.items)
      .some((item) => item.content_id === boss.stages[1]!.exercises[0]),
  ).toBe(true);
  database.close();
});
it('shows nine restrained capabilities and missing evidence without issuing an unearned certificate', async () => {
  await ensureClients();
  render(
    <MemoryRouter>
      <FieldReadyScreen />
    </MemoryRouter>,
  );
  expect(
    await screen.findByRole('heading', { name: 'Your Field Ready evidence' }),
  ).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Field Ready certificate' })).toBeNull();
  expect(screen.getAllByText('Independent evidence still needed')).toHaveLength(10);
  expect(
    content.campaigns.find((row) => row.id === 'CAMP-FIELD_READY')!.completion!.capabilities,
  ).toHaveLength(9);
  expect(screen.getByText(/does not guarantee client outcomes/)).toBeInTheDocument();
});
