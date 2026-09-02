import { useEffect, useId, useRef, type ReactNode } from 'react';

import { IconClose } from '../icons';
import { cx } from '../utils/cx';
import { IconButton } from './IconButton';
import styles from './Sheet.module.css';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** `bottom` for mobile drill-downs, `end` for a side sheet. */
  side?: 'bottom' | 'end';
  footer?: ReactNode;
  className?: string;
  children?: ReactNode;
}

/**
 * Modal sheet on the native <dialog> element: focus is trapped and Escape closes it for free.
 * Used for mobile drill-down editors and inspectors (spec §54, §83).
 */
export function Sheet({
  open,
  onClose,
  title,
  side = 'bottom',
  footer,
  className,
  children,
}: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    } else if (!open && dialog.open) {
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={cx(styles.sheet, styles[side], className)}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        // Clicks on the backdrop land on the dialog element itself.
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={styles.inner}>
        {side === 'bottom' && <span className={styles.grabber} aria-hidden="true" />}
        <header className={styles.header}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          <IconButton label="Close" icon={<IconClose />} onClick={onClose} />
        </header>
        <div className={styles.body}>{children}</div>
        {footer && <footer className={styles.footer}>{footer}</footer>}
      </div>
    </dialog>
  );
}
