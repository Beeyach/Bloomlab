import { db, type BloomlabDatabase } from '../data/db';
import type { SimProjectRecord } from '../data/types';
import { listRuns, loadRun, type StoredRun } from './store';

/**
 * Which saved run of a scenario this device is working in (D-096, D-099, D-108).
 *
 * One rule for every Lab and every exercise runtime, so a grade is always of the account the
 * learner can see, and so the CRM Lab and the Workflow Lab opened on the same scenario land in
 * the same run rather than each keeping a favourite. The device's own choice wins when it names a
 * run of this scenario that still exists; otherwise the most recently updated run, which is what
 * `listRuns` orders first. Nothing here starts, merges or deletes a run.
 *
 * The choice is a device preference like `label`: kept on the device record, never synced, never
 * simulator state. Phase 11 stored it as `crm_run_id`; that field still reads as the CRM
 * scenario's choice so an existing device keeps its selection, and every new choice — the CRM
 * scenario's included — is written per scenario in `lab_runs`.
 */

export interface RunSummary {
  run_id: string;
  /** Device wall time of the last save — sync metadata, shown as "last saved", never simulator time. */
  updated_at: string;
}

/** Every saved run of the scenario, newest first. */
export async function savedRuns(
  scenarioId: string,
  database: BloomlabDatabase = db,
): Promise<RunSummary[]> {
  const rows = await listRuns(database);
  return rows
    .filter((row: SimProjectRecord) => row.scenario_id === scenarioId)
    .map((row) => ({ run_id: row.run_id, updated_at: row.updated_at }));
}

/** The scenario Phase 11 remembered under `crm_run_id`, before choices were kept per scenario. */
export const LEGACY_CRM_SCENARIO_ID = 'SC-glowhaus-crm';

/** The id of the run this device is working in for the scenario, or null when it has no run yet. */
export async function currentRunId(
  scenarioId: string,
  database: BloomlabDatabase = db,
): Promise<string | null> {
  const saved = await savedRuns(scenarioId, database);
  if (saved.length === 0) return null;
  const device = await database.device.toCollection().first();
  const chosen =
    device?.lab_runs?.[scenarioId] ??
    (scenarioId === LEGACY_CRM_SCENARIO_ID ? device?.crm_run_id : null) ??
    null;
  if (chosen && saved.some((row) => row.run_id === chosen)) return chosen;
  return saved[0]?.run_id ?? null;
}

/** The run itself, loaded, or null. */
export async function currentRun(
  scenarioId: string,
  database: BloomlabDatabase = db,
): Promise<StoredRun | null> {
  const id = await currentRunId(scenarioId, database);
  return id ? loadRun(id, database) : null;
}

/** Records the learner's choice for one scenario on this device. Touches no run. */
export async function rememberRun(
  scenarioId: string,
  runId: string | null,
  database: BloomlabDatabase = db,
): Promise<void> {
  const device = await database.device.toCollection().first();
  if (!device) return;
  const labRuns = { ...(device.lab_runs ?? {}) };
  if (runId) labRuns[scenarioId] = runId;
  else delete labRuns[scenarioId];
  await database.device.put({
    ...device,
    lab_runs: labRuns,
    // Keep the Phase 11 field in step for the CRM scenario, so nothing that still reads it drifts.
    ...(scenarioId === LEGACY_CRM_SCENARIO_ID ? { crm_run_id: runId } : {}),
  });
}
