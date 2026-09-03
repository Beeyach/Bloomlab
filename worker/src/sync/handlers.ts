import {
  SYNC_ENTITY_KINDS,
  decideMerge,
  isSyncEntity,
  normalizeSyncKey,
  type DeviceSummary,
  type DevicesResponse,
  type LinkRequest,
  type LinkResponse,
  type PullChange,
  type PullRequest,
  type PullResponse,
  type PushOperation,
  type PushOutcome,
  type PushRequest,
  type PushResponse,
  type SyncRecord,
} from '@bloomlab/shared';

import type { Session } from './auth';
import { hashSyncKey, hashToken, randomId, randomToken } from './crypto';
import {
  applyRecord,
  getRecord,
  nowIso,
  operationsSince,
  recordsById,
  rowToRecord,
  type DeviceRow,
  type LearnerRow,
} from './db';

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const MAX_BODY_BYTES = 1_000_000;
const MAX_PUSH_OPERATIONS = 200;
const DEFAULT_PULL_LIMIT = 200;
const MAX_PULL_LIMIT = 500;
const MAX_LABEL = 40;

export async function readJson<T>(request: Request): Promise<T> {
  const length = Number(request.headers.get('content-length') ?? 0);
  if (length > MAX_BODY_BYTES) throw new HttpError(413, 'Request too large');
  try {
    return (await request.json()) as T;
  } catch {
    throw new HttpError(400, 'Body must be JSON');
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

const isIso = (value: unknown): value is string =>
  typeof value === 'string' && !Number.isNaN(Date.parse(value));

function validateRecord(value: unknown): SyncRecord {
  if (!isObject(value)) throw new HttpError(400, 'record must be an object');
  const { id, created_at, updated_at, revision, device_id, deleted_at } = value;
  if (typeof id !== 'string' || !id) throw new HttpError(400, 'record.id is required');
  if (!isIso(created_at) || !isIso(updated_at)) {
    throw new HttpError(400, 'record timestamps must be ISO 8601');
  }
  if (typeof revision !== 'number') throw new HttpError(400, 'record.revision must be a number');
  if (typeof device_id !== 'string') throw new HttpError(400, 'record.device_id is required');
  if (deleted_at !== null && !isIso(deleted_at)) {
    throw new HttpError(400, 'record.deleted_at must be null or ISO 8601');
  }
  return value as SyncRecord;
}

// ---------------------------------------------------------------- link (SYNC-001 … SYNC-004)

export async function link(
  body: LinkRequest,
  db: D1Database,
  pepper: string | undefined,
): Promise<LinkResponse> {
  if (!pepper) throw new HttpError(503, 'Sync is not configured on this server');
  const check = normalizeSyncKey(typeof body?.secret === 'string' ? body.secret : '');
  if (!check.ok) throw new HttpError(400, check.reason);
  const device = body.device;
  if (!isObject(device) || typeof device.device_id !== 'string' || !device.device_id) {
    throw new HttpError(400, 'device.device_id is required');
  }
  const label = String(device.label ?? '')
    .trim()
    .slice(0, MAX_LABEL);
  if (!label) throw new HttpError(400, 'device.label is required');

  const keyHash = await hashSyncKey(check.key, pepper);
  const at = nowIso();
  let learner = await db
    .prepare('SELECT * FROM learners WHERE key_hash = ?1')
    .bind(keyHash)
    .first<LearnerRow>();
  const created = !learner;
  if (!learner) {
    learner = { learner_id: randomId(), key_hash: keyHash, created_at: at, last_seen_at: at };
    await db
      .prepare(
        'INSERT INTO learners (learner_id, key_hash, created_at, last_seen_at) VALUES (?1, ?2, ?3, ?4)',
      )
      .bind(learner.learner_id, keyHash, at, at)
      .run();
  } else {
    await db
      .prepare('UPDATE learners SET last_seen_at = ?1 WHERE learner_id = ?2')
      .bind(at, learner.learner_id)
      .run();
  }

  const existing = await db
    .prepare('SELECT * FROM devices WHERE device_id = ?1')
    .bind(device.device_id)
    .first<DeviceRow>();
  if (existing && existing.learner_id !== learner.learner_id) {
    throw new HttpError(409, 'This device is linked to a different sync key');
  }

  const token = randomToken();
  const tokenHash = await hashToken(token);
  await db.batch([
    db
      .prepare(
        `INSERT INTO devices (device_id, learner_id, token_hash, created_at, last_seen_at, revoked_at, device_label)
         VALUES (?1, ?2, ?3, ?4, ?4, NULL, ?5)
         ON CONFLICT(device_id) DO UPDATE SET
           token_hash = excluded.token_hash, last_seen_at = excluded.last_seen_at,
           revoked_at = NULL, device_label = excluded.device_label`,
      )
      .bind(device.device_id, learner.learner_id, tokenHash, at, label),
    db
      .prepare(
        `INSERT INTO sync_sessions (session_id, device_id, learner_id, token_hash, created_at, last_seen_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?5)`,
      )
      .bind(randomId(), device.device_id, learner.learner_id, tokenHash, at),
  ]);

  return {
    learner_id: learner.learner_id,
    device_id: device.device_id,
    session_token: token,
    created,
  };
}

// ---------------------------------------------------------------- push (SYNC-007 … SYNC-009)

async function pushOne(op: PushOperation, session: Session, db: D1Database): Promise<PushOutcome> {
  const seq = Number(op?.seq);
  if (!isSyncEntity(op?.entity)) return { seq, status: 'rejected', reason: 'Unknown entity' };
  let record: SyncRecord;
  try {
    record = validateRecord(op.record);
  } catch (error) {
    return { seq, status: 'rejected', reason: (error as Error).message };
  }
  if (record.device_id !== session.deviceId) {
    return { seq, status: 'rejected', reason: 'A device may only push its own writes' };
  }
  const base = Number.isInteger(op.base_revision) ? op.base_revision : 0;
  const existing = await getRecord(db, op.entity, session.learnerId, record.id);
  const decision = decideMerge(
    SYNC_ENTITY_KINDS[op.entity],
    existing,
    record,
    base,
    op.force === true,
  );
  if (decision.action === 'apply') {
    await applyRecord(db, op.entity, session.learnerId, record, decision.revision);
    return { seq, status: 'applied', revision: decision.revision };
  }
  // `existing` is non-null whenever the decision is not 'apply'.
  const server = rowToRecord(existing as NonNullable<typeof existing>);
  return { seq, status: decision.action, server };
}

export async function push(
  body: PushRequest,
  session: Session,
  db: D1Database,
): Promise<PushResponse> {
  const operations = Array.isArray(body?.operations) ? body.operations : null;
  if (!operations) throw new HttpError(400, 'operations must be an array');
  if (operations.length > MAX_PUSH_OPERATIONS) {
    throw new HttpError(413, `At most ${MAX_PUSH_OPERATIONS} operations per push`);
  }
  const outcomes: PushOutcome[] = [];
  for (const op of operations) outcomes.push(await pushOne(op, session, db));
  return { outcomes };
}

// ---------------------------------------------------------------- pull

export async function pull(
  body: PullRequest,
  session: Session,
  db: D1Database,
): Promise<PullResponse> {
  const cursor = Number.isInteger(body?.cursor) && body.cursor >= 0 ? body.cursor : 0;
  const limit = Math.min(
    MAX_PULL_LIMIT,
    Number.isInteger(body?.limit) && (body.limit as number) > 0
      ? (body.limit as number)
      : DEFAULT_PULL_LIMIT,
  );
  const rows = await operationsSince(db, session.learnerId, cursor, limit + 1);
  const more = rows.length > limit;
  const page = more ? rows.slice(0, limit) : rows;

  // One change per record: the latest op_seq wins, the record itself is always current.
  const latest = new Map<string, (typeof page)[number]>();
  for (const row of page) latest.set(`${row.entity}:${row.entity_id}`, row);
  const byEntity = new Map<string, string[]>();
  for (const row of latest.values()) {
    byEntity.set(row.entity, [...(byEntity.get(row.entity) ?? []), row.entity_id]);
  }
  const changes: PullChange[] = [];
  for (const [entity, ids] of byEntity) {
    if (!isSyncEntity(entity)) continue;
    const records = await recordsById(db, entity, session.learnerId, ids);
    for (const row of latest.values()) {
      if (row.entity !== entity) continue;
      const record = records.get(row.entity_id);
      if (record) changes.push({ op_seq: row.op_seq, entity, record: rowToRecord(record) });
    }
  }
  changes.sort((a, b) => a.op_seq - b.op_seq);
  return { changes, cursor: page.at(-1)?.op_seq ?? cursor, more };
}

// ---------------------------------------------------------------- devices (SYNC-004, SYNC-005)

export async function listDevices(session: Session, db: D1Database): Promise<DevicesResponse> {
  const { results } = await db
    .prepare('SELECT * FROM devices WHERE learner_id = ?1 ORDER BY created_at ASC')
    .bind(session.learnerId)
    .all<DeviceRow>();
  const devices: DeviceSummary[] = results.map((row) => ({
    device_id: row.device_id,
    device_label: row.device_label,
    created_at: row.created_at,
    last_seen_at: row.last_seen_at,
    revoked_at: row.revoked_at,
    current: row.device_id === session.deviceId,
  }));
  return { learner_id: session.learnerId, devices };
}

export async function revokeDevice(
  body: { device_id?: unknown },
  session: Session,
  db: D1Database,
): Promise<DevicesResponse> {
  const deviceId = typeof body?.device_id === 'string' ? body.device_id : '';
  if (!deviceId) throw new HttpError(400, 'device_id is required');
  const at = nowIso();
  const result = await db
    .prepare(
      `UPDATE devices SET revoked_at = ?1, token_hash = NULL
       WHERE device_id = ?2 AND learner_id = ?3 AND revoked_at IS NULL`,
    )
    .bind(at, deviceId, session.learnerId)
    .run();
  if (!result.meta.changes) throw new HttpError(404, 'No such connected device');
  await db
    .prepare('UPDATE sync_sessions SET revoked_at = ?1 WHERE device_id = ?2 AND revoked_at IS NULL')
    .bind(at, deviceId)
    .run();
  return listDevices(session, db);
}

export async function labelDevice(
  body: { label?: unknown },
  session: Session,
  db: D1Database,
): Promise<DevicesResponse> {
  const label = String(body?.label ?? '')
    .trim()
    .slice(0, MAX_LABEL);
  if (!label) throw new HttpError(400, 'label is required');
  await db
    .prepare('UPDATE devices SET device_label = ?1 WHERE device_id = ?2')
    .bind(label, session.deviceId)
    .run();
  return listDevices(session, db);
}
