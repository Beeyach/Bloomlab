import { useId, type ComponentPropsWithRef, type ReactNode } from 'react';

import { IconClose } from '../icons';
import { cx } from '../utils/cx';
import { IconButton } from './IconButton';
import styles from './ToolPanel.module.css';

export type Density = 'low' | 'medium' | 'high';

export interface ToolPanelProps extends Omit<ComponentPropsWithRef<'section'>, 'title'> {
  title: string;
  /** Header controls (IconButtons, small Buttons). */
  actions?: ReactNode;
  /** Information density (spec §72): row padding follows `--bl-density-row`. */
  density?: Density;
  children?: ReactNode;
}

/** Working panel for lab tool areas: titled header, dense scrollable body. */
export function ToolPanel({
  title,
  actions,
  density = 'medium',
  className,
  children,
  ...rest
}: ToolPanelProps) {
  const titleId = useId();
  return (
    <section
      className={cx(styles.panel, className)}
      aria-labelledby={titleId}
      data-density={density}
      {...rest}
    >
      <header className={styles.header}>
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        {actions && <div className={styles.actions}>{actions}</div>}
      </header>
      <div className={styles.body}>{children}</div>
    </section>
  );
}

export interface InspectorProps extends Omit<ToolPanelProps, 'actions'> {
  /** Close control (contextual inspectors can be dismissed). */
  onClose?: () => void;
  actions?: ReactNode;
}

/**
 * Contextual inspector (spec §53): a ToolPanel with a close control. Desktop shows it as a
 * side column; mobile hosts it in a Sheet.
 */
export function Inspector({ onClose, actions, children, ...rest }: InspectorProps) {
  return (
    <ToolPanel
      actions={
        <>
          {actions}
          {onClose && <IconButton label="Close inspector" icon={<IconClose />} onClick={onClose} />}
        </>
      }
      {...rest}
    >
      {children}
    </ToolPanel>
  );
}

export function InspectorSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>{title}</h3>
      {children}
    </div>
  );
}
