import { fileURLToPath } from 'node:url';

import { cloudflare } from '@cloudflare/vite-plugin';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  // Root-level public/ per the spec §102 layout.
  publicDir: fileURLToPath(new URL('../../public', import.meta.url)),
  plugins: [react(), cloudflare({ configPath: '../../worker/wrangler.jsonc' })],
});
