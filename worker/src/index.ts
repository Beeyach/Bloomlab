import { APP_VERSION, CONTENT_VERSION, parseRuntimeEnvironment } from '@bloomlab/shared';
import { SIMULATOR_VERSION } from '@bloomlab/simulator-core';

export interface Env {
  BLOOMLAB_ENV: string;
  ASSETS: Fetcher;
}

export interface HealthResponse {
  ok: true;
  environment: string;
  versions: {
    app: string;
    content: string | null;
    simulator: string;
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

/** Only /api/* reaches this handler (see wrangler.jsonc `run_worker_first`). */
function handleApi(url: URL, env: Env): Response {
  if (url.pathname === '/api/health') {
    const body: HealthResponse = {
      ok: true,
      environment: parseRuntimeEnvironment(env.BLOOMLAB_ENV),
      versions: { app: APP_VERSION, content: CONTENT_VERSION, simulator: SIMULATOR_VERSION },
    };
    return json(body);
  }
  return json({ error: 'Not found' }, 404);
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) return handleApi(url, env);
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
