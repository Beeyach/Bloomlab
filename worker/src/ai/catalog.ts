/** AI-005. First-party global standard pricing, USD/MTok. Verified 2026-09-07.
 * https://platform.claude.com/docs/en/about-claude/pricing
 * https://platform.claude.com/docs/en/models/sonnet-5/migration-guide
 */
export const MODEL_CATALOG_VERSION = '2026-09-07.1';
export const MODELS = {
  cheap: { id: 'claude-haiku-4-5-20251001', input: 1, output: 5, write: 1.25, read: 0.1 },
  strong: { id: 'claude-sonnet-5', input: 2, output: 10, write: 2.5, read: 0.2 },
} as const;
export type Model = (typeof MODELS)[keyof typeof MODELS];
export interface Usage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
}
export function cost(model: Model, usage: Usage): number {
  return (
    (usage.input_tokens * model.input +
      usage.output_tokens * model.output +
      usage.cache_creation_input_tokens * model.write +
      usage.cache_read_input_tokens * model.read) /
    1e6
  );
}
