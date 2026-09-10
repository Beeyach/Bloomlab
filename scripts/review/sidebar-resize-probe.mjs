// DES-009: genuine drag/keyboard resize, geometry, persistence and constrained Workspace.
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
const axeSource = readFileSync(
  createRequire(import.meta.url).resolve('axe-core/axe.min.js'),
  'utf8',
);
import { session, openPage, setViewport, sleep, screenshot } from './cdp.mjs';
const BASE = process.env.BASE ?? 'http://localhost:4173',
  HEAD = process.env.REVIEW_HEAD;
const OUT = resolve(process.env.REVIEW_OUT ?? '.review/sidebar-resize');
mkdirSync(OUT, { recursive: true });
const report = {
  head: HEAD ?? 'working-tree',
  base: BASE,
  checks: [],
  drags: [],
  accessibility: [],
  layouts: [],
  status: 'RUNNING',
};
const { page, close } = await session();
const save = () =>
  writeFileSync(OUT + '/sidebar-resize-probe.json', JSON.stringify(report, null, 2));
const check = (name, value) => {
  report.checks.push({ name, passed: !!value });
  save();
  assert(value, name);
};
const keys = { Tab: 9, ArrowLeft: 37, ArrowRight: 39, Home: 36, End: 35, Enter: 13, Escape: 27 };
const key = async (name) => {
  for (const type of ['keyDown', 'keyUp'])
    await page.send('Input.dispatchKeyEvent', {
      type,
      key: name,
      code: name,
      windowsVirtualKeyCode: keys[name],
      ...(name === 'Enter' && type === 'keyDown' ? { text: '\r' } : {}),
    });
  await sleep(50);
};
const box = async (selector) =>
  page.evaluate(
    `(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`,
  );
const click = async (selector, count = 1) => {
  const p = await box(selector);
  for (const type of ['mousePressed', 'mouseReleased'])
    await page.send('Input.dispatchMouseEvent', { type, ...p, button: 'left', clickCount: count });
  await sleep(80);
};
const reset = async () => {
  await openPage(page, BASE + '/skills');
  await sleep(100);
};
const state = () =>
  page.evaluate(
    `(()=>{const f=document.querySelector('[data-sidebar]'),n=document.querySelector('nav[aria-label="Primary"]'),h=document.querySelector('[data-testid="sidebar-resizer"]'),main=document.querySelector('main');const rect=e=>{const b=e.getBoundingClientRect();return{left:b.left,right:b.right,top:b.top,width:b.width,height:b.height,cx:b.x+b.width/2,cy:b.y+b.height/2,boxes:e.getClientRects().length}};return{build:f.dataset.buildId,mode:f.dataset.sidebar,width:n.getBoundingClientRect().width,offset:parseFloat(getComputedStyle(f).paddingLeft),mainLeft:main.getBoundingClientRect().left,overflow:document.documentElement.scrollWidth>innerWidth,stored:localStorage.getItem('bloomlab.sidebar.width.v1'),handle:h?{...rect(h),min:+h.getAttribute('aria-valuemin'),max:+h.getAttribute('aria-valuemax'),now:+h.getAttribute('aria-valuenow'),orientation:h.getAttribute('aria-orientation'),name:h.getAttribute('aria-label'),controls:document.getElementById(h.getAttribute('aria-controls'))===n}:null,links:[...document.querySelectorAll('[data-testid="rail-destinations"] a')].map(a=>{const label=a.querySelector('[class*="label"]');return{name:a.getAttribute('aria-label'),row:rect(a),icon:rect(a.querySelector('svg')),label:rect(label),fullLabelFits:label.scrollWidth<=label.clientWidth+1}})}})()`,
  );
