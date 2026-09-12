import { useLiveQuery } from 'dexie-react-hooks';

import { db, type BloomlabDatabase } from './db';
import { currentDevice, ensureDevice } from './device';
import { nowIso } from './envelope';

/**
 * Local checkpoints of work in progress (TA§7): the current simulator session, an unfinished
 * exercise, node positions, the open client workspace. Local-only and device-specific; the
 * meaningful outcome of the work syncs through its own entity, not through these blobs.
 */
export async function saveWorkspace<T>(
  key: string,
  value: T,
  database: BloomlabDatabase = db,
): Promise<void> {
  const owner = await ensureDevice(database);
  await database.workspace.put({
    key,
    learner_id: owner.learner_id,
    device_id: owner.device_id,
    value,
    updated_at: nowIso(),
  });
}

export async function loadWorkspace<T>(
  key: string,
  database: BloomlabDatabase = db,
): Promise<T | undefined> {
  const owner = await currentDevice(database);
  const row = await database.workspace.get(key);
  return owner && row?.learner_id === owner.learner_id ? (row.value as T) : undefined;
}

export async function clearWorkspace(key: string, database: BloomlabDatabase = db): Promise<void> {
  const owner = await currentDevice(database);
  const row = await database.workspace.get(key);
  if (owner && row?.learner_id === owner.learner_id) await database.workspace.delete(key);
}

export function useWorkspace<T>(key: string, database: BloomlabDatabase = db): T | undefined {
  return useLiveQuery(() => loadWorkspace<T>(key, database), [key, database]);
}
