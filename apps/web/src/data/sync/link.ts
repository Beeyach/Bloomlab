import { formatSyncKey, generateSyncKey, normalizeSyncKey } from '@bloomlab/shared';

import { db, type BloomlabDatabase } from '../db';
import { ensureDevice } from '../device';
import { nowIso } from '../envelope';
import { LOCAL_SYNC_ENTITIES, type DeviceRecord } from '../types';
import { syncApi, type SyncApi } from './api';

export interface LinkResult {
  device: DeviceRecord;
  /** True when this key created the learner (first device). */
  created: boolean;
}

export const isLinked = (device: DeviceRecord | undefined): boolean =>
  Boolean(device?.session_token);

/** A brand-new key for a first device (SYNC-002). Shown once; the learner must save it. */
export function createSyncKey(): { canonical: string; display: string } {
  const canonical = generateSyncKey();
  return { canonical, display: formatSyncKey(canonical) };
}

/**
 * Links this device to the learner behind `secret` (SYNC-001, SYNC-004): the Worker returns a
 * device session token and the learner id, and every local record is re-keyed from the
 * provisional `local:` learner to the real one (D-027). The key itself is kept on the device
 * so the learner can show it again; it is never sent with sync requests.
 */
export async function linkThisDevice(
  secret: string,
  database: BloomlabDatabase = db,
  api: SyncApi = syncApi,
): Promise<LinkResult> {
  const check = normalizeSyncKey(secret);
  if (!check.ok) throw new Error(check.reason);
  const device = await ensureDevice(database);
  const response = await api.link({
    secret: check.key,
    device: { device_id: device.device_id, label: device.label },
  });
  const linked = await adoptLearner(
    {
      learner_id: response.learner_id,
      session_token: response.session_token,
      sync_key: check.key,
    },
    database,
  );
  return { device: linked, created: response.created };
}

/** Re-keys the device and every local record to the server's learner id, in one transaction. */
export async function adoptLearner(
  identity: { learner_id: string; session_token: string; sync_key: string },
  database: BloomlabDatabase = db,
): Promise<DeviceRecord> {
  const tables = [
    database.device,
    database.sync_queue,
    ...LOCAL_SYNC_ENTITIES.map((e) => database[e]),
  ];
  return database.transaction('rw', tables, async () => {
    const current = await ensureDevice(database);
    const previous = current.learner_id;
    const linked: DeviceRecord = {
      ...current,
      learner_id: identity.learner_id,
      session_token: identity.session_token,
      sync_key: identity.sync_key,
      linked_at: nowIso(),
    };
    await database.device.put(linked);
    if (previous !== identity.learner_id) {
      for (const entity of LOCAL_SYNC_ENTITIES) {
        await database[entity]
          .filter((row) => row.learner_id === previous)
          .modify({ learner_id: identity.learner_id });
      }
      await database.sync_queue.toCollection().modify((op) => {
        if (op.payload && op.payload.learner_id === previous) {
          op.payload = { ...op.payload, learner_id: identity.learner_id };
        }
      });
    }
    return linked;
  });
}

/** Forgets the session on this device only; the server-side device row stays until revoked. */
export async function unlinkThisDevice(database: BloomlabDatabase = db): Promise<DeviceRecord> {
  const current = await ensureDevice(database);
  const unlinked: DeviceRecord = { ...current, session_token: null, linked_at: null };
  await database.device.put(unlinked);
  return unlinked;
}
