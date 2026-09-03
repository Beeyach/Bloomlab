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
    // The spectral selection edge, then the focus ring outside it. The third shadow is the soft
    // lilac pool, which has a blur and is not a ring.
    expect(both?.body.match(/0 0 0 \d+px/g) ?? []).toHaveLength(2);
    expect(both?.body).toMatch(/var\(--bl-color-focus\)/);
  });

  it('uses no offset outline on the holographic cards themselves', () => {
    // An offset outline around a transformed element is painted square by older WebKit.
    const css = read(
      join(ROOT, 'packages', 'design-system', 'src', 'semantic', 'HoloTerritory.module.css'),
    );
    const selected = rules(css).find((rule) => rule.selector === ".territory[aria-pressed='true']");
    expect(selected?.body).toMatch(/box-shadow/);
    expect(selected?.body).not.toMatch(/outline/);
  });
});

describe('a selected holographic card is lit, not fenced in (D-088)', () => {
  const territoryCss = () =>
    read(join(ROOT, 'packages', 'design-system', 'src', 'semantic', 'HoloTerritory.module.css'));

  it('draws no dark ring around a selected territory', () => {
    // The tablet screenshot showed a black-bordered form control sitting among soft holo cards.
    const selected = rules(territoryCss()).find(
      (rule) => rule.selector === ".territory[aria-pressed='true']",
    );
    expect(selected, 'a selected territory must still be drawn').toBeDefined();
    for (const rule of rules(territoryCss())) {
      if (!rule.selector.includes("[aria-pressed='true']")) continue;
      expect(rule.body, `${rule.selector} must not ring the card in ink`).not.toMatch(
        /--bl-color-ink\b|--bl-color-ink-deep/,
      );
    }
  });

  it('draws selection with the material’s own spectral colour and a soft pool', () => {
    const selected = rules(territoryCss()).find(
      (rule) => rule.selector === ".territory[aria-pressed='true']",
    );
    expect(selected?.body).toMatch(/0 0 0 2px var\(--bl-color-lavender\)/);
    // A blurred, offset shadow: the pool under the card, not another hard edge.
    expect(selected?.body).toMatch(/0 8px 24px/);
  });

  it('wakes the material through its own properties, leaving the shape alone', () => {
    const material = rules(territoryCss()).find(
      (rule) => rule.selector === ".territory[aria-pressed='true'] .material",
    );
    expect(material?.body).toMatch(/--holo-ring:/);
    expect(material?.body).toMatch(/--holo-glow:/);
    // Nothing about selection may touch the clip, the radius or the tilt.
    for (const property of ['border-radius', 'overflow', 'clip-path', 'transform', 'will-change']) {
      expect(material?.body, `selection must not set ${property}`).not.toContain(property);
    }
  });

  it('does not leave the Skill Map drawing a second selection ring', () => {
    // Two owners of one state is how selection and focus came to disagree about the shape.
    const skillMap = read(join(ROOT, 'apps', 'web', 'src', 'screens', 'SkillMap.module.css'));
    const rings = rules(skillMap).filter(
      (rule) =>
        rule.selector.includes("[aria-pressed='true']") && /box-shadow|outline/.test(rule.body),
    );
    expect(rings).toEqual([]);
  });

  it('says which territory is showing, so selection is never colour alone', () => {
    const source = read(
      join(ROOT, 'packages', 'design-system', 'src', 'semantic', 'HoloTerritory.tsx'),
    );
    expect(source).toMatch(/Showing/);
    expect(source).toMatch(/aria-pressed/);
    expect(rules(territoryCss()).some((rule) => rule.selector === '.showing')).toBe(true);
  });
});

describe('the tablet engines the cards are actually read on (D-086)', () => {
  it('suppresses the native button chrome on WebKit older than 15.4 as well', () => {
    // D-075 said buttons lose the chrome WebKit paints on `:active`. Unprefixed `appearance` is
    // only honoured from Safari 15.4, so on an older iPad that suppression never happened and the
    // platform was still free to paint a square fill over the button's box under the finger.
    const global = read(join(ROOT, 'apps', 'web', 'src', 'styles', 'global.css'));
    const rule = rules(global).find((candidate) => candidate.selector.trim() === 'button');
    expect(rule, 'global.css must still suppress the native button chrome').toBeDefined();
    expect(rule?.body).toMatch(/-webkit-appearance:\s*none/);
    expect(rule?.body).toMatch(/[^-]appearance:\s*none/);
  });

  it('cuts the rim light back to a rim on those engines too', () => {
    // Unprefixed `mask` and `mask-composite` are also 15.4. Without the prefixed pair the conic
    // gradient is never excluded down to 1.5 px and washes the whole card while it is touched.
    const css = read(
      join(ROOT, 'packages', 'design-system', 'src', 'holo', 'HoloMaterial.module.css'),
    );
    const rim = rules(css).find((rule) => rule.selector === '.rim');
    expect(rim?.body).toMatch(/-webkit-mask:/);
    expect(rim?.body).toMatch(/-webkit-mask-composite:\s*xor/);
    expect(rim?.body).toMatch(/mask-composite:\s*exclude/);
  });

  it('offers a surface whose rounded clip is not on the element that transforms', () => {
    // The diagnostic's case F. Until a real tablet says otherwise it is not the default, but it
    // has to be a real alternative rather than a mock, or the comparison proves nothing.
    const css = read(
      join(ROOT, 'packages', 'design-system', 'src', 'holo', 'HoloMaterial.module.css'),
    );
    const split = rules(css).find((rule) => rule.selector === '.split');
    const surface = rules(css).find((rule) => rule.selector === '.surface');
    expect(split?.body).toMatch(/overflow:\s*visible/);
    expect(surface?.body).toMatch(/overflow:\s*hidden/);
    expect(surface?.body).toMatch(/border-radius:\s*inherit/);
    // The transform stays where it was: only the clipping moved.
    const holo = rules(css).find((rule) => rule.selector === '.holo');
    expect(holo?.body).toMatch(/transform:\s*perspective/);
    expect(split?.body).not.toMatch(/transform:/);
  });
});
