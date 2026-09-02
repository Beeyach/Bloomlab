import { useId } from 'react';

import { cx } from '../utils/cx';
import { formatCurrency } from './domain';
import styles from './PricingScopeItem.module.css';

export interface PricingScopeItemProps {
  name: string;
  description?: string;
  /** Price impact of including this item; `null` when the scenario hides economics until submit. */
  priceImpact: number | null;
  currency?: string;
  included: boolean;
  onIncludedChange?: (included: boolean) => void;
  /** What removing this item structurally breaks (spec §80: visible consequences). */
  dependency?: string;
  /** Locked items cannot be removed (e.g. required by the accepted proposal). */
  locked?: boolean;
  className?: string;
}

/** One scope line on the deal desk: include/exclude with visible structural consequences. */
export function PricingScopeItem({
  name,
  description,
  priceImpact,
  currency = 'USD',
  included,
  onIncludedChange,
  dependency,
  locked = false,
  className,
}: PricingScopeItemProps) {
  const id = useId();
  return (
    <div
      className={cx(styles.item, !included && styles.excluded, className)}
      data-included={included}
    >
      <input
        id={id}
        type="checkbox"
        className={styles.checkbox}
        checked={included}
        disabled={locked}
        onChange={(event) => onIncludedChange?.(event.target.checked)}
      />
      <label htmlFor={id} className={styles.label}>
        <span className={styles.name}>{name}</span>
        {description && <span className={styles.description}>{description}</span>}
        {dependency && !included && (
          <span className={styles.dependency}>Removing this: {dependency}</span>
        )}
      </label>
      <span className={styles.price}>
        {priceImpact === null ? '—' : formatCurrency(priceImpact, currency)}
        <span className={styles.state}>
          {locked ? 'Required' : included ? 'Included' : 'Excluded'}
        </span>
      </span>
    </div>
  );
}
