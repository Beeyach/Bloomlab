import { z } from 'zod';
import {
  assertCheckpoint,
  assertPendingEvent,
  canonical,
  replay,
  replayMatches,
  SIMULATOR_VERSION,
  EVENT_ORIGINS,
  SIMULATOR_EVENT_TYPES,
  isValidTimeZone,
  type Checkpoint,
  type SimulatorEvent,
  type SimulatorState,
  type SimulatorScenario,
} from '@bloomlab/simulator-core';
import type { SyncRecord } from '@bloomlab/shared';
import { db, type BloomlabDatabase } from '../data/db';
import { recomputeProgress } from '../data/learning/progress';
import { enqueueOperation } from '../data/syncQueue';
import { DERIVED_SYNC_ENTITIES, LOCAL_SYNC_ENTITIES, type LocalSyncEntity } from '../data/types';
import { content } from '../content/bundle';
import { assertSafeBackup, MAX_BACKUP_BYTES, RestoreSchema } from './restoreSchema';

type Parsed = z.infer<typeof RestoreSchema>;
type RestoreRows = Record<LocalSyncEntity, SyncRecord[]>;
export interface RestorePreview {
  exportedAt: string;
  contentVersion: string;
  groups: { name: string; add: number; keep: number }[];
  add: number;
  keep: number;
  mediaReferences: number;
}
// Only a preview produced here can be confirmed. The caller cannot mutate imported data or the
// database fingerprint through a displayed summary. Dropping the preview cancels without writes.
const staged = new WeakMap<
  RestorePreview,
  { text: string; fingerprint: string; learner: string }
>();
const tables = (database: BloomlabDatabase) => [
  ...LOCAL_SYNC_ENTITIES.map((name) => database.table(name)),
  database.device,
  database.sync_queue,
  database.sync_shadow,
  database.sync_conflicts,
];
function rowsOf(backup: Parsed): RestoreRows {
  return {
    ...backup.progress,
    ...backup.projects,
    ...backup.simulator_saves,
    ...backup.portfolio_metadata,
    notes: backup.notes,
    skill_evidence: backup.evidence.skill_evidence,
    exercise_attempts: backup.evidence.exercise_attempts,
  } as unknown as RestoreRows;
}
const derived = (entity: LocalSyncEntity) =>
  (DERIVED_SYNC_ENTITIES as readonly string[]).includes(entity);
const generation = (row: Record<string, unknown>) => row.generation ?? '0';
const eventSchema = z.strictObject({
  id: z.string().min(1),
  type: z.enum(SIMULATOR_EVENT_TYPES),
  at: z.iso.datetime({ offset: true }),
  sequence: z.number().int().nonnegative(),
  payload: z.record(z.string(), z.unknown()),
  origin: z.enum(EVENT_ORIGINS),
  source: z
    .strictObject({
      kind: z.enum([
        'workflow_node',
        'workflow_trigger',
        'workflow_wait',
        'injector_action',
        'scheduled',
        'time_machine',
        'reducer',
      ]),
      id: z.string(),
      caused_by: z.string().optional(),
    })
    .nullable(),
  run_id: z.string(),
  scenario_id: z.string(),
});
const queuedSchema = eventSchema
  .omit({ run_id: true, scenario_id: true })
  .extend({ description: z.string().nullable() });
