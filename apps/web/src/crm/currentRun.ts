import { db, type BloomlabDatabase } from '../data/db';
import {
  currentRun,
  currentRunId,
  LEGACY_CRM_SCENARIO_ID,
  rememberRun,
  savedRuns,
  type RunSummary,
} from '../simulator/currentRun';
import type { StoredRun } from '../simulator/store';

/**
 * Which CRM run this device is working in (D-096, D-099).
 *
 * Phase 12 made the rule one for every Lab (`simulator/currentRun.ts`, D-108); these are the
 * Phase 11 names for it, kept so the CRM Lab and its tests read exactly as they did. The CRM
 * scenario's choice is the one Phase 11 stored on the device as `crm_run_id`, and it still is.
 */

export type CrmRunSummary = RunSummary;

/** Every saved run of the scenario, newest first. */
export const savedCrmRuns = (
  scenarioId: string,
  database: BloomlabDatabase = db,
): Promise<CrmRunSummary[]> => savedRuns(scenarioId, database);

/** The id of the run this device is working in, or null when the scenario has no run yet. */
export const currentCrmRunId = (
  scenarioId: string,
  database: BloomlabDatabase = db,
): Promise<string | null> => currentRunId(scenarioId, database);

/** The run itself, loaded, or null. */
export const currentCrmRun = (
  scenarioId: string,
  database: BloomlabDatabase = db,
): Promise<StoredRun | null> => currentRun(scenarioId, database);

/** Records the learner's choice on this device. Touches no run. */
export const rememberCrmRun = (
  runId: string | null,
  database: BloomlabDatabase = db,
): Promise<void> => rememberRun(LEGACY_CRM_SCENARIO_ID, runId, database);
