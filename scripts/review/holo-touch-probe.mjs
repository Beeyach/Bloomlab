// Tablet holo interaction review (D-075). The user reproduced a sharp rectangular shape when
// tapping a rounded holographic card on a real tablet, so this probe drives REAL touch events at
// tablet widths and samples the interactive stack *while the finger is down* — not before and
// after. For every stage it records the properties that can paint a rectangle outside the rounded
// card, and hit-tests the four corner regions the rounded shape is supposed to exclude.
//
//   BASE=http://localhost:4173 node scripts/review/holo-touch-probe.mjs
import { mkdirSync } from 'node:fs';

import { openPage, screenshot, session, setViewport, sleep } from './cdp.mjs';
import { decodePng } from './png.mjs';

/** Size of the square sampled at each corner of a card, in CSS pixels. */
const CORNER = 14;
/**
 * How far a corner may sit from its local backdrop before it counts as a rectangular flash.
 * The card's own drop shadow (16 % ink, 30 px blur) lands well inside this; a tap highlight, an
 * active background or a ring that ignores the radius lands far outside it.
 */
const CORNER_TOLERANCE = 40;

const BASE = process.env.BASE ?? 'http://localhost:4173';
const OUT = process.env.REVIEW_OUT ?? '.review';
const WIDTHS = (process.env.WIDTHS ?? '1024,768').split(',').map(Number);

mkdirSync(OUT, { recursive: true });

/** Everything about an element that could paint a rectangle over a rounded card. */
const PROBE = (selector) => `(() => {
  const el = document.querySelector(${JSON.stringify(selector)});
  if (!el) return null;
  const s = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  const material = el.querySelector('[data-variant]');
  const ms = material ? getComputedStyle(material) : null;
  // The corner regions a rounded rectangle excludes: 3px inside the box corner, which for a
  // >=12px radius is outside the arc. If the interactive shape is rectangular, the button or its
  // material is the topmost element there; when the shape is really rounded, it is not.
  const radius = parseFloat(s.borderTopLeftRadius) || 0;
  const inset = 3;
  const corners = {
    tl: [r.left + inset, r.top + inset],
    tr: [r.right - inset, r.top + inset],
    bl: [r.left + inset, r.bottom - inset],
    br: [r.right - inset, r.bottom - inset],
  };
  const owns = {};
  for (const [name, [x, y]] of Object.entries(corners)) {
    const hit = document.elementFromPoint(x, y);
    owns[name] = hit ? (el === hit || el.contains(hit)) : false;
  }
  return {
    rect: { w: Math.round(r.width), h: Math.round(r.height) },
    radius: s.borderRadius,
    radiusPx: radius,
    appearance: s.appearance + '/' + (s.webkitAppearance ?? '-'),
    tapHighlight: s.webkitTapHighlightColor ?? '-',
    background: s.backgroundColor,
    backgroundImage: s.backgroundImage,
    border: s.borderTopWidth + ' ' + s.borderTopStyle + ' ' + s.borderTopColor,
    outline: s.outlineStyle === 'none'
      ? 'none'
      : s.outlineWidth + ' ' + s.outlineStyle + ' ' + s.outlineColor + ' offset ' + s.outlineOffset,
    boxShadow: s.boxShadow,
    overflow: s.overflow,
    clipPath: s.clipPath,
    isolation: s.isolation,
    contain: s.contain,
    touchAction: s.touchAction,
    userSelect: s.userSelect + '/' + (s.webkitUserSelect ?? '-'),
    touchCallout: s.webkitTouchCallout ?? '-',
    transform: s.transform === 'none' ? 'none' : 'set',
    material: ms && {
      radius: ms.borderRadius,
      overflow: ms.overflow,
      clipPath: ms.clipPath,
      transform: ms.transform === 'none' ? 'none' : 'set',
      transformStyle: ms.transformStyle,
      tracking: material.dataset.tracking ?? null,
    },
    /** True when a corner the rounded shape should exclude is still owned by the card. */
    squareCorners: Object.entries(owns).filter(([, v]) => v).map(([k]) => k),
    focused: document.activeElement === el,
    matchesFocusVisible: (() => { try { return el.matches(':focus-visible'); } catch { return null; } })(),
    matchesActive: (() => { try { return el.matches(':active'); } catch { return null; } })(),
    ariaPressed: el.getAttribute('aria-pressed'),
    interactive: ['A', 'BUTTON', 'SUMMARY'].includes(el.tagName)
      || el.hasAttribute('role')
      || el.tabIndex >= 0,
    /*
     * Corner pixels only mean something while the card is the thing on screen. Tapping a card
     * that opens a sheet covers the card, so those later stages are reported as occluded rather
     * than counted as clean corners.
     */
    occluded: (() => {
      if (r.width === 0 || r.height === 0) return 'zero-size';
      if (r.bottom < 0 || r.top > innerHeight) return 'off-screen';
      const hit = document.elementFromPoint(
        Math.min(innerWidth - 1, Math.max(0, r.left + r.width / 2)),
        Math.min(innerHeight - 1, Math.max(0, r.top + r.height / 2)),
      );
      if (!hit) return 'no-hit';
      return el === hit || el.contains(hit) || hit.contains(el) ? null : 'covered';
    })(),
  };
})()`;

