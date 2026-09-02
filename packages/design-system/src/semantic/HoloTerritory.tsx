import type { ComponentPropsWithRef } from 'react';

import { HoloMaterial } from '../holo/HoloMaterial';
import { cx } from '../utils/cx';
import { TERRITORY_LABELS, type Territory } from './domain';
import styles from './HoloTerritory.module.css';

export interface HoloTerritoryProps extends ComponentPropsWithRef<'button'> {
  territory: Territory;
  /** One line of what the territory covers. */
  scope: string;
  demonstrated: number;
  total: number;
}

/** Skill Map territory as a collectible holographic object (spec §75, DES-011). */
export function HoloTerritory({
  territory,
  scope,
  demonstrated,
  total,
  className,
  type = 'button',
  ...rest
}: HoloTerritoryProps) {
  const ratio = total > 0 ? Math.min(1, demonstrated / total) : 0;
  const complete = total > 0 && demonstrated >= total;
  return (
    <button
      type={type}
      className={cx(styles.territory, className)}
      data-territory={territory}
      {...rest}
    >
      <HoloMaterial
        as="span"
        variant={complete ? 'mastery' : 'collectible'}
        className={styles.material}
      >
        <span className={styles.inner}>
          <span>
            <span className={styles.name}>{TERRITORY_LABELS[territory]}</span>
            <span className={styles.scope}>{scope}</span>
          </span>
          <span className={styles.progress}>
            <span className={styles.count}>
              {demonstrated} of {total} capabilities demonstrated
            </span>
            <span className={styles.track} aria-hidden="true">
              <span className={styles.fill} style={{ width: `${ratio * 100}%` }} />
            </span>
          </span>
        </span>
      </HoloMaterial>
    </button>
  );
}
