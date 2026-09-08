import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { content } from '../content/bundle';
import { PORTFOLIO_ARTIFACT_KINDS } from '@bloomlab/content-schema';

describe('Portfolio and export product boundaries', () => {
  it('uses all ten authored artifact categories and only truthful labels in current templates', () => {
    for (const template of content.portfolio) {
      expect(template.artifacts.map((a) => a.kind).sort()).toEqual(
        [...PORTFOLIO_ARTIFACT_KINDS].sort(),
      );
      expect(['Simulation Project', 'Demonstration Build']).toContain(template.label);
      expect(JSON.stringify(template)).not.toMatch(
        /client_outcomes|conversion_lift|generated \d+ leads|increased conversion|testimonial/i,
      );
    }
  });
  it('keeps providers, public media, parallel stores and outcome claim fields out of the new product surfaces', () => {
    for (const folder of ['.', '../backup']) {
      const root = resolve(import.meta.dirname, folder);
      for (const file of readdirSync(root).filter(
        (n) => /\.(ts|tsx)$/.test(n) && !n.includes('.test.') && n !== 'fixtures.ts',
      )) {
        const source = readFileSync(resolve(root, file), 'utf8');
        expect(source).not.toMatch(
          /\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|localStorage|\/api\/(ai|voice|call)|from ['"][^'"]*(ai\/client|call\/client)/,
        );
        expect(source).not.toMatch(
          /client_outcomes|conversion_lift|generated \d+ leads|increased conversion|testimonial/,
        );
      }
    }
  });
});
