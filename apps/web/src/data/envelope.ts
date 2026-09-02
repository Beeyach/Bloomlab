import type { SyncEnvelope } from './types';

export const nowIso = (): string => new Date().toISOString();

export const randomId = (): string => crypto.randomUUID();

interface Writer {
  learner_id: string;
  device_id: string;
}

/** Stamps a brand-new record: revision 1, both timestamps now, not deleted. */
export function stampCreate<T>(
  fields: T,
  writer: Writer,
  id: string = randomId(),
  at: string = nowIso(),
): T & SyncEnvelope {
  return {
    ...fields,
    id,
    learner_id: writer.learner_id,
    created_at: at,
    updated_at: at,
    revision: 1,
    device_id: writer.device_id,
    deleted_at: null,
  };
}

/** Returns a new record with the changes applied and the envelope advanced by one revision. */
export function stampUpdate<T extends SyncEnvelope>(
  record: T,
  changes: Partial<T>,
  writer: Writer,
  at: string = nowIso(),
): T {
  return {
    ...record,
    ...changes,
    id: record.id,
    learner_id: record.learner_id,
    created_at: record.created_at,
    updated_at: at,
    revision: record.revision + 1,
    device_id: writer.device_id,
  };
}

/** Soft delete: the row stays so the deletion can sync (SYNC-007 `deleted_at`). */
export function stampDelete<T extends SyncEnvelope>(
  record: T,
  writer: Writer,
  at: string = nowIso(),
): T {
  return stampUpdate(record, { deleted_at: at } as Partial<T>, writer, at);
}
