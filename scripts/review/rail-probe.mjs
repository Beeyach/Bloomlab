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
// Phones: the bar shows the first four areas with their names and a labelled More for the rest.

mkdirSync(OUT, { recursive: true });

const DESTINATIONS = [
  '/',
  '/campaign',
  '/skills',
  '/crm',
  '/workflow',
  '/conversations',
  '/playground',
];

const measure = (page) =>
  page.evaluate(`(() => {
    const rail = document.querySelector('nav[aria-label="Primary"]');
    const main = document.querySelector('main');
    if (!rail || !main) return { missing: true };
    const r = rail.getBoundingClientRect();
    const m = main.getBoundingClientRect();
    const token = getComputedStyle(document.documentElement).getPropertyValue('--bl-size-rail').trim();
    const shown = (el) => { const b = el.getBoundingClientRect(); return b.width > 0 && b.height > 0 && getComputedStyle(el).visibility !== 'hidden'; };
    // Every control in the rail: links and the More button. A label counts as visible wording
    // only when it takes up real space (a clipped, one-pixel label does not).
    const items = [...rail.querySelectorAll('a, button')].map((el) => {
      const b = el.getBoundingClientRect();
      const label = el.querySelector('[class*="label"]');
      const lb = label ? label.getBoundingClientRect() : null;
      return { label: (label?.textContent ?? el.textContent).trim(), href: el.getAttribute('href'),
        x: b.left, y: b.top, w: b.width, h: b.height,
        visible: shown(el) && b.right <= innerWidth + 0.5 && b.bottom <= innerHeight + 0.5,
        labelVisible: Boolean(lb) && lb.width > 8 && lb.height > 8 && lb.right <= innerWidth + 0.5,
        inMenu: Boolean(el.closest('[data-testid="rail-more-menu"]')) };
    });
    const first = main.querySelector('h1, h2, section, article, div');
    const f = first ? first.getBoundingClientRect() : m;
    const menu = document.querySelector('[data-testid="rail-more-menu"]');
    const mb = menu && !menu.hidden ? menu.getBoundingClientRect() : null;
    return {
      token,
      rail: { x: r.left, y: r.top, w: r.width, h: r.height },
      main: { x: m.left, w: m.width },
      firstContentLeft: f.left,
      items,
      menu: mb ? { x: mb.left, y: mb.top, w: mb.width, h: mb.height, withinViewport: mb.left >= 0 && mb.right <= innerWidth + 0.5 && mb.top >= 0 && mb.bottom <= innerHeight + 0.5 } : null,
      innerWidth, innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      holo: (() => { const c = document.querySelector('[data-variant]'); if (!c) return null; const b = c.getBoundingClientRect(); return { x: b.left, w: b.width, overlapsRail: r.width < r.height ? b.left < r.right - 0.5 : false }; })(),
    };
  })()`);

const click = (page, selector) =>
  page.evaluate(
    `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; el.click(); return true; })()`,
  );
const pressEscape = (page) =>
  page.send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'Escape',
    code: 'Escape',
    windowsVirtualKeyCode: 27,
  });

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
      const bar = m.items.filter((item) => !item.inMenu && item.visible);
      checks.railIsBottomBar =
        Math.abs(m.rail.y + m.rail.h - m.innerHeight) < 1 && m.rail.w >= m.innerWidth - 1;
      checks.barHeight64 = Math.abs(m.rail.h - 64) < 0.5;
      // Visible wording on every bar item, not icons only; and a labelled More among them.
      checks.barItemsLabelled = bar.length >= 4 && bar.every((item) => item.labelVisible);
      checks.moreIsLabelled = bar.some((item) => item.label === 'More' && item.labelVisible);
      checks.noHorizontalOverflow = m.scrollWidth <= m.innerWidth;
      checks.touchTargets44 = bar.every((item) => item.w >= 44 && item.h >= 44);
      // Open More: the remaining areas appear as labelled links, inside the viewport, and every
      // current destination is reachable from the bar or the list.
      await click(page, '[data-testid="rail-more"]');
      await sleep(250);
      const opened = await measure(page);
      const menuItems = opened.items.filter((item) => item.inMenu && item.visible);
      const reachable = new Set([
        ...opened.items.filter((item) => item.visible && item.href).map((item) => item.href),
      ]);
      checks.moreOpensLabelledList =
        menuItems.length >= 3 && menuItems.every((item) => item.labelVisible && item.h >= 44);
      checks.menuWithinViewport = opened.menu?.withinViewport === true;
      checks.everyAreaReachable = DESTINATIONS.every((to) => reachable.has(to));
      checks.noOverflowWithMenuOpen = opened.scrollWidth <= opened.innerWidth;
      await screenshot(page, resolve(OUT, `rail-${width}-more.png`), null, false);
      await pressEscape(page);
      await sleep(200);
      const closed = await measure(page);
      checks.escapeClosesMore = closed.menu === null;
      m.opened = { menuItems: menuItems.map((item) => item.label), reachable: [...reachable] };
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