function validateSimulator(backup: Parsed) {
  for (const row of backup.simulator_saves.sim_events) {
    const event = eventSchema.parse(row.event);
    if (event.run_id !== row.run_id || event.sequence !== row.sequence)
      throw new Error('Simulator event identity does not match its saved row.');
  }
  for (const project of backup.projects.sim_projects) {
    if (project.id !== project.run_id || !isValidTimeZone(project.timezone))
      throw new Error('Invalid simulator identity or timezone.');
    if (project.simulator_version !== SIMULATOR_VERSION)
      throw new Error('This backup needs its original simulator version. No data was changed.');
    const scenario = content.scenarios.find((s) => s.id === project.scenario_id);
    if (!scenario)
      throw new Error('The saved simulator scenario is not available in this content version.');
    const log = backup.simulator_saves.sim_events
      .filter(
        (row) =>
          row.run_id === project.run_id &&
          generation(row) === generation(project) &&
          row.deleted_at === null,
      )
      .map((row) => eventSchema.parse(row.event))
      .sort((a, b) => a.sequence - b.sequence);
    if (
      log.length !== project.log_length ||
      new Set(log.map((e) => e.id)).size !== log.length ||
      new Set(log.map((e) => e.sequence)).size !== log.length
    )
      throw new Error('Simulator history is incomplete or duplicated.');
    const rebuilt = replay(scenario as unknown as SimulatorScenario, log, {
      run_id: project.run_id,
    });
    const candidate = {
      ...rebuilt,
      clock: { now: project.clock_now, timezone: project.timezone },
      account: project.account,
      log,
      execution: project.execution,
      random: project.random,
      sequence: project.sequence,
    } as unknown as SimulatorState;
    if (!replayMatches(candidate, rebuilt))
      throw new Error(
        'Simulator save does not match its history. The content may have changed or the export was redacted.',
      );
    for (const entry of project.queue) {
      queuedSchema.parse(entry);
      assertPendingEvent(entry);
      if (
        typeof entry.id !== 'string' ||
        !Number.isSafeInteger(entry.sequence) ||
        !Number.isFinite(Date.parse(entry.at))
      )
        throw new Error('Malformed simulator queue.');
    }
  }
  for (const row of backup.simulator_saves.sim_snapshots) {
    const point = row.checkpoint as unknown as Checkpoint;
    assertCheckpoint(point, row.run_id);
    if (row.log_length !== point.log_length) throw new Error('Checkpoint length does not match.');
    const scenario = content.scenarios.find((s) => s.id === point.state.scenario_id);
    const log: SimulatorEvent[] = z.array(eventSchema).parse(point.state.log);
    if (
      !scenario ||
      !replayMatches(
        point.state,
        replay(scenario as unknown as SimulatorScenario, log, { run_id: row.run_id }),
      )
    )
      throw new Error('Checkpoint cannot be reproduced from its history.');
  }
}
function parseBackup(text: string): Parsed {
  if (new TextEncoder().encode(text).length > MAX_BACKUP_BYTES)
    throw new Error('Choose a JSON backup up to 25 MB.');
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error('This is not a valid JSON backup.');
  }
  assertSafeBackup(value);
  const parsed = RestoreSchema.safeParse(value);
  if (!parsed.success)
    throw new Error(
      'Unsupported backup format/version or invalid record schema. No data was changed.',
    );
  const rows = rowsOf(parsed.data);
  for (const records of Object.values(rows)) {
    if (new Set(records.map((r) => r.id)).size !== records.length)
      throw new Error('Backup contains duplicate record IDs.');
  }
  validateSimulator(parsed.data);
  return parsed.data;
}
async function inspect(backup: Parsed, database: BloomlabDatabase) {
  const device = await database.device.toCollection().first();
  if (!device) throw new Error('Open Bloomlab on this device before restoring a backup.');
  const incoming = rowsOf(backup);
  const current = {} as RestoreRows;
  for (const entity of LOCAL_SYNC_ENTITIES)
    current[entity] = (await database.table(entity).toArray()) as SyncRecord[];
  for (const records of Object.values(incoming))
    if (records.some((row) => row.learner_id !== device.learner_id))
      throw new Error(
        'This backup belongs to another learner. Link with its original Bloomlab Sync Key first; records are never reassigned.',
      );
  const next = {} as RestoreRows;
  const groups: RestorePreview['groups'] = [];
  for (const entity of LOCAL_SYNC_ENTITIES) {
    const existing = new Set(current[entity].map((row) => row.id));
    // Never mix an older backup generation into an existing run, even when an append row is absent.
    const existingRuns = new Set(current.sim_projects.map((row) => row.run_id));
    next[entity] = derived(entity)
      ? []
      : incoming[entity].filter(
          (row) =>
            !existing.has(row.id) &&
            (!['sim_events', 'sim_snapshots'].includes(entity) || !existingRuns.has(row.run_id)),
        );
    if (!derived(entity))
      groups.push({
        name: entity,
        add: next[entity].length,
        keep: incoming[entity].length - next[entity].length,
      });
  }
  const combined = (entity: LocalSyncEntity) =>
    [...current[entity], ...next[entity]].filter((row) => row.learner_id === device.learner_id);
  const owns = (entity: LocalSyncEntity, id: unknown) =>
    combined(entity).some((row) => row.id === id);
  for (const row of next.skill_evidence)
    if (row.attempt_id !== null && !owns('exercise_attempts', row.attempt_id))
      throw new Error('Evidence points to a missing or foreign attempt.');
  for (const row of next.portfolio_assets)
    if (!owns('exercise_attempts', row.attempt_id) || !owns('portfolio_projects', row.portfolio_id))
      throw new Error('Portfolio reference points to missing or foreign work.');
  for (const row of [...next.sim_events, ...next.sim_snapshots])
    if (!owns('sim_projects', row.run_id))
      throw new Error('Simulator history points to a missing or foreign run.');
  const fingerprint = canonical({
    learner: device.learner_id,
    current,
    queue: await database.sync_queue.toArray(),
    shadows: await database.sync_shadow.toArray(),
    conflicts: await database.sync_conflicts.toArray(),
  });
  return { device, next, groups, fingerprint };
}

