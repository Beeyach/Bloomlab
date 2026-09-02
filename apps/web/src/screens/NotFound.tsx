import { Link } from 'react-router';

import styles from './NotFound.module.css';

export function NotFound() {
  return (
    <section className={styles.screen} aria-labelledby="not-found-title">
      <h1 id="not-found-title" className={styles.title}>
        Nothing at this address.
      </h1>
      <p className={styles.body}>
        <Link to="/">Back to Bloomlab</Link>
      </p>
    </section>
  );
}
