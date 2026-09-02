import type { ComponentPropsWithRef } from 'react';

import { cx } from '../utils/cx';
import { formatCurrency } from './domain';
import styles from './PipelineCard.module.css';

export interface PipelineCardProps extends ComponentPropsWithRef<'button'> {
  contactName: string;
  value: number;
  currency?: string;
  stage: string;
  /** Days in the current stage, simulated time. */
  ageDays: number;
  owner?: string;
  selected?: boolean;
}

/** Opportunity card inside a pipeline stage (spec §55). */
export function PipelineCard({
  contactName,
  value,
  currency = 'USD',
  stage,
  ageDays,
  owner,
  selected = false,
  className,
  type = 'button',
  ...rest
}: PipelineCardProps) {
  return (
    <button type={type} className={cx(styles.card, className)} aria-pressed={selected} {...rest}>
      <span className={styles.top}>
        <span className={styles.name}>{contactName}</span>
        <span className={styles.value}>{formatCurrency(value, currency)}</span>
      </span>
      <span className={styles.meta}>
        <span>{stage}</span>
        <span>
          {ageDays} {ageDays === 1 ? 'day' : 'days'} in stage
        </span>
        <span>{owner ?? 'Unassigned'}</span>
      </span>
    </button>
  );
}
