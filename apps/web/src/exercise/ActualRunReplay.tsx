import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Button, Surface, usePrefersReducedMotion } from '@bloomlab/design-system';
import { loadWorkspace } from '../data/workspace';
import { runReplayKey, type RunReplay } from './runReplay';
import styles from './ExerciseRunner.module.css';

export function ActualRunReplay({ attemptId, fresh }: { attemptId: string; fresh: boolean }) {
  const loaded = useLiveQuery(async () => {
    try {
      return { replay: await loadWorkspace<RunReplay>(runReplayKey(attemptId)), error: false };
    } catch {
      return { replay: undefined, error: true };
    }
  }, [attemptId]);
  return loaded?.replay ? (
    <Replay key={attemptId} replay={loaded.replay} fresh={fresh} />
  ) : (
    <p role="status">
      {!loaded
        ? 'Loading the saved execution…'
        : loaded.error
          ? 'The saved execution could not be read on this device. Your result is unchanged.'
          : 'This device has no saved execution playback for this historical attempt. The recorded grade is unchanged.'}
    </p>
  );
}

export function Replay({ replay, fresh = false }: { replay: RunReplay; fresh?: boolean }) {
  const reduced = usePrefersReducedMotion();
  const [index, setIndex] = useState(0);
  const [requested, setRequested] = useState(fresh);
  const playing = requested && !reduced && index < replay.events.length - 1;
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(
      () => setIndex((value) => Math.min(value + 1, replay.events.length - 1)),
      650,
    );
    return () => clearInterval(timer);
  }, [playing, replay.events.length]);
  return (
    <Surface
      padding="md"
      className={styles.replay}
      data-testid="actual-run-replay"
      data-playing={playing}
    >
      <h3>Actual execution</h3>
      <p>
        Observed account events at submission, saved on this device. Playback changes no result or
        account state.
      </p>
      <p>
        Your prediction:{' '}
        {Object.entries(replay.prediction)
          .map(([key, value]) => `${key}: ${value}`)
          .join(' · ') || 'No structured prediction supplied.'}
      </p>
      {!reduced && replay.events.length > 0 && (
        <div className={styles.replayControls}>
          <Button
            onClick={() => {
              setIndex(0);
              setRequested(true);
            }}
          >
            Replay execution
          </Button>
          <Button
            disabled={index >= replay.events.length - 1}
            onClick={() => setRequested(!requested)}
          >
            {playing ? 'Pause execution' : 'Continue execution'}
          </Button>
          <Button
            onClick={() => {
              setIndex(replay.events.length - 1);
              setRequested(false);
            }}
          >
            Show full execution
          </Button>
        </div>
      )}
      {reduced && <p>Reduced motion: the full observed execution is shown without playback.</p>}
      {replay.events.length === 0 ? (
        <p>No observed events for this contact. Nothing is animated or invented.</p>
      ) : (
        <ol aria-label="Observed execution events">
          {replay.events.slice(0, reduced ? undefined : index + 1).map((event) => (
            <li
              key={event.index}
              aria-current={!reduced && event === replay.events[index] ? 'step' : undefined}
            >
              <time>{event.at}</time> — {event.type.replaceAll('.', ' ')}
              {typeof event.fields.body === 'string' && <p>{event.fields.body}</p>}
              {typeof event.fields.tag === 'string' && <p>Tag: {event.fields.tag}</p>}
            </li>
          ))}
        </ol>
      )}
    </Surface>
  );
}
