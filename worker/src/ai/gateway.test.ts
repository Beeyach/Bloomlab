import { env } from 'cloudflare:test';
import { describe, it, expect, vi } from 'vitest';
import content from 'virtual:bloomlab-content';
import { generateSyncKey } from '@bloomlab/shared';
import { link } from '../sync/handlers';
import { evaluate, handleAi, settings } from './handlers';
import { cost, MODELS } from './catalog';
import { maximumCost, route } from './governor';
import { anthropic, type Provider } from './provider';
import { validateGrading } from './output';
const rubric = content.rubrics.find((r) => r.id === 'WRITTEN_COMMUNICATION_RUBRIC_V2')!;
const valid = () => ({
  score: 100,
  rubric_results: rubric.items.map((i) => ({
    id: i.id,
    passed: true,
    reason: 'Supported by the submitted evidence.',
  })),
  critical_issue: null,
  strengths: ['Clear'],
  improvements: [],
  next_probe: 'Explain why.',
  confidence: 0.9,
});
const usage = {
  input_tokens: 100,
  output_tokens: 100,
  cache_creation_input_tokens: 50,
  cache_read_input_tokens: 50,
};
async function learner() {
  const r = await link(
    { secret: generateSyncKey(), device: { device_id: crypto.randomUUID(), label: 'Test' } },
    env.DB,
    env.SYNC_KEY_PEPPER,
  );
  return { session: { learnerId: r.learner_id, deviceId: r.device_id }, token: r.session_token };
}
const request = () => ({
  attempt_id: crypto.randomUUID(),
  exercise_id: 'EX-WRITE_IT-northwind-cold-email',
  rubric_id: rubric.id,
  submission: 'A specific email and follow-up.',
});
describe('AI-003/005 catalog and governor', () => {
  it('accounts for all four independent usage fields', () =>
    expect(
      cost(MODELS.cheap, {
        input_tokens: 1e6,
        output_tokens: 1e6,
        cache_creation_input_tokens: 1e6,
        cache_read_input_tokens: 1e6,
      }),
    ).toBe(7.35));
  it.each([0, 11.99, 12, 15.99, 16, 18.99, 19, 19.99])('routes essential at $%s', (spent) =>
    expect(route('Limited', spent, 20, 'strong', true)).toBe(
      spent < 12 ? MODELS.strong : MODELS.cheap,
    ),
  );
  it.each([16, 19, 20])('refuses ordinary at $%s', (spent) =>
    expect(route('Limited', spent, 20, 'cheap', false)).toBeNull(),
  );
  it('uses none for Off or deterministic and restricts optional', () => {
    expect(route('Off', 0, 20, 'cheap', true)).toBeNull();
    expect(route('Full', 0, 20, 'none', true)).toBeNull();
    expect(route('Limited', 0, 20, 'cheap', true, true)).toBeNull();
    expect(route('Full', 12, 20, 'cheap', true, true)).toBeNull();
    expect(maximumCost(MODELS.strong)).toBeGreaterThan(maximumCost(MODELS.cheap));
  });
});
describe('AI-006/009/011/012 gateway', () => {
  it('validates exact item identities and critical consistency', () => {
    expect(validateGrading(valid(), rubric)).toEqual(valid());
    expect(() => validateGrading({ ...valid(), rubric_results: [] }, rubric)).toThrow();
    expect(() =>
      validateGrading({ ...valid(), critical_issue: 'Contradiction' }, rubric),
    ).toThrow();
  });
  it('persists usage, rubric version and submission, and replays duplicate without spending', async () => {
    const { session } = await learner();
    const input = request();
    const provider = vi.fn<Provider>().mockResolvedValue({ value: valid(), usage });
    const first = await evaluate(input, session, env.DB, provider);
    expect(await evaluate(input, session, env.DB, provider)).toEqual(first);
    expect(provider).toHaveBeenCalledTimes(1);
    expect((await settings(env.DB, session.learnerId)).spent_usd).toBeGreaterThan(0);
    expect((await settings(env.DB, session.learnerId)).reserved_usd).toBe(0);
    const saved = await env.DB.prepare(
      'SELECT submission,rubric_version FROM ai_feedback WHERE learner_id=?',
    )
      .bind(session.learnerId)
      .first();
    expect(saved?.submission).toBe(input.submission);
    expect(saved?.rubric_version).toBe('2');
  });
  it('repairs once and accounts for both actual responses', async () => {
    const { session } = await learner();
    const provider = vi
      .fn<Provider>()
      .mockResolvedValueOnce({ value: { bad: true }, usage })
      .mockResolvedValueOnce({ value: valid(), usage });
    await evaluate(request(), session, env.DB, provider);
    expect(provider).toHaveBeenCalledTimes(2);
    expect(provider.mock.calls[1]![0].repair).toBe(true);
    expect((await settings(env.DB, session.learnerId)).spent_usd).toBeCloseTo(
      2 * cost(MODELS.cheap, usage),
      12,
    );
  });
  it('fails after exactly two invalid responses and allows explicit retry', async () => {
    const { session } = await learner();
    const input = request();
    const bad = vi.fn<Provider>().mockResolvedValue({ value: null, usage });
    await expect(evaluate(input, session, env.DB, bad)).rejects.toThrow('evaluation_invalid');
    expect(bad).toHaveBeenCalledTimes(2);
    await expect(
      evaluate(input, session, env.DB, async () => ({ value: valid(), usage })),
    ).resolves.toHaveProperty('result');
  });
  it('rejects a changed submission under the same id', async () => {
    const { session } = await learner();
    const input = request();
    await evaluate(input, session, env.DB, async () => ({ value: valid(), usage }));
    await expect(
      evaluate({ ...input, submission: 'Changed' }, session, env.DB, async () => ({
        value: valid(),
        usage,
      })),
    ).rejects.toThrow('submission_conflict');
  });
  it('atomic reservations refuse concurrent over-budget calls', async () => {
    const { session } = await learner();
    await env.DB.prepare('UPDATE learners SET ai_monthly_limit_usd=? WHERE learner_id=?')
      .bind(maximumCost(MODELS.cheap), session.learnerId)
      .run();
    let finish!: () => void;
    const gate = new Promise<void>((r) => {
      finish = r;
    });
    const provider = vi.fn<Provider>(async () => {
      await gate;
      return { value: valid(), usage };
    });
    const first = evaluate(request(), session, env.DB, provider);
    await vi.waitFor(() => expect(provider).toHaveBeenCalledTimes(1));
    await expect(evaluate(request(), session, env.DB, provider)).rejects.toThrow('budget_refused');
    finish();
    await first;
    expect(provider).toHaveBeenCalledTimes(1);
  });
  it('protects Off and missing-secret routes without invoking provider', async () => {
    const { session, token } = await learner();
    const req = () =>
      new Request('https://test/api/ai/evaluate', {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
        body: JSON.stringify(request()),
      });
    expect((await handleAi(req(), env)).status).toBe(503);
    await env.DB.prepare("UPDATE learners SET ai_mode='Off' WHERE learner_id=?")
      .bind(session.learnerId)
      .run();
    const provider = vi.fn<Provider>();
    expect((await handleAi(req(), env, provider)).status).toBe(403);
    expect(provider).not.toHaveBeenCalled();
    expect((await handleAi(new Request('https://test/api/ai/settings'), env)).status).toBe(401);
  });
  it('preserves conservative reservation when provider outcome is unknown', async () => {
    const { session } = await learner();
    await expect(
      evaluate(request(), session, env.DB, async () => {
        throw new Error('network');
      }),
    ).rejects.toThrow();
    expect((await settings(env.DB, session.learnerId)).reserved_usd).toBeGreaterThan(0);
  });
});
describe('direct Anthropic boundary', () => {
  it.each([429, 500, 503])('sanitizes HTTP %s', async (status) => {
    const provider = anthropic(
      'not-a-real-key',
      vi.fn().mockResolvedValue(new Response('private upstream detail', { status })),
    );
    await expect(
      provider({
        model: MODELS.cheap,
        stable: 'stable',
        submission: 'work',
        schema: {},
        repair: false,
      }),
    ).rejects.toThrow(status === 429 ? 'provider_rate_limited' : 'provider_unavailable');
  });
  it('uses output_config.format and caches only stable prefix', async () => {
    const transport = vi.fn().mockResolvedValue(
      Response.json({
        usage,
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: JSON.stringify(valid()) }],
      }),
    );
    const provider = anthropic('test', transport);
    await provider({
      model: MODELS.cheap,
      stable: 'stable',
      submission: 'variable',
      schema: { type: 'object' },
      repair: false,
    });
    const body = JSON.parse(transport.mock.calls[0]![1].body);
    expect(body.output_config.format.type).toBe('json_schema');
    expect(body.system[0].cache_control.ttl).toBe('5m');
    expect(body.system[0].text).not.toContain('variable');
    expect(body.messages).toHaveLength(1);
  });
});

