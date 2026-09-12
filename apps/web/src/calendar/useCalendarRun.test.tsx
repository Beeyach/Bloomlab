import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { db } from '../data/db';
import { loadRun } from '../simulator/store';
import * as commands from './commands';
import { useCalendarRun } from './useCalendarRun';

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
});
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(db.tables.map((table) => table.clear()));
});

it('keeps account mutations out of an unfinished reset and resumes on its committed generation', async () => {
  const view = renderHook(() => useCalendarRun());
  await waitFor(() => expect(view.result.current.run).not.toBeNull());
  const before = view.result.current.run!;
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const reset = commands.resetCalendarRun;
  vi.spyOn(commands, 'resetCalendarRun').mockImplementation(async (...args) => {
    await held;
    return reset(...args);
  });
  let pending!: Promise<void>;
  act(() => {
    pending = view.result.current.reset();
  });
  try {
    await waitFor(() => expect(view.result.current.busy).toBe(true));
    const overlappingMutation = vi.fn(async () => {
      throw new Error('Mutation reached the old generation');
    });
    await act(async () => {
      expect(await view.result.current.perform(overlappingMutation)).toBeNull();
    });
    expect(overlappingMutation).not.toHaveBeenCalled();
    expect((await loadRun(before.state.run_id))?.generation).toBe(before.generation);
    await act(async () => {
      release();
      await pending;
    });
    expect(view.result.current.busy).toBe(false);
    expect(view.result.current.run?.generation).not.toBe(before.generation);
    expect((await loadRun(before.state.run_id))?.generation).toBe(
      view.result.current.run?.generation,
    );
  } finally {
    await act(async () => {
      release();
      await pending;
    });
    view.unmount();
  }
});
