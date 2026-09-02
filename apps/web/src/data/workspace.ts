import { useLiveQuery } from 'dexie-react-hooks';

import { db, type BloomlabDatabase } from './db';
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
  await database.workspace.put({ key, value, updated_at: nowIso() });
}

export async function loadWorkspace<T>(
  key: string,
  database: BloomlabDatabase = db,
): Promise<T | undefined> {
  const row = await database.workspace.get(key);
  return row?.value as T | undefined;
}

export async function clearWorkspace(key: string, database: BloomlabDatabase = db): Promise<void> {
  await database.workspace.delete(key);
}

export function useWorkspace<T>(key: string, database: BloomlabDatabase = db): T | undefined {
  return useLiveQuery(() => loadWorkspace<T>(key, database), [key, database]);
}
