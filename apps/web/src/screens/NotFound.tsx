import { Link } from 'react-router';

import { Stack } from '@bloomlab/design-system';

import styles from './NotFound.module.css';

export function NotFound() {
  return (
    <Stack as="section" gap={3} className={styles.screen} aria-labelledby="not-found-title">
      <h1 id="not-found-title" className={styles.title}>
        Nothing at this address.
      </h1>
      <p className={styles.body}>
        <Link to="/">Back to Bloomlab</Link>
      </p>
    </Stack>
  );
}
