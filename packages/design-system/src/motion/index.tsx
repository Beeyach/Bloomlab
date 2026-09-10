import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';

import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import { IconSkip } from '../icons';
import { Button } from '../primitives/Button';
import { motion } from '../tokens';
import { cx } from '../utils/cx';
import styles from './motion.module.css';

export const motionClass = {
  state: styles.state,
  spatialEnter: styles.spatialEnter,
} as const;

export interface ExecutionTrackProps {
  /** 0–1 progress of the travelling contact along the track. */
  progress: number;
  label: string;
  className?: string;
}

/** Execution motion: a contact moving along a system (spec §69 "execution", WFL-012 later). */
export function ExecutionTrack({ progress, label, className }: ExecutionTrackProps) {
  const clamped = Math.max(0, Math.min(1, progress));
  return (
    <div
      className={cx(styles.executionTrack, className)}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
      style={{ '--execution-progress': clamped } as CSSProperties}
    >
      <span className={styles.executionDot} aria-hidden="true" />
    </div>
  );
}

export interface RewardRevealProps {
  /** Quiet acknowledgement: keep text at full opacity/scale; only its frame responds. */
  recognition?: boolean;
  /** 1500–3000 ms (spec §69); clamped. */
  durationMs?: number;
  /** Called when the sequence finishes or is skipped. */
  onDone?: () => void;
  skipLabel?: string;
  className?: string;
  children: ReactNode;
}

/**
 * Reward motion for meaningful accomplishments. Always skippable; under reduced motion the
 * end state shows immediately and `onDone` fires at once (MOT-002, MOT-003).
 */
export function RewardReveal({
  recognition = false,
  durationMs = 2000,
  onDone,
  skipLabel = 'Skip',
  className,
  children,
}: RewardRevealProps) {
  const reduced = usePrefersReducedMotion();
  const duration = Math.max(motion.rewardMin, Math.min(motion.rewardMax, durationMs));
  const [done, setDone] = useState(reduced);
  if (reduced && !done) setDone(true);
  const stage = useRef<HTMLDivElement>(null);
  const skip = useRef<HTMLButtonElement>(null);
  const setSkipRef = useCallback((element: HTMLButtonElement | null) => {
    if (!element && document.activeElement === skip.current) stage.current?.focus();
    skip.current = element;
  }, []);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (done) {
      if (document.activeElement === skip.current) stage.current?.focus();
      onDoneRef.current?.();
      return;
    }
    const timer = setTimeout(() => {
      if (document.activeElement === skip.current) stage.current?.focus();
      setDone(true);
    }, duration);
    return () => clearTimeout(timer);
  }, [done, duration]);

  return (
    <div
      className={cx(styles.reward, recognition && styles.recognition, className)}
      data-done={done || undefined}
    >
      {!done && (
        <Button
          ref={setSkipRef}
          size="sm"
          variant="ghost"
          className={styles.rewardSkip}
          icon={<IconSkip size={16} />}
          onClick={() => {
            stage.current?.focus();
            setDone(true);
          }}
        >
          {skipLabel}
        </Button>
      )}
      <div
        ref={stage}
        tabIndex={-1}
        className={done ? undefined : styles.rewardStage}
        style={{ '--reward-duration': `${duration}ms` } as CSSProperties}
      >
        {children}
      </div>
    </div>
  );
}
