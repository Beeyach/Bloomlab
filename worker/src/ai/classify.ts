import { z } from 'zod';
import { NEGOTIATION_STRATEGIES } from '@bloomlab/content-schema';
import content from 'virtual:bloomlab-content';
import { cost, MODELS } from './catalog';
import { maximumCost, route } from './governor';
import { AiError, type Provider } from './provider';
import type { Session } from '../sync/auth';
import { settings } from './handlers';
const inputSchema = z.strictObject({
  exercise_id: z.string().max(160),
  request_id: z.string().min(1).max(180),
  text: z.string().min(1).max(4000),
});
const outputSchema = z.strictObject({
  strategy: z.enum(NEGOTIATION_STRATEGIES),
  confidence: z.number().min(0).max(1),
});
export async function classify(
  body: unknown,
  session: Session,
  db: D1Database,
  provider: Provider,
) {
  const input = inputSchema.parse(body);
  const exercise = content.exercises.find((e) => e.id === input.exercise_id);
  if (!exercise?.negotiation) throw new AiError('invalid_exercise', 400);
  const policy = await settings(db, session.learnerId);
  const model = route(
    policy.mode,
    policy.spent_usd + policy.reserved_usd,
    policy.monthly_limit_usd,
    'cheap',
    true,
  );
  if (!model) throw new AiError('budget_refused', 403);
  const id = `classification:${session.learnerId}:${input.request_id}`;
  const previous = await db
    .prepare('SELECT result,submission FROM ai_feedback WHERE feedback_id=?')
    .bind(id)
    .first<{ result: string; submission: string }>();
  if (previous) {
    if (previous.submission !== JSON.stringify(input))
      throw new AiError('submission_conflict', 409);
    return JSON.parse(previous.result) as z.infer<typeof outputSchema>;
  }
  const bound = maximumCost(MODELS.cheap) / 2;
  const at = new Date().toISOString();
  const reservation = await db
    .prepare(
      `INSERT OR IGNORE INTO ai_usage(usage_id,learner_id,created_at,purpose,model,exercise_id,reserved_usd,status)
    SELECT ?,?,?,'negotiation',?,?,?,'reserved' FROM learners WHERE learner_id=? AND ai_mode!='Off'
    AND ?+COALESCE((SELECT SUM(cost_usd+reserved_usd) FROM ai_usage WHERE learner_id=? AND created_at>=?),0)<=ai_monthly_limit_usd`,
    )
    .bind(
      id,
      session.learnerId,
      at,
      model.id,
      exercise.id,
      bound,
      session.learnerId,
      bound,
      session.learnerId,
      at.slice(0, 7) + '-01T00:00:00.000Z',
    )
    .run();
  if (!reservation.meta.changes) throw new AiError('budget_or_duplicate_refused', 409);
  const response = await provider({
    model,
    stable: `Classify negotiation language into exactly one existing strategy: ${NEGOTIATION_STRATEGIES.join(', ')}. discount: requests a lower fee; hold: maintains price; clarify: asks for information; reduce_scope: removes deliverables; phase: stages delivery; walk_away: declines professionally; defensive: reacts defensively. Return low confidence for ambiguous language. Never invent a price, scope, concession, reaction or state change.`,
    submission: input.text,
    schema: z.toJSONSchema(outputSchema),
    repair: false,
  });
  const charged = cost(model, response.usage);
  await db
    .prepare(
      "UPDATE ai_usage SET cost_usd=?,reserved_usd=0,input_tokens=?,output_tokens=?,cached_input_tokens=?,cache_creation_input_tokens=?,status='complete' WHERE usage_id=?",
    )
    .bind(
      charged,
      response.usage.input_tokens,
      response.usage.output_tokens,
      response.usage.cache_read_input_tokens,
      response.usage.cache_creation_input_tokens,
      id,
    )
    .run();
  const result = outputSchema.parse(response.value);
  await db
    .prepare(
      'INSERT INTO ai_feedback(feedback_id,learner_id,created_at,target_kind,target_ref,submission,model,result,cost_usd) VALUES(?,?,?,?,?,?,?,?,?)',
    )
    .bind(
      id,
      session.learnerId,
      at,
      'negotiation',
      exercise.id,
      JSON.stringify(input),
      model.id,
      JSON.stringify(result),
      charged,
    )
    .run();
  return result;
}
