import { formatSyncKey, generateSyncKey, normalizeSyncKey } from '@bloomlab/shared';

import { db, type BloomlabDatabase } from '../db';
import { ensureDevice } from '../device';
import { nowIso } from '../envelope';
import { derivedIdBelongsTo, isUnitCompletionId, unitCompletionId } from '../learning/ids';
import {
  DERIVED_SYNC_ENTITIES,
  LOCAL_SYNC_ENTITIES,
  type DeviceRecord,
  type SyncEnvelope,
} from '../types';
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
    database.sync_state,
    database.sync_shadow,
    database.sync_conflicts,
    database.workspace,
    database.call_recordings,
    database.evidence_assets,
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
        await database
          .table(entity)
          .filter((row: SyncEnvelope) => row.learner_id === previous)
          .modify({ learner_id: identity.learner_id });
      }
      await database.sync_queue.toCollection().modify((op) => {
        if (op.learner_id === previous) op.learner_id = identity.learner_id;
        if (op.payload && op.payload.learner_id === previous) {
          op.payload = { ...op.payload, learner_id: identity.learner_id };
        }
      });
      for (const table of ['sync_state', 'sync_shadow', 'sync_conflicts'] as const)
        await database
          .table(table)
          .filter((row) => row.learner_id === previous)
          .modify({ learner_id: identity.learner_id });
      for (const table of ['workspace', 'call_recordings', 'evidence_assets'] as const)
        await database
          .table(table)
          .filter((row) => row.learner_id === previous)
          .modify({ learner_id: identity.learner_id });
      // Unit completions are the one evidence row with a deterministic, learner-scoped id
      // (D-062). Evidence is never dropped, so each one moves to the id the real learner's
      // other devices will mint, and its queued write follows it. Nothing was pushed before
      // linking, so the provisional id only ever existed on this device.
      const completions = await database.skill_evidence
        .filter((row) => isUnitCompletionId(row.id))
        .toArray();
      for (const row of completions) {
        if (row.source.type !== 'learning_unit' || !row.source.id) continue;
        const wanted = unitCompletionId(row.source.id, row.skill_id, identity.learner_id);
        if (wanted === row.id) continue;
        const held = await database.skill_evidence.get(wanted);
        await database.skill_evidence.delete(row.id);
        const queued = database.sync_queue
          .where('[entity+entity_id]')
          .equals(['skill_evidence', row.id]);
        if (held) {
          // The real learner already has this completion: the provisional row is the same fact.
          await queued.delete();
        } else {
          await database.skill_evidence.add({ ...row, id: wanted });
          await queued.modify((operation) => {
            operation.entity_id = wanted;
            if (operation.payload) {
              operation.payload = {
                ...operation.payload,
                id: wanted,
                learner_id: identity.learner_id,
              };
            }
          });
        }
      }
      // Derived rows carry the learner in their id; they are recomputed from evidence after
      // linking, so the provisional ones (and their queued writes) are dropped here.
      for (const entity of DERIVED_SYNC_ENTITIES) {
        await database
          .table(entity)
          .filter((row: SyncEnvelope) => !derivedIdBelongsTo(row.id, identity.learner_id))
          .delete();
      }
      await database.sync_queue
        .filter((op) => (DERIVED_SYNC_ENTITIES as readonly string[]).includes(op.entity))
        .delete();
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
