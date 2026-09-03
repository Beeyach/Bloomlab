/**
 * Vite plugin: compiles `content/` once per build and serves the bundle as
 * `virtual:bloomlab-content` (the whole bundle) and `virtual:bloomlab-content/version` (the
 * version slice the Worker needs). A content error fails the build (CNT-005, CNT-006); in dev,
 * edits under `content/` rebuild the bundle and reload the page.
 */
import { resolve } from 'node:path';

import type { Plugin, ViteDevServer } from 'vite';

import { versionInfoOf, type ContentBundle } from './bundle.ts';
import { compileContentDir, ContentBuildError, formatIssue } from './node.ts';

export const CONTENT_MODULE_ID = 'virtual:bloomlab-content';
export const CONTENT_VERSION_MODULE_ID = 'virtual:bloomlab-content/version';

const RESOLVED_CONTENT = `\0${CONTENT_MODULE_ID}`;
const RESOLVED_VERSION = `\0${CONTENT_VERSION_MODULE_ID}`;

export interface BloomlabContentOptions {
  /** Absolute path of the content tree. */
  rootDir: string;
  /** Fail when `content.lock.yaml` is out of date (default: true outside `vite dev`). */
  enforceLock?: boolean;
}

export function bloomlabContent(options: BloomlabContentOptions): Plugin {
  const rootDir = resolve(options.rootDir);
  let bundle: ContentBundle | null = null;
  let enforceLock = options.enforceLock ?? true;

  async function build(): Promise<ContentBundle> {
    bundle = await compileContentDir(rootDir, { enforceLock });
    for (const warning of bundle.warnings) console.warn(`[content] ${formatIssue(warning)}`);
    return bundle;
  }

  function invalidate(server: ViteDevServer): void {
    for (const id of [RESOLVED_CONTENT, RESOLVED_VERSION]) {
      const module = server.moduleGraph.getModuleById(id);
      if (module) server.moduleGraph.invalidateModule(module);
    }
  }

  return {
    name: 'bloomlab-content',
    configResolved(config) {
      if (options.enforceLock === undefined && config.command === 'serve') enforceLock = false;
    },
    async buildStart() {
      // One compile per process: the client and Worker environments share it.
      if (!bundle) await build();
    },
    resolveId(id) {
      if (id === CONTENT_MODULE_ID) return RESOLVED_CONTENT;
      if (id === CONTENT_VERSION_MODULE_ID) return RESOLVED_VERSION;
      return null;
    },
    async load(id) {
      if (id !== RESOLVED_CONTENT && id !== RESOLVED_VERSION) return null;
      const current = bundle ?? (await build());
      const value = id === RESOLVED_CONTENT ? current : versionInfoOf(current);
      return `export default ${JSON.stringify(value)};`;
    },
    configureServer(server) {
      server.watcher.add(rootDir);
      const onChange = async (file: string) => {
        if (!resolve(file).startsWith(rootDir)) return;
        try {
          await build();
          invalidate(server);
          server.ws.send({ type: 'full-reload' });
          server.config.logger.info(`[content] rebuilt after ${file}`);
        } catch (error) {
          const message = error instanceof ContentBuildError ? error.message : String(error);
          server.config.logger.error(`[content] ${message}`);
          server.ws.send({
            type: 'error',
            err: { message, stack: '', plugin: 'bloomlab-content' },
          });
        }
      };
      server.watcher.on('change', onChange);
      server.watcher.on('add', onChange);
      server.watcher.on('unlink', onChange);
    },
  };
}
