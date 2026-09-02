import { useLiveQuery } from 'dexie-react-hooks';
import { useSyncExternalStore } from 'react';

import { db, type BloomlabDatabase } from './db';

/**
 * What the small indicator says (spec §86 / TA§8): work is always saved on this device first;
 * "Synced" appears only after a sync round trip. Phase 3 has no transport, so the status stays
 * at "Saved on this device" (or "Offline") until Phase 4 drains the queue.
 */
export type SyncStatus = 'offline' | 'saved-locally' | 'syncing' | 'synced';

export const SYNC_STATUS_LABELS: Readonly<Record<SyncStatus, string>> = {
  offline: 'Offline · saved on this device',
  'saved-locally': 'Saved on this device',
  syncing: 'Syncing…',
  synced: 'Synced',
};

export interface SyncSignals {
  online: boolean;
  pending: number;
  inFlight: number;
  lastSyncedAt: string | null;
}

export function deriveSyncStatus({
  online,
  pending,
  inFlight,
  lastSyncedAt,
}: SyncSignals): SyncStatus {
  if (!online) return 'offline';
  if (inFlight > 0) return 'syncing';
  if (pending > 0 || !lastSyncedAt) return 'saved-locally';
  return 'synced';
}

const subscribeOnline = (notify: () => void) => {
  window.addEventListener('online', notify);
  window.addEventListener('offline', notify);
  return () => {
    window.removeEventListener('online', notify);
    window.removeEventListener('offline', notify);
  };
};
const readOnline = () => navigator.onLine;

export function useOnline(): boolean {
  return useSyncExternalStore(subscribeOnline, readOnline, () => true);
}

export interface SyncStatusView {
  status: SyncStatus;
  label: string;
  pending: number;
}

export function useSyncStatus(database: BloomlabDatabase = db): SyncStatusView {
  const online = useOnline();
  const signals = useLiveQuery(
    async () => {
      const rows = await database.sync_queue.toArray();
      const states = await database.sync_state.toArray();
      const lastSyncedAt = states
        .map((state) => state.last_synced_at)
        .filter((value): value is string => value !== null)
        .sort()
        .at(-1);
      return {
        pending: rows.filter((row) => row.status !== 'syncing').length,
        inFlight: rows.filter((row) => row.status === 'syncing').length,
        lastSyncedAt: lastSyncedAt ?? null,
      };
    },
    [database],
    { pending: 0, inFlight: 0, lastSyncedAt: null },
  );
  const status = deriveSyncStatus({ online, ...signals });
  return { status, label: SYNC_STATUS_LABELS[status], pending: signals.pending };
}
