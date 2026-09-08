import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Exercise } from '@bloomlab/content-schema';
import type { CallSnapshot } from '@bloomlab/shared';
import { content } from '../content/bundle';
import { db } from '../data/db';
import { ensureDevice } from '../data/device';
import {
  emptyCallResponse,
  loadAttempt,
  NORMAL_RUN,
  saveCall,
  startAttempt,
} from '../exercise/attempt';
import CallRoom from './CallRoom';
import { captureAudio } from './recording';

vi.mock('./recording', () => ({
  recordingMime: () => 'audio/webm;codecs=opus',
  captureAudio: vi.fn(),
}));
const cold = content.exercises.find((e) => e.call?.mode === 'cold_call')!;
function initial(exercise: Exercise, attemptId: string): CallSnapshot {
  const node = exercise.conversation!.nodes.find((n) => n.id === exercise.conversation!.opening)!;
  return {
    attempt_id: attemptId,
    exercise_id: exercise.id,
    content_version: content.content_version,
    turn: 0,
    current: { node: node.id, text: node.client_message, dynamic: false },
    turns: [],
    complete: false,
    projection: {
      turns: 0,
      complete: false,
      diagnosis_agreed: false,
      pitched_before_diagnosis: false,
      next_step_agreed: false,
      talk_ratio_learner: null,
      economically_sound: true,
      structurally_sound: true,
    },
  };
}
beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
  const device = await ensureDevice();
  await db.device.update(device.device_id, { session_token: 'test-token' });
  vi.mocked(captureAudio).mockReset();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
