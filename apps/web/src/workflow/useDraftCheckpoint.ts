import { useCallback, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type BloomlabDatabase } from '../data/db';
import { loadWorkspace, saveWorkspace } from '../data/workspace';
import type { DraftHistory } from './draft';

export interface DraftCheckpoint {
  key: string;
  version: number;
  history: DraftHistory;
}

/** Local-only editing checkpoints. Account saves still own the single sync/event boundary. */
export function useDraftCheckpoint(key: string | null, database: BloomlabDatabase = db) {
  const [memory, setMemory] = useState<DraftCheckpoint | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const sequence = useRef(0);
  const loaded = useLiveQuery(async () => {
    if (!key) return { key, checkpoint: null, error: false };
    try {
      return {
        key,
        checkpoint: (await loadWorkspace<DraftCheckpoint>(key, database)) ?? null,
        error: false,
      };
    } catch {
      return { key, checkpoint: null, error: true };
    }
  }, [key, database, retry]);

  const persist = useCallback(
    (checkpoint: DraftCheckpoint) => {
      const ticket = ++sequence.current;
      setMemory(checkpoint);
      setFailure(null);
      // Dexie starts read/write transactions in call order; no server or sync operation.
      void saveWorkspace(checkpoint.key, checkpoint, database).catch(() => {
        if (sequence.current === ticket) setFailure(checkpoint.key);
      });
    },
    [database],
  );

  return {
    checkpoint: memory?.key === key ? memory : loaded?.key === key ? loaded.checkpoint : null,
    ready: loaded?.key === key && !loaded.error,
    readError: loaded?.key === key && loaded.error,
    writeError: failure === key && key !== null,
    persist,
    retryRead: () => setRetry((value) => value + 1),
    retryWrite: () => {
      if (memory?.key === key) persist(memory);
    },
    clearMemory: () => setMemory(null),
  };
}

export function workflowDraftKey(runId: string, generation: string, workflowId: string): string {
  return `workflow.draft.${JSON.stringify([runId, generation, workflowId])}`;
}
