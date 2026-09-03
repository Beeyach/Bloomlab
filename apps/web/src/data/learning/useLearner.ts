import { useLiveQuery } from 'dexie-react-hooks';

import { db, type BloomlabDatabase } from '../db';
import { clearWorkspace, saveWorkspace, useWorkspace } from '../workspace';
import { evaluateLearner, type LearnerSnapshot } from './progress';

/**
 * The learner as the engine sees them right now, live: re-evaluated whenever evidence (or the
 * device row) changes in IndexedDB. Undefined until the first evaluation completes.
 */
export function useLearnerSnapshot(database: BloomlabDatabase = db): LearnerSnapshot | undefined {
  return useLiveQuery(async () => {
    const device = await database.device.toCollection().first();
    if (!device) return undefined;
    return evaluateLearner(database);
  }, [database]);
}

export const FOCUS_KEY = 'learning.focus';

/** The learner's chosen focus (spec §33 "learner-selected focus"): local to this device. */
export interface LearnerFocus {
  skill_id: string;
  set_at: string;
}

export function useFocus(database: BloomlabDatabase = db): LearnerFocus | undefined {
  return useWorkspace<LearnerFocus>(FOCUS_KEY, database);
}

export function setFocus(skillId: string, database: BloomlabDatabase = db): Promise<void> {
  return saveWorkspace<LearnerFocus>(
    FOCUS_KEY,
    { skill_id: skillId, set_at: new Date().toISOString() },
    database,
  );
}

export function clearFocus(database: BloomlabDatabase = db): Promise<void> {
  return clearWorkspace(FOCUS_KEY, database);
}