const layout = async (name, width) => {
  const s = await state();
  report.layouts.push({ name, ...s });
  check(
    name + ': shared width and offset',
    s.width === width && s.offset === width && s.mainLeft >= width && !s.overflow,
  );
  check(
    name + ': separator values',
    s.handle?.min === 176 &&
      s.handle.now === width &&
      s.handle.orientation === 'vertical' &&
      s.handle.controls &&
      s.handle.name,
  );
  check(
    name + ': readable horizontal labels',
    s.links.length >= 15 &&
      s.links.every(
        (l) =>
          l.label.boxes > 0 &&
          l.icon.right <= l.label.left &&
          Math.abs(l.icon.cy - l.label.cy) <= 2 &&
          l.row.height >= 44 &&
          l.row.height <= 48 &&
          l.fullLabelFits,
      ),
  );
  if (HEAD) check(name + ': exact browser head', s.build === HEAD);
  return s;
};
const drag = async (delta, expected) => {
  const start = await state(),
    p = await box('[data-testid="sidebar-resizer"]');
  await page.send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    ...p,
    button: 'left',
    clickCount: 1,
  });
  for (let i = 1; i <= 6; i++) {
    await page.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: p.x + (delta * i) / 6,
      y: p.y,
      button: 'left',
      buttons: 1,
    });
    await sleep(40);
    const s = await state();
    check(
      'live drag moves content without overflow',
      s.width === s.offset && s.mainLeft >= s.width && !s.overflow,
    );
    check('drag does not persist per pointer move', s.stored === start.stored);
  }
  const live = await state();
  report.drags.push({
    start: start.width,
    delta,
    expected,
    liveWidth: live.width,
    aria: live.handle.now,
    dragging: await page.evaluate(
      `document.querySelector('[data-sidebar]').dataset.sidebarResizing`,
    ),
  });
  check('drag updates before release', live.width === expected && live.handle.now === expected);
  await page.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: p.x + delta,
    y: p.y,
    button: 'left',
    clickCount: 1,
  });
  await sleep(100);
  check('drag persists on release', (await state()).stored === String(expected));
};
const focusHandle = async () => {
  await reset();
  for (let i = 0; i < 30; i++) {
    await key('Tab');
    if (await page.evaluate(`document.activeElement.dataset.testid==='sidebar-resizer'`)) break;
  }
  check(
    'resizer reachable through native Tab with visible focus',
    await page.evaluate(
      `document.activeElement.dataset.testid==='sidebar-resizer'&&document.activeElement.matches(':focus-visible')&&getComputedStyle(document.activeElement).outlineStyle!=='none'`,
    ),
  );
};
try {
  report.healthBefore = await (await fetch(BASE + '/api/health')).json();
  if (HEAD) assert.equal(report.healthBefore.build_id, HEAD);
  await setViewport(page, 1440, 900);
  await reset();
  await layout('default', 200);
  await drag(-16, 184);
  await reset();
  await layout('smaller reload', 184);
  await drag(64, 248);
  await reset();
  await layout('larger reload', 248);
  await drag(-150, 176);
  await drag(500, 280);
  await focusHandle();
  await key('Home');
  await layout('keyboard Home', 176);
  await key('ArrowRight');
  await layout('keyboard Right', 184);
  await key('ArrowLeft');
  await layout('keyboard Left', 176);
  await key('ArrowLeft');
  check('keyboard minimum clamps', (await state()).width === 176);
  await key('End');
  await key('ArrowRight');
  await layout('keyboard maximum', 280);
  await click('[data-testid="sidebar-resizer"]');
  await click('[data-testid="sidebar-resizer"]', 2);
  await layout('double click default', 200);
  await reset();
  check('reset persisted', (await state()).stored === '200');
  await drag(40, 240);
  await click('[data-testid="rail-toggle"]');
  let s = await state();
  check(
    'collapsed fixed and cannot resize',
    s.width === 76 &&
      s.offset === 76 &&
      !s.handle &&
      s.links.every((l) => l.label.boxes === 0 && Math.abs(l.icon.cx - l.row.cx) <= 1),
  );
  await reset();
  check('collapsed reload', (await state()).width === 76);
  await click('[data-testid="rail-toggle"]');
  await layout('expand restores chosen width', 240);
  // Deliberate corrupted preference fixtures only; no learner progress is touched.
  for (const [value, expected] of [
    [null, 200],
    ['broken', 200],
    ['{}', 200],
    ['Infinity', 200],
    ['', 200],
    ['99', 176],
    ['999', 280],
  ]) {
    await page.evaluate(
      value === null
        ? `localStorage.removeItem('bloomlab.sidebar.width.v1')`
        : `localStorage.setItem('bloomlab.sidebar.width.v1',${JSON.stringify(value)})`,
    );
    await reset();
    check('stored ' + JSON.stringify(value) + ' normalizes', (await state()).width === expected);
  }
  for (const width of [1440, 1024, 768]) {
    await setViewport(page, width, 900);
    await focusHandle();
    const max = Math.min(280, width - 536);
    for (const [name, target] of [
      ['minimum', 176],
      ['default', 200],
      ['maximum', max],
    ]) {
      if (name === 'minimum') await key('Home');
      else if (name === 'maximum') await key('End');
      else {
        await click('[data-testid="sidebar-resizer"]');
        await click('[data-testid="sidebar-resizer"]', 2);
      }
      await layout(width + ' ' + name, target);
      check('viewport-aware maximum', (await state()).handle.max === max);
      await page.evaluate(axeSource);
      const axe = await page.evaluate(
        `axe.run().then(r=>({violations:r.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>n.target)}))}))`,
      );
      report.accessibility.push({ width, name, ...axe });
      check(
        width + ' ' + name + ' axe serious/critical',
        !axe.violations.some((v) => ['serious', 'critical'].includes(v.impact)),
      );
      await screenshot(page, OUT + '/' + width + '-' + name + '.png', null, false);
      await openPage(page, BASE + '/workflow');
      for (let attempt = 0; attempt < 100; attempt++) {
        if (await page.evaluate(`!!document.querySelector('[data-testid="workflow-canvas"]')`))
          break;
        await sleep(100);
      }
      const w = await page.evaluate(
        `(()=>{const c=document.querySelector('[data-testid="workflow-canvas"]'),r=c.getBoundingClientRect();return {width:r.width,right:r.right,overflow:document.documentElement.scrollWidth>innerWidth}})()`,
      );
      check(
        width + ' ' + name + ' readable Workflow',
        w.width >= 280 && w.right <= width && !w.overflow,
      );
      await screenshot(page, OUT + '/' + width + '-' + name + '-workflow.png', null, false);
      await focusHandle();
    }
  }
  await setViewport(page, 1440, 600);
  await focusHandle();
  await click('[data-testid="sidebar-resizer"]');
  await click('[data-testid="sidebar-resizer"]', 2);
  const pending = await box('[data-testid="sidebar-resizer"]');
  await page.send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    ...pending,
    button: 'left',
    clickCount: 1,
  });
  await page.send('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x: pending.x + 16,
    y: pending.y,
    button: 'left',
    buttons: 1,
  });
  await sleep(100);
  check(
    'unfinished gesture changes live width only',
    (await state()).width === 216 && (await state()).stored === '200',
  );
  await setViewport(page, 768, 600);
  await sleep(100);
  await layout('viewport cancels unfinished drag and resets ARIA', 200);
  check(
    'cancelled gesture leaves preference and cursor clean',
    (await state()).stored === '200' &&
      !(await page.evaluate(`document.querySelector('[data-sidebar]').dataset.sidebarResizing`)),
  );
  await page.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: pending.x + 16,
    y: pending.y,
    button: 'left',
    clickCount: 1,
  });
  await setViewport(page, 768, 600, { mobile: true });
  const touch = await box('[data-testid="sidebar-resizer"]');
  for (const cancel of [true, false]) {
    await page.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ ...touch, id: 0, radiusX: 2, radiusY: 2 }],
    });
    await page.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: touch.x + 16, y: touch.y, id: 0, radiusX: 2, radiusY: 2 }],
    });
    await sleep(100);
    check('touch resize updates live width', (await state()).width === 216);
    await page.send('Input.dispatchTouchEvent', {
      type: cancel ? 'touchCancel' : 'touchEnd',
      touchPoints: [],
    });
    await sleep(100);
    await layout(
      cancel ? 'touch cancellation restores saved width' : 'touch release commits width',
      cancel ? 200 : 216,
    );
    check(
      'touch preference commits only on completion',
      (await state()).stored === String(cancel ? 200 : 216),
    );
  }
  // A viewport constraint never overwrites the learner's larger saved choice.
  await setViewport(page, 1440, 600);
  await focusHandle();
  await key('End');
  await setViewport(page, 768, 600);
  await sleep(100);
  await layout('constrained tablet', 232);
  check('tablet leaves 536px content and remembers 280', (await state()).stored === '280');
  await setViewport(page, 1024, 600);
  await sleep(100);
  await layout('wide viewport restores preference', 280);
  for (const width of [390, 320]) {
    await setViewport(page, width, 480);
    await reset();
    s = await state();
    check(
      'phone ' + width + ' no desktop controls',
      !s.overflow &&
        s.handle?.boxes === 0 &&
        (await page.evaluate(
          `document.querySelector('[data-testid="rail-toggle"]').getClientRects().length===0&&document.querySelector('[data-testid="rail-more"]').getClientRects().length>0`,
        )),
    );
    await screenshot(page, OUT + '/' + width + '-phone.png', null, false);
  }
  report.healthAfter = await (await fetch(BASE + '/api/health')).json();
  if (HEAD) assert.equal(report.healthAfter.build_id, HEAD);
  report.status = 'PASSED';
  save();
  console.log(
    'Sidebar resize PASS: ' +
      report.checks.length +
      ' checks; ' +
      report.layouts.length +
      ' layouts',
  );
} catch (error) {
  report.status = 'FAILED';
  report.error = String(error);
  save();
  await screenshot(page, OUT + '/failure.png', null, false).catch(() => {});
  throw error;
} finally {
  await close();
}
