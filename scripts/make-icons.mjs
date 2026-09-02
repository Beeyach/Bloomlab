// Renders the PWA icons from the favicon's geometry with headless Chrome (DATA-003).
//   node scripts/make-icons.mjs   → public/icons/*.png
import { mkdirSync } from 'node:fs';

import { screenshot, session, sleep } from './review/cdp.mjs';

const OUT = 'public/icons';
const GRADIENT = `<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6EC8FF"/><stop offset="0.5" stop-color="#A99BFF"/><stop offset="1" stop-color="#FF82C8"/></linearGradient>`;
const MARK = `<circle cx="32" cy="32" r="13" fill="#F8FAFF"/><circle cx="32" cy="32" r="6" fill="#18152B"/>`;

// Rounded tile for regular icons; full-bleed tile for the maskable one (the mark sits well
// inside the 80 % safe zone).
const svg = (radius) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs>${GRADIENT}</defs><rect width="64" height="64" rx="${radius}" fill="url(#g)"/>${MARK}</svg>`;

const icons = [
  ['icon-192', 192, svg(16)],
  ['icon-512', 512, svg(16)],
  ['icon-maskable-512', 512, svg(0)],
  ['apple-touch-icon', 180, svg(0)],
];

mkdirSync(OUT, { recursive: true });
const { page, close } = await session();
try {
  await page.send('Emulation.setDefaultBackgroundColorOverride', {
    color: { r: 0, g: 0, b: 0, a: 0 },
  });
  for (const [name, size, markup] of icons) {
    const html = `<!doctype html><html><body style="margin:0;background:transparent">${markup.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`;
    await page.send('Emulation.setDeviceMetricsOverride', {
      width: size,
      height: size,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await page.send('Page.navigate', {
      url: `data:text/html;charset=utf-8,${encodeURIComponent(html)}`,
    });
    await sleep(250);
    await screenshot(page, `${OUT}/${name}.png`, { x: 0, y: 0, width: size, height: size });
    console.log(`${name}.png ${size}x${size}`);
  }
} finally {
  await close();
}
