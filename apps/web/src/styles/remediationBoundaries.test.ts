import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');
const files = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' }).trim().split('\n');

describe('Field-Ready remediation boundaries', () => {
  it('separates local/preview resources from production and keeps local bindings simulated', () => {
    const { config } = ts.parseConfigFileTextToJson(
      'wrangler.jsonc',
      read('worker/wrangler.jsonc'),
    );
    const production = config.env.production;
    for (const dev of [config, config.env.preview]) {
      expect(dev.d1_databases[0].database_name).toBe('bloomlab-dev');
      expect(dev.d1_databases[0].database_id).not.toBe(production.d1_databases[0].database_id);
      expect(dev.r2_buckets[0].bucket_name).not.toBe(production.r2_buckets[0].bucket_name);
      for (const binding of [...dev.d1_databases, ...dev.r2_buckets])
        expect(binding.remote).not.toBe(true);
    }
    const ci = read('.github/workflows/ci.yml');
    const preview = ci.slice(ci.indexOf('\n  preview:'), ci.indexOf('\n  deploy:'));
    expect(preview).toContain('CLOUDFLARE_ENV: preview');
    expect(preview).toContain('bloomlab-dev --remote --env preview');
    expect(preview).not.toContain('CLOUDFLARE_ENV: production');
    expect(preview.replace(/^\s*#.*$/gm, '')).not.toContain('bloomlab-prod');
    expect(ci).toContain("github.ref == 'refs/heads/main'");
  });

  it('detects credential canaries without printing values and refuses unknown/public R2 state', () => {
    const script = `
      import assert from 'node:assert/strict';
      import { secretFindings, assertPrivateBucket } from './scripts/security-rules.mjs';
      for (const value of ['sk-ant-' + 'a'.repeat(40), 'AIza' + 'b'.repeat(35), '-----BEGIN ' + 'PRIVATE KEY-----' + String.fromCharCode(10) + 'd'.repeat(64), 'ELEVENLABS_API_KEY=' + JSON.stringify('c'.repeat(32))]) {
        assert(secretFindings(value).length > 0, 'Canary not detected');
        assert(!JSON.stringify(secretFindings(value)).includes(value), 'Scanner exposed canary');
      }
      assert.deepEqual(secretFindings('env.ANTHROPIC_API_KEY'), []);
      assertPrivateBucket({enabled:false}, {domains:[]});
      for (const [managed, custom] of [[{enabled:true},{domains:[]}], [{enabled:false},{domains:[{enabled:true}]}], [{},{domains:[]}], [{enabled:false},{}]])
        assert.throws(() => assertPrivateBucket(managed,custom));
    `;
    expect(() =>
      execFileSync(process.execPath, ['--input-type=module', '-e', script], {
        cwd: root,
        stdio: 'pipe',
      }),
    ).not.toThrow();
  });

  it('preserves all twelve independent-audit human acceptance rows', () => {
    const matrix = read('REQUIREMENTS_MATRIX.md');
    for (const id of [
      'PRD-005',
      'CUR-015',
      'CUR-031',
      'FLD-001',
      'EXR-020',
      'CALL-002',
      'CALL-005',
      'CALL-006',
      'EXR-015',
      'VOI-006',
      'VOI-007',
      'SEC-005',
    ]) {
      const row = matrix.split('\n').find((line) => line.startsWith(`| ${id} |`));
      expect(row, id).toContain('| IMPLEMENTED_UNVERIFIED |');
    }
  });

  it('retains the independent report and all ten INF-015 categories', () => {
    const report = read('AUDIT_REPORT.md');
    for (const heading of [
      'Missing requirements',
      'Partial features',
      'Stubs',
      'TODOs',
      'Fake data',
      'Responsive gaps',
      'Missing tests',
      'Stale GHL mapping',
      'Design violations',
      'Inaccessible interactions',
    ])
      expect(report).toContain(heading);
    expect(report).toContain('INF-015 audit result: PASS');
  });

  it('has no prohibited INF-006/007 bindings in any environment', () => {
    const parsed = ts.parseConfigFileTextToJson('wrangler.jsonc', read('worker/wrangler.jsonc'));
    expect(parsed.error).toBeUndefined();
    const config: unknown = parsed.config;
    function check(value: unknown): void {
      if (!value || typeof value !== 'object') return;
      for (const [key, child] of Object.entries(value)) {
        expect(['durable_objects', 'queues', 'vectorize', 'services']).not.toContain(key);
        check(child);
      }
    }
    check(config);
  });

  it('has no prohibited INF-008 infrastructure in tracked manifests', () => {
    for (const path of files.filter((path) => /(^|\/)package\.json$/.test(path))) {
      const manifest = JSON.parse(read(path)) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
        optionalDependencies?: Record<string, string>;
      };
      const dependencies = Object.keys({
        ...manifest.dependencies,
        ...manifest.devDependencies,
        ...manifest.optionalDependencies,
      });
      for (const name of dependencies) {
        expect(name, path).not.toMatch(
          /redis|supabase|firebase|kubernetes|pinecone|weaviate|qdrant|chroma|express|fastify|nestjs/i,
        );
      }
    }
    expect(
      files.filter((path) => /(^|\/)(Dockerfile|docker-compose|kubernetes|k8s)([/.]|$)/.test(path)),
    ).toEqual([]);
  });
});
