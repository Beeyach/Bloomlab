/**
 * The sync contract shared by the Worker and the web client (spec §91, TA§14; SYNC-007, SYNC-008).
 *
 * Revision semantics: the server assigns `revision` when it accepts a change (1 on insert, then
 * +1 per accepted write). A client adopts the server's number at every sync point and bumps it
 * locally per edit in between; a push carries `base_revision`, the last server revision the
 * client saw for that record, so the server can tell a fast-forward from a divergence.
 */

/** How the server merges a divergent write for each entity (spec §91, TA§14). */
export type SyncKind =
  /** Simple progress: the latest valid revision wins (fast-forward, else newest `updated_at`). */
  | 'simple'
  /** Append-only evidence: rows are only ever added; two devices' rows merge to the union. */
  | 'append'
  /** Complex work: divergent edits are never merged silently — the learner chooses a version. */
  | 'snapshot';

export const SYNC_ENTITY_KINDS = {
  // Learning
  skill_progress: 'simple',
  skill_evidence: 'append',
  campaign_progress: 'simple',
  exercise_attempts: 'append',
  review_queue: 'simple',
  fieldwork: 'simple',
  notes: 'snapshot',
  // Simulation
  sim_projects: 'snapshot',
  sim_snapshots: 'append',
  sim_events: 'append',
  client_progress: 'snapshot',
  // Portfolio
  portfolio_projects: 'snapshot',
  portfolio_assets: 'append',
} as const satisfies Record<string, SyncKind>;

export type SyncEntity = keyof typeof SYNC_ENTITY_KINDS;

export const SYNC_ENTITIES = Object.keys(SYNC_ENTITY_KINDS) as SyncEntity[];

export function isSyncEntity(value: unknown): value is SyncEntity {
  return typeof value === 'string' && Object.hasOwn(SYNC_ENTITY_KINDS, value);
}

/** The fields every synced record carries (SYNC-007). */
export interface SyncEnvelope {
  id: string;
  learner_id: string;
  created_at: string;
  updated_at: string;
  revision: number;
  device_id: string;
  deleted_at: string | null;
}

/** A synced record: the envelope plus the entity's own fields. */
export type SyncRecord = SyncEnvelope & Record<string, unknown>;

export const ENVELOPE_FIELDS: readonly (keyof SyncEnvelope)[] = [
  'id',
  'learner_id',
  'created_at',
  'updated_at',
  'revision',
  'device_id',
  'deleted_at',
];

// ---------------------------------------------------------------- API contract (/api/sync/*)

export interface LinkRequest {
  /** The raw sync key (display form or bare); hashed with the pepper server-side, never stored. */
  secret: string;
  device: { device_id: string; label: string };
}

export interface LinkResponse {
  learner_id: string;
  device_id: string;
  /** Returned once; the server keeps only its hash. Sent as `Authorization: Bearer …`. */
  session_token: string;
  /** True when this key created the learner (first device). */
  created: boolean;
}

export interface PushOperation {
  /** The client's outbox sequence, echoed in the outcome. */
  seq: number;
  entity: SyncEntity;
  /** The server revision the client last saw for this record; 0 when never synced. */
  base_revision: number;
  /** The full record as the client has it (soft deletes carry `deleted_at`). */
  record: SyncRecord;
  /** Resolving a conflict: apply regardless of divergence. */
  force?: boolean;
}

export interface PushRequest {
  operations: PushOperation[];
}

export type PushOutcome =
  | { seq: number; status: 'applied'; revision: number }
  /** The server already held a newer state; the client should adopt `server`. */
  | { seq: number; status: 'superseded'; server: SyncRecord }
  /** Divergent edits on a snapshot entity; the client shows the chooser with `server`. */
  | { seq: number; status: 'conflict'; server: SyncRecord }
  | { seq: number; status: 'rejected'; reason: string };

export interface PushResponse {
  outcomes: PushOutcome[];
}

export interface PullRequest {
  /** The last `op_seq` the client applied; 0 for a full pull. */
  cursor: number;
  limit?: number;
}

export interface PullChange {
  op_seq: number;
  entity: SyncEntity;
  record: SyncRecord;
}

export interface PullResponse {
  changes: PullChange[];
  cursor: number;
  more: boolean;
}

export interface DeviceSummary {
  device_id: string;
  device_label: string;
  created_at: string;
  last_seen_at: string;
  revoked_at: string | null;
  /** The device making the request. */
  current: boolean;
}

export interface DevicesResponse {
  learner_id: string;
  devices: DeviceSummary[];
}

export interface ApiError {
  error: string;
}
