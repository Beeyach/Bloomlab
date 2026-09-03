// Touch review (A11Y-003, RSP-004): a phone-sized, touch-emulated Skill Map. Taps a territory,
// then a capability, and reports target sizes, the selected state and the bottom sheet.
//   BASE=http://localhost:4173 node scripts/review/touch-probe.mjs
import { openPage, session, setViewport, sleep } from './cdp.mjs';

const BASE = process.env.BASE ?? 'http://localhost:4173';

const tap = async (page, x, y) => {
  await page.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
};

const center = async (page, selector) => {
  const rect = await page.evaluate(
    `(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height }; })()`,
  );
  return rect;
};

const waitFor = async (page, expression, tries = 60) => {
  for (let i = 0; i < tries; i += 1) {
    if (await page.evaluate(`Boolean(${expression})`)) return true;
    await sleep(250);
  }
  return false;
};

const { page, close } = await session();
const report = { base: BASE };
try {
  await setViewport(page, 390, 844, { mobile: true });
  await page.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
  await openPage(page, `${BASE}/skills`);
  await waitFor(page, "document.querySelector('[data-territory=BUILD]')");
  await sleep(300);

  report.coarse = await page.evaluate("matchMedia('(pointer: coarse)').matches");
  report.rail = await page.evaluate(
    "(() => { const r = document.querySelector('nav[aria-label=Primary]').getBoundingClientRect(); return { top: Math.round(r.top), height: Math.round(r.height), bottomFixed: Math.round(r.bottom) === innerHeight }; })()",
  );
  report.railTargets = await page.evaluate(
    "[...document.querySelectorAll('nav[aria-label=Primary] a')].map((a) => { const r = a.getBoundingClientRect(); return `${a.textContent.trim()} ${Math.round(r.width)}x${Math.round(r.height)}`; })",
  );
  report.territoryOrder = await page.evaluate(
    "[...document.querySelectorAll('[data-territory]')].map((b) => b.dataset.territory + ':' + Math.round(b.getBoundingClientRect().top))",
  );

  // Tap the BUILD territory.
  await page.evaluate(
    "document.querySelector('[data-territory=BUILD]').scrollIntoView({ block: 'center' })",
  );
  await sleep(200);
  const build = await center(page, '[data-territory=BUILD]');
  report.territoryTarget = { w: Math.round(build.w), h: Math.round(build.h) };
  await tap(page, build.x, build.y);
  await sleep(400);
  report.afterTerritoryTap = await page.evaluate(
    "({ pressed: document.querySelector('[data-territory=BUILD]').getAttribute('aria-pressed'), search: location.search, panelTitle: document.querySelector('#territory-title')?.textContent, count: document.querySelector('[data-testid=territory-panel]')?.textContent.match(/\\d+ of \\d+ capabilities demonstrated/)?.[0] })",
  );

  // Tap the first capability card.
  await waitFor(page, "document.querySelector('[data-skill]')");
  await page.evaluate("document.querySelector('[data-skill]').scrollIntoView({ block: 'center' })");
  await sleep(200);
  const card = await center(page, '[data-skill]');
  report.cardTarget = { w: Math.round(card.w), h: Math.round(card.h) };
  await tap(page, card.x, card.y);
  await waitFor(page, "document.querySelector('dialog[open]')");
  await page.evaluate(
    'Promise.all(document.getAnimations().map((a) => a.finished.catch(() => null)))',
  );
  report.sheet = await page.evaluate(
    "(() => { const d = document.querySelector('dialog[open]'); if (!d) return null; const r = d.getBoundingClientRect(); return { path: location.pathname, side: d.className.includes('bottom') ? 'bottom' : 'end', top: Math.round(r.top), bottom: Math.round(r.bottom), width: Math.round(r.width), viewport: [innerWidth, innerHeight], title: d.querySelector('h2')?.textContent, focusInside: d.contains(document.activeElement), buttons: [...d.querySelectorAll('button')].map((b) => { const br = b.getBoundingClientRect(); return `${(b.getAttribute('aria-label') || b.textContent).trim()} ${Math.round(br.width)}x${Math.round(br.height)}`; }) }; })()",
  );

  // Tap the sheet's Close button.
  const closeButton = await page.evaluate(
    "(() => { const b = [...document.querySelectorAll('dialog[open] button')].find((x) => x.textContent.trim() === 'Close'); const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()",
  );
  await tap(page, closeButton.x, closeButton.y);
  await sleep(400);
  report.afterClose = await page.evaluate(
    "({ dialogOpen: Boolean(document.querySelector('dialog[open]')), path: location.pathname, search: location.search })",
  );
  report.hOverflow = await page.evaluate('document.documentElement.scrollWidth > innerWidth');
} finally {
  await close();
}
console.log(JSON.stringify(report, null, 2));
