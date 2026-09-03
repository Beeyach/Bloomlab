import {
  SYNC_ENTITY_KINDS,
  decideMerge,
  isSyncEntity,
  normalizeSyncKey,
  type DevicesResponse,
  type LinkRequest,
  type LinkResponse,
  type PullChange,
  type PullRequest,
  type PullResponse,
  type PushOutcome,
  type PushRequest,
  type PushResponse,
  type SyncRecord,
} from '@bloomlab/shared';

import { SyncApiError, type SyncApi } from './api';

interface FakeDevice {
  device_id: string;
  learner_id: string;
  label: string;
  token: string;
  created_at: string;
  last_seen_at: string;
  revoked_at: string | null;
}

/**
 * An in-memory stand-in for the Worker with the real merge rules (`decideMerge`), so engine
 * tests exercise link → push → pull → conflict end to end without a network. Test-only.
 */
export class FakeSyncServer implements SyncApi {
  learners = new Map<string, string>(); // key → learner_id
  sessions = new Map<string, FakeDevice>(); // token → device
  records = new Map<string, Map<string, SyncRecord>>(); // learner → `${entity}:${id}` → record
  log: { op_seq: number; learner_id: string; entity: string; id: string }[] = [];
  offline = false;
  /** Apply the next push server-side but lose the response, like a dropped connection. */
  dropNextPushResponse = false;
  calls = { link: 0, push: 0, pull: 0 };

  private guard() {
    if (this.offline) throw new SyncApiError(0, 'The server could not be reached');
  }

  private session(token: string): FakeDevice {
    const device = this.sessions.get(token);
    if (!device || device.revoked_at) {
      throw new SyncApiError(401, 'This device is not linked or was revoked');
    }
    return device;
  }

  async link(body: LinkRequest): Promise<LinkResponse> {
    this.guard();
    this.calls.link += 1;
    const check = normalizeSyncKey(body.secret);
    if (!check.ok) throw new SyncApiError(400, check.reason);
    const created = !this.learners.has(check.key);
    const learner_id = this.learners.get(check.key) ?? `learner-${this.learners.size + 1}`;
    this.learners.set(check.key, learner_id);
    const token = `token-${body.device.device_id}-${crypto.randomUUID()}`;
    for (const [existingToken, device] of this.sessions) {
      if (device.device_id === body.device.device_id) this.sessions.delete(existingToken);
    }
    const now = new Date().toISOString();
    this.sessions.set(token, {
      device_id: body.device.device_id,
      learner_id,
      label: body.device.label,
      token,
      created_at: now,
      last_seen_at: now,
      revoked_at: null,
    });
    return { learner_id, device_id: body.device.device_id, session_token: token, created };
  }

  async push(token: string, body: PushRequest): Promise<PushResponse> {
    this.guard();
    this.calls.push += 1;
    const device = this.session(token);
    const store = this.records.get(device.learner_id) ?? new Map<string, SyncRecord>();
    this.records.set(device.learner_id, store);
    const outcomes: PushOutcome[] = [];
    for (const op of body.operations) {
      if (!isSyncEntity(op.entity)) {
        outcomes.push({ seq: op.seq, status: 'rejected', reason: 'Unknown entity' });
        continue;
      }
      if (op.record.device_id !== device.device_id) {
        outcomes.push({
          seq: op.seq,
          status: 'rejected',
          reason: 'A device may only push its own writes',
        });
        continue;
      }
      const key = `${op.entity}:${op.record.id}`;
      const existing = store.get(key) ?? null;
      if (
        existing &&
        existing.device_id === op.record.device_id &&
        existing.updated_at === op.record.updated_at &&
        existing.deleted_at === op.record.deleted_at
      ) {
        outcomes.push({ seq: op.seq, status: 'applied', revision: existing.revision });
        continue;
      }
      const decision = decideMerge(
        SYNC_ENTITY_KINDS[op.entity],
        existing,
        op.record,
        op.base_revision,
        op.force === true,
      );
      if (decision.action === 'apply') {
        store.set(key, {
          ...op.record,
          learner_id: device.learner_id,
          revision: decision.revision,
        });
        this.log.push({
          op_seq: this.log.length + 1,
          learner_id: device.learner_id,
          entity: op.entity,
          id: op.record.id,
        });
        outcomes.push({ seq: op.seq, status: 'applied', revision: decision.revision });
      } else {
        outcomes.push({ seq: op.seq, status: decision.action, server: existing as SyncRecord });
      }
    }
    if (this.dropNextPushResponse) {
      this.dropNextPushResponse = false;
      throw new SyncApiError(0, 'The server could not be reached');
    }
    return { outcomes };
  }

  async pull(token: string, body: PullRequest): Promise<PullResponse> {
    this.guard();
    this.calls.pull += 1;
    const device = this.session(token);
    const store = this.records.get(device.learner_id) ?? new Map<string, SyncRecord>();
    const rows = this.log.filter(
      (row) => row.learner_id === device.learner_id && row.op_seq > body.cursor,
    );
    const latest = new Map<string, (typeof rows)[number]>();
    for (const row of rows) latest.set(`${row.entity}:${row.id}`, row);
    const changes: PullChange[] = [...latest.values()]
      .map((row) => ({
        op_seq: row.op_seq,
        entity: row.entity,
        record: store.get(`${row.entity}:${row.id}`),
      }))
      .filter((c): c is PullChange => isSyncEntity(c.entity) && c.record !== undefined)
      .sort((x, y) => x.op_seq - y.op_seq);
    return { changes, cursor: rows.at(-1)?.op_seq ?? body.cursor, more: false };
  }

  async devices(token: string): Promise<DevicesResponse> {
    this.guard();
    return this.listFor(this.session(token));
  }

  private listFor(current: FakeDevice): DevicesResponse {
    return {
      learner_id: current.learner_id,
      devices: [...this.sessions.values()]
        .filter((d) => d.learner_id === current.learner_id)
        .map((d) => ({
          device_id: d.device_id,
          device_label: d.label,
          created_at: d.created_at,
          last_seen_at: d.last_seen_at,
          revoked_at: d.revoked_at,
          current: d.device_id === current.device_id,
        })),
    };
  }

  async revoke(token: string, deviceId: string): Promise<DevicesResponse> {
    this.guard();
    const current = this.session(token);
    for (const device of this.sessions.values()) {
      if (device.device_id === deviceId) device.revoked_at = new Date().toISOString();
    }
    return this.listFor(current);
  }

  async label(token: string, label: string): Promise<DevicesResponse> {
    this.guard();
    const current = this.session(token);
    current.label = label;
    return this.listFor(current);
  }
}
