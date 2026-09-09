import { projectProgress, clientProgressId } from '../../clients/progression';
import type { ContentBundle } from '@bloomlab/content-schema';
import {
  buildSession,
  type SessionContent,
  type SessionFocus,
  type SessionLength,
  type SessionPlan,
} from '@bloomlab/mastery-engine';

import { content as compiledContent } from '../../content/bundle';
import { db, type BloomlabDatabase } from '../db';
import { evaluateLearner, type RecomputeOptions } from './progress';

export interface LearnerSessionOptions extends RecomputeOptions {
  focus?: SessionFocus | null;
  /** Item ids already completed this sitting ("Continue"). */
  exclude?: string[];
  /** Defaults to the first campaign that requires no other (Field Ready). */
  campaign_id?: string;
}

export function sessionContentOf(bundle: ContentBundle): SessionContent {
  return {
    units_by_skill: bundle.indexes.units_by_skill,
    unit_minutes: Object.fromEntries(
      bundle.learning_units.map((unit) => [unit.id, unit.estimated_minutes]),
    ),
    exercises_by_skill: bundle.indexes.exercises_by_skill,
    exercises: Object.fromEntries(
      bundle.exercises
        .filter((exercise) => !exercise.placement_area)
        .map((exercise) => [
          exercise.id,
          {
            id: exercise.id,
            type: exercise.type,
            mode: exercise.mode,
            estimated_minutes: exercise.estimated_minutes,
            skills: exercise.skills,
            fieldwork_required:
              exercise.type === 'FIELDWORK' || exercise.fieldwork?.required === true,
          },
        ]),
    ),
  };
}

export function defaultCampaignId(bundle: ContentBundle): string | null {
  return (
    bundle.campaigns.find((campaign) => campaign.requires_campaigns.length === 0)?.id ??
    bundle.campaigns[0]?.id ??
    null
  );
}

/**
 * Build My Session (spec §33, MAS-006): the compiled content, the learner's evidence and the
 * engine's deterministic builder. No AI, no clock-based locks; the learner can always continue.
 */
export async function buildLearnerSession(
  length: SessionLength,
  database: BloomlabDatabase = db,
  options: LearnerSessionOptions = {},
): Promise<SessionPlan> {
  const bundle = options.bundle ?? compiledContent;
  const snapshot = await evaluateLearner(database, options);
  const campaignId = options.campaign_id ?? defaultCampaignId(bundle);
  const campaign = snapshot.campaigns.find((c) => c.campaign_id === campaignId) ?? null;
  const path = bundle.campaign_paths.find((p) => p.campaign === campaignId);
  const content = sessionContentOf(bundle);

  const currentGate = campaign?.gates.find((g) => g.gate === campaign.current_gate);
  const gateDefinition = bundle.campaigns
    .find((c) => c.id === campaignId)
    ?.gates.find((g) => g.id === currentGate?.gate);
  const pendingFieldwork =
    gateDefinition?.pass_criteria.fieldwork_required && currentGate
      ? currentGate.skills
          .filter((s) => s.missing.includes('real_ghl_fieldwork'))
          .flatMap((s) =>
            (content.exercises_by_skill[s.skill_id] ?? []).filter(
              (id) => content.exercises[id]?.fieldwork_required,
            ),
          )
      : [];

  const [clients, attempts, records] = await Promise.all([
    database.client_progress.toArray(),
    database.exercise_attempts.toArray(),
    database.skill_evidence.toArray(),
  ]);
  const projectCandidates = bundle.projects
    .map((project) => ({
      project,
      record: clients.find(
        (row) =>
          row.id === clientProgressId(project.client) && row.learner_id === snapshot.learner_id,
      ),
    }))
    .filter(({ project, record }) => Boolean(record?.engagements[project.id]))
    .sort((a, b) => (b.record?.updated_at ?? '').localeCompare(a.record?.updated_at ?? ''));
  const active = projectCandidates
    .map(({ project, record }) => ({
      project,
      progress: projectProgress(project, record, attempts, records, snapshot.learner_id, bundle),
    }))
    .find(({ progress }) => !progress.complete);
  return buildSession({
    length,
    now: snapshot.now,
    skills: bundle.skills,
    evaluations: [...snapshot.evaluations.values()],
    campaign,
    path_order: path?.ordered_skills ?? [],
    review: snapshot.review,
    recent_evidence: snapshot.evidence,
    content,
    focus: options.focus ?? null,
    pending_fieldwork: [...new Set(pendingFieldwork)],
    active_project: active
      ? { id: active.project.id, next_exercises: active.progress.next?.missing ?? [] }
      : null,
    exclude: options.exclude ?? [],
  });
}
