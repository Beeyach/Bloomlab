import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';

import { cx } from '../utils/cx';
import styles from './Popover.module.css';

export interface PopoverTriggerProps {
  ref: (element: HTMLElement | null) => void;
  'aria-expanded': boolean;
  'aria-controls': string;
  'aria-haspopup': 'dialog';
  onClick: () => void;
}

export interface PopoverProps {
  /** Renders the trigger; spread the given props onto a Button/IconButton. */
  trigger: (props: PopoverTriggerProps) => ReactNode;
  /** Accessible name of the panel. */
  label: string;
  className?: string;
  children?: ReactNode;
}

const GAP = 6;

/**
 * Light-dismiss popover anchored to its trigger: Escape and outside clicks close it, focus
 * moves into the panel on open and back to the trigger on close. Flips above the trigger
 * when there is no room below.
 */
export function Popover({ trigger, label, className, children }: PopoverProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<CSSProperties>({});
  const triggerRef = useRef<HTMLElement | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    const anchor = triggerRef.current?.getBoundingClientRect();
    const panel = panelRef.current;
    if (!anchor || !panel) return;
    const height = panel.offsetHeight;
    const width = panel.offsetWidth;
    const viewportH = window.innerHeight;
    const viewportW = window.innerWidth;
    const below = anchor.bottom + GAP + height <= viewportH;
    const top = below ? anchor.bottom + GAP : Math.max(GAP, anchor.top - GAP - height);
    const left = Math.max(GAP, Math.min(anchor.left, viewportW - width - GAP));
    setPosition({ top, left });
    panel.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open, close]);

  return (
    <>
      {trigger({
        ref: (element) => {
          triggerRef.current = element;
        },
        'aria-expanded': open,
        'aria-controls': panelId,
        'aria-haspopup': 'dialog',
        onClick: () => setOpen((value) => !value),
      })}
      {open && (
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-label={label}
          tabIndex={-1}
          className={cx(styles.panel, className)}
          style={position}
        >
          {children}
        </div>
      )}
    </>
  );
}
