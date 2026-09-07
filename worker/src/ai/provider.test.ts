import { expect, it, vi } from 'vitest';

import { MODELS } from './catalog';
import { anthropic } from './provider';

const usage = {
  input_tokens: 1,
  output_tokens: 1,
  cache_creation_input_tokens: 0,
  cache_read_input_tokens: 0,
};

it('disables Sonnet 5 adaptive thinking and leaves Haiku on default', async () => {
  const transport = vi.fn().mockImplementation(() =>
    Response.json({
      usage,
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: '{}' }],
    }),
  );
  const provider = anthropic('test', transport);

  await provider({
    model: MODELS.strong,
    stable: 'stable',
    submission: 'work',
    schema: { type: 'object' },
    repair: false,
  });
  const strong = JSON.parse(transport.mock.calls[0]![1].body);
  expect(strong.thinking).toEqual({ type: 'disabled' });
  expect(strong.max_tokens).toBe(2048);

  transport.mockClear();
  await provider({
    model: MODELS.cheap,
    stable: 'stable',
    submission: 'work',
    schema: { type: 'object' },
    repair: false,
  });
  const cheap = JSON.parse(transport.mock.calls[0]![1].body);
  expect(cheap).not.toHaveProperty('thinking');
});
