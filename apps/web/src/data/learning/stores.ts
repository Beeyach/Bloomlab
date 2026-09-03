import { db, type BloomlabDatabase } from '../db';
import { createSyncableStore, type SyncableStore } from '../stores';
import type {
  CampaignProgressRecord,
  ExerciseAttemptRecord,
  ReviewQueueRecord,
  SkillEvidenceRecord,
  SkillProgressRecord,
} from '../types';

/**
 * The learner's learning records, all on the Phase 3/4 path: one write path
 * (`createSyncableStore`), IndexedDB first, outbox in the same transaction, synced by kind —
 * evidence and attempts append-only, the derived rows as simple state (spec §91).
 */
export interface LearningStores {
  evidence: SyncableStore<SkillEvidenceRecord>;
  attempts: SyncableStore<ExerciseAttemptRecord>;
  progress: SyncableStore<SkillProgressRecord>;
  campaigns: SyncableStore<CampaignProgressRecord>;
  reviews: SyncableStore<ReviewQueueRecord>;
}

export function createLearningStores(database: BloomlabDatabase = db): LearningStores {
  return {
    evidence: createSyncableStore<SkillEvidenceRecord>('skill_evidence', database),
    attempts: createSyncableStore<ExerciseAttemptRecord>('exercise_attempts', database),
    progress: createSyncableStore<SkillProgressRecord>('skill_progress', database),
    campaigns: createSyncableStore<CampaignProgressRecord>('campaign_progress', database),
    reviews: createSyncableStore<ReviewQueueRecord>('review_queue', database),
  };
}

export const learning: LearningStores = createLearningStores();
