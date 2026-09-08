import { Button, type ButtonProps } from '@bloomlab/design-system';
import styles from './call.module.css';

/** Presentation only: the caller's existing phase/request state owns progress. The live
 * status sits outside the busy button so aria-busy does not defer its announcement. */
export function CallAction({
  loading = false,
  pendingLabel,
  children,
  ...props
}: ButtonProps & { pendingLabel: string }) {
  return (
    <>
      <Button {...props} loading={loading} disabled={props.disabled || loading}>
        {loading ? pendingLabel : children}
      </Button>
      <span className={styles.srOnly} role="status" aria-live="polite" aria-atomic="true">
        {loading ? pendingLabel : ''}
      </span>
    </>
  );
}
