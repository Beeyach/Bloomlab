import { useSyncExternalStore } from 'react';
import { Button } from '@bloomlab/design-system';
import { updates } from './updates';
import styles from './update.module.css';

export function UpdateNotice() {
  const state = useSyncExternalStore(updates.subscribe, updates.snapshot);
  if (!state.available) return null;
  return (
    <section className={styles.notice} aria-label="App update" data-testid="app-update">
      <div role="status" aria-live="polite" aria-atomic="true">
        <strong>Update available</strong>
        <p>
          {state.blocked
            ? 'Finish the current call step first. The update will be available after your reply is safely saved and confirmed.'
            : 'Reload to use the latest Bloomlab. Your saved work stays on this device.'}
        </p>
        {(state.error ?? state.checkError) && <p>{state.error ?? state.checkError}</p>}
      </div>
      <Button
        disabled={state.blocked > 0}
        loading={state.applying}
        onClick={() => void updates.apply()}
      >
        {state.applying ? 'Updating…' : 'Reload to update'}
      </Button>
    </section>
  );
}
