import { content } from '../content/bundle';
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';

import { Button, Sheet, Surface } from '@bloomlab/design-system';
import { ENVELOPE_FIELDS, type SyncRecord } from '@bloomlab/shared';

import { db, resolveConflict, syncNow, type LocalSyncEntity } from '../data';
import styles from './ConflictChooser.module.css';
import { dismissConflictPrompt, useDismissedConflict } from './conflictPrompt';

/** A readable summary of a record: its text body when it has one, else its own fields. */
function describe(record: SyncRecord): string {
  if (
    record.schema_version === 1 &&
    typeof record.client_id === 'string' &&
    Array.isArray(record.journal)
  )
    return `${content.clients.find((c) => c.id === record.client_id)?.business_name ?? 'Client'} · ${String(record.relationship)}\n${record.journal.map((entry) => String((entry as { text?: string }).text ?? '')).join('\n')}\nSaved project selections: ${Object.keys((record.engagements ?? {}) as object).length}`;
  if (record.schema_version === 1 && typeof record.reflection === 'string')
    return record.deleted_at
      ? 'Removed from Portfolio'
      : record.reflection || 'No additional reflection saved.';
  if (typeof record.body === 'string') return record.body;
  return Object.entries(record)
    .filter(([key]) => !(ENVELOPE_FIELDS as readonly string[]).includes(key))
    .map(([key, value]) => `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`)
    .join('\n');
}

const when = (iso: string) => new Date(iso).toLocaleString();

/**
 * "Two versions were changed. Choose which version to keep." (spec §91, SYNC-009). Shown as soon
 * as the sync engine records a divergence; nothing is discarded until the learner chooses.
 */
export function ConflictChooser() {
  const conflict = useLiveQuery(() => db.sync_conflicts.orderBy('detected_at').first(), []);
  const dismissed = useDismissedConflict();
  const [busy, setBusy] = useState<'local' | 'server' | null>(null);

  async function choose(choice: 'local' | 'server') {
    if (!conflict) return;
    setBusy(choice);
    await resolveConflict(conflict.entity as LocalSyncEntity, conflict.entity_id, choice);
    setBusy(null);
    void syncNow();
  }

  if (!conflict) return null;
  const key = `${conflict.entity}:${conflict.entity_id}`;
  const local = conflict.local as SyncRecord;
  const server = conflict.server as SyncRecord;

  return (
    <Sheet
      open={dismissed !== key}
      onClose={() => dismissConflictPrompt(key)}
      title="Two versions were changed."
    >
      <p className={styles.lede}>
        Choose which version to keep. The other one is dropped only after you choose; closing this
        keeps both for later.
      </p>
      <div className={styles.versions}>
        <Surface padding="sm" className={styles.version}>
          <p className={styles.versionTitle}>On this device</p>
          <p className={styles.meta}>Edited {when(local.updated_at)}</p>
          <pre className={styles.body}>{describe(local)}</pre>
          <Button
            variant="primary"
            size="sm"
            loading={busy === 'local'}
            onClick={() => void choose('local')}
          >
            Keep this device&apos;s version
          </Button>
        </Surface>
        <Surface padding="sm" className={styles.version}>
          <p className={styles.versionTitle}>On another device</p>
          <p className={styles.meta}>Edited {when(server.updated_at)}</p>
          <pre className={styles.body}>{describe(server)}</pre>
          <Button size="sm" loading={busy === 'server'} onClick={() => void choose('server')}>
            Keep the other version
          </Button>
        </Surface>
      </div>
    </Sheet>
  );
}
