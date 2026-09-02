import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { freshDatabase } from './db.test';
import { enqueueOperation, takeOperations } from './syncQueue';
import { SYNC_STATUS_LABELS, deriveSyncStatus, useSyncStatus } from './syncStatus';

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => value });
  window.dispatchEvent(new Event(value ? 'online' : 'offline'));
}

afterEach(() => setOnline(true));

describe('sync status', () => {
  it('derives the indicator state from connectivity, the queue and the last sync', () => {
    const base = { online: true, pending: 0, inFlight: 0, lastSyncedAt: null };
    expect(deriveSyncStatus({ ...base, online: false })).toBe('offline');
    expect(deriveSyncStatus({ ...base, inFlight: 1 })).toBe('syncing');
    expect(deriveSyncStatus({ ...base, pending: 2 })).toBe('saved-locally');
    expect(deriveSyncStatus(base)).toBe('saved-locally');
    expect(deriveSyncStatus({ ...base, lastSyncedAt: '2026-09-02T00:00:00.000Z' })).toBe('synced');
    expect(SYNC_STATUS_LABELS['saved-locally']).toBe('Saved on this device');
  });

  it('follows the queue and connectivity live', async () => {
    const database = freshDatabase();
    const { result } = renderHook(() => useSyncStatus(database));
    expect(result.current.label).toBe('Saved on this device');

    await act(async () => {
      await enqueueOperation(
        { entity: 'notes', entity_id: 'n1', op: 'upsert', revision: 1, payload: {} },
        database,
      );
    });
    await waitFor(() => expect(result.current.pending).toBe(1));
    expect(result.current.status).toBe('saved-locally');

    await act(async () => {
      await takeOperations(1, database);
    });
    await waitFor(() => expect(result.current.status).toBe('syncing'));

    act(() => setOnline(false));
    expect(result.current.status).toBe('offline');
    expect(result.current.label).toBe('Offline · saved on this device');

    act(() => setOnline(true));
    await act(async () => {
      await database.sync_queue.clear();
      await database.sync_state.put({
        entity: 'notes',
        last_synced_at: '2026-09-02T00:00:00.000Z',
        server_cursor: null,
      });
    });
    await waitFor(() => expect(result.current.status).toBe('synced'));
    expect(result.current.label).toBe('Synced');
  });
});
