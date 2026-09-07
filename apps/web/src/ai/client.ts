import type { NegotiationStrategy } from '@bloomlab/content-schema';
import type {
  AiEvaluationRequest,
  AiEvaluationResponse,
  AiMode,
  AiSettings,
} from '@bloomlab/shared';
import { db, type BloomlabDatabase } from '../data/db';
import { loadWorkspace, saveWorkspace } from '../data/workspace';
export async function aiRequest<T>(
  path: string,
  body?: unknown,
  database: BloomlabDatabase = db,
  method = 'POST',
): Promise<T> {
  const device = await database.device.toCollection().first();
  if (!device?.session_token)
    throw new Error(
      'Link this device with a Bloomlab Sync Key to use AI. Your work is saved; retry after linking.',
    );
  const response = await fetch(`/api/ai/${path}`, {
    method: body === undefined ? 'GET' : method,
    headers: {
      authorization: `Bearer ${device.session_token}`,
      'content-type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    const data = (await response.json()) as { error?: string };
    const reasons: Record<string, string> = {
      ai_off: 'AI Coaching is Off.',
      ai_not_configured: 'AI is not configured on the server.',
      budget_refused: 'The remaining AI budget cannot cover this evaluation.',
      evaluation_in_progress: 'This evaluation is already running.',
      submission_conflict: 'This attempt already has a different submitted answer.',
    };
    throw new Error(
      `${reasons[data.error ?? ''] ?? 'AI evaluation is unavailable.'} Your submitted work is saved. Retry when ready, or continue other study.`,
    );
  }
  return response.json() as Promise<T>;
}
export async function evaluateSubmission(
  request: AiEvaluationRequest,
  database: BloomlabDatabase = db,
): Promise<AiEvaluationResponse> {
  if ((await loadWorkspace<AiMode>('ai.mode', database)) === 'Off')
    throw new Error('AI Coaching is Off. Your work is saved. Enable AI in Settings to retry.');
  return aiRequest('evaluate', request, database);
}
export async function getAiSettings(): Promise<AiSettings> {
  return aiRequest('settings');
}
export async function setAiSettings(mode: AiMode, monthly_limit_usd: number): Promise<AiSettings> {
  // Local Off takes effect immediately, even if the server is unreachable. Server confirmation
  // is required before claiming another device or direct server requests are disabled.
  if (mode === 'Off') await saveWorkspace('ai.mode', mode);
  const result = await aiRequest<AiSettings>('settings', { mode, monthly_limit_usd }, db, 'PUT');
  await saveWorkspace('ai.mode', result.mode);
  return result;
}

export async function classifyLanguage(
  exercise_id: string,
  request_id: string,
  text: string,
  database: BloomlabDatabase = db,
): Promise<{
  strategy: NegotiationStrategy;
  confidence: number;
} | null> {
  if ((await loadWorkspace<AiMode>('ai.mode', database)) === 'Off') return null;
  try {
    return await aiRequest('classify', { exercise_id, request_id, text }, database);
  } catch {
    return null;
  }
}
