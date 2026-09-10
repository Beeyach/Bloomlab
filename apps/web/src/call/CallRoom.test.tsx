import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { Blob as NodeBlob } from 'node:buffer';
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
import type { CapturedAudio } from './recording';
import * as localAudio from './local';
import { updates } from '../pwa/updates';
import { UpdateNotice } from '../pwa/UpdateNotice';
import { gradeAttempt } from '../exercise/finalize';

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
async function open(
  exercise = cold,
  review: boolean | 'locally_saved' | 'complete' = false,
  configure: (snapshot: CallSnapshot) => CallSnapshot = (snapshot) => snapshot,
  restoredRecording?: Promise<Response>,
) {
  let attempt = await startAttempt(exercise);
  let snapshot = configure(initial(exercise, attempt.attempt_id));
  const id = crypto.randomUUID();
  let original = 'Could I ask about your coat follow-up?';
  let confirmed: string | null = null;
  if (review) {
    await saveCall(exercise.id, NORMAL_RUN, attempt.attempt_id, {
      ...emptyCallResponse(),
      snapshot,
      phase: typeof review === 'string' ? review : 'transcript_review',
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
      return (
        restoredRecording ??
        Response.json({
          recording_id: id,
          original_transcript: original,
          confirmed_transcript: confirmed,
        })
      );
    if (path.includes('/attempts')) return Response.json(snapshot);
    throw new Error(`Unexpected path ${path}`);
  });
  vi.stubGlobal('fetch', network);
  const props = {
    exercise,
    attempt,
    context: NORMAL_RUN,
    onSubmit: vi.fn(),
    submitting: false,
    submissionError: null,
  };
  const view = render(<CallRoom {...props} />);
  await waitFor(() => expect(network).toHaveBeenCalled());
  return { ...view, attempt, network, id, props };
}
function deferred() {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function expectProgress(label: string) {
  const button = screen.getByRole('button', { name: label });
  expect(button).toBeDisabled();
  expect(button).toHaveAttribute('aria-busy', 'true');
  expect(button.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  expect(screen.getAllByRole('status').some((status) => status.textContent === label)).toBe(true);
  expect(updates.snapshot().blocked).toBeGreaterThan(0);
  return button;
}
function fallback(snapshot: CallSnapshot): CallSnapshot {
  const node = cold.conversation!.nodes.find((n) => n.id === cold.conversation!.opening)!;
  const next = cold.conversation!.nodes.find((n) => n.id === node.fallback)!;
  const response = { node: next.id, text: next.client_message, dynamic: false };
  return {
    ...snapshot,
    turn: 1,
    current: response,
    turns: [
      {
        turn: 0,
        recording_id: crypto.randomUUID(),
        original_transcript: 'Unrelated fictional sentence.',
        confirmed_transcript: 'Unrelated fictional sentence.',
        client: snapshot.current,
        response,
        move: null,
        interpretation: 'fallback',
      },
    ],
  };
}
describe('CALL-001/004/006 call work area', () => {
  it('announces updates during recording and pending Blob storage, then offers reload at the saved checkpoint', async () => {
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Start call' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Continue with client text' })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Continue with client text' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Record reply' })).toBeEnabled());
    let finish!: (audio: CapturedAudio) => void;
    const finished = new Promise<CapturedAudio>((resolve) => {
      finish = resolve;
    });
    vi.mocked(captureAudio).mockResolvedValue({ stop: vi.fn(), finished });
    let save!: () => void;
    const gate = new Promise<void>((resolve) => {
      save = resolve;
    });
    const original = localAudio.storeLocalRecording;
    const held = vi.spyOn(localAudio, 'storeLocalRecording').mockImplementation(async (...args) => {
      await gate;
      return original(...args);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Record reply' }));
    await screen.findByRole('button', { name: 'Stop recording' });
    act(() => updates.available());
    render(<UpdateNotice />);
    expect(screen.getByRole('region', { name: 'App update' })).toHaveTextContent(
      'Finish the current call step',
    );
    expect(screen.getByRole('button', { name: 'Reload to update' })).toBeDisabled();
    await act(async () =>
      finish({
        blob: new NodeBlob(['audio']) as Blob,
        mime_type: 'audio/mp4',
        duration_ms: 1000,
        stop_reason: 'manual',
      }),
    );
    expect(screen.getByRole('button', { name: 'Reload to update' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Start fresh call' })).toBeDisabled();
    await act(async () => save());
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Transcribe recording' })).toBeEnabled(),
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Reload to update' })).toBeEnabled(),
    );
    expect(await db.call_recordings.count()).toBe(1);
    held.mockRestore();
  });
  it('requires explicit retained-audio deletion consent and exposes cleanup failure/retry in the restart dialog', async () => {
    const a = await open(cold, true);
    const original = a.network.getMockImplementation()!;
    const deleting = deferred();
    a.network.mockImplementation((path, init) =>
      init?.method === 'DELETE' ? deleting.promise : original(path, init),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Start fresh call' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('including recordings you chose to keep');
    expect(a.network.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Keep this call' }));
    expect((await loadAttempt(cold.id))?.attempt_id).toBe(a.attempt.attempt_id);
    fireEvent.click(screen.getByRole('button', { name: 'Start fresh call' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete recordings and start fresh' }));
    expectProgress('Deleting audio and starting fresh…');
    await act(async () =>
      deleting.resolve(Response.json({ error: 'unavailable' }, { status: 503 })),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('Audio cleanup did not finish');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Retry deletion and start fresh' })).toBeEnabled(),
    );
    expect((await loadAttempt(cold.id))?.attempt_id).toBe(a.attempt.attempt_id);
    a.network.mockImplementation(original);
    fireEvent.click(screen.getByRole('button', { name: 'Retry deletion and start fresh' }));
    await waitFor(async () =>
      expect((await loadAttempt(cold.id))?.attempt_id).not.toBe(a.attempt.attempt_id),
    );
    expect(await db.exercise_attempts.count()).toBe(0);
    expect(await db.skill_evidence.count()).toBe(0);
  });
  it('announces initial feedback and retry immediately and prevents duplicate submission until completion', async () => {
    const a = await open(cold, 'complete', (snapshot) => ({ ...snapshot, complete: true }));
    a.unmount();
    let gate = deferred();
    const request = vi.fn(() => gate.promise);
    function SubmissionOwner() {
      const [attempt, setAttempt] = useState(a.attempt);
      const [submitting, setSubmitting] = useState(false);
      const [failure, setFailure] = useState<string | null>(null);
      const [complete, setComplete] = useState(false);
      return (
        <CallRoom
          {...a.props}
          attempt={complete ? null : attempt}
          submitting={submitting}
          submissionError={failure}
          onSubmit={() => {
            setSubmitting(true);
            setAttempt({
              ...a.attempt,
              submitted: { report: gradeAttempt(cold, a.attempt), rubric_id: cold.grading.rubric! },
            });
            void request().then((response) => {
              setFailure(response.ok ? null : 'Feedback unavailable. Your call is saved.');
              setComplete(response.ok);
              setSubmitting(false);
            });
          }}
        >
          {complete && <p>Saved feedback result</p>}
        </CallRoom>
      );
    }
    render(<SubmissionOwner />);
    fireEvent.click(screen.getByRole('button', { name: 'Get call feedback' }));
    fireEvent.click(expectProgress('Getting feedback…'));
    expect(request).toHaveBeenCalledTimes(1);
    await act(async () => gate.resolve(new Response(null, { status: 503 })));
    expect(screen.getByRole('alert')).toHaveTextContent('Your call is saved');
    expect(screen.getByRole('button', { name: 'Retry call feedback' })).toBeEnabled();
    gate = deferred();
    fireEvent.click(screen.getByRole('button', { name: 'Retry call feedback' }));
    fireEvent.click(expectProgress('Getting feedback…'));
    expect(request).toHaveBeenCalledTimes(2);
    await act(async () => gate.resolve(new Response(null, { status: 200 })));
    expect(screen.getByText('Saved feedback result')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Getting feedback…' })).not.toBeInTheDocument();
  });
  it('shows immediate upload/transcription progress, blocks duplicates and recovers the saved audio after failure', async () => {
    const a = await open(cold, 'locally_saved');
    const device = await ensureDevice();
    await db.call_recordings.put({
      recording_id: a.id,
      learner_id: device.learner_id,
      device_id: device.device_id,
      attempt_id: a.attempt.attempt_id,
      exercise_id: cold.id,
      turn: 0,
      mime_type: 'audio/webm;codecs=opus',
      byte_length: 1,
      duration_ms: 1000,
      checksum: 'fixture',
      created_at: new Date().toISOString(),
      uploaded: false,
      retain: false,
      blob: new Blob(['a']),
    });
    const original = a.network.getMockImplementation()!;
    const upload = deferred(),
      stt = deferred();
    a.network.mockImplementation((path, init) =>
      init?.method === 'PUT'
        ? upload.promise
        : path.endsWith('/transcribe')
          ? stt.promise
          : original(path, init),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Transcribe recording' }));
    fireEvent.click(expectProgress('Transcribing…'));
    await waitFor(() =>
      expect(a.network.mock.calls.filter(([, init]) => init?.method === 'PUT')).toHaveLength(1),
    );
    expect(a.network.mock.calls.filter(([path]) => path.endsWith('/transcribe'))).toHaveLength(0);
    await act(async () => upload.resolve(Response.json({ recording_id: a.id })));
    await waitFor(() =>
      expect(a.network.mock.calls.filter(([path]) => path.endsWith('/transcribe'))).toHaveLength(1),
    );
    expectProgress('Transcribing…');
    await act(async () => stt.resolve(Response.json({ error: 'speech_timeout' }, { status: 503 })));
    expect(await screen.findByRole('alert')).toHaveTextContent('Transcription timed out');
    expect(await db.call_recordings.get(a.id)).toMatchObject({ uploaded: true });
    a.network.mockImplementation(original);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Retry transcription' })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Retry transcription' }));
    expectProgress('Transcribing…');
    await waitFor(() => expect(screen.getByLabelText('Transcript to confirm')).toBeEnabled());
    expect(a.network.mock.calls.filter(([, init]) => init?.method === 'PUT')).toHaveLength(1);
  });
  it('keeps confirmation and its exact retry through a late restore, error and saving the turn', async () => {
    const restore = deferred();
    const a = await open(cold, true, (snapshot) => snapshot, restore.promise);
    await waitFor(() =>
      expect(a.network.mock.calls.some(([path]) => path.endsWith(`/recordings/${a.id}`))).toBe(
        true,
      ),
    );
    const original = a.network.getMockImplementation()!;
    const first = deferred(),
      cleanupGate = deferred();
    a.network.mockImplementation((path, init) =>
      path.endsWith('/turn') ? first.promise : original(path, init),
    );
    const button = screen.getByRole('button', { name: 'Confirm transcript and continue' });
    fireEvent.click(button);
    expect(expectProgress('Evaluating…')).toBe(button);
    fireEvent.click(button);
    await waitFor(() =>
      expect(a.network.mock.calls.filter(([path]) => path.endsWith('/turn'))).toHaveLength(1),
    );
    expect(screen.getByLabelText('Transcript to confirm')).toHaveValue(
      'Could I ask about your coat follow-up?',
    );
    await act(async () =>
      restore.resolve(
        Response.json({ recording_id: a.id, original_transcript: 'Older saved transcription.' }),
      ),
    );
    expect(expectProgress('Evaluating…')).toBe(button);
    expect(screen.getByLabelText('Transcript to confirm')).toHaveValue(
      'Could I ask about your coat follow-up?',
    );
    await act(async () =>
      first.resolve(Response.json({ error: 'turn_in_progress' }, { status: 409 })),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('still being resolved');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Retry confirmed turn' })).toBeEnabled(),
    );
    a.network.mockImplementation((path, init) =>
      path.endsWith('/recordings') ? cleanupGate.promise : original(path, init),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Retry confirmed turn' }));
    expectProgress('Evaluating…');
    await waitFor(() => expectProgress('Saving turn…'));
    expect(screen.getByLabelText('Transcript to confirm')).toHaveValue(
      'Could I ask about your coat follow-up?',
    );
    await act(async () => cleanupGate.resolve(Response.json([])));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Continue with client text' })).toBeEnabled(),
    );
    expect(screen.queryByRole('button', { name: 'Saving turn…' })).not.toBeInTheDocument();
    const submissions = a.network.mock.calls.filter(([path]) => path.endsWith('/turn'));
    expect(submissions).toHaveLength(2);
    expect(submissions[0]![1]?.body).toBe(submissions[1]![1]?.body);
  });
  it.each(['guided', 'practice'] as const)(
    'shows current authored recovery guidance after fallback in %s mode, including loops',
    async (mode) => {
      const a = await open({ ...cold, mode }, true, fallback);
      expect(screen.getByTestId('call-recovery')).toHaveTextContent(
        'Ask about the current follow-up',
      );
      expect(screen.getByTestId('call-recovery')).not.toHaveTextContent('Tina emails');
      a.unmount();
      await open({ ...cold, mode }, true, (snapshot) => {
        const result = fallback(snapshot);
        result.turns[0]!.client = result.current;
        return result;
      });
      expect(screen.getByTestId('call-recovery')).toBeInTheDocument();
    },
  );
  it.each(['independent', 'pressure'] as const)(
    'never mounts recovery coaching for a fallback in %s mode',
    async (mode) => {
      await open({ ...cold, mode }, true, fallback);
      expect(screen.queryByTestId('call-recovery')).not.toBeInTheDocument();
      expect(screen.queryByTestId('call-anchors')).not.toBeInTheDocument();
      expect(document.body.textContent).not.toContain('The call needs clarification');
    },
  );
  it('does not coach an intended-path response or a call at its turn limit', async () => {
    const a = await open(cold, true);
    expect(screen.queryByTestId('call-recovery')).not.toBeInTheDocument();
    a.unmount();
    await open(cold, 'complete', (snapshot) => ({
      ...fallback(snapshot),
      complete: true,
      turn: cold.call!.max_turns,
    }));
    expect(screen.queryByTestId('call-recovery')).not.toBeInTheDocument();
  });
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
