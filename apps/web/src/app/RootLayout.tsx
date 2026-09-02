import { Outlet } from 'react-router';

import styles from './RootLayout.module.css';

/**
 * Phase 1 frame: skip link + main region. The compact left rail (DES-009) is Phase 7.
 */
export function RootLayout() {
  return (
    <div className={styles.frame}>
      <a className={styles.skipLink} href="#main">
        Skip to content
      </a>
      <main id="main" className={styles.main} tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  );
}
