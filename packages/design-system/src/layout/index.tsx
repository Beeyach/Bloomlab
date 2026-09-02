import type { CSSProperties, ElementType, HTMLAttributes, ReactNode } from 'react';

import { cx } from '../utils/cx';
import styles from './layout.module.css';

type Gap = 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12 | 16;

interface LayoutProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  gap?: Gap;
  children?: ReactNode;
}

function gapVar(gap: Gap | undefined): string | undefined {
  return gap === undefined ? undefined : `var(--bl-space-${gap})`;
}

function withVars(style: CSSProperties | undefined, vars: Record<string, string | undefined>) {
  return { ...style, ...vars } as CSSProperties;
}

/** Vertical rhythm: children stacked with a consistent gap. */
export function Stack({
  as: Tag = 'div',
  gap,
  align,
  className,
  style,
  children,
  ...rest
}: LayoutProps & { align?: 'stretch' | 'start' | 'center' | 'end' }) {
  return (
    <Tag
      className={cx(styles.stack, className)}
      style={withVars(style, {
        '--layout-gap': gapVar(gap),
        '--layout-align': align && flexAlign(align),
      })}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/** Wrapping row of items (chips, buttons, meta) that never overflows horizontally. */
export function Cluster({
  as: Tag = 'div',
  gap,
  align,
  justify,
  className,
  style,
  children,
  ...rest
}: LayoutProps & {
  align?: 'stretch' | 'start' | 'center' | 'end';
  justify?: 'start' | 'center' | 'end' | 'between';
}) {
  return (
    <Tag
      className={cx(styles.cluster, className)}
      style={withVars(style, {
        '--layout-gap': gapVar(gap),
        '--layout-align': align && flexAlign(align),
        '--layout-justify': justify && flexJustify(justify),
      })}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/** Responsive grid: as many `minColumn`-wide columns as fit, one column on narrow screens. */
export function Grid({
  as: Tag = 'div',
  gap,
  minColumn = '16rem',
  className,
  style,
  children,
  ...rest
}: LayoutProps & { minColumn?: string }) {
  return (
    <Tag
      className={cx(styles.grid, className)}
      style={withVars(style, { '--layout-gap': gapVar(gap), '--layout-min': minColumn })}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/** Text for assistive technology only. */
export function VisuallyHidden({
  as: Tag = 'span',
  children,
}: {
  as?: ElementType;
  children: ReactNode;
}) {
  return <Tag className={styles.visuallyHidden}>{children}</Tag>;
}

function flexAlign(value: 'stretch' | 'start' | 'center' | 'end'): string {
  return value === 'start' ? 'flex-start' : value === 'end' ? 'flex-end' : value;
}

function flexJustify(value: 'start' | 'center' | 'end' | 'between'): string {
  return value === 'start'
    ? 'flex-start'
    : value === 'end'
      ? 'flex-end'
      : value === 'between'
        ? 'space-between'
        : value;
}
