import { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router';
import { BUILD_ID } from '@bloomlab/shared';

import {
  db,
  ensureDevice,
  recomputeProgress,
  requestPersistentStorage,
  startSyncScheduler,
  syncApi,
} from '../data';
import { AppRail } from './AppRail';
import { useSidebarPreference } from './useSidebarPreference';
import { ConflictChooser } from './ConflictChooser';
import styles from './RootLayout.module.css';
import { SyncStatusIndicator } from './SyncStatusIndicator';
import { UpdateNotice } from '../pwa/UpdateNotice';
import { SoundToggle } from '../moments/SoundToggle';

/**
 * The app frame: skip link, the compact rail (spec §73, DES-009), the main region.
 * Phase 3 adds the device record on first run and the quiet sync indicator; Phase 4 the
 * background sync scheduler and the conflict chooser; Phase 6 recomputes the learner's
 * progress from evidence on start and after every sync that brought something in.
 */
export function RootLayout() {
  const navigate = useNavigate();
  const { collapsed, toggle } = useSidebarPreference();
  useEffect(() => {
    const search = (event: KeyboardEvent) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        !event.shiftKey &&
        !event.repeat &&
        event.key.toLowerCase() === 'k'
      ) {
        event.preventDefault();
        const field = document.querySelector<HTMLInputElement>('[data-global-search]');
        if (field) field.focus();
        else navigate('/search');
      }
    };
    document.addEventListener('keydown', search);
    return () => document.removeEventListener('keydown', search);
  }, [navigate]);
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
    <div
      className={styles.frame}
      data-build-id={BUILD_ID}
      data-sidebar={collapsed ? 'collapsed' : 'expanded'}
    >
      <a className={styles.skipLink} href="#main">
        Skip to content
      </a>
      <AppRail collapsed={collapsed} onToggle={toggle} />
      <div className={styles.status}>
        <SoundToggle />
        <SyncStatusIndicator />
      </div>
      <main id="main" className={styles.main} tabIndex={-1}>
        <UpdateNotice />
        <Outlet />
      </main>
      <ConflictChooser />
    </div>
  );
}
