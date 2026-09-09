// Measures the primary rail (DES-009, D-117, RSP-004): the column is exactly --bl-size-rail wide
// on tablet and desktop and the page starts beside it, never under it; on phones it is a bottom
// bar every area still fits in, with no horizontal overflow. Writes rail-probe.json and rail-*.png
// to .review/ (override with REVIEW_OUT).
// Also checks 480px-high viewports in both motion modes: wheel/touch isolation, every link's
// keyboard focus ring, and bottom actions. REVIEW_SCROLLBARS=1 includes real scrollbar gutters;
// REVIEW_HEAD=<source SHA> pins both Preview health and browser build identity.
//   BASE=http://localhost:4173 node scripts/review/rail-probe.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { openPage, screenshot, session, setViewport, sleep } from './cdp.mjs';
import { probeHelpers } from './probe-lib.mjs';

const OUT = resolve(process.env.REVIEW_OUT ?? '.review');
const BASE = process.env.BASE ?? 'http://localhost:4173';
const { waitFor } = probeHelpers({ base: BASE });
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
  '/funnel',
  '/calendar',
  '/conversations',
  '/reporting',
  '/payments',
  '/incident',
  '/clients',
  '/portfolio',
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

const key = async (page, key, modifiers = 0) => {
  const code = { Tab: 9, Enter: 13 }[key];
  for (const type of ['rawKeyDown', 'keyUp'])
    await page.send('Input.dispatchKeyEvent', {
      type,
      key,
      code: key,
      windowsVirtualKeyCode: code,
      modifiers,
    });
};

// Native scrolling and actual Tab traversal: DOM dimensions alone missed this regression.
async function overflowCase(page, width, reducedMotion) {
  await setViewport(page, width, 480, { mobile: width < 768 });
  await page.send('Emulation.setEmulatedMedia', {
    features: [
      { name: 'prefers-reduced-motion', value: reducedMotion ? 'reduce' : 'no-preference' },
    ],
  });
  await openPage(page, `${BASE}${PAGE}`);
  const phone = width < 768;
  if (phone) await click(page, '[data-testid="rail-more"]');
  const selector = phone ? '[data-testid="rail-more-menu"]' : 'nav[aria-label="Primary"]';
  await page.evaluate(
    `void (window.__railScroller = document.querySelector(${JSON.stringify(selector)}))`,
  );
  const state = () =>
    page.evaluate(`(() => {
    const el = window.__railScroller, r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    return { top: el.scrollTop, height: el.clientHeight, content: el.scrollHeight,
      width: el.clientWidth, contentWidth: el.scrollWidth, page: scrollY,
      x: r.left + r.width / 2, y: r.top + r.height / 2,
      withinViewport: r.top >= 0 && r.bottom <= innerHeight,
      overflow: cs.overflowY, behavior: cs.scrollBehavior,
      pageOverflow: document.documentElement.scrollWidth > innerWidth };
  })()`);
  const wheel = async (x, y, deltaY) => {
    await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
    await page.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x, y, deltaX: 0, deltaY });
    await sleep(250);
  };
  const initial = await state();
  await wheel(initial.x, initial.y, 240);
  const scrolled = await state();
  const checks = {
    deliberateOverflow: initial.content > initial.height,
    viewportBounded: initial.withinViewport,
    wheelScrollsRailOnly: scrolled.top > initial.top && scrolled.page === initial.page,
    noHorizontalOverflow: !initial.pageOverflow && initial.contentWidth <= initial.width,
    nativeMotion: initial.behavior === 'auto',
  };
  // Reach each boundary, then keep scrolling there: the page must not inherit that gesture.
  await page.evaluate('window.__railScroller.scrollTop = window.__railScroller.scrollHeight');
  await wheel(initial.x, initial.y, 300);
  checks.bottomDoesNotChain = (await state()).page === initial.page;
  await page.evaluate('window.__railScroller.scrollTop = 0');
  await wheel(phone ? 4 : width - 40, 100, 240);
  const pageScrolled = await state();
  checks.pageScrollsIndependently = pageScrolled.page > initial.page && pageScrolled.top === 0;
  await wheel(initial.x, initial.y, -300);
  checks.topDoesNotChain = (await state()).page === pageScrolled.page;
  await page.evaluate('scrollTo(0, 0)');

  // Every real link, including flag-gated bottom actions, must scroll into view with its ring.
  const count = await page.evaluate(`(() => {
    const links = [...window.__railScroller.querySelectorAll('a')].filter(a => a.getClientRects().length);
    links[0].focus(); return links.length;
  })()`);
  const focused = () =>
    page.evaluate(`(() => {
    const el = document.activeElement, s = window.__railScroller;
    const r = el.getBoundingClientRect(), b = s.getBoundingClientRect(), cs = getComputedStyle(el);
    const ring = parseFloat(cs.outlineWidth) + parseFloat(cs.outlineOffset);
    const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return { href: el.getAttribute('href'), label: el.textContent.trim(),
      inside: s.contains(el), visibleFocus: el.matches(':focus-visible') && cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2,
      ringUnclipped: r.top - ring >= b.top && r.bottom + ring <= b.bottom && r.left - ring >= b.left && r.right + ring <= b.left + s.clientWidth,
      hit: el === hit || el.contains(hit), target: r.width >= 44 && r.height >= 44,
      labelFits: el.scrollWidth <= el.clientWidth,
      x: r.x + r.width / 2, y: r.y + r.height / 2 };
  })()`);
  // Enter keyboard modality and return to the first link without replacing browser traversal.
  await key(page, 'Tab');
  await key(page, 'Tab', 8);
  const forward = [];
  for (let i = 0; i < count; i++) {
    if (i) await key(page, 'Tab');
    forward.push(await focused());
  }
  checks.everyLinkReachable =
    forward.length >= (phone ? 9 : DESTINATIONS.length) &&
    forward.every(
      (s) => s.inside && s.visibleFocus && s.ringUnclipped && s.hit && s.target && s.labelFits,
    );
  await screenshot(
    page,
    resolve(OUT, `rail-short-${width}-${reducedMotion ? 'reduced' : 'normal'}-bottom.png`),
    null,
    false,
  );
  const backward = [];
  for (let i = 1; i < count; i++) {
    await key(page, 'Tab', 8);
    backward.push(await focused());
  }
  checks.reverseKeyboardReachable = backward.every(
    (s) => s.inside && s.visibleFocus && s.ringUnclipped && s.hit,
  );
  const first = await focused();
  await key(page, 'Enter');
  // URL history can change before React commits a lazy route. Reopening More during that
  // transition binds it to the previous pathname and the committed navigation closes it.
  // Wait for the actual active navigation, not a network-speed-dependent fixed pause.
  checks.keyboardActivates = await waitFor(
    page,
    `location.pathname === ${JSON.stringify(first.href)} && [...document.querySelectorAll('nav[aria-label="Primary"] a')].some(a => a.getAttribute('href') === ${JSON.stringify(first.href)} && a.getAttribute('aria-current') === 'page') && !!document.querySelector('main h1')`,
  );
  if (phone) {
    await click(page, '[data-testid="rail-more"]');
    if (
      !(await waitFor(
        page,
        `!document.querySelector('[data-testid="rail-more-menu"]').hidden && document.querySelector('[data-testid="rail-more-menu"]').clientHeight > 0`,
      ))
    )
      throw new Error('More did not become visible after committed keyboard navigation');
    await page.evaluate(
      `void (window.__railScroller = document.querySelector('[data-testid="rail-more-menu"]'))`,
    );
  }
  await page.evaluate('scrollTo(0, 0)');

  await page.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await page.evaluate('window.__railScroller.scrollTop = 0');
  await sleep(100);
  const touchOrigin = await state();
  await page.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: touchOrigin.x, y: touchOrigin.y + 80 }],
  });
  for (let step = 1; step <= 10; step++) {
    await page.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: touchOrigin.x, y: touchOrigin.y + 80 - step * 20 }],
    });
    await sleep(30);
  }
  await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(250);
  const touched = await state();
  checks.touchScrollsRailOnly = touched.top > 0 && touched.page === 0;
  // Activate the last destination with a real tap after scrolling the rail by touch.
  await page.evaluate(`(() => {
    const links = [...window.__railScroller.querySelectorAll('a')].filter(a => a.getClientRects().length);
    links[links.length - 1].focus();
  })()`);
  const last = await focused();
  await page.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: last.x, y: last.y }],
  });
  await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(300);
  checks.bottomActionTap = await page.evaluate(
    `location.pathname === ${JSON.stringify(last.href)}`,
  );
  checks.phoneMenuDismisses = !phone || (await measure(page)).menu === null;
  return {
    initial,
    scrolled,
    pageScrolled,
    touched,
    forward,
    backward,
    checks,
    passed: Object.values(checks).every(Boolean),
  };
}

