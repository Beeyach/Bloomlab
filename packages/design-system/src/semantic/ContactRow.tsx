import type { ComponentPropsWithRef } from 'react';

import { cx } from '../utils/cx';
import styles from './ContactRow.module.css';

export interface ContactRowProps extends ComponentPropsWithRef<'button'> {
  name: string;
  hasPhone: boolean;
  hasEmail: boolean;
  tags?: string[];
  owner?: string;
  /** Last activity in simulated time, already formatted. */
  lastActivity?: string;
  selected?: boolean;
}

const MAX_TAGS = 3;

/** Dense CRM contact row. Missing channels are spelled out — they matter to workflows. */
export function ContactRow({
  name,
  hasPhone,
  hasEmail,
  tags = [],
  owner,
  lastActivity,
  selected = false,
  className,
  type = 'button',
  ...rest
}: ContactRowProps) {
  const shown = tags.slice(0, MAX_TAGS);
  const more = tags.length - shown.length;
  return (
    <button type={type} className={cx(styles.row, className)} aria-pressed={selected} {...rest}>
      <span className={styles.name}>{name}</span>
      <span className={styles.channels}>
        <span className={hasPhone ? undefined : styles.missing}>
          {hasPhone ? 'Phone' : 'No phone'}
        </span>
        <span className={hasEmail ? undefined : styles.missing}>
          {hasEmail ? 'Email' : 'No email'}
        </span>
      </span>
      <span
        className={styles.tags}
        aria-label={tags.length ? `Tags: ${tags.join(', ')}` : 'No tags'}
      >
        {shown.map((tag) => (
          <span key={tag} className={styles.tag}>
            {tag}
          </span>
        ))}
        {more > 0 && <span className={styles.tag}>+{more}</span>}
      </span>
      <span className={styles.owner}>{owner ?? 'Unassigned'}</span>
      <span className={styles.activity}>{lastActivity ?? '—'}</span>
    </button>
  );
}
