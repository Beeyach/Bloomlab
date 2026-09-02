import { useRef } from 'react';

import { useOnScreen } from '../hooks/useOnScreen';
import { cx } from '../utils/cx';
import { IdentityMark } from './IdentityMark';
import { StatusPill, type StatusGlyph, type StatusTone } from './StatusPill';
import styles from './CallParticipant.module.css';

export type AudioState = 'speaking' | 'listening' | 'muted' | 'connecting';

const AUDIO: Record<AudioState, { label: string; tone: StatusTone; glyph: StatusGlyph }> = {
  speaking: { label: 'Speaking', tone: 'execution', glyph: 'dot' },
  listening: { label: 'Listening', tone: 'neutral', glyph: 'ring' },
  muted: { label: 'Muted', tone: 'warning', glyph: 'dash' },
  connecting: { label: 'Connecting', tone: 'info', glyph: 'clock' },
};

export interface CallParticipantProps {
  name: string;
  company?: string;
  audio: AudioState;
  /** Elapsed call time, formatted (mm:ss). */
  elapsed?: string;
  /** Identity seed; defaults to the name. */
  seed?: string;
  className?: string;
}

/** Call Room participant: identity, company, audio state, elapsed time (spec §79). */
export function CallParticipant({
  name,
  company,
  audio,
  elapsed,
  seed,
  className,
}: CallParticipantProps) {
  const a = AUDIO[audio];
  const ref = useRef<HTMLDivElement>(null);
  const onScreen = useOnScreen(ref);
  return (
    <div
      ref={ref}
      className={cx(
        styles.participant,
        audio === 'speaking' && onScreen && styles.speaking,
        className,
      )}
      data-audio={audio}
    >
      <span className={styles.markWrap}>
        <span className={styles.ring} aria-hidden="true" />
        <IdentityMark seed={seed ?? name} size={64} />
      </span>
      <div className={styles.text}>
        <span className={styles.name}>{name}</span>
        {company && <span className={styles.company}>{company}</span>}
        <span className={styles.status}>
          <StatusPill label={a.label} tone={a.tone} glyph={a.glyph} live={audio === 'speaking'} />
          {elapsed && <span className={styles.elapsed}>{elapsed}</span>}
        </span>
      </div>
    </div>
  );
}
