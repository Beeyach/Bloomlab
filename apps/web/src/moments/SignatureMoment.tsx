import type { ReactNode } from 'react';
import { RewardReveal, usePrefersReducedMotion } from '@bloomlab/design-system';
import styles from './moments.module.css';

export type Moment = 'client-case' | 'failed-test' | 'independent-pass' | 'field-ready';

/** Presentation only. The caller supplies a real outcome; this never writes evidence/progress. */
export function SignatureMoment({
  kind,
  active = true,
  children,
}: {
  kind: Moment;
  active?: boolean;
  children: ReactNode;
}) {
  const reduced = usePrefersReducedMotion();
  const major = kind === 'independent-pass' || kind === 'field-ready';
  return (
    <div
      data-signature={kind}
      data-motion={active && !reduced ? 'enabled' : 'static'}
      className={active && !major && !reduced ? styles.arrival : undefined}
    >
      {active && major ? (
        <RewardReveal recognition durationMs={1800} skipLabel="Skip recognition">
          {children}
        </RewardReveal>
      ) : (
        children
      )}
    </div>
  );
}