/**
 * The corner squares of the card's *painted* box — its border box grown by any focus ring, so a
 * ring that ignores the radius is sampled too — each paired with a reference square of the same
 * size displaced diagonally outward. The reference is the local backdrop at that instant, so a
 * panel behind the card, or a sheet opening under it, cannot be mistaken for a corner flash.
 */
const cornersOf = (page, selector) =>
  page.evaluate(
    `(() => { const el = document.querySelector(${JSON.stringify(selector)});
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      // A ring drawn as either an outline or a spread box-shadow pushes the painted edge out.
      const outline = s.outlineStyle === 'none'
        ? 0
        : parseFloat(s.outlineWidth) + Math.max(0, parseFloat(s.outlineOffset) || 0);
      const spread = [...s.boxShadow.matchAll(/(-?[0-9.]+)px/g)].map((m) => parseFloat(m[1]));
      const ring = Math.max(outline, spread.length >= 4 ? Math.abs(spread[3]) : 0);
      const grow = Math.ceil(ring);
      const c = ${CORNER};
      const away = c + 6;
      const left = Math.round(r.left) - grow;
      const top = Math.round(r.top) - grow;
      const right = Math.round(r.right) + grow;
      const bottom = Math.round(r.bottom) + grow;
      const box = (x, y) => ({ x, y, width: c, height: c });
      return {
        ring,
        boxes: {
          tl: { at: box(left, top), off: box(left - away, top - away) },
          tr: { at: box(right - c, top), off: box(right - c + away, top - away) },
          bl: { at: box(left, bottom - c), off: box(left - away, bottom - c + away) },
          br: { at: box(right - c, bottom - c), off: box(right - c + away, bottom - c + away) },
        },
      }; })()`,
  );

/** Decodes one corner patch straight from a clipped capture, without writing a file. */
async function patch(page, clip) {
  const { data } = await page.send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
    clip: { ...clip, scale: 1 },
  });
  return decodePng(Buffer.from(data, 'base64'));
}

/** The 4x4 block at a patch's outermost corner, averaged per channel. */
function outerBlock(image, name) {
  const xs = name === 'tl' || name === 'bl' ? [0, 4] : [image.width - 4, image.width];
  const ys = name === 'tl' || name === 'tr' ? [0, 4] : [image.height - 4, image.height];
  const sums = [0, 0, 0];
  let count = 0;
  for (let y = ys[0]; y < ys[1]; y += 1) {
    for (let x = xs[0]; x < xs[1]; x += 1) {
      const base = (y * image.width + x) * image.channels;
      sums[0] += image.data[base];
      sums[1] += image.data[base + 1];
      sums[2] += image.data[base + 2];
      count += 1;
    }
  }
  return sums.map((sum) => Math.round(sum / count));
}

