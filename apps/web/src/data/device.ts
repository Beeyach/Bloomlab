import { useLiveQuery } from 'dexie-react-hooks';

import { db, type BloomlabDatabase } from './db';
import { nowIso, randomId } from './envelope';
import type { DeviceRecord } from './types';

export const DEVICE_LABEL_MAX = 40;

interface UserAgentDataLike {
  platform?: string;
  mobile?: boolean;
}

/** A friendly default label ("Windows desktop", "Android phone") the learner can rename. */
export function defaultDeviceLabel(
  nav: { userAgent?: string; userAgentData?: UserAgentDataLike } = navigator,
): string {
  const ua = nav.userAgent ?? '';
  const platform = nav.userAgentData?.platform ?? '';
  const mobile = nav.userAgentData?.mobile ?? /Mobi|Android|iPhone/i.test(ua);
  if (/iPad/i.test(ua) || /iPad/i.test(platform)) return 'iPad';
  if (/iPhone/i.test(ua) || /iOS/i.test(platform)) return 'iPhone';
  if (/Android/i.test(ua) || /Android/i.test(platform))
    return mobile ? 'Android phone' : 'Android tablet';
  if (/Windows/i.test(ua) || /Windows/i.test(platform)) return 'Windows desktop';
  if (/Mac/i.test(ua) || /macOS/i.test(platform)) return 'Mac desktop';
  if (/CrOS/i.test(ua) || /Chrome OS/i.test(platform)) return 'Chromebook';
  if (/Linux/i.test(ua) || /Linux/i.test(platform)) return 'Linux desktop';
  return 'This device';
}

/**
 * Returns this browser's device record, creating it on first run (spec §89 groundwork).
 * The learner id is provisional (`local:…`) until Phase 4 issues one from the sync key.
 */
export async function ensureDevice(database: BloomlabDatabase = db): Promise<DeviceRecord> {
  return database.transaction('rw', database.device, async () => {
    const existing = await database.device.toCollection().first();
    const at = nowIso();
    if (existing) {
      const seen = { ...existing, last_seen_at: at };
      await database.device.put(seen);
      return seen;
    }
    const created: DeviceRecord = {
      device_id: randomId(),
      learner_id: `local:${randomId()}`,
      label: defaultDeviceLabel(),
      created_at: at,
      last_seen_at: at,
      storage_persisted: null,
    };
    await database.device.add(created);
    return created;
  });
}

/** Reads the current owner without creating or refreshing identity inside a reactive query. */
export function currentDevice(database: BloomlabDatabase = db): Promise<DeviceRecord | undefined> {
  return database.device.toCollection().first();
}

export async function renameDevice(
  label: string,
  database: BloomlabDatabase = db,
): Promise<DeviceRecord> {
  const trimmed = label.trim().slice(0, DEVICE_LABEL_MAX);
  if (!trimmed) throw new Error('A device needs a name');
  const current = await ensureDevice(database);
  const renamed = { ...current, label: trimmed, last_seen_at: nowIso() };
  await database.device.put(renamed);
  return renamed;
}

/**
 * Asks the browser to protect the database from eviction. Best effort: the answer is recorded
 * on the device row for diagnostics and never blocks anything.
 */
export async function requestPersistentStorage(
  database: BloomlabDatabase = db,
  storage: Pick<StorageManager, 'persist'> | undefined = navigator.storage,
): Promise<boolean | null> {
  if (!storage || typeof storage.persist !== 'function') return null;
  let persisted: boolean;
  try {
    persisted = await storage.persist();
  } catch {
    return null;
  }
  const current = await ensureDevice(database);
  await database.device.put({ ...current, storage_persisted: persisted });
  return persisted;
}

/** Live view of the device record; undefined until `ensureDevice` has run. */
export function useDevice(database: BloomlabDatabase = db): DeviceRecord | undefined {
  return useLiveQuery(() => database.device.toCollection().first(), [database]);
}
