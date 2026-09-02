import { colors } from '../tokens';
import { cx } from '../utils/cx';
import { hashString } from './domain';
import styles from './IdentityMark.module.css';

const ACCENTS = [
  colors.sky,
  colors.bubblegum,
  colors.lavender,
  colors.aqua,
  colors.lemon,
  colors.peach,
  colors.ice,
] as const;

export interface IdentityMarkProps {
  /** Any stable string (client id or business name); the same seed always draws the same mark. */
  seed: string;
  size?: number;
  className?: string;
}

/**
 * Abstract identity treatment for clients (spec §78, DES-012): a deterministic composition of
 * a gradient field and three simple shapes, so no stock photos are ever needed.
 */
export function IdentityMark({ seed, size = 48, className }: IdentityMarkProps) {
  const hash = hashString(seed);
  const a = ACCENTS[hash % ACCENTS.length] ?? colors.sky;
  const b = ACCENTS[(hash >>> 4) % ACCENTS.length] ?? colors.lavender;
  const angle = hash % 360;
  const cx1 = 22 + ((hash >>> 8) % 40);
  const cy1 = 22 + ((hash >>> 12) % 40);
  const r = 10 + ((hash >>> 16) % 12);
  const rot = (hash >>> 20) % 90;
  const ringX = 30 + ((hash >>> 24) % 30);
  const gradientId = `im-${hash.toString(16)}`;

  return (
    <svg
      className={cx(styles.mark, className)}
      width={size}
      height={size}
      viewBox="0 0 80 80"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={gradientId} gradientTransform={`rotate(${angle} 0.5 0.5)`}>
          <stop offset="0" stopColor={a} />
          <stop offset="1" stopColor={b} />
        </linearGradient>
      </defs>
      <rect width="80" height="80" rx="16" fill={`url(#${gradientId})`} />
      <circle cx={cx1} cy={cy1} r={r} fill={colors.snow} fillOpacity="0.85" />
      <rect
        x="34"
        y="34"
        width="30"
        height="18"
        rx="6"
        fill={colors.ink}
        fillOpacity="0.8"
        transform={`rotate(${rot} 49 43)`}
      />
      <circle
        cx={ringX}
        cy="58"
        r="9"
        fill="none"
        stroke={colors.snow}
        strokeWidth="3"
        strokeOpacity="0.9"
      />
    </svg>
  );
}
