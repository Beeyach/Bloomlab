import type { ContentBundle } from '@bloomlab/content-schema';
import {
  evaluateCampaign,
  evaluateSkills,
  scheduleReviews,
  type CampaignEvaluation,
  type ReviewSchedule,
  type SkillEvaluation,
  type SkillEvidence,
} from '@bloomlab/mastery-engine';

import { content as compiledContent } from '../../content/bundle';
import { db, type BloomlabDatabase } from '../db';
import { ensureDevice } from '../device';
import type {
  CampaignProgressRecord,
  ReviewQueueRecord,
  SkillProgressRecord,
  SyncEnvelope,
} from '../types';
import { derivedId } from './ids';
import { stripEnvelope } from './shape';
import { createLearningStores } from './stores';

export interface RecomputeOptions {
  bundle?: ContentBundle;
  now?: Date;
}

/** Everything the engine says about this learner right now, computed from evidence. */
export interface LearnerSnapshot {
  learner_id: string;
  now: Date;
  evidence: SkillEvidence[];
  evaluations: Map<string, SkillEvaluation>;
  campaigns: CampaignEvaluation[];
  review: ReviewSchedule;
}

export async function loadEvidence(
  database: BloomlabDatabase,
  learnerId: string,
): Promise<SkillEvidence[]> {
  const rows = await database.skill_evidence
    .filter((row) => row.deleted_at === null && row.learner_id === learnerId)
    .toArray();
  return rows.map(stripEnvelope);
}

/** Pure read: evaluates every skill, campaign and review from the evidence in IndexedDB. */
export async function evaluateLearner(
  database: BloomlabDatabase = db,
  options: RecomputeOptions = {},
): Promise<LearnerSnapshot> {
  const bundle = options.bundle ?? compiledContent;
  const now = options.now ?? new Date();
  // Read-only when the device exists, so live queries can evaluate without writing.
  const device = (await database.device.toCollection().first()) ?? (await ensureDevice(database));
  const evidence = await loadEvidence(database, device.learner_id);
  const evaluations = evaluateSkills(bundle.skills, evidence, now);
  const skills = new Map(bundle.skills.map((skill) => [skill.id, skill]));
  const campaigns = bundle.campaigns.map((campaign) =>
    evaluateCampaign(campaign, skills, evaluations),
  );
  return {
    learner_id: device.learner_id,
    now,
    evidence,
    evaluations,
    campaigns,
    review: scheduleReviews(evaluations.values(), now),
  };
}

/** A derived record's own fields: everything but the envelope and the timestamp of computation. */
type Derived<T> = Omit<T, keyof SyncEnvelope | 'computed_at'>;

const same = (current: Record<string, unknown>, fields: Record<string, unknown>): boolean =>
  Object.keys(fields).every((key) => JSON.stringify(current[key]) === JSON.stringify(fields[key]));

/**
 * Derives the learner's progress rows from evidence (TA§68–§69) and writes only what changed:
 * one `skill_progress` row per skill with evidence, one `campaign_progress` row per campaign
 * the learner has touched, one `review_queue` row per skill that has ever been scheduled.
 * Every device recomputes the same rows from the same evidence, so they converge; ids are
 * learner-scoped so two learners never collide (D-043).
 */
export async function recomputeProgress(
  database: BloomlabDatabase = db,
  options: RecomputeOptions = {},
): Promise<LearnerSnapshot> {
  const snapshot = await evaluateLearner(database, options);
  const bundle = options.bundle ?? compiledContent;
  const stores = createLearningStores(database);
  const learnerId = snapshot.learner_id;
  const computedAt = snapshot.now.toISOString();
  const contentVersion = bundle.content_version;

  await database.transaction(
    'rw',
    [
      database.skill_progress,
      database.campaign_progress,
      database.review_queue,
      database.sync_queue,
      database.device,
    ],
    async () => {
      const progressRows = new Map(
        (await database.skill_progress.toArray()).map((row) => [row.id, row]),
      );
      for (const [skillId, evaluation] of snapshot.evaluations) {
        if (evaluation.counts.evidence === 0) continue;
        const id = derivedId('sp', skillId, learnerId);
        const fields: Derived<SkillProgressRecord> = {
          skill_id: skillId,
          state: evaluation.state,
          ladder_state: evaluation.ladder_state,
          refresh_from: evaluation.refresh_from,
          refresh_reason: evaluation.refresh_reason,
          confidence: evaluation.confidence,
          missing_requirements: evaluation.missing_requirements,
          review_priority: evaluation.review_priority,
          review_due: evaluation.review_due,
          last_demonstrated: evaluation.last_demonstrated,
          counts: evaluation.counts,
          rules_version: evaluation.rules_version,
          content_version: contentVersion,
        };
        const current = progressRows.get(id);
        if (current && same(current as unknown as Record<string, unknown>, fields)) continue;
        if (current) await stores.progress.patch(id, { ...fields, computed_at: computedAt });
        else await stores.progress.create({ ...fields, computed_at: computedAt }, id);
      }

      const campaignRows = new Map(
        (await database.campaign_progress.toArray()).map((row) => [row.id, row]),
      );
      for (const campaign of snapshot.campaigns) {
        const touched = campaign.gates.some(
          (g) => g.status === 'in_progress' || g.status === 'passed',
        );
        const id = derivedId('cp', campaign.campaign_id, learnerId);
        const current = campaignRows.get(id);
        if (!touched && !current) continue;
        const fields: Derived<CampaignProgressRecord> = {
          campaign_id: campaign.campaign_id,
          current_gate: campaign.current_gate,
          gates: campaign.gates.map((g) => ({
            gate: g.gate,
            status: g.status,
            passed_count: g.passed_count,
            total: g.total,
          })),
          passed_gates: campaign.passed_gates,
          next_required: campaign.next_required,
          work_ahead: campaign.work_ahead,
          complete: campaign.complete,
          rules_version: campaign.rules_version,
          content_version: contentVersion,
        };
        if (current && same(current as unknown as Record<string, unknown>, fields)) continue;
        if (current) await stores.campaigns.patch(id, { ...fields, computed_at: computedAt });
        else await stores.campaigns.create({ ...fields, computed_at: computedAt }, id);
      }

      const reviewRows = new Map(
        (await database.review_queue.toArray()).map((row) => [row.id, row]),
      );
      const scheduled = new Map(
        [
          ...snapshot.review.due.map((item) => ({ item, status: 'due' as const })),
          ...snapshot.review.upcoming.map((item) => ({ item, status: 'upcoming' as const })),
        ].map((entry) => [entry.item.skill_id, entry]),
      );
      for (const [id, row] of reviewRows) {
        if (!scheduled.has(row.skill_id) && row.status !== 'none') {
          await stores.reviews.patch(id, { status: 'none', computed_at: computedAt });
        }
      }
      for (const [skillId, { item, status }] of scheduled) {
        const id = derivedId('rq', skillId, learnerId);
        const fields: Derived<ReviewQueueRecord> = {
          skill_id: skillId,
          due_at: item.due_at,
          priority: item.priority,
          reason: item.reason,
          status,
          last_demonstrated: item.last_demonstrated,
          state: item.state,
          rules_version: snapshot.evaluations.get(skillId)?.rules_version ?? '',
        };
        const current = reviewRows.get(id);
        if (current && same(current as unknown as Record<string, unknown>, fields)) continue;
        if (current) await stores.reviews.patch(id, { ...fields, computed_at: computedAt });
        else await stores.reviews.create({ ...fields, computed_at: computedAt }, id);
      }
    },
  );

  return snapshot;
}