async function open(exercise = cold, review = false) {
  let attempt = await startAttempt(exercise);
  let snapshot = initial(exercise, attempt.attempt_id);
  const id = crypto.randomUUID();
  let original = 'Could I ask about your coat follow-up?';
  let confirmed: string | null = null;
  if (review) {
    await saveCall(exercise.id, NORMAL_RUN, attempt.attempt_id, {
      ...emptyCallResponse(),
      snapshot,
      phase: 'transcript_review',
      recording_id: id,
      transcript_draft: original,
    });
    attempt = (await loadAttempt(exercise.id))!;
  }
  const network = vi.fn(async (path: string, init?: RequestInit) => {
    if (path.endsWith('/config')) return Response.json({ enabled: true });
    if (path.endsWith('/audio'))
      return Response.json({ error: 'audio_unavailable' }, { status: 404 });
    if (path.endsWith('/transcribe')) {
      original = 'Could I ask about your quote follow-up?';
      return Response.json({ recording_id: id, original_transcript: original });
    }
    if (path.endsWith('/turn')) {
      const input = JSON.parse(String(init?.body)) as { transcript: string; move: string };
      confirmed = input.transcript;
      const current = {
        node: 'problem',
        text:
          exercise.conversation!.nodes.find((n) => n.id === 'problem')?.client_message ??
          'Tell me more.',
        dynamic: false,
      };
      snapshot = {
        ...snapshot,
        turn: 1,
        current,
        turns: [
          {
            turn: 0,
            recording_id: id,
            original_transcript: original,
            confirmed_transcript: confirmed,
            client: snapshot.current,
            response: current,
            move: input.move,
            interpretation: 'explicit',
          },
        ],
      };
      return Response.json(snapshot);
    }
    if (path.endsWith('/recordings')) return Response.json([]);
    if (path.includes(`/recordings/${id}`))
      return Response.json({
        recording_id: id,
        original_transcript: original,
        confirmed_transcript: confirmed,
      });
    if (path.includes('/attempts')) return Response.json(snapshot);
    throw new Error(`Unexpected path ${path}`);
  });
  vi.stubGlobal('fetch', network);
  const view = render(
    <CallRoom
      exercise={exercise}
      attempt={attempt}
      context={NORMAL_RUN}
      onSubmit={vi.fn()}
      submitting={false}
      submissionError={null}
    />,
  );
  await waitFor(() => expect(network).toHaveBeenCalled());
  return { ...view, attempt, network, id };
}
describe('CALL-001/004/006 call work area', () => {
  it('starts a new attempt empty even when an older call result is available', async () => {
    const attempt = await startAttempt(cold);
    const historical = {
      ...emptyCallResponse(),
      phase: 'complete' as const,
      notes: 'Historical notes',
      snapshot: { ...initial(cold, crypto.randomUUID()), complete: true },
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ enabled: true })));
    render(
      <CallRoom
        exercise={cold}
        attempt={attempt}
        context={NORMAL_RUN}
        saved={historical}
        onSubmit={vi.fn()}
        submitting={false}
        submissionError={null}
      />,
    );
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start call' })).toBeEnabled());
    expect(screen.queryByText('Call complete')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open notes' }));
    expect(screen.getByLabelText('Call notes')).toHaveValue('');
  });
  it('shows identity, company, objective, audio state, elapsed time and notes without requesting microphone permission', async () => {
    const a = await open();
    expect(screen.getByRole('heading', { name: 'Gary Lindqvist' })).toBeInTheDocument();
    expect(screen.getByText(/Northwind Heating & Air/)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Call objective' })).toBeInTheDocument();
    expect(screen.getByText('Ready to start')).toBeInTheDocument();
    expect(screen.getByLabelText('Elapsed call time')).toHaveTextContent('00:00');
    fireEvent.click(screen.getByRole('button', { name: 'Open notes' }));
    fireEvent.change(screen.getByLabelText('Call notes'), {
      target: { value: 'Ask about Tina’s ownership.' },
    });
    await waitFor(async () =>
      expect((await loadAttempt(cold.id))?.response.call?.notes).toBe(
        'Ask about Tina’s ownership.',
      ),
    );
    expect(captureAudio).not.toHaveBeenCalled();
    expect(a.network.mock.calls.every(([path]) => path.startsWith('/api/call/'))).toBe(true);
  });
  it.each(['independent', 'pressure'] as const)(
    'removes anchors from the DOM in %s mode even if stale saved content supplies them',
    async (mode) => {
      await open({ ...cold, mode });
      expect(screen.queryByTestId('call-anchors')).not.toBeInTheDocument();
      expect(document.body.textContent).not.toContain('Permission and relevance');
    },
  );
  it('offers guided anchors, continues from a failed client voice and handles microphone denial after an intentional action', async () => {
    await open();
    expect(screen.getByTestId('call-anchors')).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: 'Start call' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Continue with client text' })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Continue with client text' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Record reply' })).toBeEnabled());
    expect(captureAudio).not.toHaveBeenCalled();
    vi.mocked(captureAudio).mockRejectedValue(new Error('Microphone permission was not granted.'));
    fireEvent.click(screen.getByRole('button', { name: 'Record reply' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Microphone permission was not granted',
    );
    expect(captureAudio).toHaveBeenCalledTimes(1);
    expect(await db.call_recordings.count()).toBe(0);
  });
  it('reviews original STT, grades the corrected confirmation and keeps notes through the queued turn save', async () => {
    const a = await open(cold, true);
    await waitFor(() =>
      expect(screen.getByLabelText('Transcript to confirm')).toHaveValue(
        'Could I ask about your coat follow-up?',
      ),
    );
    fireEvent.change(screen.getByLabelText('Transcript to confirm'), {
      target: { value: 'Could I ask about your quote follow-up?' },
    });
    fireEvent.change(screen.getByLabelText('My intended move (optional)'), {
      target: { value: 'permission' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Open notes' }));
    fireEvent.change(screen.getByLabelText('Call notes'), {
      target: { value: 'Keep this private note.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm transcript and continue' }));
    await screen.findByRole('button', { name: 'Continue with client text' });
    const held = (await loadAttempt(cold.id))!.response.call!;
    expect(held.snapshot?.turns[0]?.confirmed_transcript).toBe(
      'Could I ask about your quote follow-up?',
    );
    expect(held.snapshot?.turns[0]?.original_transcript).toBe(
      'Could I ask about your coat follow-up?',
    );
    expect(held.notes).toBe('Keep this private note.');
    const sent = a.network.mock.calls.find(([path]) => path.endsWith('/turn'))![1];
    expect(String(sent?.body)).not.toContain('private note');
    expect(captureAudio).not.toHaveBeenCalled();
  });
});