describe('AI-011 authored rubric audit', () => {
  it.each(content.exercises.filter((e) => e.grading.rubric && e.grading.mode !== 'deterministic'))(
    'resolves exact authored rubric for $id',
    async (exercise) => {
      const r = content.rubrics.find((r) => r.id === exercise.grading.rubric)!;
      const { session } = await learner();
      const answer = await evaluate(
        { ...request(), exercise_id: exercise.id, rubric_id: r.id },
        session,
        env.DB,
        async () => ({
          usage,
          value: {
            ...valid(),
            rubric_results: r.items.map((i) => ({
              id: i.id,
              passed: true,
              reason: 'Authored item evidence',
            })),
          },
        }),
      );
      expect(answer.rubric_id).toBe(exercise.grading.rubric);
      expect(answer.rubric_version).toBe(r.version);
    },
  );
  it('an older submitted written rubric remains bound to V1', async () => {
    const { session } = await learner();
    const r = content.rubrics.find((r) => r.id === 'WRITTEN_COMMUNICATION_RUBRIC_V1')!;
    const answer = await evaluate({ ...request(), rubric_id: r.id }, session, env.DB, async () => ({
      usage,
      value: {
        ...valid(),
        rubric_results: r.items.map((i) => ({ id: i.id, passed: true, reason: 'Older criterion' })),
      },
    }));
    expect(answer.rubric_version).toBe(1);
  });
  it('provider timeout is bounded and sanitized', async () => {
    vi.useFakeTimers();
    try {
      const transport = vi.fn(
        (_url: unknown, init: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => reject(new Error('private detail')));
          }),
      );
      const work = anthropic(
        'test',
        transport as typeof fetch,
      )({ model: MODELS.cheap, stable: 'stable', submission: 'work', schema: {}, repair: false });
      const assertion = expect(work).rejects.toThrow('provider_timeout');
      await vi.advanceTimersByTimeAsync(30000);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });
});

