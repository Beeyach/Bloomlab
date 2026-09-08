import type { D1Migration } from '@cloudflare/vitest-pool-workers';

// `env` from "cloudflare:test" is typed as the global Cloudflare.Env: give it the Worker's
// bindings plus the migrations injected by vitest.config.ts.
declare global {
  namespace Cloudflare {
    interface Env {
      ELEVENLABS_API_KEY?: string;
      TEST_MIGRATIONS: D1Migration[];
    }
  }
}
