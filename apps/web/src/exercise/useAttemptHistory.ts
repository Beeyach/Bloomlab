import { useLiveQuery } from 'dexie-react-hooks';

import { db, type BloomlabDatabase } from '../data/db';
import type { ExerciseAttemptRecord } from '../data/types';
import { NORMAL_RUN, type AttemptContext } from './attempt';
import { attemptsInContext } from './finalize';

/**
 * The finalized attempts for the run context on screen, newest first (D-072). A normal run does
 * not show a review's result and a review does not show a normal run's; the whole history stays
 * available through `attemptHistory`. Undefined until the first read.
 */
export function useAttemptHistory(
  exerciseId: string,
  context: AttemptContext = NORMAL_RUN,
  database: BloomlabDatabase = db,
): ExerciseAttemptRecord[] | undefined {
  const key = `${exerciseId}|${context.run}|${context.skill_id ?? ''}`;
  return useLiveQuery(() => attemptsInContext(exerciseId, context, database), [key, database]);
}
