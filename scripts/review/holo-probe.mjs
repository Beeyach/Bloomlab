// Measures HoloMaterial physics (HOL-001…004, MOT-003) with real DevTools input and a live frame loop:
// mouse follow + settle timing, per-layer response, reduced-motion emulation, touch press/drag/release.
// Writes holo-probe.json and holo-*.png to .review/ (override with REVIEW_OUT).
//   BASE=https://bloomlab-preview.example.workers.dev node scripts/review/holo-probe.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { session, openPage, setViewport, screenshot, sleep } from './cdp.mjs';

const OUT = resolve(process.env.REVIEW_OUT ?? '.review');
const BASE = process.env.BASE ?? 'http://localhost:4173';
const CARD = "document.querySelectorAll('[data-variant]')[1]"; // the gallery's collectible card

const rectOf = (page) =>
  page.evaluate(
    `(() => { const r = ${CARD}.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; })()`,
  );

const startSampler = (page) =>
  page.evaluate(`(() => {
    const c = ${CARD};
    window.__s = []; window.__t0 = performance.now(); clearInterval(window.__iv);
    window.__iv = setInterval(() => {
      const m = new DOMMatrix(getComputedStyle(c).transform);
      window.__s.push({ t: Math.round(performance.now() - window.__t0), nx: +c.style.getPropertyValue('--holo-nx') || 0,
        lift: +c.style.getPropertyValue('--holo-lift') || 0, rotY: +(Math.asin(Math.max(-1, Math.min(1, m.m13))) * 180 / Math.PI).toFixed(2),
        tracking: c.dataset.tracking || '' });
    }, 20);
    return 'sampling';
  })()`);
const stopSampler = (page) =>
  page.evaluate('(() => { clearInterval(window.__iv); return window.__s; })()');

const layers = (page) =>
  page.evaluate(`(() => {
    const c = ${CARD}; const cs = (sel) => getComputedStyle(c.querySelector(sel));
    const m = new DOMMatrix(getComputedStyle(c).transform);
    return { nx: c.style.getPropertyValue('--holo-nx'), ny: c.style.getPropertyValue('--holo-ny'), lift: c.style.getPropertyValue('--holo-lift'),
      angle: c.style.getPropertyValue('--holo-angle'), rotX: +(Math.asin(Math.max(-1, Math.min(1, -m.m23))) * 180 / Math.PI).toFixed(2),
      rotY: +(Math.asin(Math.max(-1, Math.min(1, m.m13))) * 180 / Math.PI).toFixed(2), translateY: +m.m42.toFixed(2),
      bandsPos: cs('[class*=bands]').backgroundPosition, bandsFilter: cs('[class*=bands]').filter,
      glareTransform: cs('[class*=glare]').transform, glareOpacity: cs('[class*=glare]').opacity,
      rimOpacity: cs('[class*=rim]').opacity, rimFrom: cs('[class*=rim]').backgroundImage.slice(0, 40),
      grainTransform: cs('[class*=grain]').transform, shadow: getComputedStyle(c).boxShadow,
      tracking: c.dataset.tracking || '' };
  })()`);

function timeTo(samples, key, fraction, from, to) {
  const goal = from + (to - from) * fraction;
  const hit = samples.find((s) => (to > from ? s[key] >= goal : s[key] <= goal));
  return hit ? hit.t : null;
}

const mouse = (page, x, y) => page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });

