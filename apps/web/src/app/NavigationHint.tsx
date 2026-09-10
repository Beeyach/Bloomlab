import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import styles from './AppRail.module.css';

/** Outside the scroll clip; hoverable, focus-visible, Escape dismissible and viewport bounded. */
export function NavigationHint({
  label,
  enabled,
  children,
}: {
  label: string;
  enabled: boolean;
  children: ReactNode;
}) {
  const anchor = useRef<HTMLSpanElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
  };
  const show = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    if (!enabled || !window.matchMedia('(min-width: 768px)').matches) return;
    const rect = anchor.current?.querySelector('a, button')?.getBoundingClientRect();
    if (rect)
      setPosition({
        left: rect.right + 16,
        top: Math.max(24, Math.min(innerHeight - 24, rect.top + rect.height / 2)),
      });
  }, [enabled]);
  const hide = () => {
    cancel();
    timer.current = setTimeout(() => setPosition(null), 120);
  };
  useEffect(() => {
    const dismiss = () => setPosition(null);
    const scroll = () => {
      if (anchor.current?.contains(document.activeElement)) show();
      else dismiss();
    };
    const focus = () => {
      if (!anchor.current?.contains(document.activeElement)) dismiss();
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismiss();
    };
    window.addEventListener('resize', dismiss);
    document.addEventListener('scroll', scroll, true);
    document.addEventListener('focusin', focus);
    document.addEventListener('keydown', key);
    return () => {
      if (timer.current) clearTimeout(timer.current);
      window.removeEventListener('resize', dismiss);
      document.removeEventListener('scroll', scroll, true);
      document.removeEventListener('focusin', focus);
      document.removeEventListener('keydown', key);
    };
  }, [show]);
  return (
    <span
      ref={anchor}
      className={styles.hintAnchor}
      onPointerEnter={show}
      onPointerLeave={hide}
      onFocus={show}
      onBlur={() => {
        cancel();
        setPosition(null);
      }}
    >
      {children}
      {enabled &&
        position &&
        createPortal(
          <span
            role="tooltip"
            className={styles.tooltip}
            style={position}
            onPointerEnter={cancel}
            onPointerLeave={hide}
          >
            {label}
          </span>,
          document.body,
        )}
    </span>
  );
}
