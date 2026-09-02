import type { ComponentPropsWithRef, ReactNode } from 'react';

import { cx } from '../utils/cx';
import styles from './IconButton.module.css';

export interface IconButtonProps extends Omit<ComponentPropsWithRef<'button'>, 'children'> {
  /** Accessible name — required because the button has no visible text (A11Y-003). */
  label: string;
  icon: ReactNode;
  variant?: 'ghost' | 'outlined';
  /** For toggle buttons; renders `aria-pressed`. */
  pressed?: boolean;
}

export function IconButton({
  label,
  icon,
  variant = 'ghost',
  pressed,
  className,
  type = 'button',
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      className={cx(styles.iconButton, variant === 'outlined' && styles.outlined, className)}
      {...rest}
    >
      {icon}
    </button>
  );
}
