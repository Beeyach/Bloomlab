import { defineConfig } from 'vitest/config';

// Each workspace folder is a Vitest project. Folders with their own vitest.config.ts
// (apps/web) override these defaults; the rest inherit them.
export default defineConfig({
  test: {
    projects: ['apps/*', 'packages/*', 'worker'],
    passWithNoTests: true,
  },
});
