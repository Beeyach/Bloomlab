import type { NegotiationStrategy } from '@bloomlab/content-schema';
import type {
  AiEvaluationRequest,
  AiEvaluationResponse,
  AiMode,
  AiSettings,
} from '@bloomlab/shared';
import { db, type BloomlabDatabase } from '../data/db';
import { loadWorkspace, saveWorkspace } from '../data/workspace';
// Transient race protection only; ai.mode in the existing workspace remains the local cache.
const modeGuards = new WeakMap<
  BloomlabDatabase,
  { revision: number; off: boolean; writes: number }
>();
function guard(database: BloomlabDatabase) {
  let state = modeGuards.get(database);
  if (!state) {
    state = { revision: 0, off: false, writes: 0 };
    modeGuards.set(database, state);
  }
  return state;
}
export async function selectAiOff(database: BloomlabDatabase = db): Promise<void> {
  const state = guard(database);
  state.revision++;
  state.off = true;
  await saveWorkspace('ai.mode', 'Off', database);
}
async function isOff(database: BloomlabDatabase) {
  const cached = await loadWorkspace<AiMode>('ai.mode', database);
  return guard(database).off || cached === 'Off';
}
async function reconcileSettings(
  settings: AiSettings,
  revision: number,
  database: BloomlabDatabase,
) {
  return database.transaction('rw', database.workspace, async () => {
    const state = guard(database);
    if (state.revision === revision && state.writes === 0) {
      await saveWorkspace('ai.mode', settings.mode, database);
      if (state.revision === revision) {
        state.off = false;
        return settings;
      }
    }
    const mode = state.off ? 'Off' : await loadWorkspace<AiMode>('ai.mode', database);
    return { ...settings, mode: mode ?? settings.mode };
  });
}
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
  if (await isOff(database))
    throw new Error('AI Coaching is Off. Your work is saved. Enable AI in Settings to retry.');
  return aiRequest('evaluate', request, database);
}
export async function getAiSettings(database: BloomlabDatabase = db): Promise<AiSettings> {
  const state = guard(database);
  const revision = state.revision;
  // A read begun during a write cannot establish a newer canonical value.
  const duringWrite = state.writes > 0;
  const result = await aiRequest<AiSettings>('settings', undefined, database);
  return reconcileSettings(result, duringWrite ? -1 : revision, database);
}
export async function setAiSettings(
  mode: AiMode,
  monthly_limit_usd: number,
  database: BloomlabDatabase = db,
): Promise<AiSettings> {
  const state = guard(database);
  state.revision++;
  state.writes++;
  let result: AiSettings;
  let revision: number;
  try {
    if (mode === 'Off') await selectAiOff(database);
    revision = state.revision;
    result = await aiRequest<AiSettings>('settings', { mode, monthly_limit_usd }, database, 'PUT');
  } finally {
    state.writes--;
  }
  return reconcileSettings(result, revision, database);
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
  if (await isOff(database)) return null;
  try {
    return await aiRequest('classify', { exercise_id, request_id, text }, database);
  } catch {
    return null;
  }
}
