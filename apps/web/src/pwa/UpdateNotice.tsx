import { useSyncExternalStore } from 'react';
import { Button } from '@bloomlab/design-system';
import { updates } from './updates';
import styles from './update.module.css';

export function UpdateNotice() {
  const state = useSyncExternalStore(updates.subscribe, updates.snapshot);
  if (!state.available && !state.checkError) return null;
  return (
    <section className={styles.notice} aria-label="App update" data-testid="app-update">
      <div role="status" aria-live="polite" aria-atomic="true">
        {state.available ? (
          <>
            <strong>Update available</strong>
            <p>
              {state.blocked
                ? 'Finish the current call step first. The update will be available after your reply is safely saved and confirmed.'
                : 'Reload to use the latest Bloomlab. Your saved work stays on this device.'}
            </p>
            {(state.error ?? state.checkError) && <p>{state.error ?? state.checkError}</p>}
          </>
        ) : (
          <>
            <strong>Could not check for updates</strong>
            <p>Your saved work is still here. Reconnect and try again.</p>
          </>
        )}
      </div>
      {state.available ? (
        <Button
          disabled={state.blocked > 0}
          loading={state.applying}
          onClick={() => void updates.apply()}
        >
          {state.applying ? 'Updating…' : 'Reload to update'}
        </Button>
      ) : (
        <Button loading={state.checking} onClick={() => void updates.check()}>
          {state.checking ? 'Checking…' : 'Check for updates'}
        </Button>
      )}
    </section>
  );
}