mkdirSync(OUT, { recursive: true });
const { page, close } = await session();
const report = { base: BASE };
try {
  // ---------- desktop mouse ----------
  await setViewport(page, 1280, 900, { mobile: false });
  await openPage(page, `${BASE}/design?section=holo`);
  report.build = await page.evaluate(
    "[...document.styleSheets].map(s => (s.href || '').split('/').pop()).filter(Boolean)",
  );
  let r = await rectOf(page);
  const outside = { x: r.x - 60, y: r.y + r.h / 2 };
  const corner = { x: r.x + r.w * 0.92, y: r.y + r.h * 0.09 };
  await mouse(page, outside.x, outside.y);
  await sleep(100);
  report.rest = await layers(page);
  await screenshot(page, `${OUT}/holo-rest.png`, { x: 0, y: 0, width: 1280, height: 900 });
  await startSampler(page);
  await mouse(page, corner.x, corner.y);
  await sleep(600);
  const follow = await stopSampler(page);
  report.peak = await layers(page);
  await screenshot(page, `${OUT}/holo-peak.png`, { x: 0, y: 0, width: 1280, height: 900 });
  const targetNx = +report.peak.nx || 0.84;
  report.follow = {
    samples: follow.length,
    t63: timeTo(follow, 'nx', 0.63, 0, targetNx),
    t95: timeTo(follow, 'nx', 0.95, 0, targetNx),
    final: follow.at(-1),
  };
  await startSampler(page);
  await mouse(page, outside.x, outside.y);
  await sleep(1000);
  const settle = await stopSampler(page);
  const startNx = settle[0]?.nx ?? targetNx;
  report.settle = {
    samples: settle.length,
    t95: timeTo(settle, 'nx', 0.95, startNx, 0),
    trackingClearedAt: settle.find((s) => s.tracking === '')?.t ?? null,
    final: settle.at(-1),
  };
  await mouse(page, r.x + r.w * 0.15, r.y + r.h * 0.8);
  await sleep(400);
  report.bottomLeft = await layers(page);
  await mouse(page, outside.x, outside.y);
  await sleep(800);

  // ---------- reduced motion ----------
  await page.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  });
  await openPage(page, `${BASE}/design?section=holo`);
  r = await rectOf(page);
  await mouse(page, r.x - 60, r.y + r.h / 2);
  await sleep(100);
  await mouse(page, r.x + r.w * 0.92, r.y + r.h * 0.09);
  await sleep(400);
  report.reducedMotion = {
    tokens: await page.evaluate(
      "(() => { const s = getComputedStyle(document.documentElement); return { tilt: s.getPropertyValue('--bl-holo-tilt-max').trim(), track: s.getPropertyValue('--bl-holo-track').trim(), settle: s.getPropertyValue('--bl-motion-settle').trim() }; })()",
    ),
    hovered: await layers(page),
    bandsOpacity: await page.evaluate(
      `getComputedStyle(${CARD}.querySelector('[class*=bands]')).opacity`,
    ),
  };
  await screenshot(page, `${OUT}/holo-reduced-motion-hover.png`, {
    x: 0,
    y: 0,
    width: 1280,
    height: 900,
  });
  await page.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }],
  });

  // ---------- touch at 390 (mobile, coarse pointer) ----------
  await setViewport(page, 390, 900, { mobile: true });
  await openPage(page, `${BASE}/design?section=holo`);
  await page.evaluate(
    "window.__types = []; for (const t of ['pointerdown','pointermove','pointerup','pointercancel']) document.addEventListener(t, (e) => { if (window.__types.length < 20) window.__types.push(t + ':' + e.pointerType); }, true); 'ok'",
  );
  r = await rectOf(page);
  report.touch = {
    coarse: await page.evaluate("matchMedia('(pointer: coarse)').matches"),
    touchAction: await page.evaluate(`getComputedStyle(${CARD}).touchAction`),
  };
  const p1 = { x: r.x + r.w * 0.2, y: r.y + r.h * 0.3 };
  const p2 = { x: r.x + r.w * 0.85, y: r.y + r.h * 0.8 };
  await page.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [p1] });
  await sleep(350);
  report.touch.pressed = await layers(page);
  await page.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [p2] });
  await sleep(350);
  report.touch.dragged = await layers(page);
  await screenshot(page, `${OUT}/holo-touch-drag-390.png`, { x: 0, y: 0, width: 390, height: 900 });
  await startSampler(page);
  await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(1000);
  const touchSettle = await stopSampler(page);
  report.touch.released = await layers(page);
  report.touch.settleTrackingClearedAt = touchSettle.find((s) => s.tracking === '')?.t ?? null;
  report.touch.events = await page.evaluate('window.__types');
  await page.evaluate(
    `${CARD}.dispatchEvent(new PointerEvent('pointermove', { pointerType: 'touch', buttons: 0, clientX: ${p2.x}, clientY: ${p2.y}, bubbles: true }))`,
  );
  await sleep(200);
  report.touch.unpressedMove = await page.evaluate(
    `({ tracking: ${CARD}.dataset.tracking || '', nx: ${CARD}.style.getPropertyValue('--holo-nx') })`,
  );
} finally {
  writeFileSync(`${OUT}/holo-probe.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await close();
}
