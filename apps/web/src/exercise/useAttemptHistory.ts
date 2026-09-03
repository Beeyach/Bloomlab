import { useLiveQuery } from 'dexie-react-hooks';

import { db, type BloomlabDatabase } from '../data/db';
import type { ExerciseAttemptRecord } from '../data/types';
import { attemptHistory } from './finalize';

/** Every finalized attempt at this exercise, newest first. Undefined until the first read. */
export function useAttemptHistory(
  exerciseId: string,
  database: BloomlabDatabase = db,
): ExerciseAttemptRecord[] | undefined {
  return useLiveQuery(() => attemptHistory(exerciseId, database), [exerciseId, database]);
}
