import { useEffect } from 'react';
import { Outlet } from 'react-router';

import {
  db,
  ensureDevice,
  recomputeProgress,
  requestPersistentStorage,
  startSyncScheduler,
  syncApi,
} from '../data';
import { ConflictChooser } from './ConflictChooser';
import styles from './RootLayout.module.css';
import { SyncStatusIndicator } from './SyncStatusIndicator';

/**
 * Phase 1 frame: skip link + main region. The compact left rail (DES-009) is Phase 7.
 * Phase 3 adds the device record on first run and the quiet sync indicator; Phase 4 the
 * background sync scheduler and the conflict chooser; Phase 6 recomputes the learner's
 * progress from evidence on start and after every sync that brought something in.
 */
export function RootLayout() {
  useEffect(() => {
    void ensureDevice()
      .then(() => requestPersistentStorage())
      .then(() => recomputeProgress());
    return startSyncScheduler(db, syncApi, {
      afterSync: (result) => {
        if (result.status === 'synced' && result.pulled + result.adopted > 0) {
          void recomputeProgress();
        }
      },
    });
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
