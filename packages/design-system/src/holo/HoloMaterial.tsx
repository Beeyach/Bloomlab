import {
  useCallback,
  useEffect,
  useRef,
  type HTMLAttributes,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type Ref,
} from 'react';

import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import { cx } from '../utils/cx';
import styles from './HoloMaterial.module.css';

export type HoloVariant = 'soft' | 'collectible' | 'mastery' | 'legendary';

export interface HoloMaterialProps extends HTMLAttributes<HTMLElement> {
  /** `span` when the material sits inside a button or link (valid phrasing content). */
  as?: 'div' | 'span';
  variant?: HoloVariant;
  radius?: 'md' | 'lg' | 'xl';
  /** Turn pointer physics off (static material, e.g. inside a list of many cards). */
  interactive?: boolean;
  ref?: Ref<HTMLElement>;
  children?: ReactNode;
}

const clamp = (value: number) => Math.max(-1, Math.min(1, value));

/**
 * The one holographic material (spec §67). Pearlescent base, spectral layer, moving
 * reflection, fine foil, edge sheen, pointer tilt and touch response. Pointer maths run in
 * JavaScript; every visual response is CSS driven by `--holo-nx` / `--holo-ny`, so reduced
 * motion (token override) and off-screen elements (no listeners) cost nothing.
 */
export function HoloMaterial({
  as: Tag = 'div',
  variant = 'collectible',
  radius = 'xl',
  interactive = true,
  ref: externalRef,
  className,
  children,
  onPointerEnter,
  onPointerDown,
  onPointerMove,
  onPointerLeave,
  onPointerUp,
  onPointerCancel,
  ...rest
}: HoloMaterialProps) {
  const ref = useRef<HTMLElement | null>(null);
  const frame = useRef<number | null>(null);
  const pending = useRef<{ nx: number; ny: number } | null>(null);
  const visible = useRef(true);
  const reducedMotion = usePrefersReducedMotion();
  const physics = interactive && !reducedMotion;

  const setRef = useCallback(
    (element: HTMLElement | null) => {
      ref.current = element;
      if (typeof externalRef === 'function') externalRef(element);
      else if (externalRef) externalRef.current = element;
    },
    [externalRef],
  );

  // Listeners are only worth having while the element is on screen (MOT-004, PERF-003).
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => {
      visible.current = entry?.isIntersecting ?? true;
      if (!visible.current) settle(element);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    },
    [],
  );

  const flush = useCallback(() => {
    frame.current = null;
    const element = ref.current;
    const next = pending.current;
    if (!element || !next) return;
    element.style.setProperty('--holo-nx', next.nx.toFixed(3));
    element.style.setProperty('--holo-ny', next.ny.toFixed(3));
  }, []);

  const track = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const element = ref.current;
      if (!element || !physics || !visible.current) return;
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      pending.current = {
        nx: clamp(((event.clientX - rect.left) / rect.width) * 2 - 1),
        ny: clamp(((event.clientY - rect.top) / rect.height) * 2 - 1),
      };
      element.dataset.tracking = 'true';
      if (frame.current === null) {
        frame.current =
          typeof requestAnimationFrame === 'function' ? requestAnimationFrame(flush) : (flush(), 0);
      }
    },
    [flush, physics],
  );

  const release = useCallback(() => {
    const element = ref.current;
    if (element) settle(element);
  }, []);

  return (
    <Tag
      ref={setRef}
      className={cx(
        styles.holo,
        styles[variant],
        radius === 'md' && styles.radiusMd,
        radius === 'lg' && styles.radiusLg,
        className,
      )}
      data-variant={variant}
      onPointerEnter={(event: ReactPointerEvent<HTMLElement>) => {
        onPointerEnter?.(event);
        if (event.pointerType === 'mouse') track(event);
      }}
      onPointerDown={(event: ReactPointerEvent<HTMLElement>) => {
        onPointerDown?.(event);
        track(event);
      }}
      onPointerMove={(event: ReactPointerEvent<HTMLElement>) => {
        onPointerMove?.(event);
        // Touch only follows while pressed (spec §68: press → drag → release).
        if (event.pointerType === 'mouse' || event.buttons > 0) track(event);
      }}
      onPointerLeave={(event: ReactPointerEvent<HTMLElement>) => {
        onPointerLeave?.(event);
        release();
      }}
      onPointerUp={(event: ReactPointerEvent<HTMLElement>) => {
        onPointerUp?.(event);
        if (event.pointerType !== 'mouse') release();
      }}
      onPointerCancel={(event: ReactPointerEvent<HTMLElement>) => {
        onPointerCancel?.(event);
        release();
      }}
      {...rest}
    >
      <span className={cx(styles.layer, styles.pearl)} aria-hidden="true" />
      <span className={cx(styles.layer, styles.spectral)} aria-hidden="true" />
      <span className={cx(styles.layer, styles.reflection)} aria-hidden="true" />
      <span className={cx(styles.layer, styles.foil)} aria-hidden="true" />
      <span className={cx(styles.layer, styles.sheen)} aria-hidden="true" />
      <span className={styles.content}>{children}</span>
    </Tag>
  );
}

/** Return to neutral; the CSS transition provides the 350–500 ms settle (HOL-003). */
function settle(element: HTMLElement) {
  delete element.dataset.tracking;
  element.style.setProperty('--holo-nx', '0');
  element.style.setProperty('--holo-ny', '0');
}
