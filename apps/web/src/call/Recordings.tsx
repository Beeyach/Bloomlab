import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { CallRecording } from '@bloomlab/shared';
import { db } from '../data/db';
import { callFetch, callRequest } from './client';
import { CallAction } from './CallAction';
import { updates } from '../pwa/updates';
import { localRecordingsForAttempt } from './local';

/** Deletion lives outside immutable attempt history. Metadata is fetched from the media store. */
export function Recordings({ attemptId, revision }: { attemptId: string; revision: string }) {
  const local = useLiveQuery(() => localRecordingsForAttempt(attemptId, db), [attemptId]) ?? [];
  const [remote, setRemote] = useState<CallRecording[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<{ id: string; action: 'play' | 'delete' } | null>(null);
  const operation = useRef(false);
  const [playing, setPlaying] = useState<{ id: string; url: string } | null>(null);
  const audio = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    let alive = true;
    void callRequest<CallRecording[]>(`attempts/${attemptId}/recordings`)
      .then((rows) => {
        if (alive) {
          if (!Array.isArray(rows)) throw new Error('Invalid recording list');
          setRemote(rows);
          setError('');
        }
      })
      .catch(() => {
        if (alive)
          setError(
            'Server recording status is unavailable. Audio saved on this device is listed below.',
          );
      });
    return () => {
      alive = false;
    };
  }, [attemptId, revision]);
  useEffect(
    () => () => {
      if (playing) URL.revokeObjectURL(playing.url);
    },
    [playing],
  );
  const ids = [
    ...new Set([...local.map((r) => r.recording_id), ...remote.map((r) => r.recording_id)]),
  ];
  async function play(id: string) {
    if (operation.current) return;
    operation.current = true;
    const release = updates.hold();
    setBusy({ id, action: 'play' });
    setError('');
    try {
      const blob =
        local.find((row) => row.recording_id === id)?.blob ??
        (await (await callFetch(`/api/call/recordings/${id}/audio`)).blob());
      setPlaying({ id, url: URL.createObjectURL(blob) });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Playback is unavailable.');
    } finally {
      operation.current = false;
      release();
      setBusy(null);
    }
  }
  async function remove(id: string) {
    if (operation.current) return;
    operation.current = true;
    const release = updates.hold();
    setBusy({ id, action: 'delete' });
    setError('');
    if (playing?.id === id) {
      audio.current?.pause();
      setPlaying(null);
    }
    try {
      const deleted = (await (
        await callFetch(`/api/call/recordings/${id}`, { method: 'DELETE' })
      ).json()) as Pick<CallRecording, 'recording_id' | 'status' | 'deleted_at'>;
      setRemote((rows) =>
        rows.map((row) => (row.recording_id === id ? { ...row, ...deleted } : row)),
      );
      await db.call_recordings.delete(id);
    } catch {
      setError(
        'Audio deletion did not finish. Retry Delete audio; the transcript will stay saved.',
      );
    } finally {
      operation.current = false;
      release();
      setBusy(null);
    }
  }
  return (
    <section aria-label="Saved recordings">
      <h2>Recordings</h2>
      <p>
        Transcripts stay with your call. Audio stays only when retained or needed to recover a turn.
      </p>
      {error && <p role="status">{error}</p>}
      {ids.length === 0 && <p>No audio saved for this call.</p>}
      <ul>
        {ids.map((id) => {
          const device = local.find((r) => r.recording_id === id);
          const server = remote.find((r) => r.recording_id === id);
          const available =
            Boolean(device) ||
            Boolean(server && !server.deleted_at && server.status !== 'deleting');
          return (
            <li key={id}>
              <span>
                Turn {(device?.turn ?? server?.turn ?? 0) + 1} ·{' '}
                {device ? 'On this device' : 'No local audio'} ·{' '}
                {server
                  ? server.deleted_at
                    ? 'Server audio deleted'
                    : server.status === 'deleting'
                      ? 'Server deletion pending'
                      : server.retain
                        ? 'Retained on server'
                        : 'On server for recovery'
                  : 'Server status not confirmed'}
              </span>
              <div>
                {available && (
                  <CallAction
                    type="button"
                    disabled={busy !== null}
                    loading={busy?.id === id && busy.action === 'play'}
                    pendingLabel="Loading recording…"
                    onClick={() => void play(id)}
                  >
                    Replay recording
                  </CallAction>
                )}
                {(available || server?.status === 'deleting') && (
                  <CallAction
                    type="button"
                    disabled={busy !== null}
                    loading={busy?.id === id && busy.action === 'delete'}
                    pendingLabel="Deleting audio…"
                    onClick={() => void remove(id)}
                  >
                    Delete audio
                  </CallAction>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {playing && <audio ref={audio} src={playing.url} controls aria-label="Recording playback" />}
    </section>
  );
}