/** Read-only, including malformed/cancelled/foreign input. Nothing is written until confirm. */
export async function previewRestore(
  text: string,
  database: BloomlabDatabase = db,
): Promise<RestorePreview> {
  const backup = parseBackup(text);
  const inspected = await database.transaction('r', tables(database), () =>
    inspect(backup, database),
  );
  const preview: RestorePreview = {
    exportedAt: backup.exported_at,
    contentVersion: backup.versions.content,
    groups: inspected.groups,
    add: inspected.groups.reduce((n, g) => n + g.add, 0),
    keep: inspected.groups.reduce((n, g) => n + g.keep, 0),
    mediaReferences: backup.evidence.private_assets.length,
  };
  staged.set(preview, {
    text,
    fingerprint: inspected.fingerprint,
    learner: inspected.device.learner_id,
  });
  return preview;
}
export function cancelRestore(preview: RestorePreview) {
  staged.delete(preview);
}

/** Atomic with the existing outbox. No force writes, server calls, session import or fake sync. */
export async function confirmRestore(preview: RestorePreview, database: BloomlabDatabase = db) {
  const stage = staged.get(preview);
  if (!stage) throw new Error('Review this backup again before restoring.');
  const backup = parseBackup(stage.text);
  const restored = await database.transaction('rw', tables(database), async () => {
    const inspected = await inspect(backup, database);
    if (
      inspected.fingerprint !== stage.fingerprint ||
      inspected.device.learner_id !== stage.learner
    )
      throw new Error(
        'Saved data changed since the preview. Review the backup again; nothing was restored.',
      );
    let added = 0;
    for (const entity of LOCAL_SYNC_ENTITIES)
      for (const row of inspected.next[entity]) {
        // Same immutable IDs and historical evidence versions; this device owns the new local write.
        const restored = { ...row, device_id: inspected.device.device_id };
        await database.table(entity).add(restored);
        await enqueueOperation(
          {
            entity,
            entity_id: restored.id,
            op: restored.deleted_at ? 'delete' : 'upsert',
            revision: restored.revision,
            payload: restored,
          },
          database,
        );
        added++;
      }
    // Serialized derived progress is never imported as proof. Any failure rolls back the whole restore.
    await recomputeProgress(database);
    return added;
  });
  staged.delete(preview);
  return restored;
}
