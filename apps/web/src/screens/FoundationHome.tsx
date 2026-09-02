import { Link } from 'react-router';

import { APP_VERSION, CONTENT_VERSION } from '@bloomlab/shared';
import { SIMULATOR_VERSION } from '@bloomlab/simulator-core';

import { useFeatureFlags } from '../app/featureFlagsContext';
import { getRuntimeEnvironment } from '../app/runtime';
import styles from './FoundationHome.module.css';

/**
 * Phase 1 home. Shows the true state of the build. The Command Center (DES-010) replaces
 * this in Phase 7 once there is progress to continue.
 */
export default function FoundationHome() {
  const flags = useFeatureFlags();

  return (
    <section className={styles.screen} aria-labelledby="home-title">
      <p className={styles.eyebrow}>Foundation build</p>
      <h1 id="home-title" className={styles.title}>
        Bloomlab
      </h1>
      <p className={styles.lede}>
        The repository foundation is in place. No learning content is installed yet.
      </p>

      <dl className={styles.facts}>
        <div className={styles.fact}>
          <dt>App</dt>
          <dd>{APP_VERSION}</dd>
        </div>
        <div className={styles.fact}>
          <dt>Content</dt>
          <dd>{CONTENT_VERSION ?? 'none'}</dd>
        </div>
        <div className={styles.fact}>
          <dt>Simulator</dt>
          <dd>{SIMULATOR_VERSION}</dd>
        </div>
        <div className={styles.fact}>
          <dt>Environment</dt>
          <dd>{getRuntimeEnvironment()}</dd>
        </div>
      </dl>

      {flags.system_diagnostics && (
        <p className={styles.footer}>
          <Link to="/system">System diagnostics</Link>
        </p>
      )}
    </section>
  );
}
