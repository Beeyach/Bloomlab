import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';

import { Button, Cluster, Surface } from '@bloomlab/design-system';

import {
  DB_NAME,
  DB_VERSION,
  db,
  listOperations,
  notes,
  resetOperations,
  useDevice,
  useSyncStatus,
} from '../data';
import styles from './SystemDiagnostics.module.css';

const TABLES = ['device', 'notes', 'workspace', 'sync_queue', 'sync_state'] as const;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

/**
 * Developer view of the local-first layer (DATA-001, DATA-002): what IndexedDB holds, whether
 * the browser will keep it, and what waits in the sync queue. The two note actions exercise
 * the syncable write path end to end without a product screen.
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
  const { label, pending } = useSyncStatus();
  const [estimate, setEstimate] = useState<StorageEstimate | null>(null);

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
        <dt>Sync</dt>
        <dd>
          {label} · {pending} pending
        </dd>
      </Surface>

      <Surface padding="sm" className={styles.queue}>
        <p className={styles.muted}>Sync queue (oldest first)</p>
        {operations && operations.length > 0 ? (
          <ul className={styles.ops}>
            {operations.map((op) => (
              <li key={op.seq}>
                #{op.seq} {op.entity}/{op.entity_id.slice(0, 8)} {op.op} r{op.revision} {op.status}
                {op.last_error ? ` · ${op.last_error}` : ''}
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.muted}>Nothing waiting.</p>
        )}
        <Cluster gap={2}>
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
      </Surface>
    </>
  );
}
