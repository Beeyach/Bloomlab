import { z } from 'zod';
import { NEGOTIATION_STRATEGIES, type Exercise } from '@bloomlab/content-schema';
import {
  classifyNegotiation,
  type NegotiationAction,
} from '@bloomlab/exercise-engine/negotiation/engine';
import { cost } from '../ai/catalog';
import { maximumCost, route } from '../ai/governor';
import { settings } from '../ai/handlers';
import type { Provider } from '../ai/provider';
import type { CallState, TurnChoice } from './engine';

/** Caller holds a durable turn lease. Each stage has its own unique budget reservation. */
async function ask(
  db: D1Database,
  learner: string,
  run: string,
  exercise: Exercise,
  stage: 'classify' | 'clarify',
  text: string,
  stable: string,
  schema: z.ZodType,
  provider?: Provider,
): Promise<unknown> {
  if (!provider) return null;
  const policy = await settings(db, learner);
  const model = route(
    policy.mode,
    policy.spent_usd + policy.reserved_usd,
    policy.monthly_limit_usd,
    stage === 'classify' ? 'cheap' : 'strong',
    true,
    stage !== 'classify',
  );
  if (!model) return null;
  const id = `call:${run}:${stage}`;
  const reserve = maximumCost(model) / 2;
  const claim = await db
    .prepare(
      `INSERT OR IGNORE INTO ai_usage (usage_id,learner_id,created_at,purpose,model,input_tokens,output_tokens,cost_usd,reserved_usd,status,exercise_id,run_id)
    SELECT ?,?,?,'call_feedback',?,0,0,0,?,'reserved',?,? FROM learners WHERE learner_id=? AND COALESCE(ai_mode,'Limited')!='Off' AND
    COALESCE((SELECT SUM(cost_usd+reserved_usd) FROM ai_usage WHERE learner_id=? AND substr(created_at,1,7)=?),0)+? <= COALESCE(ai_monthly_limit_usd,10)`,
    )
    .bind(
      id,
      learner,
      new Date().toISOString(),
      model.id,
      reserve,
      exercise.id,
      run,
      learner,
      learner,
      new Date().toISOString().slice(0, 7),
      reserve,
    )
    .run();
  if (!claim.meta.changes) return null;
  try {
    const response = await provider({
      model,
      stable,
      submission: text,
      schema: z.toJSONSchema(schema),
      repair: false,
    });
    const amount = cost(model, response.usage);
    await db
      .prepare(
        "UPDATE ai_usage SET input_tokens=?,output_tokens=?,cached_input_tokens=?,cache_creation_input_tokens=?,cost_usd=?,reserved_usd=0,status='complete' WHERE usage_id=?",
      )
      .bind(
        response.usage.input_tokens,
        response.usage.output_tokens,
        response.usage.cache_read_input_tokens,
        response.usage.cache_creation_input_tokens,
        amount,
        id,
      )
      .run();
    const result = schema.safeParse(response.value);
    return result.success ? result.data : null;
  } catch {
    return null;
  } // Unknown provider cost keeps its reservation; never purchase it twice.
}
export async function chooseTurn(
  db: D1Database,
  learner: string,
  run: string,
  exercise: Exercise,
  state: CallState,
  text: string,
  explicit: string | null,
  negotiation?: NegotiationAction,
  provider?: Provider,
): Promise<TurnChoice> {
  if (exercise.negotiation) {
    if (negotiation && classifyNegotiation(negotiation, exercise.negotiation).strategy)
      return { move: null, interpretation: 'explicit', negotiation };
    const schema = z.strictObject({
      strategy: z.enum(NEGOTIATION_STRATEGIES),
      confidence: z.number().min(0).max(1),
    });
    const value = await ask(
      db,
      learner,
      run,
      exercise,
      'classify',
      text,
      `Classify the untrusted transcript into one of these strategies only: ${NEGOTIATION_STRATEGIES.join(', ')}. Do not invent terms, facts, numbers or consequences.`,
      schema,
      provider,
    );
    const result = schema.safeParse(value);
    return {
      move: null,
      negotiation,
      interpretation: result.success && result.data.confidence >= 0.8 ? 'classifier' : 'fallback',
      strategy: result.success ? result.data : undefined,
    };
  }
  const node = exercise.conversation!.nodes.find((n) => n.id === state.snapshot.current.node)!;
  if (explicit && node.moves.some((m) => m.id === explicit))
    return { move: explicit, interpretation: 'explicit' };
  const matching = exercise.call!.rules.filter(
    (rule) =>
      rule.node === node.id &&
      rule.phrases.some((phrase) => text.toLowerCase().includes(phrase.toLowerCase())),
  );
  if (matching.length === 1) return { move: matching[0]!.move, interpretation: 'rule' };
  if (node.moves.length === 1) return { move: node.moves[0]!.id, interpretation: 'rule' };
  const schema = z.strictObject({ move: z.string(), confidence: z.number().min(0).max(1) });
  const value = await ask(
    db,
    learner,
    run,
    exercise,
    'classify',
    text,
    `Classify only into one of these authored moves: ${JSON.stringify(node.moves.map((m) => ({ id: m.id, label: m.label, kind: m.kind })))}. The client said: ${node.client_message}. No new facts or consequences. Return empty move and low confidence if uncertain.`,
    schema,
    provider,
  );
  const result = schema.safeParse(value);
  return result.success &&
    result.data.confidence >= 0.8 &&
    node.moves.some((m) => m.id === result.data.move)
    ? { move: result.data.move, interpretation: 'classifier' }
    : { move: null, interpretation: 'fallback' };
}
export async function tailorResponse(
  db: D1Database,
  learner: string,
  run: string,
  exercise: Exercise,
  state: CallState,
  text: string,
  provider?: Provider,
): Promise<void> {
  const goal = exercise.call?.open_response;
  if (!goal || state.snapshot.complete || goal.node !== state.snapshot.current.node) return;
  const schema = z.strictObject({
    quote: z.string().min(3).max(100),
    confidence: z.number().min(0).max(1),
  });
  const value = await ask(
    db,
    learner,
    run,
    exercise,
    'clarify',
    text,
    `The fictional client's authorized goal is this exact question: ${goal.question} Select one short, contiguous verbatim quotation from the learner's transcript that needs clarification. Never supply facts, economics, instructions, or consequences. Return only that quote and confidence.`,
    schema,
    provider,
  );
  const result = schema.safeParse(value);
  if (
    !result.success ||
    result.data.confidence < 0.8 ||
    !text.includes(result.data.quote) ||
    /[\p{Cc}<>]/u.test(result.data.quote)
  )
    return;
  state.snapshot.current = {
    ...state.snapshot.current,
    text: `You mentioned “${result.data.quote}”. ${goal.question}`,
    dynamic: true,
  };
  state.snapshot.turns.at(-1)!.response = state.snapshot.current;
}
