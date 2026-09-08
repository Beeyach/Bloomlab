import type { Exercise } from '@bloomlab/content-schema';
import type { CallState } from './engine';

/** Whitespace is a selection boundary, never a rewrite of the confirmed learner's words. */
export function literalQuote(text: string): string | null {
  if (/[<>\p{Cf}\p{Cs}]/u.test(text) || /\p{Cc}/u.test(text.replace(/[\t\r\n]/g, ''))) return null;
  // Select a run with ordinary single spaces. Tabs/newlines/repeated spaces separate runs,
  // so normalization cannot manufacture a quote that was absent from the original text.
  for (const match of text.matchAll(/[^\s]+(?: [^\s]+)*/gu)) {
    const quote = match[0]!
      .slice(0, 100)
      .replace(/[\uD800-\uDBFF]$/u, '')
      .trim();
    if (quote.length >= 3 && /[\p{L}\p{N}]/u.test(quote) && text.includes(quote)) return quote;
  }
  return null;
}

/** Only the displayed response changes; the authored engine owns every consequence. */
export function tailorResponse(exercise: Exercise, state: CallState, text: string): void {
  const goal = exercise.call?.open_response;
  const last = state.snapshot.turns.at(-1);
  if (!goal || !last || state.snapshot.complete || goal.node !== state.snapshot.current.node)
    return;
  const quote = literalQuote(text);
  if (!quote) return;
  state.snapshot.current = {
    ...state.snapshot.current,
    text: `You mentioned “${quote}”. ${goal.question}`,
    dynamic: true,
  };
  last.response = state.snapshot.current;
}
