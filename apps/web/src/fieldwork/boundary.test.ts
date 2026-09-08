import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { evidenceFetch } from './assets';

describe('FLD-002 screenshot boundary', () => {
  it('keeps fieldwork network calls in one relative, redirect-refusing evidence transport', async () => {
    const root = resolve(import.meta.dirname);
    for (const name of readdirSync(root).filter(
      (n) => /\.(ts|tsx)$/.test(n) && !n.includes('.test.'),
    )) {
      const source = readFileSync(resolve(root, name), 'utf8');
      expect(source).not.toMatch(
        /https?:\/\/|XMLHttpRequest|sendBeacon|WebSocket|\/api\/(ai|voice|call)|from ['"][^'"]*(ai\/client|call\/client)/,
      );
      if (name !== 'assets.ts') expect(source).not.toMatch(/\bfetch\s*\(/);
    }
    const server = readFileSync(
      resolve(root, '../../../../worker/src/evidence/handlers.ts'),
      'utf8',
    );
    expect(server).not.toMatch(
      /\bfetch\s*\(|console\.|anthropic|elevenlabs|google|leadconnector|gohighlevel/i,
    );
    const fetch = vi.spyOn(globalThis, 'fetch');
    for (const address of [
      'https://services.leadconnectorhq.com',
      'https://api.anthropic.com',
      'https://example.r2.dev',
      '../ai/evaluate',
    ])
      await expect(evidenceFetch(address)).rejects.toThrow('Invalid evidence address');
    expect(fetch).not.toHaveBeenCalled();
    fetch.mockRestore();
  });
});
