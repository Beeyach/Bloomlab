import { cx } from '../utils/cx';
import { MASTERY_LABELS, type MasteryState } from './domain';
import styles from './MasteryBadge.module.css';

export interface MasteryBadgeProps {
  state: MasteryState;
  size?: 'md' | 'lg';
  className?: string;
}

/** A distinct shape per state so the state reads without colour (A11Y-005). */
function Glyph({ state }: { state: MasteryState }) {
  switch (state) {
    case 'UNSEEN':
      return <circle cx="6" cy="6" r="4.5" strokeDasharray="2 2" />;
    case 'LEARNING':
      return (
        <>
          <circle cx="6" cy="6" r="4.5" />
          <path d="M6 6V1.5A4.5 4.5 0 0110.5 6z" fill="currentColor" stroke="none" />
        </>
      );
    case 'GUIDED':
      return (
        <>
          <circle cx="6" cy="6" r="4.5" />
          <path d="M6 1.5a4.5 4.5 0 010 9z" fill="currentColor" stroke="none" />
        </>
      );
    case 'PRACTICED':
      return (
        <>
          <circle cx="6" cy="6" r="4.5" />
          <path d="M6 6V1.5A4.5 4.5 0 111.5 6z" fill="currentColor" stroke="none" />
        </>
      );
    case 'INDEPENDENT':
      return <circle cx="6" cy="6" r="4.5" fill="currentColor" stroke="none" />;
    case 'PRESSURE_TESTED':
      return (
        <>
          <circle cx="6" cy="6" r="5.25" />
          <circle cx="6" cy="6" r="2.75" fill="currentColor" stroke="none" />
        </>
      );
    case 'MASTERED':
      return (
        <path
          d="M6 .75L7.4 4.6 11.25 6 7.4 7.4 6 11.25 4.6 7.4.75 6 4.6 4.6z"
          fill="currentColor"
          stroke="none"
        />
      );
    case 'NEEDS_REFRESH':
      return (
        <>
          <path d="M10 6a4 4 0 11-1.2-2.85" />
          <path d="M10 1.5V4H7.5" />
        </>
      );
  }
}

/** Mastery state badge (spec §29, §75): label + glyph, material escalates with mastery. */
export function MasteryBadge({ state, size = 'md', className }: MasteryBadgeProps) {
  return (
    <span
      className={cx(styles.badge, styles[state], size === 'lg' && styles.lg, className)}
      data-state={state}
    >
      <svg
        className={styles.glyph}
        viewBox="0 0 12 12"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <Glyph state={state} />
      </svg>
      {MASTERY_LABELS[state]}
    </span>
  );
}
