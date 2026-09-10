import { useLayoutEffect, useRef, type RefObject } from 'react';
import { SIDEBAR_DEFAULT, SIDEBAR_MIN } from './sidebarWidth';
import styles from './AppRail.module.css';

export function SidebarResizer({
  frame,
  width,
  maximum,
  controls,
  onCommit,
}: {
  frame: RefObject<HTMLDivElement | null>;
  width: number;
  maximum: number;
  controls: string;
  onCommit: (width: number) => void;
}) {
  const handle = useRef<HTMLDivElement>(null);
  const drag = useRef<{ pointer: number; startX: number; startWidth: number; next: number } | null>(
    null,
  );
  const animation = useRef<number | null>(null);
  const clamp = (value: number) => Math.round(Math.max(SIDEBAR_MIN, Math.min(maximum, value)));
  // One inherited CSS value moves both panes. Pointer moves do not rerender the app or write storage.
  const preview = (value: number) => {
    frame.current?.style.setProperty('--bl-sidebar-effective-width', `${value}px`);
    handle.current?.setAttribute('aria-valuenow', String(value));
    handle.current?.setAttribute('aria-valuetext', `${value} pixels`);
  };
  const cancelFrame = () => {
    if (animation.current !== null) cancelAnimationFrame(animation.current);
    animation.current = null;
  };
  const finish = (commit: boolean) => {
    const current = drag.current;
    if (!current) return;
    drag.current = null;
    cancelFrame();
    frame.current?.removeAttribute('data-sidebar-resizing');
    const next = commit ? clamp(current.next) : width;
    preview(next);
    if (handle.current?.hasPointerCapture(current.pointer))
      handle.current.releasePointerCapture(current.pointer);
    if (commit && next !== current.startWidth) onCommit(next);
  };
  useLayoutEffect(() => {
    const root = frame.current;
    const control = handle.current;
    root?.style.setProperty('--bl-sidebar-effective-width', `${width}px`);
    control?.setAttribute('aria-valuenow', String(width));
    control?.setAttribute('aria-valuetext', `${width} pixels`);
    // A viewport/state change cancels an unfinished gesture without losing the saved choice.
    return () => {
      if (animation.current !== null) cancelAnimationFrame(animation.current);
      animation.current = null;
      const current = drag.current;
      drag.current = null;
      if (current && control?.hasPointerCapture(current.pointer))
        control.releasePointerCapture(current.pointer);
      if (root) {
        root.removeAttribute('data-sidebar-resizing');
        root.style.setProperty('--bl-sidebar-effective-width', `${width}px`);
      }
    };
  }, [frame, width, maximum]);
  return (
    <div
      ref={handle}
      className={styles.resizer}
      data-testid="sidebar-resizer"
      role="separator"
      aria-label="Sidebar width"
      aria-orientation="vertical"
      aria-controls={controls}
      aria-valuemin={SIDEBAR_MIN}
      aria-valuemax={maximum}
      aria-valuenow={width}
      aria-valuetext={`${width} pixels`}
      tabIndex={0}
      onPointerDown={(event) => {
        if (event.button !== 0 || !event.isPrimary) return;
        event.preventDefault();
        event.currentTarget.focus();
        drag.current = {
          pointer: event.pointerId,
          startX: event.clientX,
          startWidth: width,
          next: width,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
        frame.current?.setAttribute('data-sidebar-resizing', 'true');
      }}
      onPointerMove={(event) => {
        const current = drag.current;
        if (!current || event.pointerId !== current.pointer) return;
        current.next = clamp(current.startWidth + event.clientX - current.startX);
        if (animation.current === null)
          animation.current = requestAnimationFrame(() => {
            animation.current = null;
            if (drag.current) preview(drag.current.next);
          });
      }}
      onPointerUp={(event) => {
        if (event.pointerId === drag.current?.pointer) finish(true);
      }}
      onPointerCancel={(event) => {
        if (event.pointerId === drag.current?.pointer) finish(false);
      }}
      onLostPointerCapture={() => finish(false)}
      onDoubleClick={() => {
        preview(clamp(SIDEBAR_DEFAULT));
        onCommit(clamp(SIDEBAR_DEFAULT));
      }}
      onKeyDown={(event) => {
        const keys: Record<string, number> = {
          ArrowLeft: width - 8,
          ArrowRight: width + 8,
          Home: SIDEBAR_MIN,
          End: maximum,
        };
        const next = keys[event.key];
        if (next === undefined) return;
        event.preventDefault();
        preview(clamp(next));
        onCommit(clamp(next));
      }}
    />
  );
}
