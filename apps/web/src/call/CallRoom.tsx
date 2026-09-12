import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Exercise } from '@bloomlab/content-schema';
import { Sheet } from '@bloomlab/design-system';
import {
  CALL_LIMITS,
  type CallPhase,
  type CallRecording,
  type CallResponse,
  type CallSnapshot,
} from '@bloomlab/shared';
import { content } from '../content/bundle';
import { db } from '../data/db';
import {
  emptyCallResponse,
  saveCall,
  type ActiveAttempt,
  type AttemptContext,
} from '../exercise/attempt';
import { callFetch, callRequest, startRemoteCall } from './client';
import { captureAudio, recordingMime, type Capture } from './recording';
import { localRecording, localRecordingsForAttempt, storeLocalRecording } from './local';
import { cleanConfirmedAudio, confirmTurn, transcribeSaved } from './pipeline';
import { NegotiationTerms } from './NegotiationTerms';
import { Recordings } from './Recordings';
import { CallAction } from './CallAction';
import { recoveryCue } from './recovery';
import { restartCall } from './restart';
import { updates } from '../pwa/updates';
import { useReloadBlock } from '../pwa/useReloadBlock';
import styles from './call.module.css';

const PHASE_LABEL: Record<CallPhase, string> = {
  ready: 'Ready to start',
  microphone_permission: 'Waiting for microphone permission',
  client_speaking: 'Client speaking',
  learner_ready: 'Your turn',
  recording: 'Recording your reply',
  locally_saved: 'Recording saved on this device',
  uploading: 'Saving recording to the server',
  transcribing: 'Transcribing your recording',
  transcript_review: 'Review your transcript',
  evaluating: 'Evaluating your confirmed turn',
  resolving: 'Saving the next turn',
  tts_loading: 'Loading client audio',
  text_fallback: 'Client audio unavailable — text is ready',
  complete: 'Call complete',
  recoverable_error: 'Your call needs attention',
};
const idlePhases: CallPhase[] = [
  'learner_ready',
  'locally_saved',
  'transcript_review',
  'recoverable_error',
];
export default function CallRoom({
  exercise,
  attempt,
  context,
  saved,
  savedAttemptId,
  children,
  onSubmit,
  submitting,
  submissionError,
}: {
  exercise: Exercise;
  attempt: ActiveAttempt | null;
  context: AttemptContext;
  saved?: CallResponse;
  savedAttemptId?: string;
  children?: ReactNode;
  onSubmit: () => void;
  submitting: boolean;
  submissionError: string | null;
}) {
  const [call, setCall] = useState<CallResponse>(() =>
    attempt ? (attempt.response.call ?? emptyCallResponse()) : (saved ?? emptyCallResponse()),
  );
  const live = useRef(call);
  const checkpointRevision = useRef(0);
  const mounted = useRef(true);
  const capture = useRef<Capture | null>(null);
  const playback = useRef<{ audio: HTMLAudioElement; url: string } | null>(null);
  const audioEpoch = useRef(0);
  const audioLoading = useRef<AbortController | null>(null);
  const afterAudio = useRef<CallPhase>('learner_ready');
  const operation = useRef(false);
  const [busy, setBusy] = useState(false);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [notesOpen, setNotesOpen] = useState(false);
  const [restartOpen, setRestartOpen] = useState(false);
  const [original, setOriginal] = useState('');
  const transcript = useRef<HTMLTextAreaElement>(null);
  const readOnly = !attempt || Boolean(attempt.submitted);
  useReloadBlock(
    busy ||
      submitting ||
      Boolean(call.pending_turn) ||
      [
        'microphone_permission',
        'recording',
        'uploading',
        'transcribing',
        'transcript_review',
        'evaluating',
        'resolving',
        'tts_loading',
      ].includes(call.phase),
  );
  const client = content.clients.find(
    (c) =>
      c.id === exercise.client ||
      c.id === content.scenarios.find((s) => s.id === exercise.scenario)?.client,
  )!;
  const snapshot = call.snapshot;
  const attemptId = attempt?.attempt_id ?? savedAttemptId;
  const clockRunning = Boolean(snapshot && !snapshot.complete && !readOnly);
  const { run, skill_id: skillId } = context;
  const supported = recordingMime(globalThis.MediaRecorder) !== null;
  function stopPlayback() {
    audioEpoch.current++;
    audioLoading.current?.abort();
    audioLoading.current = null;
    const held = playback.current;
    if (held) {
      held.audio.pause();
      held.audio.onended = null;
      URL.revokeObjectURL(held.url);
      playback.current = null;
    }
  }
  async function patch(patch: Partial<CallResponse>) {
    if (!attempt) return;
    checkpointRevision.current++;
    live.current = { ...live.current, ...patch };
    if (mounted.current) setCall(live.current);
    const release = updates.hold();
    try {
      await saveCall(exercise.id, context, attempt.attempt_id, patch);
    } finally {
      release();
    }
  }
  function failure(cause: unknown) {
    if (mounted.current)
      setError(
        cause instanceof Error
          ? cause.message
          : 'This step did not finish. Your saved work is still here.',
      );
  }
  async function perform(work: () => Promise<void>) {
    if (operation.current || updates.snapshot().applying) return;
    operation.current = true;
    const release = updates.hold();
    setBusy(true);
    setError('');
    try {
      await work();
    } catch (cause) {
      capture.current?.stop();
      failure(cause);
      if (attempt && !attempt.submitted) await patch({ phase: 'recoverable_error' }).catch(failure);
    } finally {
      operation.current = false;
      release();
      if (mounted.current) setBusy(false);
    }
  }
  useEffect(() => {
    mounted.current = true;
    let active = true;
    void callRequest<{ enabled: boolean }>('config')
      .then((value) => {
        if (active) setEnabled(value.enabled);
      })
      .catch((cause) => {
        if (active) {
          setEnabled(false);
          failure(cause);
        }
      });
    // A saved local blob, remote upload and unfinished in-memory recording are different states.
    if (attempt?.response.call)
      void (async () => {
        const held = attempt.response.call!;
        const restoringRevision = checkpointRevision.current;
        let recovered = held;
        if (held.snapshot) {
          try {
            const remote = await callRequest<CallSnapshot>(`attempts/${attempt.attempt_id}`);
            if (remote.turn > held.snapshot.turn)
              recovered = {
                ...held,
                snapshot: remote,
                pending_turn: null,
                recording_id: null,
                transcript_draft: '',
                phase: remote.complete ? 'complete' : 'text_fallback',
              };
          } catch {
            /* Keep the local checkpoint; retry can reconcile the durable turn claim. */
          }
        }
        if (recovered.recording_id) {
          const local = await localRecording(recovered.recording_id, db);
          if (local && ['recording', 'microphone_permission'].includes(recovered.phase))
            recovered = { ...recovered, phase: 'locally_saved' };
          if (!local && ['recording', 'microphone_permission'].includes(recovered.phase)) {
            recovered = { ...recovered, recording_id: null, phase: 'learner_ready' };
            if (active)
              setNotice(
                'The page closed before that recording was saved. Record this turn again; earlier confirmed turns are intact.',
              );
          }
          try {
            const row = await callRequest<CallRecording>(`recordings/${recovered.recording_id}`);
            if (active && checkpointRevision.current === restoringRevision)
              setOriginal(row.original_transcript ?? '');
          } catch {
            /* Local audio can still be uploaded. */
          }
        }
        if (['tts_loading', 'client_speaking'].includes(recovered.phase))
          recovered = { ...recovered, phase: 'text_fallback' };
        if (['uploading', 'transcribing', 'evaluating', 'resolving'].includes(recovered.phase))
          recovered = { ...recovered, phase: 'recoverable_error' };
        // A late restore must not replace a newer edit or the immutable pending retry identity.
        if (active && checkpointRevision.current === restoringRevision) {
          afterAudio.current = recovered.snapshot?.complete ? 'complete' : 'learner_ready';
          live.current = recovered;
          setCall(recovered);
          if (!attempt.submitted)
            await saveCall(exercise.id, context, attempt.attempt_id, recovered);
          if (recovered.snapshot?.turn)
            await cleanConfirmedAudio(recovered.snapshot).catch(() =>
              setNotice('Audio cleanup is pending. Use Delete audio below or retry cleanup.'),
            );
        }
      })().catch(failure);
    return () => {
      active = false;
      mounted.current = false;
      capture.current?.stop();
      stopPlayback();
    };
    // This component is keyed by attempt ID. Checkpoint edits do not restart recovery or audio.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!clockRunning || !attemptId) return;
    let ticks = 0;
    const timer = setInterval(() => {
      live.current = { ...live.current, elapsed_ms: live.current.elapsed_ms + 1000 };
      setCall(live.current);
      if (++ticks % 5 === 0)
        void saveCall(exercise.id, { run, skill_id: skillId }, attemptId, {
          elapsed_ms: live.current.elapsed_ms,
        }).catch(failure);
    }, 1000);
    return () => clearInterval(timer);
  }, [clockRunning, attemptId, exercise.id, run, skillId]);
  useEffect(() => {
    if (call.phase === 'transcript_review') transcript.current?.focus();
  }, [call.phase]);
  async function playClient(current: CallSnapshot) {
    stopPlayback();
    const epoch = audioEpoch.current;
    afterAudio.current =
      live.current.recording_id &&
      ['transcript_review', 'locally_saved', 'recoverable_error'].includes(live.current.phase)
        ? live.current.phase
        : current.complete
          ? 'complete'
          : 'learner_ready';
    const controller = new AbortController();
    audioLoading.current = controller;
    await patch({ phase: 'tts_loading' });
    try {
      const response = await callFetch(`/api/call/attempts/${current.attempt_id}/audio`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ turn: current.turn }),
        signal: controller.signal,
      });
      const result = (await response.json()) as { url: string };
      const blob = await (await callFetch(result.url, { signal: controller.signal })).blob();
      if (!mounted.current || epoch !== audioEpoch.current) return;
      const url = URL.createObjectURL(blob),
        audio = new Audio(url);
      playback.current = { audio, url };
      audio.onended = () => {
        stopPlayback();
        void patch({ phase: afterAudio.current }).catch(failure);
      };
      audio.onerror = () => {
        stopPlayback();
        void patch({ phase: 'text_fallback' }).catch(failure);
      };
      await audio.play();
      if (epoch === audioEpoch.current) await patch({ phase: 'client_speaking' });
    } catch {
      if (epoch === audioEpoch.current) {
        stopPlayback();
        await patch({ phase: 'text_fallback' });
      }
    }
  }
  async function start() {
    if (!attempt) return;
    const started = await startRemoteCall(attempt.attempt_id, exercise.id);
    await patch({ snapshot: started });
    void playClient(started).catch(failure);
  }
  async function record() {
    if (!attempt || !snapshot) return;
    stopPlayback();
    setNotice('');
    const id = crypto.randomUUID();
    await patch({
      phase: 'microphone_permission',
      recording_id: id,
      transcript_draft: '',
      pending_turn: null,
    });
    const recorder = await captureAudio();
    // Keep the update hold after unmount/Stop until the actual Blob and checkpoint settle.
    const releaseRecording = updates.hold();
    capture.current = recorder;
    if (!mounted.current) recorder.stop();
    void recorder.finished
      .then(async (captured) => {
        capture.current = null;
        await storeLocalRecording(
          {
            recording_id: id,
            attempt_id: attempt.attempt_id,
            exercise_id: exercise.id,
            turn: snapshot.turn,
            retain: live.current.retain_audio,
          },
          captured,
        );
        // Upload is not reachable until both the Blob transaction and attempt checkpoint resolve.
        await patch({ phase: 'locally_saved', recording_id: id });
        if (mounted.current && captured.stop_reason !== 'manual')
          setNotice(
            captured.stop_reason === 'duration'
              ? 'Recording stopped at the 55-second turn limit. Your reply is saved.'
              : 'Recording stopped near the size limit. Your reply is saved.',
          );
      })
      .catch(async (cause) => {
        failure(cause);
        await patch({ phase: 'recoverable_error', recording_id: null }).catch(failure);
      })
      .finally(releaseRecording);
    await patch({ phase: 'recording' });
  }
  async function transcribe() {
    if (!attempt || !call.recording_id) return;
    // Paint progress before the first IndexedDB read; upload still waits for the local checkpoint.
    await patch({ phase: 'uploading' });
    const row = await transcribeSaved(attempt, context, call.recording_id, db, (phase) =>
      patch({ phase }),
    );
    setOriginal(row.original_transcript ?? '');
    await patch({
      phase: 'transcript_review',
      transcript_draft: row.confirmed_transcript ?? row.original_transcript ?? '',
    });
  }
  async function confirm() {
    if (!attempt || !snapshot) return;
    const input = call.pending_turn ?? {
      turn: snapshot.turn,
      recording_id: call.recording_id!,
      transcript: call.transcript_draft.trim(),
      move: call.move ?? null,
      ...(call.negotiation ? { negotiation: call.negotiation } : {}),
    };
    await patch({ phase: 'evaluating', pending_turn: input });
    const next = await confirmTurn(attempt, context, input);
    await patch({
      snapshot: next,
      phase: 'resolving',
      pending_turn: null,
      recording_id: null,
      transcript_draft: '',
      move: null,
      negotiation: undefined,
    });
    await cleanConfirmedAudio(next).catch(() =>
      setNotice('The transcript is saved. Audio cleanup is pending; retry cleanup below.'),
    );
    setOriginal('');
    void playClient(next).catch(failure);
  }
  async function retention(keep: boolean) {
    if (!attemptId) return;
    await patch({ retain_audio: keep });
    const rows = await localRecordingsForAttempt(attemptId, db);
    for (const row of rows) await db.call_recordings.update(row.recording_id, { retain: keep });
    if (snapshot) {
      const remote = await callRequest<CallRecording[]>(`attempts/${attemptId}/recordings`);
      for (const row of remote.filter((r) => !r.deleted_at))
        await callRequest(`recordings/${row.recording_id}`, { retain: keep }, 'PATCH');
      if (!keep) await cleanConfirmedAudio(snapshot);
    }
  }
  const elapsed = `${Math.floor(call.elapsed_ms / 60_000)
    .toString()
    .padStart(2, '0')}:${Math.floor((call.elapsed_ms / 1000) % 60)
    .toString()
    .padStart(2, '0')}`;
  const canRecord = Boolean(
    snapshot && !snapshot.complete && idlePhases.includes(call.phase) && !call.pending_turn,
  );
  const node = exercise.conversation?.nodes.find((n) => n.id === snapshot?.current.node);
  const transcribing = ['uploading', 'transcribing'].includes(call.phase);
  const confirming = ['evaluating', 'resolving'].includes(call.phase);
  const canRestart =
    !busy &&
    !submitting &&
    !transcribing &&
    !confirming &&
    !['recording', 'microphone_permission', 'tts_loading', 'client_speaking'].includes(call.phase);
  const updatingAudio =
    busy && !transcribing && !confirming && call.phase !== 'microphone_permission';
  const cue = recoveryCue(exercise, snapshot);
  const showReview =
    !readOnly && (call.phase === 'transcript_review' || Boolean(call.pending_turn) || confirming);
  const reviewText =
    call.phase === 'resolving'
      ? (snapshot?.turns.at(-1)?.confirmed_transcript ?? '')
      : (call.pending_turn?.transcript ?? call.transcript_draft);
  return (
    <article
      className={styles.room}
      aria-labelledby="call-title"
      data-testid="call-room"
      data-phase={call.phase}
    >
      <header className={styles.header}>
        <div>
          <h1 id="call-title">{exercise.title}</h1>
        </div>
        <div className={styles.clock}>
          <span>Elapsed</span>
          <time aria-label="Elapsed call time">{elapsed}</time>
        </div>
      </header>
      <div className={styles.layout}>
        <div className={styles.main}>
          <section className={styles.client} aria-label="Client identity">
            <div className={styles.avatar} aria-hidden="true">
              {client.team[0]!.name.split(' ')
                .map((n) => n[0])
                .join('')}
            </div>
            <div>
              <h2>{client.team[0]!.name}</h2>
              <p>
                {client.team[0]!.role} · {client.business_name}
              </p>
            </div>
          </section>
          <section aria-label="Call objective">
            <h2>Objective</h2>
            <p>{exercise.call!.objective}</p>
          </section>
          <p className={styles.status} role="status" aria-live="polite">
            <span
              aria-hidden="true"
              className={call.phase === 'recording' ? styles.recordingDot : styles.dot}
            />
            {PHASE_LABEL[call.phase]}
          </p>
          {snapshot && (
            <section className={styles.clientLine} aria-label="Current client response">
              <p className={styles.lineSpeaker}>
                {client.team[0]!.name} ·{' '}
                {snapshot.complete ? 'Closing' : `Turn ${snapshot.turn + 1}`}
              </p>
              <p>{snapshot.current.text}</p>
            </section>
          )}
          {cue && (
            <p className={styles.recovery} role="status" data-testid="call-recovery">
              The call needs clarification. Try: {cue}.
            </p>
          )}
          {!readOnly && (
            <div className={styles.controls}>
              {!snapshot && (
                <CallAction
                  className={styles.primary}
                  type="button"
                  disabled={busy || !enabled}
                  loading={busy || enabled === null}
                  pendingLabel={enabled === null ? 'Checking call availability…' : 'Starting call…'}
                  onClick={() => void perform(start)}
                >
                  Start call
                </CallAction>
              )}
              {snapshot &&
                ['text_fallback', 'client_speaking', 'tts_loading'].includes(call.phase) && (
                  <button
                    className={styles.primary}
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void perform(async () => {
                        stopPlayback();
                        await patch({ phase: afterAudio.current });
                      })
                    }
                  >
                    Continue with client text
                  </button>
                )}
              {snapshot &&
                !transcribing &&
                !confirming &&
                !['recording', 'microphone_permission'].includes(call.phase) && (
                  <CallAction
                    type="button"
                    disabled={busy}
                    loading={call.phase === 'tts_loading'}
                    pendingLabel="Loading client audio…"
                    onClick={() => void playClient(snapshot).catch(failure)}
                  >
                    Replay client
                  </CallAction>
                )}
              {(canRecord || call.phase === 'microphone_permission') && (
                <CallAction
                  className={styles.primary}
                  type="button"
                  disabled={busy || !supported || !enabled}
                  loading={call.phase === 'microphone_permission'}
                  pendingLabel="Waiting for microphone…"
                  onClick={() => void perform(record)}
                >
                  {call.recording_id ? 'Record again' : 'Record reply'}
                </CallAction>
              )}
              {call.phase === 'recording' && (
                <button
                  className={styles.stop}
                  type="button"
                  onClick={() => {
                    capture.current?.stop();
                  }}
                >
                  Stop recording
                </button>
              )}
              {call.recording_id &&
                !call.pending_turn &&
                !confirming &&
                !['recording', 'microphone_permission'].includes(call.phase) && (
                  <CallAction
                    type="button"
                    disabled={busy || !enabled}
                    loading={transcribing}
                    pendingLabel="Transcribing…"
                    onClick={() => void perform(transcribe)}
                  >
                    {call.phase === 'locally_saved'
                      ? 'Transcribe recording'
                      : 'Retry transcription'}
                  </CallAction>
                )}
            </div>
          )}
          {!supported && !readOnly && (
            <p>
              This browser cannot record a supported format. Use a browser with WebM Opus or MP4 AAC
              recording.
            </p>
          )}
          {enabled === false && (
            <p>
              Voice calls await server configuration. Saved transcripts and recordings remain
              available below.
            </p>
          )}
          {!readOnly && (
            <p className={styles.help}>
              Up to 55 seconds per turn. Your microphone starts only when you choose Record reply.
              Review and correct the transcript before confirming.
            </p>
          )}
          {!readOnly && !snapshot?.complete && (
            <div>
              <button
                type="button"
                disabled={!canRestart}
                onClick={() => {
                  setError('');
                  setRestartOpen(true);
                }}
              >
                Start fresh call
              </button>
            </div>
          )}
          {restartOpen && (
            <Sheet
              open
              title="Start a fresh call?"
              className={styles.restart}
              onClose={() => {
                if (!busy) setRestartOpen(false);
              }}
            >
              <p>
                This replaces this unfinished call and its notes. It will not be graded or added to
                your results.
              </p>
              <p>
                All recordings for this call will be deleted from this device and the server,
                including recordings you chose to keep. Private server transcript records remain.
              </p>
              <p>
                If cleanup fails, this call stays available so you can retry. Once ready, choose
                Start call to begin at the opening.
              </p>
              {error && <p role="alert">{error}</p>}
              <div className={styles.controls}>
                <button type="button" disabled={busy} onClick={() => setRestartOpen(false)}>
                  Keep this call
                </button>
                <CallAction
                  loading={busy}
                  disabled={!canRestart}
                  pendingLabel="Deleting audio and starting fresh…"
                  onClick={() =>
                    void perform(async () => {
                      stopPlayback();
                      // Invalidate a restore that started before this explicit replacement.
                      checkpointRevision.current++;
                      if (attempt) await restartCall(exercise, context, attempt, true);
                    })
                  }
                >
                  {error ? 'Retry deletion and start fresh' : 'Delete recordings and start fresh'}
                </CallAction>
              </div>
            </Sheet>
          )}
          {showReview && (
            <section className={styles.review} aria-label="Transcript review">
              <h2>What you said</h2>
              <p>
                {confirming
                  ? 'Using your confirmed reply below.'
                  : call.pending_turn
                    ? 'Retry will use your confirmed reply below.'
                    : 'Correct any transcription mistakes. Corrections carry no score penalty.'}
              </p>
              <label htmlFor="call-transcript">Transcript to confirm</label>
              <textarea
                id="call-transcript"
                ref={transcript}
                value={reviewText}
                maxLength={CALL_LIMITS.maxTranscript}
                rows={5}
                disabled={busy || Boolean(call.pending_turn) || confirming}
                onChange={(e) => void patch({ transcript_draft: e.target.value }).catch(failure)}
              />
              <details>
                <summary>Original transcription</summary>
                <p>{original}</p>
              </details>
              {node && !call.pending_turn && !confirming && (
                <label>
                  My intended move (optional)
                  <select
                    disabled={busy}
                    value={call.move ?? ''}
                    onChange={(e) => void patch({ move: e.target.value || null }).catch(failure)}
                  >
                    <option value="">Interpret my spoken intent</option>
                    {node.moves.map((move) => (
                      <option key={move.id} value={move.id}>
                        {move.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {snapshot && !call.pending_turn && !confirming && (
                <NegotiationTerms
                  exercise={exercise}
                  snapshot={snapshot}
                  value={call.negotiation}
                  onChange={(value) => void patch({ negotiation: value }).catch(failure)}
                  disabled={busy}
                />
              )}
              <CallAction
                type="button"
                className={styles.primary}
                disabled={busy || !reviewText.trim()}
                loading={confirming}
                pendingLabel={call.phase === 'resolving' ? 'Saving turn…' : 'Evaluating…'}
                onClick={() => void perform(confirm)}
              >
                {call.pending_turn ? 'Retry confirmed turn' : 'Confirm transcript and continue'}
              </CallAction>
            </section>
          )}
          {error && !restartOpen && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
          {notice && <p role="status">{notice}</p>}
          {snapshot?.complete && attempt && (
            <section aria-label="Call feedback">
              <h2>Review your call</h2>
              <p>
                Feedback covers questions, listening, diagnosis, clarity, jargon, pitch timing,
                objection handling and next step. Accent and pronunciation are never graded.
              </p>
              <CallAction
                type="button"
                className={styles.primary}
                disabled={busy || submitting}
                loading={submitting}
                pendingLabel="Getting feedback…"
                onClick={onSubmit}
              >
                {attempt.submitted ? 'Retry call feedback' : 'Get call feedback'}
              </CallAction>
              {submissionError && <p role="alert">{submissionError}</p>}
            </section>
          )}
          <div className={styles.result}>{children}</div>
        </div>
        <aside className={styles.side}>
          <section>
            <h2>Your notes</h2>
            <button
              type="button"
              aria-expanded={notesOpen}
              aria-controls="call-notes-panel"
              onClick={() => setNotesOpen((value) => !value)}
            >
              {notesOpen ? 'Close notes' : 'Open notes'}
            </button>
            {notesOpen && (
              <div id="call-notes-panel" className={styles.notes}>
                <label htmlFor="call-notes">Call notes</label>
                <textarea
                  id="call-notes"
                  rows={7}
                  maxLength={6000}
                  value={call.notes}
                  readOnly={readOnly}
                  onChange={(e) => void patch({ notes: e.target.value }).catch(failure)}
                />
                <p>Private notes for your recall. They are not sent for AI feedback.</p>
              </div>
            )}
          </section>
          <details>
            <summary>Call brief</summary>
            <p>{exercise.instructions}</p>
          </details>
          {['guided', 'practice'].includes(exercise.mode) && exercise.call!.anchors.length > 0 && (
            <details data-testid="call-anchors">
              <summary>Optional call anchors</summary>
              <ul>
                {exercise.call!.anchors.map((anchor) => (
                  <li key={anchor}>{anchor}</li>
                ))}
              </ul>
            </details>
          )}
          {snapshot?.agreement && (
            <details>
              <summary>Agreement on the table</summary>
              <p>
                Project: ${snapshot.agreement.project} · Due now: ${snapshot.agreement.due_now} ·{' '}
                {snapshot.agreement.timeline_days} days · {snapshot.agreement.revisions} revision
                rounds · Separate support: ${snapshot.agreement.recurring}/month
              </p>
              {snapshot.agreement.phase && (
                <p>
                  Phase 2: ${snapshot.agreement.phase.project}, {snapshot.agreement.phase.days} days
                  after acceptance.
                </p>
              )}
              <ul>
                {exercise.negotiation!.pricing.scope.map((scope) => (
                  <li key={scope.id}>
                    {scope.name}:{' '}
                    {snapshot.agreement!.excluded.includes(scope.id)
                      ? `Excluded. ${scope.consequence}`
                      : snapshot.agreement!.phase?.deferred.includes(scope.id)
                        ? `Phase 2. ${scope.consequence}`
                        : scope.description}
                  </li>
                ))}
              </ul>
            </details>
          )}
          <section>
            <h2>Audio retention</h2>
            {!readOnly && (
              <label className={styles.toggle}>
                <input
                  type="checkbox"
                  checked={call.retain_audio}
                  disabled={busy || ['recording', 'microphone_permission'].includes(call.phase)}
                  onChange={(e) => void perform(() => retention(e.target.checked))}
                />
                Keep recordings after transcript confirmation
                {updatingAudio && <span role="status">Updating saved audio…</span>}
              </label>
            )}
            <p>
              Default: save the transcript and remove audio after confirmation. Failed
              transcriptions keep audio for retry. Retained audio can be deleted below.
            </p>
            {attemptId && snapshot && (
              <CallAction
                type="button"
                disabled={busy || call.phase === 'recording'}
                loading={updatingAudio}
                pendingLabel="Updating saved audio…"
                onClick={() =>
                  void perform(async () => {
                    await cleanConfirmedAudio(snapshot);
                    setNotice('Confirmed, unretained recordings have been removed.');
                  })
                }
              >
                Retry audio cleanup
              </CallAction>
            )}
          </section>
        </aside>
      </div>
      {snapshot && (
        <details className={styles.history}>
          <summary>Call transcript · {snapshot.turns.length} confirmed turns</summary>
          <ol>
            {snapshot.turns.map((turn) => (
              <li key={turn.turn}>
                <p>
                  <strong>{client.team[0]!.name}:</strong> {turn.client.text}
                </p>
                <p>
                  <strong>You:</strong> {turn.confirmed_transcript}
                </p>
                {turn.original_transcript !== turn.confirmed_transcript && (
                  <details>
                    <summary>Transcription corrected</summary>
                    <p>{turn.original_transcript}</p>
                  </details>
                )}
              </li>
            ))}
          </ol>
        </details>
      )}
      {attemptId && snapshot && (
        <Recordings
          attemptId={attemptId}
          revision={`${snapshot.turn}:${call.retain_audio}:${notice}:${call.phase}`}
        />
      )}
    </article>
  );
}
