// Full-page captures + layout audits of every gallery section and screen at the five review widths
// (spec §82, §135). Writes PNGs and audit.json to .review/ (override with REVIEW_OUT).
//   BASE=http://localhost:4173 WIDTHS=320,390 node scripts/review/capture.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { session, openPage, setViewport, screenshot, sleep } from './cdp.mjs';

const OUT = resolve(process.env.REVIEW_OUT ?? '.review');
const BASE = process.env.BASE ?? 'http://localhost:4173';
const SLICE = 1800;
const MAX_FULL = 16000;

const AUDIT = `(() => {
  const W = innerWidth;
  const els = [...document.querySelectorAll('body *')];
  const nm = (e) => e.tagName + '.' + String(e.className).split(' ')[0];
  const off = els
    .filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > W + 1 || r.left < -1) && !/layer/.test(String(e.className)); })
    .slice(0, 5).map((e) => nm(e) + '@' + Math.round(e.getBoundingClientRect().right));
  const clipped = els
    .filter((e) => { const cs = getComputedStyle(e); return (cs.overflowX === 'hidden' || cs.overflowX === 'clip') && e.scrollWidth > e.clientWidth + 2 && cs.textOverflow !== 'ellipsis' && !/holo|layer/.test(String(e.className)); })
    .slice(0, 5).map((e) => nm(e) + ' ' + e.scrollWidth + '>' + e.clientWidth);
  const ctl = [...document.querySelectorAll('button,input,select,textarea,[role=button]')];
  const small = ctl
    .filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.height < 44 || r.width < 44); })
    .map((e) => nm(e) + ' ' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height)).slice(0, 8);
  const inputs = [...document.querySelectorAll('input,select,textarea')].map((e) => parseFloat(getComputedStyle(e).fontSize)).filter((s) => s < 16);
  const tiny = [...document.querySelectorAll('p,span,li,td,th,label,a,button')]
    .filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && parseFloat(getComputedStyle(e).fontSize) < 12).length;
  return { hOverflow: document.documentElement.scrollWidth > W, offscreen: off, clipped, controls: ctl.length, smallControls: small, inputsUnder16: inputs, textUnder12px: tiny, coarse: matchMedia('(pointer: coarse)').matches, reduced: matchMedia('(prefers-reduced-motion: reduce)').matches };
})()`;

const sections = [
  'palette',
  'type',
  'surfaces',
  'buttons',
  'forms',
  'holo',
  'motion',
  'panels',
  'semantic',
];
const defaultPages = [
  ...sections.map((s) => [s, `/design?section=${s}`]),
  ['home', '/'],
  ['campaign', '/campaign'],
  ['skills', '/skills'],
  ['skill-detail', '/skills/SK-STRATEGIZE-funnel-math'],
  ['academy', '/academy/LU-funnel-math-basics?skill=SK-STRATEGIZE-funnel-math'],
  ['academy-workflow', '/academy/LU-workflow-foundations'],
  ['academy-tags', '/academy/LU-tags-vs-custom-fields'],
  [
    'exercise',
    '/exercise/EX-ARCHITECTURE_DECISION-treatment-interest?skill=SK-ARCHITECT-tags-vs-custom-fields',
  ],
  ['exercise-build', '/exercise/EX-BUILD_IT-no-show-recovery'],
  ['exercise-pressure', '/exercise/EX-REBUILD_BLIND-appointment-reminders'],
  ['exercise-fixit', '/exercise/EX-FIX_IT-double-reminder'],
  ['sync', '/sync'],
  ['system', '/system'],
  ['simulator', '/system/simulator?scenario=SC-glowhaus-no-show'],
  ['notfound', '/nope'],
];
const pages = process.env.PAGES
  ? defaultPages.filter(([n]) => process.env.PAGES.split(',').includes(n))
  : defaultPages;
const widths = (process.env.WIDTHS ?? '320,390,768,1024,1440').split(',').map(Number);

mkdirSync(OUT, { recursive: true });
const { page, close } = await session();
const results = [];
try {
  for (const w of widths) {
    for (const [name, path] of pages) {
      await setViewport(page, w, 900);
      await openPage(page, `${BASE}${path}`);
      // Lazy screen bodies (an Academy unit's chunk) must be in before measuring, especially on a
      // remote host: wait until no route or unit is still announcing that it is loading.
      for (let i = 0; i < 60; i += 1) {
        const loading = await page.evaluate(
          "[...document.querySelectorAll('[role=status]')].some((el) => /Opening the unit|Loading/.test(el.textContent))",
        );
        if (!loading) break;
        await sleep(150);
      }
      // Let entrance animations (e.g. a sheet sliding in) finish before measuring positions.
      await page.evaluate(
        'Promise.all(document.getAnimations().map((a) => a.finished.catch(() => null)))',
      );
      const audit = await page.evaluate(AUDIT);
      const height = await page.evaluate('document.documentElement.scrollHeight');
      await page.send('Emulation.setDeviceMetricsOverride', {
        width: w,
        height: Math.min(height, MAX_FULL),
        deviceScaleFactor: 1,
        mobile: w < 768,
      });
      await sleep(250);
      await screenshot(page, `${OUT}/${name}-${w}.png`);
      let parts = 0;
      if (height > SLICE) {
        for (let y = 0; y < height; y += SLICE) {
          parts += 1;
          await screenshot(page, `${OUT}/${name}-${w}-part${parts}.png`, {
            x: 0,
            y,
            width: w,
            height: Math.min(SLICE, height - y),
          });
        }
      }
      results.push({ width: w, page: name, height, parts, ...audit });
      console.log(JSON.stringify(results.at(-1)));
    }
  }
} finally {
  writeFileSync(`${OUT}/audit.json`, JSON.stringify(results, null, 2));
  await close();
}
