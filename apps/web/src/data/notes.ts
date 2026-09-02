import { useLiveQuery } from 'dexie-react-hooks';

import { db, type BloomlabDatabase } from './db';
import { createSyncableStore, type SyncableStore } from './stores';
import type { NoteRecord } from './types';

export type NotesStore = SyncableStore<NoteRecord>;

export function createNotesStore(database: BloomlabDatabase = db): NotesStore {
  return createSyncableStore<NoteRecord>('notes', database);
}

/** Learner notes: the first syncable entity, used by later phases (notes drawer, evidence). */
export const notes: NotesStore = createNotesStore();

/** Live list of notes (newest first); undefined while the first query runs. */
export function useNotes(database: BloomlabDatabase = db): NoteRecord[] | undefined {
  return useLiveQuery(
    () =>
      database.notes
        .orderBy('updated_at')
        .reverse()
        .filter((row) => row.deleted_at === null)
        .toArray(),
    [database],
  );
}
