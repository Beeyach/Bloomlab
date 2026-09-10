import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

import { bloomlabContent } from '@bloomlab/content-schema/vite';
import { cloudflare } from '@cloudflare/vite-plugin';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { stablePrecacheFiles } from './src/pwa/precachePolicy.ts';

export default defineConfig({
  build: { manifest: true },
  define: {
    __BLOOMLAB_BUILD_ID__: JSON.stringify(process.env.BLOOMLAB_BUILD_ID ?? 'local'),
  },
  // Root-level public/ per the spec §102 layout.
  publicDir: fileURLToPath(new URL('../../public', import.meta.url)),
  plugins: [
    // Curriculum compiled from content/ at build time (spec §100, CNT-006); a broken reference
    // fails the build, and the app imports `virtual:bloomlab-content` instead of parsing files.
    bloomlabContent({ rootDir: fileURLToPath(new URL('../../content', import.meta.url)) }),
    react(),
    // Installable PWA (DATA-003, spec §87): the service worker precaches the app shell and
    // stable assets; `/api/*` is never cached; curriculum (Phase 5) is served stale-while-revalidate.
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        id: '/',
        name: 'Bloomlab',
        short_name: 'Bloomlab',
        description: 'A mastery simulator for funnel and GoHighLevel systems.',
        lang: 'en',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#F8FAFF',
        theme_color: '#F8FAFF',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        globIgnores: ['**/wrangler.json', '**/*.map', '**/.assetsignore'],
        manifestTransforms: [
          async (entries) => {
            const manifest = JSON.parse(
              readFileSync(new URL('./dist/client/.vite/manifest.json', import.meta.url), 'utf8'),
            );
            const stable = stablePrecacheFiles(manifest);
            return {
              manifest: entries.filter(
                (entry) => !/\.(?:js|css)$/.test(entry.url) || stable.has(entry.url),
              ),
              warnings: [],
            };
          },
        ],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: false,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkOnly',
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/content/'),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'bloomlab-content',
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            // Demand-loaded route assets remain available on the next offline visit. Hashed
            // URLs cannot change underneath a cache hit; /api and private media are excluded.
            urlPattern: ({ url, sameOrigin }) =>
              sameOrigin && /^\/assets\/.*\.(?:js|css)$/.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'bloomlab-routes',
              // Vite's local asset server varies on Origin; script/link/fetch requests differ.
              // These same-origin hashed public bytes are identical, never API/private data.
              matchOptions: { ignoreVary: true },
              cacheableResponse: { statuses: [200] },
              expiration: { maxEntries: 250, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
    cloudflare({ configPath: '../../worker/wrangler.jsonc' }),
  ],
});