const { page, close } = await session();
const report = {
  base: BASE,
  page: PAGE,
  head: process.env.REVIEW_HEAD ?? 'working-tree',
  scrollbars: process.env.REVIEW_SCROLLBARS === '1' ? 'visible' : 'hidden',
  widths: {},
  short: {},
};
let failures = 0;
try {
  if (process.env.REVIEW_HEAD) {
    report.health = await (await fetch(`${BASE}/api/health`)).json();
    if (report.health.build_id !== process.env.REVIEW_HEAD)
      throw new Error('Preview health head mismatch');
  }
  for (const width of WIDTHS) {
    const height = width < 768 ? 844 : 900;
    await setViewport(page, width, height, { mobile: width < 768 });
    await openPage(page, `${BASE}${PAGE}`);
    if (
      process.env.REVIEW_HEAD &&
      (await page.evaluate("document.querySelector('[data-build-id]')?.dataset.buildId")) !==
        process.env.REVIEW_HEAD
    )
      throw new Error('Browser build head mismatch');
    await sleep(600);
    const m = await measure(page);
    const checks = {};
    if (m.missing) {
      checks.rendered = false;
    } else if (width >= 768) {
      const expected = Number.parseFloat(m.token);
      // D-117: the user-directed band is 96–112 px (104 today); the design-rule test pins the same.
      checks.tokenInBand = expected >= 96 && expected <= 112;
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
  for (const width of WIDTHS) {
    for (const reduced of [false, true]) {
      const name = `${width}x480-${reduced ? 'reduced' : 'normal'}`;
      const row = await overflowCase(page, width, reduced);
      report.short[name] = row;
      if (!row.passed) failures++;
      console.log(`${name} ${row.passed ? 'PASS' : 'FAIL'} ${JSON.stringify(row.checks)}`);
    }
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