it('AI-002/013 settings persist canonically, expose categories, and refuse a limit below committed spend', async () => {
  const { session, token } = await learner();
  const put = (mode: string, monthly_limit_usd: number) =>
    handleAi(
      new Request('https://test/api/ai/settings', {
        method: 'PUT',
        headers: { authorization: `Bearer ${token}` },
        body: JSON.stringify({ mode, monthly_limit_usd }),
      }),
      env,
    );
  expect((await settings(env.DB, session.learnerId)).mode).toBe('Limited');
  expect((await put('Full', 30)).status).toBe(200);
  await evaluate(request(), session, env.DB, async () => ({ value: valid(), usage }));
  const current = await settings(env.DB, session.learnerId);
  expect(current.mode).toBe('Full');
  expect(current.categories[0]?.category).toBe('written_coaching');
  expect((await put('Limited', 0)).status).toBe(409);
  expect((await put('Off', 30)).status).toBe(200);
  expect((await settings(env.DB, session.learnerId)).mode).toBe('Off');
});

it.each([1, 2])(
  'AI-003 retains unaccounted paid usage when accounting transaction %s fails',
  async (failAt) => {
    const { session } = await learner();
    let batches = 0;
    let responses = 0;
    const failingDb = new Proxy(env.DB, {
      get(target, property) {
        if (property === 'batch')
          return (statements: D1PreparedStatement[]) => {
            if (++batches === failAt) {
              return Promise.reject(new Error('storage unavailable'));
            }
            return target.batch(statements);
          };
        const value = Reflect.get(target, property);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    await expect(
      evaluate(request(), session, failingDb, async () => ({
        value: responses++ === 0 ? null : valid(),
        usage,
      })),
    ).rejects.toThrow('storage unavailable');
    const policy = await settings(env.DB, session.learnerId);
    expect(policy.spent_usd).toBeCloseTo((failAt - 1) * cost(MODELS.cheap, usage), 12);
    expect(policy.spent_usd + policy.reserved_usd).toBeCloseTo(maximumCost(MODELS.cheap), 12);
  },
);
