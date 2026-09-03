import { fail } from './errors.ts';

/**
 * Seeded determinism (spec §9, SIM-012). `Math.random()` never appears in this package: a
 * scenario that needs probability declares a `seed`, and the same state, seed and event sequence
 * always produce the same run — which is what makes a probabilistic scenario gradable.
 *
 * The generator is mulberry32: one 32-bit word of state, exact integer arithmetic, identical on
 * every engine. The word itself is carried in the run's state, so a snapshot resumes the sequence
 * exactly where it stopped rather than restarting it or replaying every draw to catch up.
 */

export interface RandomState {
  /** The scenario's authored seed, kept so a run can say where its sequence came from. */
  seed: number;
  /** The generator's live 32-bit word. */
  word: number;
  /** How many values have been drawn; diagnostic, and proof a resume did not rewind. */
  draws: number;
}

const UINT32 = 0x100000000;

const asWord = (value: number) => value >>> 0;

export function createRandomState(seed: number): RandomState {
  if (!Number.isInteger(seed) || seed < 0 || seed >= UINT32) {
    fail('INVALID_RANDOM_STATE', `Seed must be a 32-bit unsigned integer, got ${seed}`, { seed });
  }
  return { seed, word: asWord(seed), draws: 0 };
}

export function assertRandomState(state: unknown): asserts state is RandomState {
  const candidate = state as RandomState | null;
  if (
    !candidate ||
    typeof candidate !== 'object' ||
    !Number.isInteger(candidate.seed) ||
    !Number.isInteger(candidate.word) ||
    !Number.isInteger(candidate.draws) ||
    candidate.draws < 0
  ) {
    fail('INVALID_RANDOM_STATE', 'Random state is missing or malformed', { state });
  }
}

/**
 * One draw. Returns the value in `[0, 1)` and the state that follows it — the caller threads the
 * new state through, so nothing here is stateful and a transition stays pure.
 */
export function nextRandom(state: RandomState): { value: number; state: RandomState } {
  let word = asWord(state.word + 0x6d2b79f5);
  let mixed = Math.imul(word ^ (word >>> 15), 1 | word);
  mixed = asWord(mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
  const value = asWord(mixed ^ (mixed >>> 14)) / UINT32;
  word = asWord(word);
  return { value, state: { seed: state.seed, word, draws: state.draws + 1 } };
}

/** An integer in `[min, max]`, inclusive. */
export function nextInt(
  state: RandomState,
  min: number,
  max: number,
): { value: number; state: RandomState } {
  if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
    fail('INVALID_RANDOM_STATE', `Invalid integer range ${min}..${max}`, { min, max });
  }
  const drawn = nextRandom(state);
  return { value: min + Math.floor(drawn.value * (max - min + 1)), state: drawn.state };
}

/** True with probability `chance` (0–1). */
export function nextChance(
  state: RandomState,
  chance: number,
): { value: boolean; state: RandomState } {
  const drawn = nextRandom(state);
  return { value: drawn.value < chance, state: drawn.state };
}
