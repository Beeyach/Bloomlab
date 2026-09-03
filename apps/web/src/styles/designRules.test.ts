import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * The global design prohibitions, checked against the stylesheets rather than against class
 * names (DES-021, DES-022, D-075). Renaming `.eyebrow` to `.meta` would not satisfy any of
 * these: they look for the *treatment* — tiny uppercase type, monospace families, and rings
 * that ignore the shape they surround.
 */

/** Walks up from the working directory until the workspace root is underfoot. */
function workspaceRoot(): string {
  let current = process.cwd();
  for (let depth = 0; depth < 6; depth += 1) {
    try {
      statSync(join(current, 'packages', 'design-system', 'package.json'));
      return current;
    } catch {
      current = join(current, '..');
    }
  }
  throw new Error('Could not locate the workspace root from ' + process.cwd());
}

const ROOT = workspaceRoot();

function stylesheets(directory: string, found: string[] = []): string[] {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) stylesheets(path, found);
    else if (entry.name.endsWith('.css')) found.push(path);
  }
  return found;
}

const SHEETS = [
  ...stylesheets(join(ROOT, 'apps', 'web', 'src')),
  ...stylesheets(join(ROOT, 'packages', 'design-system', 'src')),
];

const read = (path: string) => readFileSync(path, 'utf8');
const relative = (path: string) => path.slice(ROOT.length + 1).replaceAll('\\', '/');

/**
 * Every `selector { … }` block in a stylesheet, with the line it starts on. Comments are blanked
 * rather than deleted so the reported line numbers still point at the real rule.
 */
