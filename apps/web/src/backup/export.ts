import { ClientProgressRecordSchema } from '@bloomlab/content-schema';
import { z } from 'zod';
import { db, type BloomlabDatabase } from '../data/db';
import { currentVersions } from '../data/learning/versions';
import { collectPortfolio } from '../portfolio/store';
import { PortfolioProjectRecordSchema, PortfolioAssetRecordSchema } from '@bloomlab/content-schema';

export const BACKUP_GROUPS = [
  'progress',
  'evidence',
  'projects',
  'notes',
  'simulator_saves',
  'portfolio_metadata',
] as const;
const row = z.record(z.string(), z.unknown());
export const BackupSchema = z.strictObject({
  format: z.literal('bloomlab-data'),
  schema_version: z.literal(1),
  exported_at: z.iso.datetime(),
  versions: z.strictObject({
    app: z.string(),
    content: z.string(),
    content_hash: z.string(),
    simulator: z.string(),
    rules: z.string(),
  }),
  progress: z.strictObject({
    skill_progress: z.array(row),
    campaign_progress: z.array(row),
    review_queue: z.array(row),
  }),
  evidence: z.strictObject({
    skill_evidence: z.array(row),
    exercise_attempts: z.array(row),
    private_assets: z.array(row),
  }),
  projects: z.strictObject({
    sim_projects: z.array(row),
    client_progress: z.array(ClientProgressRecordSchema).default([]),
  }),
  notes: z.array(row),
  simulator_saves: z.strictObject({ sim_events: z.array(row), sim_snapshots: z.array(row) }),
  portfolio_metadata: z.strictObject({
    portfolio_projects: z.array(PortfolioProjectRecordSchema),
    portfolio_assets: z.array(PortfolioAssetRecordSchema),
  }),
});
export type BloomlabBackup = z.infer<typeof BackupSchema>;

const forbidden =
  /(?:secret|token|password|credential|authorization|cookie|api_?key|sync_?key|pepper|private_?key|object_?key|r2_?key|base64|audio|recording|blob|image_?bytes|provider|voice_?id|signed_?url|(?:^|_)bytes$|buffer|binary)/i;
const privateString =
  /(?:\bBLM-(?:[A-Z0-9]{4}-){3}|\bBearer\s+\S+|\bsk-ant-\S+|-----BEGIN .*PRIVATE KEY|(?:data|blob):|[?&](?:token|key|secret|password|signature|x-amz-[^=]+)=|https?:\/\/[^/\s]+:[^/\s]+@)/i;
/** Known unsafe fields are removed even inside flexible simulator/response payloads. */
export function safeBackupValue(value: unknown): unknown {
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string')
    return privateString.test(value) ? '[private value omitted]' : value;
  if (Array.isArray(value)) return value.map(safeBackupValue);
  if (typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) return null;
  const object = value as Record<string, unknown>;
  if (
    ['name', 'key', 'header'].some(
      (k) => typeof object[k] === 'string' && forbidden.test(object[k]),
    )
  )
    return { omitted: 'private setting' };
  return Object.fromEntries(
    Object.entries(value)
      .filter(
        ([key, entry]) =>
          // Calendar scheduling buffers are durations, not binary buffers (DATA-009).
          ((['pre_buffer_minutes', 'post_buffer_minutes'].includes(key) &&
            typeof entry === 'number' &&
            Number.isFinite(entry)) ||
            !forbidden.test(key)) &&
          !['__proto__', 'constructor', 'prototype'].includes(key),
      )
      .map(([key, entry]) => [key, safeBackupValue(entry)]),
  );
}
export const BACKUP_ENVELOPE = [
  'id',
  'learner_id',
  'device_id',
  'created_at',
  'updated_at',
  'revision',
  'deleted_at',
];
export const BACKUP_COLUMNS = {
  skill_progress: [
    'skill_id',
    'state',
    'ladder_state',
    'refresh_from',
    'refresh_reason',
    'confidence',
    'missing_requirements',
    'review_priority',
    'review_due',
    'last_demonstrated',
    'counts',
    'rules_version',
    'content_version',
    'computed_at',
  ],
  campaign_progress: [
    'campaign_id',
    'current_gate',
    'gates',
    'passed_gates',
    'next_required',
    'work_ahead',
    'complete',
    'rules_version',
    'content_version',
    'computed_at',
  ],
  review_queue: [
    'skill_id',
    'due_at',
    'priority',
    'reason',
    'status',
    'last_demonstrated',
    'state',
    'rules_version',
    'computed_at',
  ],
  skill_evidence: [
    'skill_id',
    'kind',
    'source',
    'exercise_id',
    'exercise_type',
    'attempt_id',
    'result',
    'score',
    'assistance',
    'hints_used',
    'difficulty',
    'critical_failures',
    'occurred_at',
    'versions',
    'real_ghl',
    'mode',
  ],
  exercise_attempts: [
    'exercise_id',
    'exercise_type',
    'skill_ids',
    'source',
    'started_at',
    'completed_at',
    'result',
    'score',
    'assistance',
    'hints_used',
    'difficulty',
    'critical_failures',
    'mode',
    'versions',
    'response',
    'grade',
    'portfolio_capture',
  ],
  sim_projects: [
    'scenario_id',
    'run_id',
    'generation',
    'simulator_version',
    'clock_now',
    'timezone',
    'account',
    'queue',
    'random',
    'sequence',
    'queue_sequence',
    'log_length',
    'execution',
    'diagnostics',
  ],
  notes: ['body', 'target_kind', 'target_ref'],
  sim_events: ['run_id', 'generation', 'sequence', 'event'],
  sim_snapshots: ['run_id', 'generation', 'log_length', 'label', 'checkpoint'],
} as const;

