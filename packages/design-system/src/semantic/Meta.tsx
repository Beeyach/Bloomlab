import { Fragment, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { IconArrowRight } from '../icons';
import { cx } from '../utils/cx';
import styles from './Meta.module.css';

export interface MetaItem {
  kind: 'chip' | 'text' | 'badge';
  icon?: ReactNode;
  label: ReactNode;
}
export interface MetaProps extends ComponentPropsWithoutRef<'span'> {
  items: readonly MetaItem[];
  variant?: 'flow';
}

/** Related facts remain distinct without punctuation or a single wrapping sentence. */
export function Meta({ items, variant, className, ...rest }: MetaProps) {
  return (
    <span className={cx(styles.meta, variant === 'flow' && styles.flow, className)} {...rest}>
      {items.map((item, index) => (
        <Fragment key={index}>
          {index > 0 && ' '}
          {variant === 'flow' && index > 0 && <IconArrowRight size={12} className={styles.arrow} />}
          <span className={cx(styles.item, styles[item.kind])}>
            {item.icon && (
              <span className={styles.icon} aria-hidden="true">
                {item.icon}
              </span>
            )}
            <span>{item.label}</span>
          </span>
        </Fragment>
      ))}
    </span>
  );
}
