// Keyboard review (A11Y-001, A11Y-002): tabs through a page and records what receives focus and
// whether the focus ring is visible. Usage:
//   BASE=http://localhost:4173 PAGES=campaign,skills TABS=14 node scripts/review/keyboard-probe.mjs
import { openPage, session, setViewport, sleep } from './cdp.mjs';

const BASE = process.env.BASE ?? 'http://localhost:4173';
// Paths may be given without a leading slash (Git Bash rewrites '/x' into a Windows path).
const PAGES = (process.env.PAGES ?? '/,/campaign,/skills,/skills/SK-STRATEGIZE-funnel-math')
  .split(',')
  .map((path) => (path.startsWith('/') ? path : `/${path}`));
const TABS = Number(process.env.TABS ?? 14);

const FOCUSED = `(() => {
  const a = document.activeElement;
  if (!a || a === document.body) return { tag: 'BODY' };
  const cs = getComputedStyle(a);
  const rect = a.getBoundingClientRect();
  const dialog = a.closest('dialog');
  return {
    tag: a.tagName,
    role: a.getAttribute('role') || (a.tagName === 'A' ? 'link' : a.tagName === 'BUTTON' ? 'button' : a.type || ''),
    text: (a.getAttribute('aria-label') || a.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 44),
    visible: a.matches(':focus-visible'),
    ring: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2,
    size: [Math.round(rect.width), Math.round(rect.height)],
    inDialog: Boolean(dialog && dialog.open),
  };
})()`;

const key = (page, type, text) =>
  page.send('Input.dispatchKeyEvent', {
    type,
    key: text,
    code: text,
    windowsVirtualKeyCode: text === 'Tab' ? 9 : text === 'Escape' ? 27 : text === 'Enter' ? 13 : 0,
  });

const { page, close } = await session();
const report = {};
try {
  await setViewport(page, 1280, 900, { mobile: false });
  await page.send('Emulation.setFocusEmulationEnabled', { enabled: true });
  for (const path of PAGES) {
    await openPage(page, `${BASE}${path}`);
    await sleep(1200);
    const stops = [];
    for (let i = 0; i < TABS; i += 1) {
      await key(page, 'rawKeyDown', 'Tab');
      await key(page, 'keyUp', 'Tab');
      await sleep(40);
      stops.push(await page.evaluate(FOCUSED));
    }
    const entry = { stops };
    if (path.startsWith('/skills/SK-')) {
      // Escape must close the sheet and hand focus back to the page.
      await key(page, 'rawKeyDown', 'Escape');
      await key(page, 'keyUp', 'Escape');
      await sleep(400);
      entry.afterEscape = {
        dialogOpen: await page.evaluate("Boolean(document.querySelector('dialog[open]'))"),
        focus: await page.evaluate(FOCUSED),
        url: await page.evaluate('location.pathname + location.search'),
      };
    }
    report[path] = entry;
  }
} finally {
  await close();
}
for (const [path, entry] of Object.entries(report)) {
  console.log(`\n${path}`);
  entry.stops.forEach((s, i) =>
    console.log(
      `  ${String(i + 1).padStart(2)} ${s.tag.padEnd(6)} ${String(s.role).padEnd(8)} ${s.visible ? 'visible' : 'NO-RING'} ${s.ring ? 'ring' : 'no-outline'} ${s.size ? s.size.join('x') : ''} ${s.inDialog ? '[dialog]' : ''} ${s.text ?? ''}`,
    ),
  );
  if (entry.afterEscape) console.log('  after Escape:', JSON.stringify(entry.afterEscape));
}
