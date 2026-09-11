import { liveQuery } from 'dexie';

import { db, type BloomlabDatabase } from '../db';
import { syncApi, type SyncApi } from './api';
import { syncNow, type SyncRunResult } from './engine';

const DEBOUNCE_MS = 1500;
const INTERVAL_MS = 60_000;

export interface SyncSchedulerOptions {
  /** Runs after every completed sync round trip (e.g. recompute derived progress from pulled evidence). */
  afterSync?: (result: SyncRunResult) => void;
}

/**
 * Quiet background sync (spec §86, SYNC-010): on start, when the connection returns, shortly
 * after a local write lands in the outbox, when the tab becomes visible, and once a minute
 * while it stays visible. Nothing here blocks interaction; failures only show in the
 * indicator and diagnostics.
 */
export function startSyncScheduler(
  database: BloomlabDatabase = db,
  api: SyncApi = syncApi,
  options: SyncSchedulerOptions = {},
): () => void {
  let debounce: ReturnType<typeof setTimeout> | null = null;
  const kick = () => void syncNow(database, api).then((result) => options.afterSync?.(result));
  const soon = () => {
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(kick, DEBOUNCE_MS);
  };
  const onVisible = () => {
    if (document.visibilityState === 'visible' && navigator.onLine) kick();
  };

  const pending = liveQuery(() =>
    database.sync_queue.where('status').equals('pending').count(),
  ).subscribe({ next: (count) => count > 0 && navigator.onLine && soon() });
  const interval = setInterval(onVisible, INTERVAL_MS);
  window.addEventListener('online', kick);
  document.addEventListener('visibilitychange', onVisible);
  kick();

  return () => {
    pending.unsubscribe();
    clearInterval(interval);
    window.removeEventListener('online', kick);
    document.removeEventListener('visibilitychange', onVisible);
    if (debounce) clearTimeout(debounce);
  };
}
