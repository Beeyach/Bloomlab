import { describe, expect, it, vi } from 'vitest';

import { MODELS } from './catalog';
import { anthropic } from './provider';

const usage = {
  input_tokens: 1,
  output_tokens: 1,
  cache_creation_input_tokens: 0,
  cache_read_input_tokens: 0,
};

const response = () =>
  Response.json({
    usage,
    stop_reason: 'end_turn',
    content: [{ type: 'text', text: '{"ok":true}' }],
  });

describe('Anthropic model configuration', () => {
  it('disables Sonnet 5 adaptive thinking so the structured-output cap is fully available', async () => {
    const transport = vi.fn().mockResolvedValue(response());
    await anthropic('test', transport)({
      model: MODELS.strong,
      stable: 'stable',
      submission: 'work',
      schema: { type: 'object' },
      repair: false,
    });
    const body = JSON.parse(transport.mock.calls[0]![1].body);
    expect(body.thinking).toEqual({ type: 'disabled' });
    expect(body.max_tokens).toBe(2048);
  });

  it('leaves Haiku 4.5 on its no-thinking default', async () => {
    const transport = vi.fn().mockResolvedValue(response());
    await anthropic('test', transport)({
      model: MODELS.cheap,
      stable: 'stable',
      submission: 'work',
      schema: { type: 'object' },
      repair: false,
    });
    const body = JSON.parse(transport.mock.calls[0]![1].body);
    expect(body).not.toHaveProperty('thinking');
  });
});
