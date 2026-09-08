import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { CallRecording } from '@bloomlab/shared';
import { db } from '../data/db';
import { ensureDevice } from '../data/device';
import { Recordings } from './Recordings';

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
  const device = await ensureDevice();
  await db.device.update(device.device_id, { session_token: 'test-token' });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('shows the active recording operation, prevents duplicate requests and restores deletion after failure', async () => {
  const row: CallRecording = {
    recording_id: 'recording',
    attempt_id: 'attempt',
    exercise_id: 'exercise',
    turn: 0,
    mime_type: 'audio/webm;codecs=opus',
    byte_length: 1,
    duration_ms: 1000,
    checksum: 'fixture',
    retain: true,
    status: 'confirmed',
    created_at: new Date().toISOString(),
    original_transcript: 'Fictional speech',
    confirmed_transcript: 'Fictional speech',
    deleted_at: null,
  };
  let release!: (response: Response) => void;
  let pending = new Promise<Response>((resolve) => {
    release = resolve;
  });
  const network = vi.fn(async (path: string) =>
    path.endsWith('/recordings') ? Response.json([row]) : pending,
  );
  vi.stubGlobal('fetch', network);
  render(<Recordings attemptId="attempt" revision="1" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Replay recording' }));
  const loading = screen.getByRole('button', { name: 'Loading recording…' });
  expect(loading).toBeDisabled();
  expect(loading).toHaveAttribute('aria-busy', 'true');
  fireEvent.click(loading);
  await waitFor(() =>
    expect(network.mock.calls.filter(([path]) => path.endsWith('/audio'))).toHaveLength(1),
  );
  await act(async () => release(Response.json({ error: 'audio_unavailable' }, { status: 503 })));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Replay recording' })).toBeEnabled(),
  );
  pending = new Promise<Response>((resolve) => {
    release = resolve;
  });
  fireEvent.click(screen.getByRole('button', { name: 'Delete audio' }));
  const deleting = screen.getByRole('button', { name: 'Deleting audio…' });
  expect(deleting).toBeDisabled();
  expect(
    screen.getAllByRole('status').some((status) => status.textContent === 'Deleting audio…'),
  ).toBe(true);
  fireEvent.click(deleting);
  await act(async () => release(Response.json({ error: 'call_unavailable' }, { status: 503 })));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Delete audio' })).toBeEnabled());
  expect(screen.getByText(/Audio deletion did not finish/)).toBeInTheDocument();
  pending = new Promise<Response>((resolve) => {
    release = resolve;
  });
  fireEvent.click(screen.getByRole('button', { name: 'Delete audio' }));
  await act(async () =>
    release(Response.json({ ...row, status: 'deleted', deleted_at: new Date().toISOString() })),
  );
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: 'Deleting audio…' })).not.toBeInTheDocument(),
  );
  expect(screen.getByText(/Server audio deleted/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Replay recording' })).not.toBeInTheDocument();
  expect(network.mock.calls.filter(([path]) => path.endsWith('/recording'))).toHaveLength(2);
});
