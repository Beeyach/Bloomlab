// Measures the primary rail (spec §73, DES-009, RSP-004): the column is exactly --bl-size-rail wide
// on tablet and desktop and the page starts beside it, never under it; on phones it is a bottom
// bar every area still fits in, with no horizontal overflow. Writes rail-probe.json and rail-*.png
// to .review/ (override with REVIEW_OUT).
//   BASE=http://localhost:4173 node scripts/review/rail-probe.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { openPage, screenshot, session, setViewport, sleep } from './cdp.mjs';

const OUT = resolve(process.env.REVIEW_OUT ?? '.review');
const BASE = process.env.BASE ?? 'http://localhost:4173';
const PAGE = process.env.RAIL_PAGE ?? '/skills';
const WIDTHS = [1440, 1024, 768, 390, 320];

mkdirSync(OUT, { recursive: true });

const measure = (page) =>
  page.evaluate(`(() => {
    const rail = document.querySelector('nav[aria-label="Primary"]');
    const main = document.querySelector('main');
    if (!rail || !main) return { missing: true };
    const r = rail.getBoundingClientRect();
    const m = main.getBoundingClientRect();
    const token = getComputedStyle(document.documentElement).getPropertyValue('--bl-size-rail').trim();
    const items = [...rail.querySelectorAll('a')].map((a) => {
      const b = a.getBoundingClientRect();
      return { label: a.textContent.trim(), x: b.left, y: b.top, w: b.width, h: b.height,
        visible: b.width > 0 && b.height > 0 && b.right <= innerWidth + 0.5 && b.bottom <= innerHeight + 0.5 };
    });
    // The first block-level content inside main, so the offset is measured against real content,
    // not the padding box.
    const first = main.querySelector('h1, h2, section, article, div');
    const f = first ? first.getBoundingClientRect() : m;
    return {
      token,
      rail: { x: r.left, y: r.top, w: r.width, h: r.height },
      main: { x: m.left, w: m.width },
      firstContentLeft: f.left,
      items,
      innerWidth, innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      holo: (() => { const c = document.querySelector('[data-variant]'); if (!c) return null; const b = c.getBoundingClientRect(); return { x: b.left, w: b.width, overlapsRail: r.width < r.height ? b.left < r.right - 0.5 : false }; })(),
    };
  })()`);

const { page, close } = await session();
const report = { base: BASE, page: PAGE, widths: {} };
let failures = 0;
try {
  for (const width of WIDTHS) {
    const height = width < 768 ? 844 : 900;
    await setViewport(page, width, height, { mobile: width < 768 });
    await openPage(page, `${BASE}${PAGE}`);
    await sleep(600);
    const m = await measure(page);
    const checks = {};
    if (m.missing) {
      checks.rendered = false;
    } else if (width >= 768) {
      const expected = Number.parseFloat(m.token);
      checks.tokenIs80 = expected === 80;
      checks.railWidthMatchesToken = Math.abs(m.rail.w - expected) < 0.5;
      checks.railIsColumn = m.rail.h >= m.innerHeight - 1 && m.rail.x === 0;
      checks.mainStartsBesideRail = m.main.x >= m.rail.w - 0.5;
      checks.contentClearOfRail = m.firstContentLeft >= m.rail.w - 0.5;
      checks.noHorizontalOverflow = m.scrollWidth <= m.innerWidth;
      checks.holoClearOfRail = m.holo ? !m.holo.overlapsRail : null;
    } else {
      checks.railIsBottomBar =
        Math.abs(m.rail.y + m.rail.h - m.innerHeight) < 1 && m.rail.w >= m.innerWidth - 1;
      checks.barHeight64 = Math.abs(m.rail.h - 64) < 0.5;
      checks.everyAreaVisible = m.items.length >= 6 && m.items.every((item) => item.visible);
      checks.noHorizontalOverflow = m.scrollWidth <= m.innerWidth;
      checks.touchTargets44 = m.items.every((item) => item.w >= 44 && item.h >= 44);
    }
    const passed = Object.values(checks).every((value) => value !== false);
    if (!passed) failures += 1;
    report.widths[width] = { measured: m, checks, passed };
    await screenshot(page, resolve(OUT, `rail-${width}.png`), null, false);
  }
} finally {
  await close();
}
report.passed = failures === 0;
writeFileSync(resolve(OUT, 'rail-probe.json'), JSON.stringify(report, null, 2));
for (const [width, row] of Object.entries(report.widths)) {
  console.log(`${width}px ${row.passed ? 'PASS' : 'FAIL'} ${JSON.stringify(row.checks)}`);
}
console.log(report.passed ? 'rail probe: PASS' : 'rail probe: FAIL');
process.exit(report.passed ? 0 : 1);
