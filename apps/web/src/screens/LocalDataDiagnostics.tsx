import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState, type FormEvent } from 'react';

import { Button, Cluster, Field, Surface, Textarea } from '@bloomlab/design-system';

import {
  DB_NAME,
  DB_VERSION,
  SYNC_STATE_KEY,
  db,
  isLinked,
  listOperations,
  notes,
  recomputeProgress,
  resetOperations,
  syncNow,
  useDevice,
  useNotes,
  useSyncStatus,
} from '../data';
import styles from './SystemDiagnostics.module.css';

const TABLES = [
  'device',
  'notes',
  'workspace',
  'sync_queue',
  'sync_state',
  'sync_shadow',
  'sync_conflicts',
] as const;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

/** Edits the newest note in place: the driver for two-device sync and conflict checks. */
function NewestNoteEditor() {
  const list = useNotes();
  const newest = list?.[0];
  const [draft, setDraft] = useState<string | null>(null);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!newest || draft === null) return;
    await notes.patch(newest.id, { body: draft });
    setDraft(null);
  }

  if (!newest) return <p className={styles.muted}>No notes yet.</p>;
  return (
    <form className={styles.noteForm} onSubmit={save}>
      <Field label="Newest note" hint={`id ${newest.id.slice(0, 8)} · revision ${newest.revision}`}>
        <Textarea
          rows={3}
          value={draft ?? newest.body}
          onChange={(event) => setDraft(event.target.value)}
        />
      </Field>
      <Cluster gap={2}>
        <Button type="submit" size="sm" variant="primary" disabled={draft === null}>
          Save note
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setDraft(null)} disabled={draft === null}>
          Discard
        </Button>
      </Cluster>
    </form>
  );
}

/**
 * Developer view of the local-first layer (DATA-001, DATA-002, SYNC-010): what IndexedDB holds,
 * whether the browser will keep it, what waits in the sync queue, and the link state. The note
 * actions exercise the syncable write path end to end without a product screen.
 */
export function LocalDataDiagnostics() {
  const device = useDevice();
  const counts = useLiveQuery(
    async () =>
      Object.fromEntries(
        await Promise.all(TABLES.map(async (name) => [name, await db.table(name).count()])),
      ) as Record<(typeof TABLES)[number], number>,
    [],
  );
  const operations = useLiveQuery(() => listOperations(), []);
  const state = useLiveQuery(() => db.sync_state.get(SYNC_STATE_KEY), []);
  const { label, pending } = useSyncStatus();
  const [estimate, setEstimate] = useState<StorageEstimate | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    navigator.storage
      ?.estimate?.()
      .then((value) => {
        if (!cancelled) setEstimate(value);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [counts]);

  const persisted =
    device?.storage_persisted === null || device === undefined
      ? 'unknown'
      : device.storage_persisted
        ? 'yes'
        : 'no';

  async function sync() {
    setSyncing(true);
    const result = await syncNow();
    // What the other device demonstrated changes this device's derived progress (Phase 6).
    if (result.status === 'synced' && result.pulled + result.adopted > 0) await recomputeProgress();
    setSyncing(false);
  }

  return (
    <>
      <Surface as="dl" padding="sm" className={styles.list}>
        <dt>Database</dt>
        <dd>
          {DB_NAME} · v{DB_VERSION} · IndexedDB via Dexie
        </dd>
        <dt>Persistent storage</dt>
        <dd>{persisted}</dd>
        <dt>Usage</dt>
        <dd>
          {estimate?.usage !== undefined && estimate.quota !== undefined
            ? `${formatBytes(estimate.usage)} of ${formatBytes(estimate.quota)}`
            : 'unavailable'}
        </dd>
        <dt>Records</dt>
        <dd>
          {counts ? TABLES.map((name) => `${name} ${counts[name]}`).join(' · ') : 'counting…'}
        </dd>
        <dt>Link</dt>
        <dd>
          {device && isLinked(device)
            ? `linked · learner ${device.learner_id.slice(0, 8)} · device ${device.device_id.slice(0, 8)}`
            : 'not linked'}
        </dd>
        <dt>Sync</dt>
        <dd>
          {label} · {pending} pending · cursor {state?.server_cursor ?? 0}
          {state?.last_error ? ` · last error: ${state.last_error}` : ''}
        </dd>
      </Surface>

      <Surface padding="sm" className={styles.queue}>
        <p className={styles.muted}>Sync queue (oldest first)</p>
        {operations && operations.length > 0 ? (
          <ul className={styles.ops}>
            {operations.map((op) => (
              <li key={op.seq}>
                #{op.seq} {op.entity}/{op.entity_id.slice(0, 8)} {op.op} r{op.revision} {op.status}
                {op.force ? ' force' : ''}
                {op.last_error ? ` · ${op.last_error}` : ''}
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.muted}>Nothing waiting.</p>
        )}
        <Cluster gap={2}>
          <Button size="sm" variant="primary" loading={syncing} onClick={() => void sync()}>
            Sync now
          </Button>
          <Button
            size="sm"
            onClick={() =>
              void notes.create({
                body: `Diagnostics note · ${new Date().toLocaleTimeString()}`,
                target_kind: 'general',
                target_ref: null,
              })
            }
          >
            Add test note
          </Button>
          <Button
            size="sm"
            onClick={() =>
              void notes.list().then(([latest]) => (latest ? notes.remove(latest.id) : undefined))
            }
          >
            Remove newest note
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void resetOperations()}>
            Reset stuck operations
          </Button>
        </Cluster>
        <NewestNoteEditor />
      </Surface>
    </>
  );
}
