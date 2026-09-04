import { db, type BloomlabDatabase } from '../data/db';
import type { SimProjectRecord } from '../data/types';
import { listRuns, loadRun, type StoredRun } from '../simulator/store';

/**
 * Which CRM run this device is working in (D-096, D-099).
 *
 * One rule, read by the Lab and by the exercise runtime alike, so a grade is always of the
 * account the learner can see. The device's own choice wins when it names a run of this scenario
 * that still exists; otherwise the most recently updated run, which is what `listRuns` orders
 * first. Nothing here starts, merges or deletes a run.
 */

export interface CrmRunSummary {
  run_id: string;
  /** Device wall time of the last save — sync metadata, shown as "last saved", never simulator time. */
  updated_at: string;
}

/** Every saved run of the scenario, newest first. */
export async function savedCrmRuns(
  scenarioId: string,
  database: BloomlabDatabase = db,
): Promise<CrmRunSummary[]> {
  const rows = await listRuns(database);
  return rows
    .filter((row: SimProjectRecord) => row.scenario_id === scenarioId)
    .map((row) => ({ run_id: row.run_id, updated_at: row.updated_at }));
}

/** The id of the run this device is working in, or null when the scenario has no run yet. */
export async function currentCrmRunId(
  scenarioId: string,
  database: BloomlabDatabase = db,
): Promise<string | null> {
  const saved = await savedCrmRuns(scenarioId, database);
  if (saved.length === 0) return null;
  const device = await database.device.toCollection().first();
  const chosen = device?.crm_run_id ?? null;
  if (chosen && saved.some((row) => row.run_id === chosen)) return chosen;
  return saved[0]?.run_id ?? null;
}

/** The run itself, loaded, or null. */
export async function currentCrmRun(
  scenarioId: string,
  database: BloomlabDatabase = db,
): Promise<StoredRun | null> {
  const id = await currentCrmRunId(scenarioId, database);
  return id ? loadRun(id, database) : null;
}

/** Records the learner's choice on this device. Touches no run. */
export async function rememberCrmRun(
  runId: string | null,
  database: BloomlabDatabase = db,
): Promise<void> {
  const device = await database.device.toCollection().first();
  if (!device) return;
  await database.device.put({ ...device, crm_run_id: runId });
}