const inside = (clip, viewport) =>
  clip.x >= 0 &&
  clip.y >= 0 &&
  clip.x + clip.width <= viewport.width &&
  clip.y + clip.height <= viewport.height;

/**
 * How far each corner of the painted box is from its own local backdrop. A rounded card leaves
 * its box corners showing whatever is behind it; anything that paints a rectangle there — a
 * native tap highlight, an active background, a ring that ignores the radius — shows up as a
 * large delta on the corner that is flashing.
 */
async function cornerDeltas(page, selector, viewport) {
  const { ring, boxes } = await cornersOf(page, selector);
  const deltas = {};
  for (const [name, { at, off }] of Object.entries(boxes)) {
    if (!inside(at, viewport) || !inside(off, viewport)) {
      deltas[name] = null;
      continue;
    }
    const here = outerBlock(await patch(page, at), name);
    const backdrop = outerBlock(await patch(page, off), name);
    deltas[name] = Math.max(...here.map((value, i) => Math.abs(value - backdrop[i])));
  }
  return { ring: Math.round(ring * 10) / 10, deltas };
}

const centreOf = (page, selector) =>
  page.evaluate(
    `(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();
      return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }; })()`,
  );

const touch = (page, type, point) =>
  page.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: point ? [{ x: point.x, y: point.y }] : [],
  });

const waitFor = async (page, expression, tries = 80) => {
  for (let i = 0; i < tries; i += 1) {
    if (await page.evaluate(`Boolean(${expression})`)) return true;
    await sleep(250);
  }
  return false;
};

/**
 * One card, driven through the whole gesture. Every sample is taken while the corresponding
 * pointer state is live: `down` and `held` and `dragged` all happen before `touchEnd`.
 */
async function gesture(page, { width, label, selector, viewport }) {
  const stages = {};
  const shot = async (stage) =>
    screenshot(page, `${OUT}/holo-${label}-${width}-${stage}.png`, null, false);
  const sample = async (stage) => {
    const css = await page.evaluate(PROBE(selector));
    const pixels = await cornerDeltas(page, selector, viewport);
    await shot(stage);
    return { ...css, ...pixels };
  };

  await page.evaluate(
    `document.querySelector(${JSON.stringify(selector)}).scrollIntoView({ block: 'center' })`,
  );
  await sleep(250);

  stages.idle = await sample('idle');

  const point = await centreOf(page, selector);
  await touch(page, 'touchStart', point);
  await sleep(60);
  stages.down = await sample('down');

  await sleep(400);
  stages.held = await sample('held');

  await touch(page, 'touchMove', { x: point.x + 9, y: point.y + 6 });
  await sleep(120);
  stages.dragged = await sample('dragged');

  await touch(page, 'touchEnd', null);
  await sleep(50);
  stages.released = await sample('released');

  await sleep(600);
  stages.afterRelease = await sample('after-release');

  // Keyboard focus must stay visible and must follow the rounded shape.
  await page.evaluate(`document.querySelector(${JSON.stringify(selector)}).focus()`);
  await page.send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'Tab',
    windowsVirtualKeyCode: 9,
  });
  await page.send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: 'Tab',
    windowsVirtualKeyCode: 9,
  });
  await page.evaluate(`document.querySelector(${JSON.stringify(selector)}).focus()`);
  await sleep(150);
  stages.focused = await sample('focused');

  return stages;
}

const report = { base: BASE, widths: {} };

