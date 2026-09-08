import type { Exercise } from '@bloomlab/content-schema';
import type { CallSnapshot } from '@bloomlab/shared';

/** Explain an observed authored fallback; never select a branch or infer intent from prose. */
export function recoveryCue(exercise: Exercise, snapshot: CallSnapshot | null): string | null {
  if (!['guided', 'practice'].includes(exercise.mode) || !snapshot || snapshot.complete)
    return null;
  const last = snapshot.turns.at(-1);
  const previous = exercise.conversation?.nodes.find((node) => node.id === last?.client.node);
  const current = exercise.conversation?.nodes.find((node) => node.id === snapshot.current.node);
  if (
    !last ||
    !previous ||
    !current ||
    previous.moves.some((move) => move.id === last.move) ||
    previous.fallback !== current.id ||
    last.response.node !== current.id
  )
    return null;
  return (
    current.moves.find(
      (move) => move.next !== current.id && ['ask', 'clarify', 'reflect'].includes(move.kind),
    )?.label ??
    exercise.call?.anchors[0] ??
    exercise.call?.objective ??
    null
  );
}
