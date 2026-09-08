import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { AiEvaluationRequest, AiMode } from '@bloomlab/shared';
import { db } from '../data/db';
import { ensureDevice } from '../data/device';
import { loadWorkspace, saveWorkspace } from '../data/workspace';
import AiSettingsScreen from '../screens/AiSettingsScreen';
import {
  classifyLanguage,
  evaluateSubmission,
  getAiSettings,
  selectAiOff,
  setAiSettings,
} from './client';

const settings = (mode: AiMode) => ({
  mode,
  monthly_limit_usd: 20,
  spent_usd: 0,
  reserved_usd: 0,
  categories: [],
});
const request = { attempt_id: 'fixture' } as AiEvaluationRequest;
const transport = vi.fn<typeof fetch>();
function deferred() {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  const device = await ensureDevice();
  await db.device.update(device.device_id, { session_token: 'fixture' });
  transport.mockReset().mockImplementation(async () => Response.json(settings('Limited')));
  vi.stubGlobal('fetch', transport);
  await getAiSettings(); // Reset transient protection via a successful canonical refresh.
  transport.mockClear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it.each(['Limited', 'Full'] as const)(
  'canonical %s replaces stale Off for UI, evaluation and classification',
  async (mode) => {
    await saveWorkspace('ai.mode', 'Off');
    transport.mockImplementation(async (url) =>
      Response.json(
        String(url).endsWith('settings')
          ? settings(mode)
          : { strategy: 'hold_price', confidence: 1, run_id: 'fixture' },
      ),
    );
    render(
      <MemoryRouter>
        <AiSettingsScreen />
      </MemoryRouter>,
    );
    // Limited is also the initial select value. Wait for the canonical response and
    // its persisted cache before asserting that stale Off has been reconciled.
    await screen.findByRole('heading', { name: /AI this month/ });
    await waitFor(() =>
      expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe(mode),
    );
    expect(await loadWorkspace('ai.mode')).toBe(mode);
    await expect(evaluateSubmission(request)).resolves.toHaveProperty('run_id', 'fixture');
    await expect(classifyLanguage('exercise', 'request', 'Hold price')).resolves.toHaveProperty(
      'confidence',
      1,
    );
    expect(transport.mock.calls.map(([url]) => url)).toEqual([
      '/api/ai/settings',
      '/api/ai/evaluate',
      '/api/ai/classify',
    ]);
  },
);
it('selecting Off in the UI suppresses requests before Save', async () => {
  render(
    <MemoryRouter>
      <AiSettingsScreen />
    </MemoryRouter>,
  );
  await screen.findByRole('heading', { name: /AI this month/ });
  transport.mockClear();
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Off' } });
  await expect(evaluateSubmission(request)).rejects.toThrow('Off');
  await expect(classifyLanguage('e', 'r', 'text')).resolves.toBeNull();
  expect(transport).not.toHaveBeenCalled();
  expect(await loadWorkspace('ai.mode')).toBe('Off');
});
it('Off is immediate during a write and survives network failure; a later canonical refresh reconciles it', async () => {
  const pending = deferred();
  transport.mockReturnValueOnce(pending.promise);
  const write = setAiSettings('Off', 20);
  const rejected = expect(write).rejects.toThrow();
  await expect(evaluateSubmission(request)).rejects.toThrow('Off');
  await waitFor(() => expect(transport).toHaveBeenCalledTimes(1));
  expect((await getAiSettings()).mode).toBe('Off');
  pending.resolve(Response.json({ error: 'offline' }, { status: 503 }));
  await rejected;
  await expect(evaluateSubmission(request)).rejects.toThrow('Off');
  expect((await getAiSettings()).mode).toBe('Limited');
  expect(await loadWorkspace('ai.mode')).toBe('Limited');
});
it('a refresh started before Off selection cannot re-enable AI or display Limited', async () => {
  const pending = deferred();
  transport.mockReturnValueOnce(pending.promise);
  const refresh = getAiSettings();
  await waitFor(() => expect(transport).toHaveBeenCalledTimes(1));
  await selectAiOff();
  pending.resolve(Response.json(settings('Limited')));
  expect((await refresh).mode).toBe('Off');
  await expect(evaluateSubmission(request)).rejects.toThrow('Off');
});
it('a read begun during an Off write stays Off even if its response arrives after the write', async () => {
  const writeResponse = deferred();
  const readResponse = deferred();
  transport.mockReturnValueOnce(writeResponse.promise).mockReturnValueOnce(readResponse.promise);
  const write = setAiSettings('Off', 20);
  await waitFor(() => expect(transport).toHaveBeenCalledTimes(1));
  const read = getAiSettings();
  await waitFor(() => expect(transport).toHaveBeenCalledTimes(2));
  writeResponse.resolve(Response.json(settings('Off')));
  await write;
  readResponse.resolve(Response.json(settings('Full')));
  expect((await read).mode).toBe('Off');
  expect(await loadWorkspace('ai.mode')).toBe('Off');
});
it('server Off refuses a stale Full client and canonical refresh updates the cache', async () => {
  await saveWorkspace('ai.mode', 'Full');
  transport.mockImplementation(async (url) =>
    String(url).endsWith('settings')
      ? Response.json(settings('Off'))
      : Response.json({ error: 'ai_off' }, { status: 403 }),
  );
  await expect(evaluateSubmission(request)).rejects.toThrow('AI Coaching is Off');
  await expect(classifyLanguage('e', 'r', 'text')).resolves.toBeNull();
  expect((await getAiSettings()).mode).toBe('Off');
  expect(await loadWorkspace('ai.mode')).toBe('Off');
});
