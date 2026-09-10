import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BloomlabDatabase } from '../data/db';
import { blankWorkflow } from './commands';
import { edit, startHistory, undo } from './draft';
import { useDraftCheckpoint, workflowDraftKey } from './useDraftCheckpoint';

let database: BloomlabDatabase;
const key = workflowDraftKey('run', 'generation', 'workflow');
const initial = startHistory(blankWorkflow('workflow', 'Original'));
const changed = edit(initial, { ...initial.present, name: 'Offline edit' });

beforeEach(() => {
  database = new BloomlabDatabase(`draft-${crypto.randomUUID()}`);
});
afterEach(async () => {
  vi.restoreAllMocks();
  await database.delete();
});

describe('local-only Workflow checkpoints (DATA-001, SYNC-007)', () => {
  it('recovers an unsaved draft and undo history after remount, without events or sync', async () => {
    const view = renderHook(() => useDraftCheckpoint(key, database));
    await waitFor(() => expect(view.result.current.ready).toBe(true));
    act(() => view.result.current.persist({ key, version: 1, history: changed }));
    await waitFor(async () => expect(await database.workspace.count()).toBe(1));
    view.unmount();
    const resumed = renderHook(() => useDraftCheckpoint(key, database));
    await waitFor(() => expect(resumed.result.current.ready).toBe(true));
    expect(resumed.result.current.checkpoint?.history).toEqual(changed);
    expect(undo(resumed.result.current.checkpoint!.history).present).toEqual(initial.present);
    expect(await database.sync_queue.count()).toBe(0);
    expect(await database.sim_events.count()).toBe(0);
  });

  it('isolates run, reset generation and workflow; rapid writes preserve the last edit', async () => {
    const view = renderHook(({ id }) => useDraftCheckpoint(id, database), {
      initialProps: { id: key },
    });
    await waitFor(() => expect(view.result.current.ready).toBe(true));
    act(() => {
      view.result.current.persist({ key, version: 1, history: initial });
      view.result.current.persist({ key, version: 1, history: changed });
    });
    await waitFor(async () =>
      expect((await database.workspace.get(key))?.value).toMatchObject({ history: changed }),
    );
    for (const id of [
      workflowDraftKey('other', 'generation', 'workflow'),
      workflowDraftKey('run', 'reset', 'workflow'),
      workflowDraftKey('run', 'generation', 'other'),
    ]) {
      view.rerender({ id });
      await waitFor(() => expect(view.result.current.ready).toBe(true));
      expect(view.result.current.checkpoint).toBeNull();
    }
  });

  it('keeps failed writes in memory, reports the failure and retries locally', async () => {
    const view = renderHook(() => useDraftCheckpoint(key, database));
    await waitFor(() => expect(view.result.current.ready).toBe(true));
    vi.spyOn(database.workspace, 'put').mockRejectedValueOnce(new Error('QuotaExceededError'));
    act(() => view.result.current.persist({ key, version: 1, history: changed }));
    await waitFor(() => expect(view.result.current.writeError).toBe(true));
    expect(view.result.current.checkpoint?.history).toEqual(changed);
    act(() => view.result.current.retryWrite());
    await waitFor(async () =>
      expect((await database.workspace.get(key))?.value).toMatchObject({ history: changed }),
    );
    expect(view.result.current.writeError).toBe(false);
  });

  it('does not replace an unreadable draft with a blank edit and allows retry', async () => {
    vi.spyOn(database.workspace, 'get').mockRejectedValueOnce(new Error('Read failed'));
    const view = renderHook(() => useDraftCheckpoint(key, database));
    await waitFor(() => expect(view.result.current.readError).toBe(true));
    expect(view.result.current.ready).toBe(false);
    expect(await database.workspace.count()).toBe(0);
    act(() => view.result.current.retryRead());
    await waitFor(() => expect(view.result.current.ready).toBe(true));
  });
});
