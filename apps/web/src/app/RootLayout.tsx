import { useEffect } from 'react';
import { Outlet } from 'react-router';

import { ensureDevice, requestPersistentStorage, startSyncScheduler } from '../data';
import { ConflictChooser } from './ConflictChooser';
import styles from './RootLayout.module.css';
import { SyncStatusIndicator } from './SyncStatusIndicator';

/**
 * Phase 1 frame: skip link + main region. The compact left rail (DES-009) is Phase 7.
 * Phase 3 adds the device record on first run and the quiet sync indicator; Phase 4 the
 * background sync scheduler and the conflict chooser.
 */
export function RootLayout() {
  useEffect(() => {
    void ensureDevice().then(() => requestPersistentStorage());
    return startSyncScheduler();
  }, []);

  return (
    <div className={styles.frame}>
      <a className={styles.skipLink} href="#main">
        Skip to content
      </a>
      <SyncStatusIndicator className={styles.status} />
      <main id="main" className={styles.main} tabIndex={-1}>
        <Outlet />
      </main>
      <ConflictChooser />
    </div>
  );
}
