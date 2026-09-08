import { SIMULATOR_VERSION } from '@bloomlab/simulator-core';
import { env as testEnv } from 'cloudflare:test';
import { describe, expect, it, vi } from 'vitest';

import worker, { type Env, type HealthResponse } from './index';

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    BLOOMLAB_ENV: 'local',
    ASSETS: { fetch: vi.fn(async () => new Response('asset')) } as unknown as Fetcher,
    DB: testEnv.DB,
    MEDIA: testEnv.MEDIA,
    ...overrides,
  };
}

describe('worker', () => {
  it('reports health with the version triplet and environment', async () => {
    const response = await worker.fetch(new Request('https://bloomlab.test/api/health'), makeEnv());
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    const body = (await response.json()) as HealthResponse;
    expect(body.ok).toBe(true);
    expect(body.build_id).toBe('local');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(body.environment).toBe('local');
    expect(body.versions).toEqual({
      app: '0.1.0',
      content: expect.stringMatching(/^\d{4}\.\d{2}\.\d{2}/),
      simulator: SIMULATOR_VERSION,
    });
  });

  it('returns 404 JSON for unknown API routes', async () => {
    const response = await worker.fetch(new Request('https://bloomlab.test/api/nope'), makeEnv());
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Not found' });
  });

  it('delegates non-API requests to static assets', async () => {
    const env = makeEnv();
    const response = await worker.fetch(new Request('https://bloomlab.test/skill-map'), env);
    expect(env.ASSETS.fetch).toHaveBeenCalledTimes(1);
    expect(await response.text()).toBe('asset');
  });

  it('fails fast on a misconfigured environment name', async () => {
    await expect(
      worker.fetch(
        new Request('https://bloomlab.test/api/health'),
        makeEnv({ BLOOMLAB_ENV: 'staging' }),
      ),
    ).rejects.toThrow(/Unknown runtime environment/);
  });
});
