import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';
import { describe, expect, it } from 'vitest';
const root = fileURLToPath(new URL('../../..', import.meta.url));
function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)],
  );
}
describe('SEC-001 / DATA-006 / INF-004 source boundaries', () => {
  it('keeps provider keys and HTTP calls out of browser source and content', () => {
    for (const file of [...files(join(root, 'apps/web/src')), ...files(join(root, 'content'))]) {
      if (/\.test\./.test(file)) continue;
      expect(readFileSync(file, 'utf8'), file).not.toMatch(
        /ELEVENLABS_API_KEY|xi-api-key|api\.elevenlabs\.io|@elevenlabs\//i,
      );
    }
    const pkg = JSON.parse(readFileSync(join(root, 'apps/web/package.json'), 'utf8'));
    expect(pkg.scripts.build).toContain('check-browser-secrets.mjs');
    expect(pkg.scripts['build:preview']).toContain('check-browser-secrets.mjs');
  });
  it('playback has no transitive generation/provider import', () => {
    const visited = new Set<string>();
    function visit(file: string) {
      if (visited.has(file)) return;
      visited.add(file);
      expect(file).not.toMatch(/\/(?:provider|generate|handlers)\.ts$/);
      const source = readFileSync(file, 'utf8');
      expect(source).not.toMatch(/elevenLabs\(|api\.elevenlabs\.io|ELEVENLABS_API_KEY/);
      for (const match of source.matchAll(/from ['"]([^'"]+)['"]/g)) {
        if (!match[1]!.startsWith('.')) continue;
        const path = resolve(file, '..', match[1]!);
        visit(path.endsWith('.ts') ? path : `${path}.ts`);
      }
    }
    visit(join(root, 'worker/src/voice/playback.ts'));
  });
  it('binds distinct private buckets and does not require a production TTS credential', () => {
    const source = readFileSync(join(root, 'worker/wrangler.jsonc'), 'utf8');
    const config = JSON.parse(source.replace(/\/\/[^\n]*/g, '').replace(/,\s*([}\]])/g, '$1'));
    expect(config.r2_buckets).toEqual([{ binding: 'MEDIA', bucket_name: 'bloomlab-media-dev' }]);
    expect(config.env.preview.r2_buckets).toEqual(config.r2_buckets);
    expect(config.env.production.r2_buckets).toEqual([
      { binding: 'MEDIA', bucket_name: 'bloomlab-media-prod' },
    ]);
    expect(config.env.production.secrets.required).not.toContain('ELEVENLABS_API_KEY');
    expect(source).not.toMatch(/r2\.dev|"remote"\s*:\s*true/);
  });
});
