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
import { motion } from '../tokens';
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
  /**
   * Where the rounded clip lives relative to the tilt (D-086).
   *
   * `single` — one element carries the transform, the radius and `overflow: hidden`, which is the
   * shipped material. `split` — the transform and the drop shadow stay outside and an inner
   * element does the clipping, so a compositor is never asked to apply a rounded clip to a surface
   * whose transform is changing. Only the holographic diagnostic renders `split` today; it exists
   * to be told apart from `single` on a real tablet, and nothing else may depend on it until that
   * comparison has an answer.
   */
  surface?: 'single' | 'split';
  ref?: Ref<HTMLElement>;
  children?: ReactNode;
}

interface Pose {
  nx: number;
  ny: number;
  lift: number;
}

/** Time constant while following the pointer: ≈ 120 ms to settle on a new position. */
const FOLLOW_TAU_MS = 40;
/** Time constant on release: ≈ 95 % of the way back at `motion.settle` (420 ms, HOL-003). */
const SETTLE_TAU_MS = motion.settle / 3;
const EPSILON = 0.002;
const NEUTRAL: Pose = { nx: 0, ny: 0, lift: 0 };

const clamp = (value: number) => Math.max(-1, Math.min(1, value));

/**
 * The one holographic material (spec §67), modelled on foil trading cards: pearlescent base,
 * sweeping spectral bands, metallic grain, pointer-following glare, rim light, restrained tilt
 * and touch response. Pointer maths and smoothing run in a frame loop (D-022); every visual
 * response is CSS driven by the `--holo-*` custom properties, so reduced motion (token
 * override, no loop) and off-screen elements (no listeners) cost nothing.
 */
export function HoloMaterial({
  as: Tag = 'div',
  variant = 'collectible',
  radius = 'xl',
  interactive = true,
  surface = 'single',
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
  const lastTime = useRef<number | null>(null);
  const target = useRef<Pose>({ ...NEUTRAL });
  const current = useRef<Pose>({ ...NEUTRAL });
  const settling = useRef(false);
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

  const finish = useCallback(() => {
    lastTime.current = null;
    if (settling.current) {
      settling.current = false;
      delete ref.current?.dataset.tracking;
    }
  }, []);

  const step = useCallback(
    (now: number) => {
      frame.current = null;
      const element = ref.current;
      if (!element) return;
      const dt = lastTime.current === null ? 16 : Math.min(64, now - lastTime.current);
      lastTime.current = now;
      const tau = settling.current ? SETTLE_TAU_MS : FOLLOW_TAU_MS;
      const k = 1 - Math.exp(-dt / tau);
      const c = current.current;
      const t = target.current;
      c.nx += (t.nx - c.nx) * k;
      c.ny += (t.ny - c.ny) * k;
      c.lift += (t.lift - c.lift) * k;
      const done =
        Math.abs(t.nx - c.nx) < EPSILON &&
        Math.abs(t.ny - c.ny) < EPSILON &&
        Math.abs(t.lift - c.lift) < EPSILON;
      if (done) Object.assign(c, t);
      applyPose(element, c);
      if (done) finish();
      else frame.current = requestAnimationFrame(step);
    },
    [finish],
  );

  const schedule = useCallback(() => {
    if (frame.current !== null) return;
    if (typeof requestAnimationFrame === 'function') {
      frame.current = requestAnimationFrame(step);
      return;
    }
    // No frame loop available: snap to the target.
    const element = ref.current;
    if (!element) return;
    Object.assign(current.current, target.current);
    applyPose(element, current.current);
    finish();
  }, [finish, step]);

  const release = useCallback(() => {
    if (!ref.current?.dataset.tracking) return;
    target.current = { ...NEUTRAL };
    settling.current = true;
    schedule();
  }, [schedule]);

  const track = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const element = ref.current;
      if (!element || !physics || !visible.current) return;
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      target.current = {
        nx: clamp(((event.clientX - rect.left) / rect.width) * 2 - 1),
        ny: clamp(((event.clientY - rect.top) / rect.height) * 2 - 1),
        lift: 1,
      };
      settling.current = false;
      element.dataset.tracking = 'true';
      schedule();
    },
    [physics, schedule],
  );

  // Listeners are only worth having while the element is on screen (MOT-004, PERF-003).
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => {
      visible.current = entry?.isIntersecting ?? true;
      if (!visible.current) release();
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [release]);

  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    },
    [],
  );

  const stack = (
    <>
      <span className={cx(styles.layer, styles.pearl)} data-layer="pearl" aria-hidden="true" />
      <span className={cx(styles.layer, styles.bands)} data-layer="bands" aria-hidden="true" />
      <span className={cx(styles.layer, styles.grain)} data-layer="grain" aria-hidden="true" />
      <span className={cx(styles.layer, styles.glare)} data-layer="glare" aria-hidden="true" />
      <span className={cx(styles.layer, styles.rim)} data-layer="rim" aria-hidden="true" />
    </>
  );

  return (
    <Tag
      ref={setRef}
      className={cx(
        styles.holo,
        surface === 'split' && styles.split,
        styles[variant],
        radius === 'md' && styles.radiusMd,
        radius === 'lg' && styles.radiusLg,
        className,
      )}
      data-variant={variant}
      data-surface={surface}
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
      {surface === 'split' ? (
        <span className={styles.surface} data-layer="surface">
          {stack}
          <span className={styles.content} data-layer="content">
            {children}
          </span>
        </span>
      ) : (
        <>
          {stack}
          <span className={styles.content} data-layer="content">
            {children}
          </span>
        </>
      )}
    </Tag>
  );
}

/** Writes the pose as custom properties; the stylesheet turns them into tilt, light and colour. */
function applyPose(element: HTMLElement, { nx, ny, lift }: Pose) {
  const hyp = Math.min(1, Math.hypot(nx, ny));
  // Conic "from" angles run clockwise from the top, so measure the pointer the same way.
  const angle = hyp < EPSILON ? 135 : (Math.atan2(nx, -ny) * 180) / Math.PI;
  const style = element.style;
  style.setProperty('--holo-nx', nx.toFixed(3));
  style.setProperty('--holo-ny', ny.toFixed(3));
  style.setProperty('--holo-px', (50 + nx * 50).toFixed(1));
  style.setProperty('--holo-py', (50 + ny * 50).toFixed(1));
  style.setProperty('--holo-hyp', hyp.toFixed(3));
  style.setProperty('--holo-angle', `${angle.toFixed(1)}deg`);
  style.setProperty('--holo-lift', lift.toFixed(3));
}