function rules(css: string): { selector: string; body: string; line: number }[] {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '));
  const found: { selector: string; body: string; line: number }[] = [];
  const pattern = /([^{}]+)\{([^{}]*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) {
    const selector = (match[1] ?? '').trim().replace(/\s+/g, ' ');
    if (selector.startsWith('@') || selector.length === 0) continue;
    found.push({
      selector,
      body: match[2] ?? '',
      line: source.slice(0, match.index).split('\n').length,
    });
  }
  return found;
}

/**
 * The primary navigation rail labels its destinations in small caps. That is navigation, not a
 * label sitting above a heading, and it is the one place the treatment is allowed to survive.
 */
const NAV_RAIL = 'apps/web/src/app/AppRail.module.css';

describe('no eyebrows in user-facing UI (DES-021)', () => {
  it('has no rule that is both tiny and uppercase', () => {
    const offenders: string[] = [];
    for (const sheet of SHEETS) {
      if (relative(sheet) === NAV_RAIL) continue;
      for (const rule of rules(read(sheet))) {
        const uppercase = /text-transform:\s*uppercase/.test(rule.body);
        const tiny = /font-size:\s*(var\(--bl-font-size-xs\)|0\.[0-7]\d*rem)/.test(rule.body);
        if (uppercase && tiny) {
          offenders.push(`${relative(sheet)}:${rule.line} ${rule.selector}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('exposes no eyebrow tracking token to build one from', () => {
    for (const sheet of SHEETS) {
      expect(read(sheet)).not.toMatch(/--bl-font-tracking-eyebrow/);
    }
  });

  it('names no eyebrow, kicker or overline class anywhere', () => {
    const offenders: string[] = [];
    for (const sheet of SHEETS) {
      const matches = read(sheet).match(/\.(eyebrow|kicker|overline)\b/gi);
      if (matches) offenders.push(`${relative(sheet)}: ${matches.join(', ')}`);
    }
    expect(offenders).toEqual([]);
  });
});

describe('no monospace in user-facing UI (DES-022)', () => {
  it('declares no monospace family in any stylesheet', () => {
    const offenders: string[] = [];
    for (const sheet of SHEETS) {
      for (const rule of rules(read(sheet))) {
        if (
          /font-family:[^;]*(monospace|--bl-font-mono|Plex Mono|Consolas|Courier)/i.test(rule.body)
        ) {
          offenders.push(`${relative(sheet)}:${rule.line} ${rule.selector}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('retires the monospace token and the font it loaded', () => {
    const tokens = read(join(ROOT, 'packages', 'design-system', 'src', 'tokens.css'));
    expect(tokens).not.toMatch(/--bl-font-mono/);
    const fonts = read(join(ROOT, 'packages', 'design-system', 'src', 'fonts.css'));
    expect(fonts).not.toMatch(/mono/i);
    const manifest = read(join(ROOT, 'packages', 'design-system', 'package.json'));
    expect(manifest).not.toMatch(/ibm-plex-mono/);
  });

  it('makes code, pre, kbd and samp inherit the product typography', () => {
    // Without this they fall back to the user agent's own monospace family.
    const global = read(join(ROOT, 'apps', 'web', 'src', 'styles', 'global.css'));
    const rule = rules(global).find(
      (candidate) =>
        /(^|,)\s*code\s*(,|$)/m.test(candidate.selector) && candidate.selector.includes('pre'),
    );
    expect(rule, 'global.css must tell code/pre/kbd/samp to inherit').toBeDefined();
    expect(rule?.selector).toContain('kbd');
    expect(rule?.selector).toContain('samp');
    expect(rule?.body).toMatch(/font-family:\s*inherit/);
  });
});

describe('interaction rings follow the shape they surround (D-075)', () => {
  it('never lets a focus rule reshape a surface that has its own radius', () => {
    // The global rule used to set `border-radius`, which collapsed a 24 px holographic card to
    // 6 px for as long as it was focused — a pointed corner appearing during a tap.
    const global = read(join(ROOT, 'apps', 'web', 'src', 'styles', 'global.css'));
    const focus = rules(global).find((rule) => rule.selector.trim() === ':focus-visible');
    expect(focus, 'global.css must still give everything a visible focus ring').toBeDefined();
    expect(focus?.body).not.toMatch(/border-radius/);
    expect(focus?.body).toMatch(/outline:/);
  });

  it('suppresses the platform tap highlight on controls that answer a touch themselves', () => {
    const global = read(join(ROOT, 'apps', 'web', 'src', 'styles', 'global.css'));
    const rule = rules(global).find((candidate) =>
      /-webkit-tap-highlight-color:\s*transparent/.test(candidate.body),
    );
    expect(rule, 'global.css must clear the native tap highlight').toBeDefined();
    expect(rule?.selector).toContain('button');
  });

  it.each([
    ['HoloTerritory', '.territory'],
    ['SkillCard', '.card'],
    ['ClientCaseCover', '.cover'],
  ])('draws %s focus as a shadow, which always follows the radius', (component, selector) => {
    const css = read(
      join(ROOT, 'packages', 'design-system', 'src', 'semantic', `${component}.module.css`),
    );
    const focus = rules(css).find((rule) => rule.selector === `${selector}:focus-visible`);
    expect(focus, `${component} must define its own rounded focus ring`).toBeDefined();
    expect(focus?.body).toMatch(/box-shadow:\s*0 0 0 \d+px/);
    // The outline stays, transparent, so forced-colours mode still paints a ring.
    expect(focus?.body).toMatch(/outline:\s*\d+px solid transparent/);
  });

  it('keeps a selected territory distinguishable from a focused one', () => {
    const css = read(
      join(ROOT, 'packages', 'design-system', 'src', 'semantic', 'HoloTerritory.module.css'),
    );
    const both = rules(css).find(
      (rule) => rule.selector === ".territory[aria-pressed='true']:focus-visible",
    );
    expect(both, 'selection and focus must compose rather than replace each other').toBeDefined();
    expect(both?.body.match(/0 0 0 \d+px/g) ?? []).toHaveLength(2);
  });

  it('uses no offset outline on the holographic cards themselves', () => {
    // An offset outline around a transformed element is painted square by older WebKit.
    const skillMap = read(join(ROOT, 'apps', 'web', 'src', 'screens', 'SkillMap.module.css'));
    const selected = rules(skillMap).find((rule) =>
      rule.selector.includes("[aria-pressed='true']"),
    );
    expect(selected?.body).toMatch(/box-shadow/);
    expect(selected?.body).not.toMatch(/outline/);
  });
});