const { page, close } = await session();
try {
  for (const width of WIDTHS) {
    const perWidth = {};
    await setViewport(page, width, 900, { mobile: true });
    await page.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });

    // Skill Map: territory buttons, then a capability card once a territory is open.
    await openPage(page, `${BASE}/skills`);
    await waitFor(page, "document.querySelector('[data-territory=BUILD]')");
    await sleep(400);
    const viewport = { width, height: 900 };
    perWidth.territory = await gesture(page, {
      width,
      label: 'territory',
      selector: '[data-territory=BUILD]',
      viewport,
    });

    if (await waitFor(page, "document.querySelector('[data-skill]')", 12)) {
      perWidth.skillCard = await gesture(page, {
        width,
        label: 'skillcard',
        selector: '[data-skill]',
        viewport,
      });
    }

    // Command Center: the continuation holo object.
    await openPage(page, `${BASE}/`);
    await waitFor(page, "document.querySelector('[data-variant]')");
    await sleep(400);
    perWidth.continuation = await gesture(page, {
      width,
      label: 'continuation',
      selector: '[data-variant]',
      viewport,
    });

    report.widths[width] = perWidth;
  }
} finally {
  await close();
}

// A stage fails on pixel evidence — a corner of the painted box that has *changed* since idle,
// meaning something rectangular started being painted outside the rounded card mid-interaction —
// and on the CSS properties that can only produce that: a collapsed radius, an opaque offset
// outline around a transformed element (square on older WebKit), or a live native tap highlight
// on something that can actually receive one. A corner difference that is already there at idle
// is the layout behind the card, not a flash, so idle is the baseline rather than an absolute.
const failures = [];
const occluded = [];
const OPAQUE_OUTLINE = /^(?!0px)(?!.*rgba\([^)]*,\s*0\)).*solid/;
for (const [width, cards] of Object.entries(report.widths)) {
  for (const [card, stages] of Object.entries(cards)) {
    const idle = stages.idle;
    if (!idle) continue;
    for (const [stage, data] of Object.entries(stages)) {
      if (!data || stage === 'idle') continue;
      if (data.occluded || idle.occluded) {
        occluded.push(`${width} ${card} ${stage}: ${data.occluded ?? idle.occluded}`);
        continue;
      }
      const moved = Object.entries(data.deltas ?? {})
        .filter(([corner, delta]) => {
          const before = idle.deltas?.[corner];
          return (
            delta !== null &&
            before !== null &&
            before !== undefined &&
            Math.abs(delta - before) > CORNER_TOLERANCE
          );
        })
        .map(([corner, delta]) => `${corner}=${idle.deltas[corner]}->${delta}`);
      if (moved.length > 0) {
        failures.push(`${width} ${card} ${stage}: corner flash ${moved.join(' ')}`);
      }
      if (data.radiusPx + 0.5 < idle.radiusPx) {
        failures.push(
          `${width} ${card} ${stage}: radius collapsed ${idle.radiusPx}px -> ${data.radiusPx}px`,
        );
      }
    }
    for (const [stage, data] of Object.entries(stages)) {
      if (!data) continue;
      if (data.outline !== 'none' && OPAQUE_OUTLINE.test(data.outline)) {
        failures.push(`${width} ${card} ${stage}: opaque offset outline ${data.outline}`);
      }
      if (
        data.interactive &&
        data.tapHighlight !== '-' &&
        !/rgba\([^)]*,\s*0\)|transparent/.test(data.tapHighlight)
      ) {
        failures.push(`${width} ${card} ${stage}: native tap highlight ${data.tapHighlight}`);
      }
    }
    if (
      stages.focused &&
      stages.focused.boxShadow === 'none' &&
      stages.focused.outline === 'none'
    ) {
      failures.push(`${width} ${card} focused: no visible focus ring at all`);
    }
  }
}
report.failures = failures;
// Stages where the card was covered by what its own tap opened. Not evidence either way; listed
// so a covered stage can never read as a clean corner.
report.occluded = occluded;
report.measured = Object.entries(report.widths).flatMap(([width, cards]) =>
  Object.entries(cards).map(([card, stages]) => {
    const total = Object.values(stages).filter(Boolean).length;
    const covered = Object.values(stages).filter((data) => data?.occluded).length;
    return `${width} ${card}: ${total - covered}/${total} stages measurable`;
  }),
);
report.verdict = failures.length === 0 ? 'PASS' : 'FAIL';
console.log(JSON.stringify(report, null, 2));
