import { fileURLToPath } from 'node:url';

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
