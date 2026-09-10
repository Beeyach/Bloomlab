import { ENVELOPE_FIELDS, type SyncEntity, type SyncRecord } from '@bloomlab/shared';

export const nowIso = (): string => new Date().toISOString();

export interface LearnerRow {
  learner_id: string;
  key_hash: string;
  created_at: string;
  last_seen_at: string;
}

export interface DeviceRow {
  device_id: string;
  learner_id: string;
  token_hash: string | null;
  created_at: string;
  last_seen_at: string;
  revoked_at: string | null;
  device_label: string;
}

/** A learner-data row: the envelope as columns, the entity's own fields as JSON. */
export interface RecordRow {
  id: string;
  learner_id: string;
  created_at: string;
  updated_at: string;
  revision: number;
  device_id: string;
  deleted_at: string | null;
  payload: string;
}

export interface OperationRow {
  op_seq: number;
  entity: SyncEntity;
  entity_id: string;
}

export function rowToRecord(row: RecordRow): SyncRecord {
  const payload = JSON.parse(row.payload) as Record<string, unknown>;
  return {
    ...payload,
    id: row.id,
    learner_id: row.learner_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    revision: row.revision,
    device_id: row.device_id,
    deleted_at: row.deleted_at,
  };
}

export function recordToPayload(record: SyncRecord): string {
  const payload: Record<string, unknown> = { ...record };
  for (const field of ENVELOPE_FIELDS) delete payload[field];
  return JSON.stringify(payload);
}

// `entity` is always validated with `isSyncEntity` before it reaches a query, so the table
// name interpolation below never sees user-controlled text.

export async function getRecord(
  db: D1Database,
  entity: SyncEntity,
  learnerId: string,
  id: string,
): Promise<RecordRow | null> {
  const row = await db
    .prepare(`SELECT * FROM ${entity} WHERE id = ?1 AND learner_id = ?2`)
    .bind(id, learnerId)
    .first<RecordRow>();
  return row ?? null;
}

/** Writes the record at `revision` and appends the change to the learner's log, atomically. */
export async function applyRecord(
  db: D1Database,
  entity: SyncEntity,
  learnerId: string,
  record: SyncRecord,
  revision: number,
): Promise<number> {
  const at = nowIso();
  const results = await db.batch([
    db
      .prepare(
        `INSERT INTO ${entity} (id, learner_id, created_at, updated_at, revision, device_id, deleted_at, payload)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
         ON CONFLICT(learner_id, id) DO UPDATE SET
           updated_at = excluded.updated_at, revision = excluded.revision, device_id = excluded.device_id,
           deleted_at = excluded.deleted_at, payload = excluded.payload`,
      )
      .bind(
        record.id,
        learnerId,
        record.created_at,
        record.updated_at,
        revision,
        record.device_id,
        record.deleted_at,
        recordToPayload(record),
      ),
    db
      .prepare(
        `INSERT INTO sync_operations (learner_id, entity, entity_id, revision, device_id, applied_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
      )
      .bind(learnerId, entity, record.id, revision, record.device_id, at),
  ]);
  return Number(results[1]?.meta.last_row_id ?? 0);
}

export async function operationsSince(
  db: D1Database,
  learnerId: string,
  cursor: number,
  limit: number,
): Promise<OperationRow[]> {
  const { results } = await db
    .prepare(
      `SELECT op_seq, entity, entity_id FROM sync_operations
       WHERE learner_id = ?1 AND op_seq > ?2 ORDER BY op_seq ASC LIMIT ?3`,
    )
    .bind(learnerId, cursor, limit)
    .all<OperationRow>();
  return results;
}

export async function recordsById(
  db: D1Database,
  entity: SyncEntity,
  learnerId: string,
  ids: string[],
): Promise<Map<string, RecordRow>> {
  const map = new Map<string, RecordRow>();
  if (ids.length === 0) return map;
  const placeholders = ids.map((_, i) => `?${i + 2}`).join(', ');
  const { results } = await db
    .prepare(`SELECT * FROM ${entity} WHERE learner_id = ?1 AND id IN (${placeholders})`)
    .bind(learnerId, ...ids)
    .all<RecordRow>();
  for (const row of results) map.set(row.id, row);
  return map;
}
