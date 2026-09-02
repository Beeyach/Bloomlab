import type { ComponentPropsWithRef } from 'react';

import { HoloMaterial, type HoloVariant } from '../holo/HoloMaterial';
import { cx } from '../utils/cx';
import { TERRITORY_LABELS, type MasteryState, type Territory } from './domain';
import { MasteryBadge } from './MasteryBadge';
import styles from './SkillCard.module.css';

export interface SkillCardProps extends Omit<ComponentPropsWithRef<'button'>, 'title'> {
  title: string;
  territory: Territory;
  state: MasteryState;
  summary?: string;
  /** Independent demonstrations recorded (spec §159 language, not XP). */
  demonstrations?: number;
}

function materialFor(state: MasteryState): HoloVariant | null {
  if (state === 'MASTERED') return 'mastery';
  if (state === 'INDEPENDENT' || state === 'PRESSURE_TESTED') return 'soft';
  return null;
}

/**
 * A skill in the map or a session. Material escalates with mastery (spec §75): flat until
 * independent, soft holo when independent or pressure-tested, mastery holo when mastered.
 */
export function SkillCard({
  title,
  territory,
  state,
  summary,
  demonstrations,
  className,
  type = 'button',
  ...rest
}: SkillCardProps) {
  const variant = materialFor(state);
  const inner = (
    <span className={styles.inner}>
      <span className={styles.top}>
        <span>
          <span className={styles.territory}>{TERRITORY_LABELS[territory]}</span>
          <span className={styles.title}>{title}</span>
        </span>
        <MasteryBadge state={state} />
      </span>
      {summary && <span className={styles.summary}>{summary}</span>}
      {demonstrations !== undefined && (
        <span className={styles.meta}>
          {demonstrations} {demonstrations === 1 ? 'demonstration' : 'demonstrations'}
        </span>
      )}
    </span>
  );

  return (
    <button
      type={type}
      className={cx(
        styles.card,
        !variant && styles.flat,
        state === 'UNSEEN' && styles.unseen,
        className,
      )}
      data-state={state}
      {...rest}
    >
      {variant ? (
        <HoloMaterial as="span" variant={variant} radius="lg" className={styles.material}>
          {inner}
        </HoloMaterial>
      ) : (
        inner
      )}
    </button>
  );
}
