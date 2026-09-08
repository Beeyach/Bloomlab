import type { AiMode } from '@bloomlab/shared';
import { MODELS, type Model } from './catalog';
export function route(
  mode: AiMode,
  spent: number,
  limit: number,
  modelClass: 'none' | 'cheap' | 'strong',
  important: boolean,
  optional = false,
): Model | null {
  if (mode === 'Off' || modelClass === 'none' || limit <= 0 || spent >= limit) return null;
  const ratio = spent / limit;
  if (optional && (mode !== 'Full' || ratio >= 0.6)) return null;
  if (ratio >= 0.8 && !important) return null;
  return MODELS[ratio >= 0.6 ? 'cheap' : modelClass];
}
/** Full model context input ceiling is deliberately reserved, including schema overhead.
 * This avoids treating an approximate tokenizer as a monetary hard bound. Two calls cover repair.
 * Public requests are bounded to 32KB; confirmed call transcripts are bounded to 80,000 characters; output is capped at 2048 tokens, thinking disabled.
 */
export function maximumCost(model: Model): number {
  const context = model === MODELS.strong ? 1_000_000 : 200_000;
  return (2 * (context * model.write + 2048 * model.output)) / 1e6;
}
