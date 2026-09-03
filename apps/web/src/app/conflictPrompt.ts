import { useSyncExternalStore } from 'react';

/**
 * Whether the conflict chooser is postponed. Closing the sheet never discards anything: the
 * conflict stays in `sync_conflicts` and the sync screen offers "Choose now" to bring it back.
 */
let dismissedKey: string | null = null;
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((listener) => listener());

export function dismissConflictPrompt(key: string): void {
  dismissedKey = key;
  notify();
}

export function reopenConflictPrompt(): void {
  dismissedKey = null;
  notify();
}

export function useDismissedConflict(): string | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => dismissedKey,
    () => null,
  );
}
