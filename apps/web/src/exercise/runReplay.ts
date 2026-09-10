import type { GradingContext, GradingEvent } from '@bloomlab/exercise-engine';
import type { Exercise } from '@bloomlab/content-schema';

export interface RunReplay {
  events: GradingEvent[];
  prediction: Record<string, string>;
}
export const runReplayKey = (attemptId: string) => `exercise.replay.${attemptId}`;

/** A snapshot of actual runtime events, never the exercise's expected answers or a later run. */
export function captureRunReplay(
  exercise: Exercise,
  context: GradingContext,
  prediction: Record<string, string>,
): RunReplay {
  const contact = exercise.starting_state.contact_id;
  return {
    prediction: { ...prediction },
    events: structuredClone(
      context.events.filter((event) => !contact || event.fields.contact_id === contact),
    ).sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || a.index - b.index),
  };
}
