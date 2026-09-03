import { useLiveQuery } from 'dexie-react-hooks';

import { db, type BloomlabDatabase } from '../db';
import type {
  CampaignProgressRecord,
  ReviewQueueRecord,
  SkillEvidenceRecord,
  SkillProgressRecord,
} from '../types';

/** Live skill progress rows (skills with evidence), by skill id. */
export function useSkillProgress(
  database: BloomlabDatabase = db,
): SkillProgressRecord[] | undefined {
  return useLiveQuery(
    () =>
      database.skill_progress
        .filter((row) => row.deleted_at === null)
        .toArray()
        .then((rows) => rows.sort((a, b) => a.skill_id.localeCompare(b.skill_id))),
    [database],
  );
}

export function useCampaignProgress(
  database: BloomlabDatabase = db,
): CampaignProgressRecord[] | undefined {
  return useLiveQuery(
    () =>
      database.campaign_progress
        .filter((row) => row.deleted_at === null)
        .toArray()
        .then((rows) => rows.sort((a, b) => a.campaign_id.localeCompare(b.campaign_id))),
    [database],
  );
}

/** Scheduled reviews: due first (highest priority), then upcoming (soonest). */
export function useReviewQueue(database: BloomlabDatabase = db): ReviewQueueRecord[] | undefined {
  return useLiveQuery(
    () =>
      database.review_queue
        .filter((row) => row.deleted_at === null && row.status !== 'none')
        .toArray()
        .then((rows) =>
          rows.sort(
            (a, b) =>
              Number(b.status === 'due') - Number(a.status === 'due') ||
              (a.status === 'due' ? b.priority - a.priority : a.due_at.localeCompare(b.due_at)) ||
              a.skill_id.localeCompare(b.skill_id),
          ),
        ),
    [database],
  );
}

/** The newest evidence rows, most recent first. */
export function useRecentEvidence(
  limit = 12,
  database: BloomlabDatabase = db,
): SkillEvidenceRecord[] | undefined {
  return useLiveQuery(
    () =>
      database.skill_evidence
        .orderBy('occurred_at')
        .reverse()
        .filter((row) => row.deleted_at === null)
        .limit(limit)
        .toArray(),
    [database, limit],
  );
}
