import type { ClientProgressRecord } from '@bloomlab/content-schema';
import type { PortfolioProjectRecord, PortfolioAssetRecord } from '@bloomlab/content-schema';
import type { LocalEvidenceAsset } from '../fieldwork/assets';
import type { LocalCallRecording } from '../call/local';
import Dexie, { type EntityTable, type Table } from 'dexie';

import type {
  CampaignProgressRecord,
  DeviceRecord,
  ExerciseAttemptRecord,
  NoteRecord,
  ReviewQueueRecord,
  SimEventRecord,
  SimProjectRecord,
  SimSnapshotRecord,
  SkillEvidenceRecord,
  SkillProgressRecord,
  SyncConflictRecord,
  SyncOperation,
  SyncShadowRecord,
  SyncStateRecord,
  WorkspaceRecord,
} from './types';

export const DB_NAME = 'bloomlab';
export const DB_VERSION = 9;

/**
 * The IndexedDB database behind every local-first flow (DATA-002). Dexie is the whole data
 * layer: no ORM on top, and localStorage never holds application data.
 *
 * Only tables with a consumer exist. Later phases add theirs with a new `version()` block
 * (curriculum cache in Phase 5, simulator projects and events in Phase 10, and so on).
 */
export class BloomlabDatabase extends Dexie {
  declare client_progress: EntityTable<ClientProgressRecord, 'id'>;
  declare portfolio_projects: EntityTable<PortfolioProjectRecord, 'id'>;
  declare portfolio_assets: EntityTable<PortfolioAssetRecord, 'id'>;
  declare evidence_assets: EntityTable<LocalEvidenceAsset, 'asset_id'>;
  declare call_recordings: EntityTable<LocalCallRecording, 'recording_id'>;
  declare device: EntityTable<DeviceRecord, 'device_id'>;
  declare notes: EntityTable<NoteRecord, 'id'>;
  declare workspace: EntityTable<WorkspaceRecord, 'key'>;
  declare sync_queue: EntityTable<SyncOperation, 'seq'>;
  declare sync_state: EntityTable<SyncStateRecord, 'entity'>;
  // Compound primary keys: `[entity, entity_id]`.
  declare sync_shadow: Table<SyncShadowRecord, [string, string]>;
  declare sync_conflicts: Table<SyncConflictRecord, [string, string]>;
  // Phase 6: learning records (spec §93 Learning domain, synced by kind).
  declare skill_evidence: EntityTable<SkillEvidenceRecord, 'id'>;
  declare exercise_attempts: EntityTable<ExerciseAttemptRecord, 'id'>;
  declare skill_progress: EntityTable<SkillProgressRecord, 'id'>;
  declare campaign_progress: EntityTable<CampaignProgressRecord, 'id'>;
  declare review_queue: EntityTable<ReviewQueueRecord, 'id'>;
  // Phase 10: simulator saves (spec §93 Simulation domain).
  declare sim_projects: EntityTable<SimProjectRecord, 'id'>;
  declare sim_events: EntityTable<SimEventRecord, 'id'>;
  declare sim_snapshots: EntityTable<SimSnapshotRecord, 'id'>;

  constructor(name: string = DB_NAME) {
    super(name);
    // v1 (Phase 3): local-first tables and the outbox.
    this.version(1).stores({
      device: '&device_id',
      notes: '&id, updated_at, deleted_at, [target_kind+target_ref]',
      workspace: '&key',
      sync_queue: '++seq, [entity+entity_id], status',
      sync_state: '&entity',
    });
    // v2 (Phase 4): the server-confirmed state per record and unresolved conflicts.
    this.version(2).stores({
      sync_shadow: '&[entity+entity_id]',
      sync_conflicts: '&[entity+entity_id], detected_at',
    });
    // v3 (Phase 6): evidence and attempts (append-only) and the derived progress rows.
    this.version(3).stores({
      skill_evidence: '&id, skill_id, occurred_at, updated_at',
      exercise_attempts: '&id, exercise_id, updated_at',
      skill_progress: '&id, skill_id, updated_at',
      campaign_progress: '&id, campaign_id, updated_at',
      review_queue: '&id, skill_id, due_at, updated_at',
    });
    // v4 (Phase 10): one row per simulator run, plus its append-only history and checkpoints.
    this.version(4).stores({
      sim_projects: '&id, run_id, scenario_id, updated_at',
      sim_events: '&id, run_id, sequence, updated_at',
      sim_snapshots: '&id, run_id, log_length, updated_at',
    });
    // v5 (Phase 21): recoverable local audio, never a sync entity.
    this.version(5).stores({
      call_recordings: '&recording_id, attempt_id, [attempt_id+turn]',
    });
    // v6 (Phase 22): private screenshots; never part of sync/outbox JSON.
    this.version(6).stores({ evidence_assets: '&asset_id, attempt_id' });
    // v7: normalized portfolio metadata; replay history previously skipped by older clients.
    this.version(7)
      .stores({
        portfolio_projects: '&id, template_id, updated_at',
        portfolio_assets: '&id, portfolio_id, attempt_id, updated_at',
      })
      .upgrade(async (tx) => {
        await tx.table('sync_state').toCollection().modify({ server_cursor: 0 });
      });
    // v8: client relationships and project attempt selections, with explicit snapshot conflicts.
    this.version(8)
      .stores({ client_progress: '&id, client_id, updated_at' })
      .upgrade(async (tx) => {
        await tx.table('sync_state').toCollection().modify({ server_cursor: 0 });
      });
    // v9: local-only learner work carries the same explicit owner as sync records. The primary
    // UUID/key remains stable; one browser device belongs to one learner, and linking re-keys the
    // provisional owner in the same transaction as every sync record (PRD-009).
    this.version(9)
      .stores({
        workspace: '&key, learner_id',
        call_recordings: '&recording_id, learner_id, attempt_id, [attempt_id+turn]',
        evidence_assets: '&asset_id, learner_id, attempt_id',
        sync_queue: '++seq, learner_id, [entity+entity_id], status',
        sync_state: '&entity, learner_id',
        sync_shadow: '&[entity+entity_id], learner_id',
        sync_conflicts: '&[entity+entity_id], learner_id, detected_at',
      })
      .upgrade(async (tx) => {
        let device = await tx.table('device').toCollection().first();
        if (!device) {
          const at = new Date().toISOString();
          device = {
            device_id: crypto.randomUUID(),
            learner_id: `local:${crypto.randomUUID()}`,
            label: 'This device',
            created_at: at,
            last_seen_at: at,
            storage_persisted: null,
          };
          await tx.table('device').add(device);
        }
        const localOwner = { learner_id: device.learner_id, device_id: device.device_id };
        for (const table of ['workspace', 'call_recordings', 'evidence_assets'])
          await tx.table(table).toCollection().modify(localOwner);
        for (const table of ['sync_queue', 'sync_state', 'sync_shadow', 'sync_conflicts'])
          await tx.table(table).toCollection().modify({ learner_id: device.learner_id });
      });
  }
}

/** The application database. Tests construct their own `BloomlabDatabase` with a unique name. */
export const db = new BloomlabDatabase();
