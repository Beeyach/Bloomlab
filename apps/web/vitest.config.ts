import { fileURLToPath } from 'node:url';

import { bloomlabContent } from '@bloomlab/content-schema/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    // Screens import the compiled curriculum; tests compile the real content/ tree once.
    bloomlabContent({
      rootDir: fileURLToPath(new URL('../../content', import.meta.url)),
      enforceLock: false,
    }),
    react(),
  ],
  test: {
    name: 'web',
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
