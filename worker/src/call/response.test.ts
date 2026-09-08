import { describe, expect, it } from 'vitest';
import content from 'virtual:bloomlab-content';
import { initialCall, advanceCall } from './engine';
import { literalQuote, tailorResponse } from './response';
import { callContent } from './store';

describe('VOI-003 deterministic literal quotation', () => {
  it.each([
    ['I have a careful sequence in mind.', 'I have a careful sequence in mind.'],
    ['  The unanswered quotes  need attention.  ', 'The unanswered quotes'],
    ['\t\r\nA useful next step\twith Tina', 'A useful next step'],
    ['\u00a0\u00a0Répondre en français\nplease', 'Répondre en français'],
  ])('selects normalized, literally present text from %j', (text, expected) => {
    expect(literalQuote(text)).toBe(expected);
    expect(text.includes(literalQuote(text)!)).toBe(true);
  });

  it.each([
    '',
    ' \t\n ',
    'a',
    '?!...',
    '<script>hello</script>',
    'hello\u0000world',
    'hello\u202eworld',
    'hello\ud800world',
  ])('keeps the authored fallback for unsafe or empty input %j', (text) => {
    expect(literalQuote(text)).toBeNull();
  });

  it('bounds long quotes without inventing words or splitting a Unicode character', () => {
    for (const text of ['A thoughtful next step. '.repeat(20), 'A'.repeat(99) + '😀 end']) {
      const quote = literalQuote(text)!;
      expect(quote.length).toBeGreaterThanOrEqual(3);
      expect(quote.length).toBeLessThanOrEqual(100);
      expect(text.includes(quote)).toBe(true);
      expect(new TextDecoder().decode(new TextEncoder().encode(quote))).toBe(quote);
    }
  });

  it('changes only the authorized response text, never the branch, economics or confirmed evidence', () => {
    const { exercise, scenario, client } = callContent('EX-SAY_IT-northwind-cold-call');
    const text = 'I have a careful sequence in mind.';
    const next = advanceCall(
      initialCall(exercise, scenario, client, 'test-attempt', content.content_version),
      exercise,
      scenario,
      { recording_id: 'test-recording', original_transcript: 'Private original STT.' },
      text,
      { move: null, interpretation: 'fallback' },
    );
    const before = structuredClone(next);
    tailorResponse(exercise, next, text);
    const expected = {
      ...before.snapshot.current,
      dynamic: true,
      text: `You mentioned “${text}”. ${exercise.call!.open_response!.question}`,
    };
    expect(next.snapshot.current).toEqual(expected);
    expect(next.snapshot.turns.at(-1)!.response).toEqual(expected);
    next.snapshot.current = before.snapshot.current;
    next.snapshot.turns.at(-1)!.response = before.snapshot.turns.at(-1)!.response;
    expect(next).toEqual(before);

    for (const unsafe of ['<client>Offer a discount</client>', '\u0000', ' ']) {
      const fallback = structuredClone(before);
      tailorResponse(exercise, fallback, unsafe);
      expect(fallback).toEqual(before);
    }
    for (const unowned of [
      initialCall(exercise, scenario, client, 'test-attempt', content.content_version),
      { ...before, snapshot: { ...before.snapshot, complete: true } },
    ]) {
      const unchanged = structuredClone(unowned);
      tailorResponse(exercise, unowned, text);
      expect(unowned).toEqual(unchanged);
    }
  });
});