/** A consistent local snapshot of exactly six groups. No network or provider is involved. */
export async function createBackup(
  database: BloomlabDatabase = db,
  at = new Date(),
): Promise<BloomlabBackup> {
  await collectPortfolio(database);
  return database.transaction(
    'r',
    [
      ...Object.keys(BACKUP_COLUMNS).map((name) => database.table(name)),
      database.client_progress,
      database.portfolio_projects,
      database.portfolio_assets,
      database.evidence_assets,
      database.device,
    ],
    async () => {
      const device = await database.device.toCollection().first();
      const pickRows = async (table: keyof typeof BACKUP_COLUMNS) => {
        const records = (await database
          .table(table)
          .filter((r) => r.learner_id === device?.learner_id)
          .toArray()) as Record<string, unknown>[];
        return records
          .sort((a, b) => String(a.id).localeCompare(String(b.id)))
          .map((r) =>
            safeBackupValue(
              Object.fromEntries(
                [...BACKUP_ENVELOPE, ...BACKUP_COLUMNS[table]]
                  .filter((k) => k in r)
                  .map((k) => [k, r[k]]),
              ),
            ),
          ) as Record<string, unknown>[];
      };
      const [
        skill_progress,
        campaign_progress,
        review_queue,
        skill_evidence,
        exercise_attempts,
        sim_projects,
        notes,
        sim_events,
        sim_snapshots,
      ] = await Promise.all([
        pickRows('skill_progress'),
        pickRows('campaign_progress'),
        pickRows('review_queue'),
        pickRows('skill_evidence'),
        pickRows('exercise_attempts'),
        pickRows('sim_projects'),
        pickRows('notes'),
        pickRows('sim_events'),
        pickRows('sim_snapshots'),
      ]);
      const ownedAttempts = new Set(exercise_attempts.map((a) => a.id));
      const private_assets = (await database.evidence_assets.toArray())
        .filter((a) => a.learner_id === device?.learner_id && ownedAttempts.has(a.attempt_id))
        .sort((a, b) => a.asset_id.localeCompare(b.asset_id))
        .map((a) => ({
          asset_id: a.asset_id,
          attempt_id: a.attempt_id,
          exercise_id: a.exercise_id,
          item_key: a.item_key,
          status: a.status,
        }));
      const client_progress = (await database.client_progress.toArray())
        .filter((row) => row.learner_id === device?.learner_id)
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((row) => ClientProgressRecordSchema.parse(safeBackupValue(row)));
      const portfolio_projects = (await database.portfolio_projects.toArray())
        .filter((p) => p.learner_id === device?.learner_id)
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((p) => PortfolioProjectRecordSchema.parse(safeBackupValue(p)));
      const portfolio_assets = (await database.portfolio_assets.toArray())
        .filter((p) => p.learner_id === device?.learner_id)
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((p) => PortfolioAssetRecordSchema.parse(safeBackupValue(p)));
      return BackupSchema.parse({
        format: 'bloomlab-data',
        schema_version: 1,
        exported_at: at.toISOString(),
        versions: currentVersions(),
        progress: { skill_progress, campaign_progress, review_queue },
        evidence: { skill_evidence, exercise_attempts, private_assets },
        projects: { sim_projects, client_progress },
        notes,
        simulator_saves: { sim_events, sim_snapshots },
        portfolio_metadata: { portfolio_projects, portfolio_assets },
      });
    },
  );
}
export function downloadBackup(backup: BloomlabBackup) {
  const valid = BackupSchema.parse(backup);
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(valid, null, 2)], { type: 'application/json' }),
  );
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `bloomlab-data-${valid.exported_at.slice(0, 10)}.json`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
