import styles from './RouteLoading.module.css';

export function RouteLoading() {
  return (
    <p className={styles.loading} role="status" aria-live="polite">
      Loading…
    </p>
  );
}
