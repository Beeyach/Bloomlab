import type { GradingEvent } from '@bloomlab/exercise-engine';
import type { RunPredictionCheckpoint } from './response';

export interface PredictionRunIdentity {
  run_id: string;
  generation: string;
}

/** Only events emitted after the immutable prediction boundary may grade this attempt. */
export function eventsAfterPrediction(
  events: readonly GradingEvent[],
  checkpoint: RunPredictionCheckpoint,
  current: PredictionRunIdentity,
): GradingEvent[] {
  const sameGeneration =
    checkpoint.run_id === current.run_id && checkpoint.run_generation === current.generation;
  return (
    sameGeneration ? events.filter((event) => event.index > checkpoint.through_event_index) : events
  ).map((event) => structuredClone(event));
}
