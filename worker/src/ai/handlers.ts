import { getAttempt } from '../call/store';
import type { CallState } from '../call/engine';
import { classify } from './classify';
import content from 'virtual:bloomlab-content';
import { z } from 'zod';
import type { AiEvaluationResponse, AiSettings } from '@bloomlab/shared';
import { authenticate, type Session } from '../sync/auth';
import { cost, MODELS } from './catalog';
import { maximumCost, route } from './governor';
import { gradingFormat, validateGrading } from './output';
import { AiError, anthropic, type Provider } from './provider';

const requestSchema = z.strictObject({
  attempt_id: z.string().min(1).max(160),
  exercise_id: z.string().max(160),
  rubric_id: z.string().max(160),
  submission: z.string().min(1).max(24000),
});
const settingsSchema = z.strictObject({
  mode: z.enum(['Off', 'Limited', 'Full']),
  monthly_limit_usd: z.number().min(0).max(1000),
});
async function boundedJson(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new AiError('invalid_request', 400);
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 32000) {
      await reader.cancel();
      throw new AiError('submission_too_large', 413);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}
const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
const monthStart = () => new Date().toISOString().slice(0, 7) + '-01T00:00:00.000Z';
export async function settings(db: D1Database, learner: string): Promise<AiSettings> {
  const policy = await db
    .prepare(
      'SELECT ai_mode AS mode, ai_monthly_limit_usd AS monthly_limit_usd FROM learners WHERE learner_id = ?',
    )
    .bind(learner)
    .first<Pick<AiSettings, 'mode' | 'monthly_limit_usd'>>();
  if (!policy) throw new AiError('device_not_linked', 401);
  const totals = await db
    .prepare(
      'SELECT COALESCE(SUM(cost_usd),0) AS spent_usd, COALESCE(SUM(reserved_usd),0) AS reserved_usd FROM ai_usage WHERE learner_id = ? AND created_at >= ?',
    )
    .bind(learner, monthStart())
    .first<{ spent_usd: number; reserved_usd: number }>();
  const categories = await db
    .prepare(
      'SELECT purpose AS category, SUM(cost_usd) AS cost_usd FROM ai_usage WHERE learner_id = ? AND created_at >= ? GROUP BY purpose',
    )
    .bind(learner, monthStart())
    .all<{ category: string; cost_usd: number }>();
  return {
    ...policy,
    spent_usd: totals?.spent_usd ?? 0,
    reserved_usd: totals?.reserved_usd ?? 0,
    categories: categories.results,
  };
}
export async function evaluate(
  body: unknown,
  session: Session,
  db: D1Database,
  provider: Provider,
): Promise<AiEvaluationResponse> {
  const input = requestSchema.parse(body);
  const exercise = content.exercises.find((e) => e.id === input.exercise_id);
  const rubric = content.rubrics.find((r) => r.id === input.rubric_id);
  if (
    !exercise ||
    !rubric ||
    !rubric.applies_to.includes(exercise.type) ||
    rubric.model_class === 'none'
  )
    throw new AiError('invalid_rubric', 400);
  // Older versions remain addressable for already-started attempts, never resolved by latest.
  if (rubric.id.replace(/_V[0-9]+$/, '') !== exercise.grading.rubric?.replace(/_V[0-9]+$/, ''))
    throw new AiError('invalid_rubric', 400);
  if (exercise.grading.mode === 'deterministic') throw new AiError('deterministic_only', 400);
  if (exercise.call) {
    let call;
    try {
      call = await getAttempt(db, session, input.attempt_id);
    } catch {
      throw new AiError('call_attempt_unavailable', 403);
    }
    const saved = (JSON.parse(call.state_json) as CallState).snapshot;
    if (call.exercise_id !== exercise.id || !saved.complete)
      throw new AiError('call_not_complete', 409);
    // Server-confirmed transcript only: raw audio, original STT, notes and client-supplied payloads never reach Anthropic.
    input.submission = JSON.stringify({
      transcript: saved.turns.map((t) => ({
        client: t.client.text,
        learner: t.confirmed_transcript,
      })),
      closing: saved.current.text,
      deterministic: saved.projection,
    });
  }
  const policy = await settings(db, session.learnerId);
  if (policy.mode === 'Off') throw new AiError('ai_off', 403);
  const hash = Array.from(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(input))),
    ),
  )
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  type Run = { run_id: string; request_hash: string; status: string; result: string };
  const old = await db
    .prepare('SELECT * FROM rubric_runs WHERE learner_id = ? AND attempt_id = ?')
    .bind(session.learnerId, input.attempt_id)
    .first<Run>();
  if (old && old.request_hash !== hash) throw new AiError('submission_conflict', 409);
  if (old?.status === 'complete') return JSON.parse(old.result) as AiEvaluationResponse;
  if (old?.status === 'active') throw new AiError('evaluation_in_progress', 409);
  let model = route(
    policy.mode,
    policy.spent_usd + policy.reserved_usd,
    policy.monthly_limit_usd,
    rubric.model_class,
    true,
  );
  if (!model) throw new AiError('budget_refused', 403);
  if (maximumCost(model) > policy.monthly_limit_usd - policy.spent_usd - policy.reserved_usd)
    model = MODELS.cheap;
  const bound = maximumCost(model);
  const runId = old?.run_id ?? crypto.randomUUID();
  const at = new Date().toISOString();
  const claim = old
    ? await db
        .prepare("UPDATE rubric_runs SET status='active' WHERE run_id=? AND status='failed'")
        .bind(runId)
        .run()
    : await db
        .prepare(
          "INSERT OR IGNORE INTO rubric_runs(run_id,learner_id,created_at,rubric_id,rubric_version,attempt_id,result,request_hash,status) VALUES(?,?,?,?,?,?, '{}',?,'active')",
        )
        .bind(
          runId,
          session.learnerId,
          at,
          rubric.id,
          String(rubric.version),
          input.attempt_id,
          hash,
        )
        .run();
  if (!claim.meta.changes) throw new AiError('evaluation_in_progress', 409);
  const usageId = crypto.randomUUID();
  const category =
    exercise.type === 'NEGOTIATE_IT'
      ? 'negotiation'
      : exercise.type === 'AUDIT_IT'
        ? 'diagnosis'
        : exercise.type === 'SAY_IT'
          ? 'call_feedback'
          : 'written_coaching';
  // INSERT SELECT is one SQLite statement: concurrent isolates cannot oversubscribe the balance.
  const reservation = await db
    .prepare(
      `INSERT INTO ai_usage(usage_id,learner_id,created_at,purpose,model,exercise_id,reserved_usd,status,run_id)
    SELECT ?,?,?,?,?,?,?,'reserved',? FROM learners WHERE learner_id=? AND ai_mode != 'Off'
    AND ? + COALESCE((SELECT SUM(cost_usd+reserved_usd) FROM ai_usage WHERE learner_id=? AND created_at>=?),0) <= ai_monthly_limit_usd`,
    )
    .bind(
      usageId,
      session.learnerId,
      at,
      category,
      model.id,
      exercise.id,
      bound,
      runId,
      session.learnerId,
      bound,
      session.learnerId,
      monthStart(),
    )
    .run();
  if (!reservation.meta.changes) {
    await db.prepare("UPDATE rubric_runs SET status='failed' WHERE run_id=?").bind(runId).run();
    throw new AiError('budget_refused', 403);
  }
  let actual = 0;
  let accounted = 0;
  let accountedCalls = 0;
  try {
    for (let repair = 0; repair <= 1; repair++) {
      const response = await provider({
        model,
        stable: `Bloomlab grades defensible reasoning, not confident prose. Judge only authored rubric items. Deterministic checks remain authoritative. Reward verified uncertainty. Exact rubric: ${JSON.stringify(rubric)}\nExercise brief: ${JSON.stringify({ title: exercise.title, instructions: exercise.instructions })}`,
        submission: input.submission,
        schema: gradingFormat,
        repair: repair === 1,
      });
      const charged = cost(model, response.usage);
      actual += charged;
      // Commit usage and its reservation reduction in the same D1 transaction.
      await db.batch([
        db
          .prepare(
            'INSERT INTO ai_usage(usage_id,learner_id,created_at,purpose,model,input_tokens,output_tokens,cached_input_tokens,cache_creation_input_tokens,cost_usd,exercise_id,run_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',
          )
          .bind(
            crypto.randomUUID(),
            session.learnerId,
            new Date().toISOString(),
            category,
            model.id,
            response.usage.input_tokens,
            response.usage.output_tokens,
            response.usage.cache_read_input_tokens,
            response.usage.cache_creation_input_tokens,
            charged,
            exercise.id,
            runId,
          ),
        db
          .prepare('UPDATE ai_usage SET reserved_usd=? WHERE usage_id=?')
          .bind(Math.max(0, bound - actual), usageId),
      ]);
      accounted = actual;
      accountedCalls++;
      let result;
      try {
        result = validateGrading(response.value, rubric);
      } catch {
        if (repair === 0) continue;
        throw new AiError('evaluation_invalid', 502);
      }
      const answer: AiEvaluationResponse = {
        run_id: runId,
        rubric_id: rubric.id,
        rubric_version: rubric.version,
        result,
      };
      await db.batch([
        db
          .prepare("UPDATE rubric_runs SET result=?,status='complete' WHERE run_id=?")
          .bind(JSON.stringify(answer), runId),
        db
          .prepare(
            'INSERT INTO ai_feedback(feedback_id,learner_id,created_at,target_kind,target_ref,submission,rubric_id,rubric_version,model,result,cost_usd) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
          )
          .bind(
            crypto.randomUUID(),
            session.learnerId,
            at,
            'exercise',
            exercise.id,
            input.submission,
            rubric.id,
            String(rubric.version),
            model.id,
            JSON.stringify(result),
            actual,
          ),
        db
          .prepare("UPDATE ai_usage SET reserved_usd=0,status='complete' WHERE usage_id=?")
          .bind(usageId),
      ]);
      return answer;
    }
    throw new AiError('evaluation_invalid', 502);
  } catch (error) {
    // Unknown provider outcome may still be billed: retain the maximum reservation, never refund blindly.
    await db.batch([
      db.prepare("UPDATE rubric_runs SET status='failed' WHERE run_id=?").bind(runId),
      db
        .prepare('UPDATE ai_usage SET reserved_usd=?,status=? WHERE usage_id=?')
        .bind(accountedCalls === 2 ? 0 : Math.max(0, bound - accounted), 'failed', usageId),
    ]);
    throw error;
  }
}
export async function handleAi(
  request: Request,
  env: { DB: D1Database; ANTHROPIC_API_KEY?: string },
  provider?: Provider,
): Promise<Response> {
  try {
    const session = await authenticate(request, env.DB);
    if (!session) throw new AiError('device_not_linked', 401);
    const path = new URL(request.url).pathname;
    if (path === '/api/ai/settings') {
      if (request.method === 'PUT') {
        const value = settingsSchema.parse(await boundedJson(request));
        const changed = await env.DB.prepare(
          'UPDATE learners SET ai_mode=?,ai_monthly_limit_usd=? WHERE learner_id=? AND ? >= COALESCE((SELECT SUM(cost_usd+reserved_usd) FROM ai_usage WHERE learner_id=? AND created_at>=?),0)',
        )
          .bind(
            value.mode,
            value.monthly_limit_usd,
            session.learnerId,
            value.monthly_limit_usd,
            session.learnerId,
            monthStart(),
          )
          .run();
        if (!changed.meta.changes) throw new AiError('limit_below_committed_usage', 409);
      } else if (request.method !== 'GET') throw new AiError('method_not_allowed', 405);
      return json(await settings(env.DB, session.learnerId));
    }
    if (path !== '/api/ai/evaluate' && path !== '/api/ai/classify')
      throw new AiError('not_found', 404);
    if (request.method !== 'POST') throw new AiError('method_not_allowed', 405);
    if ((await settings(env.DB, session.learnerId)).mode === 'Off')
      throw new AiError('ai_off', 403);
    if (!provider && !env.ANTHROPIC_API_KEY) throw new AiError('ai_not_configured');
    const raw = JSON.stringify(await boundedJson(request));
    if (new TextEncoder().encode(raw).length > 32000)
      throw new AiError('submission_too_large', 413);
    if (path === '/api/ai/classify')
      return json(
        await classify(
          JSON.parse(raw),
          session,
          env.DB,
          provider ?? anthropic(env.ANTHROPIC_API_KEY!),
        ),
      );
    return json(
      await evaluate(
        JSON.parse(raw),
        session,
        env.DB,
        provider ?? anthropic(env.ANTHROPIC_API_KEY!),
      ),
    );
  } catch (error) {
    if (error instanceof AiError) return json({ error: error.code }, error.status);
    if (error instanceof z.ZodError || error instanceof SyntaxError)
      return json({ error: 'invalid_request' }, 400);
    return json({ error: 'evaluation_failed' }, 503);
  }
}
