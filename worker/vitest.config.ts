import { fileURLToPath } from 'node:url';

import { bloomlabContent } from '@bloomlab/content-schema/vite';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

// Worker tests run inside workerd with a real (local) D1: every test file starts from the
// migrations in ../migrations, applied by test/setup.ts (DATA-005 evidence in every run).
export default defineConfig(async () => {
  const migrations = await readD1Migrations(
    fileURLToPath(new URL('../migrations', import.meta.url)),
  );
  return {
    plugins: [
      // The Worker reports the compiled content version (spec §101); tests see the real one.
      bloomlabContent({
        rootDir: fileURLToPath(new URL('../content', import.meta.url)),
        enforceLock: false,
      }),
      cloudflareTest({
        wrangler: { configPath: './wrangler.jsonc' },
        isolatedStorage: true,
        miniflare: {
          bindings: { SYNC_KEY_PEPPER: 'test-pepper', TEST_MIGRATIONS: migrations },
        },
      }),
    ],
    test: {
      name: 'worker',
      include: ['src/**/*.test.ts'],
      setupFiles: ['./test/setup.ts'],
    },
  };
});
