import { cx } from '../utils/cx';
import { StatusPill, type StatusGlyph, type StatusTone } from './StatusPill';
import styles from './ExecutionEvent.module.css';

export type ExecutionEventStatus = 'ok' | 'skipped' | 'waiting' | 'failed' | 'info';

const STATUS: Record<
  ExecutionEventStatus,
  { label: string; tone: StatusTone; glyph: StatusGlyph }
> = {
  ok: { label: 'OK', tone: 'success', glyph: 'check' },
  skipped: { label: 'Skipped', tone: 'neutral', glyph: 'skip' },
  waiting: { label: 'Waiting', tone: 'warning', glyph: 'clock' },
  failed: { label: 'Failed', tone: 'error', glyph: 'cross' },
  info: { label: 'Info', tone: 'info', glyph: 'dot' },
};

export interface ExecutionEventProps {
  /** Simulated time, already formatted (spec §45: never wall-clock). */
  time: string;
  /** Event or step name, in real GHL terminology where it represents a real feature. */
  name: string;
  detail?: string;
  status?: ExecutionEventStatus;
  /** Branch taken, e.g. "Yes" / "No phone". */
  branch?: string;
  className?: string;
}

/** One row of the execution log / timeline (spec §48). */
export function ExecutionEvent({
  time,
  name,
  detail,
  status = 'info',
  branch,
  className,
}: ExecutionEventProps) {
  const s = STATUS[status];
  return (
    <li className={cx(styles.event, className)} data-status={status}>
      <span className={styles.time}>{time}</span>
      <span className={styles.main}>
        <span className={styles.name}>{name}</span>
        {detail && <span className={styles.detail}>{detail}</span>}
        {branch && (
          <span>
            <span className={styles.branch}>→ {branch}</span>
          </span>
        )}
      </span>
      <StatusPill label={s.label} tone={s.tone} glyph={s.glyph} />
    </li>
  );
}
