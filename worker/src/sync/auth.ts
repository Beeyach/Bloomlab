import { hashToken } from './crypto';
import { nowIso, type DeviceRow } from './db';

export interface Session {
  learnerId: string;
  deviceId: string;
}

/**
 * Resolves the device session behind `Authorization: Bearer <token>` (SYNC-004). The token is
 * compared by hash; a revoked device fails on its very next request.
 */
export async function authenticate(request: Request, db: D1Database): Promise<Session | null> {
  const header = request.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return null;
  const tokenHash = await hashToken(token);
  const device = await db
    .prepare('SELECT * FROM devices WHERE token_hash = ?1')
    .bind(tokenHash)
    .first<DeviceRow>();
  if (!device || device.revoked_at) return null;
  await db
    .prepare('UPDATE devices SET last_seen_at = ?1 WHERE device_id = ?2')
    .bind(nowIso(), device.device_id)
    .run();
  return { learnerId: device.learner_id, deviceId: device.device_id };
}
