import type { ComponentPropsWithRef } from 'react';

import { HoloMaterial } from '../holo/HoloMaterial';
import { cx } from '../utils/cx';
import { IdentityMark } from './IdentityMark';
import { StatusPill } from './StatusPill';
import styles from './ClientCaseCover.module.css';

export type ClientRelationship =
  'new' | 'prospect' | 'discovery' | 'proposal' | 'active' | 'paused' | 'lost';

export const RELATIONSHIP_LABELS: Record<ClientRelationship, string> = {
  new: 'New case',
  prospect: 'Prospect',
  discovery: 'In discovery',
  proposal: 'Proposal out',
  active: 'Active client',
  paused: 'Paused',
  lost: 'Deal lost',
};

export interface ClientCaseCoverProps extends ComponentPropsWithRef<'button'> {
  businessName: string;
  industry: string;
  relationship: ClientRelationship;
  /** Persistent multi-stage engagements (spec §27 Boss Client). */
  boss?: boolean;
  /** Fictional work is always labelled (spec §35, PORT-002). */
  label?: 'Simulation Project' | 'Demonstration Build';
}

/** Client case cover: collectible and premium, with an abstract identity mark (spec §78). */
export function ClientCaseCover({
  businessName,
  industry,
  relationship,
  boss = false,
  label = 'Simulation Project',
  className,
  type = 'button',
  ...rest
}: ClientCaseCoverProps) {
  return (
    <button type={type} className={cx(styles.cover, className)} {...rest}>
      <HoloMaterial
        as="span"
        variant={boss ? 'legendary' : 'collectible'}
        className={styles.material}
      >
        <span className={styles.inner}>
          <span className={styles.head}>
            <span className={styles.industry}>{industry}</span>
            <IdentityMark seed={businessName} size={44} />
          </span>
          <span className={styles.name}>{businessName}</span>
          <span className={styles.foot}>
            <StatusPill
              label={RELATIONSHIP_LABELS[relationship]}
              tone={
                relationship === 'active' ? 'success' : relationship === 'lost' ? 'neutral' : 'info'
              }
              glyph={relationship === 'active' ? 'check' : relationship === 'lost' ? 'dash' : 'dot'}
            />
            <span className={styles.kind}>{boss ? `Boss Client · ${label}` : label}</span>
          </span>
        </span>
      </HoloMaterial>
    </button>
  );
}
