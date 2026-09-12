import { handleEvidence } from './evidence/handlers';
import { handleAttachments } from './attachments/handlers';
import { handleRecovery } from './recovery/handlers';
import { handleCall } from './call/handlers';
import { handleAi } from './ai/handlers';
import { handleVoice } from './voice/handlers';
import { handleMedia } from './voice/playback';
import contentVersion from 'virtual:bloomlab-content/version';

import { APP_VERSION, BUILD_ID, parseRuntimeEnvironment } from '@bloomlab/shared';
import { SIMULATOR_VERSION } from '@bloomlab/simulator-core';

import { authenticate } from './sync/auth';
import {
  HttpError,
  labelDevice,
  link,
  listDevices,
  pull,
  push,
  readJson,
  revokeDevice,
} from './sync/handlers';

export interface Env extends Omit<CloudflareBindings, 'BLOOMLAB_ENV'> {
  BLOOMLAB_ENV: string;
  ANTHROPIC_API_KEY?: string;
  ELEVENLABS_API_KEY?: string;
  GOOGLE_CLOUD_CREDENTIAL?: string;
  CALLS_ENABLED?: string;
  /** Worker secret (never in config): the server-side pepper for sync-key hashing (SYNC-003). */
  SYNC_KEY_PEPPER?: string;
}

export interface HealthResponse {
  ok: true;
  build_id: string;
  environment: string;
  versions: {
    app: string;
    content: string;
    simulator: string;
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

/** /api/sync/* — the learner's sync endpoints (TECH_ARCHITECTURE §7). */
async function handleSync(request: Request, env: Env, path: string): Promise<Response> {
  if (request.method !== 'POST' && !(request.method === 'GET' && path === '/api/sync/devices')) {
    return json({ error: 'Method not allowed' }, 405);
  }
  if (path === '/api/sync/link') {
    return json(await link(await readJson(request), env.DB, env.SYNC_KEY_PEPPER));
  }
  const session = await authenticate(request, env.DB);
  if (!session) return json({ error: 'This device is not linked or was revoked' }, 401);
  switch (path) {
    case '/api/sync/push':
      return json(await push(await readJson(request), session, env.DB));
    case '/api/sync/pull':
      return json(await pull(await readJson(request), session, env.DB));
    case '/api/sync/devices':
      return json(await listDevices(session, env.DB));
    case '/api/sync/devices/revoke':
      return json(await revokeDevice(await readJson(request), session, env.DB));
    case '/api/sync/devices/label':
      return json(await labelDevice(await readJson(request), session, env.DB));
    default:
      return json({ error: 'Not found' }, 404);
  }
}

/** Only /api/* reaches this handler (see wrangler.jsonc `run_worker_first`). */
async function handleApi(request: Request, url: URL, env: Env): Promise<Response> {
  if (url.pathname.startsWith('/api/attachments')) return handleAttachments(request, env);
  if (url.pathname.startsWith('/api/recovery/')) return handleRecovery(request, env);
  if (url.pathname.startsWith('/api/evidence/')) return handleEvidence(request, env);
  if (url.pathname.startsWith('/api/call/')) return handleCall(request, env);
  if (url.pathname.startsWith('/api/media/')) return handleMedia(request, env);
  if (url.pathname.startsWith('/api/voice/')) return handleVoice(request, env);
  if (url.pathname.startsWith('/api/ai/')) return handleAi(request, env);
  if (url.pathname === '/api/health') {
    const body: HealthResponse = {
      ok: true,
      build_id: BUILD_ID,
      environment: parseRuntimeEnvironment(env.BLOOMLAB_ENV),
      versions: {
        app: APP_VERSION,
        content: contentVersion.content_version,
        simulator: SIMULATOR_VERSION,
      },
    };
    return json(body);
  }
  if (url.pathname.startsWith('/api/sync/')) {
    try {
      return await handleSync(request, env, url.pathname);
    } catch (error) {
      if (error instanceof HttpError) return json({ error: error.message }, error.status);
      // Message only: never the request, its body, headers or bound values (SEC-004).
      console.error('sync error:', error instanceof Error ? error.message : String(error));
      return json({ error: 'Sync failed on the server' }, 500);
    }
  }
  return json({ error: 'Not found' }, 404);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) return handleApi(request, url, env);
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
