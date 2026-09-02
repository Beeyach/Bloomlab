import { Link } from 'react-router';

import { Cluster, Grid, Stack, Surface } from '@bloomlab/design-system';
import { APP_VERSION, CONTENT_VERSION } from '@bloomlab/shared';
import { SIMULATOR_VERSION } from '@bloomlab/simulator-core';

import { useFeatureFlags } from '../app/featureFlagsContext';
import { getRuntimeEnvironment } from '../app/runtime';
import { DeviceIdentity } from './DeviceIdentity';
import styles from './FoundationHome.module.css';

const FACTS = (environment: string) => [
  ['App', APP_VERSION],
  ['Content', CONTENT_VERSION ?? 'none'],
  ['Simulator', SIMULATOR_VERSION],
  ['Environment', environment],
];

/**
 * Phase 1 home. Shows the true state of the build. The Command Center (DES-010) replaces
 * this in Phase 7 once there is progress to continue.
 */
export default function FoundationHome() {
  const flags = useFeatureFlags();

  return (
    <Stack as="section" gap={4} className={styles.screen} aria-labelledby="home-title">
      <p className={styles.eyebrow}>Foundation build</p>
      <h1 id="home-title" className={styles.title}>
        Bloomlab
      </h1>
      <p className={styles.lede}>
        The repository foundation and design system are in place. No learning content is installed
        yet.
      </p>

      <Grid as="dl" minColumn="8rem" gap={3} className={styles.facts}>
        {FACTS(getRuntimeEnvironment()).map(([label, value]) => (
          <Surface key={label} padding="sm" className={styles.fact}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </Surface>
        ))}
      </Grid>

      <DeviceIdentity />

      {(flags.system_diagnostics || flags.design_gallery) && (
        <Cluster as="nav" gap={4} aria-label="Developer surfaces" className={styles.footer}>
          {flags.system_diagnostics && <Link to="/system">System diagnostics</Link>}
          {flags.design_gallery && <Link to="/design">Design gallery</Link>}
        </Cluster>
      )}
    </Stack>
  );
}
