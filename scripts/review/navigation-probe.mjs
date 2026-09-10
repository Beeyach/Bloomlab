// DES-009 / D-202: user-input contract. Never assigns scrollTop or calls scrollIntoView/focus/click.
// Run against a built Worker. REVIEW_HEAD requires exact Worker and browser source identity.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { openPage, screenshot, session, setViewport, sleep } from './cdp.mjs';

const BASE = process.env.BASE ?? 'http://localhost:4173';
const OUT = resolve(process.env.REVIEW_OUT ?? '.review/navigation');
const HEAD = process.env.REVIEW_HEAD;
mkdirSync(OUT, { recursive: true });
const report = { base: BASE, head: HEAD ?? 'working-tree', cases: [], status: 'RUNNING' };
const { page, close } = await session();
const save = () =>
  writeFileSync(resolve(OUT, 'navigation-probe.json'), JSON.stringify(report, null, 2));
const key = async (key, modifiers = 0) => {
  for (const type of ['keyDown', 'keyUp'])
    await page.send('Input.dispatchKeyEvent', {
      type,
      key,
      code: key === ' ' ? 'Space' : key,
      ...(key === 'Enter' && type === 'keyDown' ? { text: '\r' } : {}),
      windowsVirtualKeyCode: { Tab: 9, Enter: 13, Escape: 27, ' ': 32 }[key],
      modifiers,
    });
  await sleep(40);
};
const point = (selector) =>
  page.evaluate(
    `(()=>{const el=document.querySelector(${JSON.stringify(selector)}),r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`,
  );
const pointer = async (selector) => {
  const p = await point(selector);
  await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...p });
  for (const type of ['mousePressed', 'mouseReleased'])
    await page.send('Input.dispatchMouseEvent', { type, ...p, button: 'left', clickCount: 1 });
  await sleep(100);
};
const wheel = async (x, y, deltaY) => {
  await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
  await page.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x, y, deltaX: 0, deltaY });
  await sleep(160);
};
const state = () =>
  page.evaluate(`(()=>{
  const s=document.querySelector('[data-testid="rail-destinations"]'), n=s.closest('nav'),r=s.getBoundingClientRect(), main=document.querySelector('main'),frame=document.querySelector('[data-sidebar]');
  const links=[...s.querySelectorAll('a')].filter(a=>a.getClientRects().length);
  const last=links.at(-1),b=last.getBoundingClientRect();
  return {top:s.scrollTop,height:s.clientHeight,content:s.scrollHeight,width:s.clientWidth,contentWidth:s.scrollWidth,
    x:r.x+r.width/2,y:r.y+r.height/2,left:r.left,right:r.right,regionTop:r.top,bottom:r.bottom,gutter:s.offsetWidth-s.clientWidth,
    page:scrollY,mode:frame.dataset.sidebar,railWidth:n.getBoundingClientRect().width,
    token:parseFloat(getComputedStyle(n).getPropertyValue('--bl-size-rail')),offset:parseFloat(getComputedStyle(frame).paddingLeft),mainLeft:main.getBoundingClientRect().left,
    horizontal:document.documentElement.scrollWidth>innerWidth,last:last.getAttribute('href'),lastVisible:b.top>=r.top&&b.bottom<=r.bottom,
    names:links.map(a=>a.getAttribute('aria-label')),hrefs:links.map(a=>a.getAttribute('href')),
    labels:links.map(a=>{const l=a.querySelector('[class*="label"]');return {visible:l.getClientRects().length>0,fits:a.scrollWidth<=a.clientWidth};}),
    icons:links.every(a=>!!a.querySelector('svg')),behavior:getComputedStyle(s).scrollBehavior,
    build:frame.dataset.buildId};
})()`);
const reset = async () => {
  await openPage(page, BASE + '/skills');
  await sleep(100);
};
const swipe = async (s) => {
  await page.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: s.x, y: s.y + 90 }],
  });
  for (let i = 1; i <= 10; i++) {
    await page.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: s.x, y: s.y + 90 - i * 20 }],
    });
    await sleep(25);
  }
  await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(200);
};
try {
  report.healthBefore = await (await fetch(BASE + '/api/health')).json();
  if (HEAD) assert.equal(report.healthBefore.build_id, HEAD);
  const widths = process.env.NAV_WIDTHS?.split(',').map(Number) ?? [1440, 1024, 768];
  const heights = process.env.NAV_HEIGHTS?.split(',').map(Number) ?? [900, 720, 600, 480];
  for (const width of widths)
    for (const height of heights)
      for (const mode of ['expanded', 'collapsed']) {
        for (const reduced of height === 480 ? [false, true] : [false]) {
          const name = `${width}x${height}-${mode}-${reduced ? 'reduced' : 'normal'}`;
          const row = { name, checks: {} };
          report.cases.push(row);
          save();
          const check = (name, value) => {
            row.checks[name] = value;
            assert(value, `${row.name}: ${name}`);
          };
          await setViewport(page, width, height, { mobile: false });
          await page.send('Emulation.setEmulatedMedia', {
            features: [
              { name: 'prefers-reduced-motion', value: reduced ? 'reduce' : 'no-preference' },
            ],
          });
          await reset();
          if ((await state()).mode !== mode) await pointer('[data-testid="rail-toggle"]');
          await reset();
          let initial = await state();
          row.initial = initial;
          check('persistedModeAfterReload', initial.mode === mode);
          if (HEAD) check('browserHead', initial.build === HEAD);
          check(
            'widthAndOffset',
            initial.railWidth === (mode === 'expanded' ? 232 : 76) &&
              initial.token === initial.railWidth &&
              initial.offset === initial.railWidth &&
              initial.mainLeft >= initial.railWidth,
          );
          check(
            'namesAndIcons',
            initial.names.length >= 15 && initial.names.every(Boolean) && initial.icons,
          );
          check(
            'labelComposition',
            initial.labels.every((l) => l.fits && l.visible === (mode === 'expanded')),
          );
          check(
            'noHorizontalOverflow',
            !initial.horizontal && initial.contentWidth <= initial.width,
          );
          check('nativeMotion', initial.behavior === 'auto');
          check(
            'singleBoundedOwner',
            initial.regionTop > 0 &&
              initial.bottom <= height &&
              (await page.evaluate(
                `document.querySelector('nav[aria-label="Primary"]').scrollHeight===document.querySelector('nav[aria-label="Primary"]').clientHeight`,
              )),
          );
          if (initial.content > initial.height) {
            check('lastInitiallyOffscreen', !initial.lastVisible);
            await wheel(initial.x, initial.y, 120);
            const moved = await state();
            row.wheel = moved;
            check(
              'realWheelConsumesBeforeBoundary',
              moved.top > initial.top && moved.page === initial.page,
            );
            await reset(); // A tall viewport may exhaust its small overflow in one wheel notch.
            for (let i = 0; i < 6; i++) await wheel(initial.x, initial.y, 8.5);
            const small = await state();
            row.trackpad = small;
            check('smallWheelDeltas', small.top > 0 && small.page === 0);
            for (let i = 0; i < 20 && !(await state()).lastVisible; i++)
              await wheel(initial.x, initial.y, 180);
            const bottom = await state();
            row.bottom = bottom;
            check('wheelRevealsLowerDestination', bottom.lastVisible && bottom.top > 0);
            // Separate wheel gestures at the exhausted boundary should permit page movement.
            await sleep(250);
            await wheel(initial.x, initial.y, 300);
            const boundary = await state();
            row.boundary = boundary;
            check('boundaryDoesNotSwallowInput', boundary.page > bottom.page);
            await reset();
            initial = await state();
            await wheel(width - 35, 150, 200);
            const outside = await state();
            row.outside = outside;
            check('pageWheelIndependent', outside.page > 0 && outside.top === 0);
            // Native scrollbar thumb: no CSS surrogate, and no programmatic scrolling.
            await reset();
            const dragStart = await state();
            check('nativeScrollbarRendered', dragStart.gutter > 0);
            const x = dragStart.right - dragStart.gutter / 2;
            const y =
              dragStart.regionTop + (dragStart.height * dragStart.height) / dragStart.content / 2;
            await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
            await page.send('Input.dispatchMouseEvent', {
              type: 'mousePressed',
              x,
              y,
              button: 'left',
              clickCount: 1,
            });
            for (let i = 1; i <= 8; i++)
              await page.send('Input.dispatchMouseEvent', {
                type: 'mouseMoved',
                x,
                y: y + i * 20,
                button: 'left',
                buttons: 1,
              });
            await page.send('Input.dispatchMouseEvent', {
              type: 'mouseReleased',
              x,
              y: y + 160,
              button: 'left',
              clickCount: 1,
            });
            await sleep(150);
            row.drag = await state();
            check('nativeScrollbarDrag', row.drag.top > 0);
            await screenshot(page, resolve(OUT, name + '-scroll.png'), null, false);
            await reset();
            await page.send('Emulation.setTouchEmulationEnabled', {
              enabled: true,
              maxTouchPoints: 5,
            });
            await swipe(await state());
            row.touch = await state();
            check('tabletTouchScroll', row.touch.top > 0 && row.touch.page === 0);
            for (let i = 0; i < 15 && !(await state()).lastVisible; i++) await swipe(await state());
            check('touchRevealsBottom', (await state()).lastVisible);
            let stable = 0;
            let previous = (await state()).top;
            for (let tick = 0; tick < 30 && stable < 3; tick++) {
              await sleep(100);
              const next = (await state()).top;
              stable = next === previous ? stable + 1 : 0;
              previous = next;
            }
            check('touchMomentumSettled', stable >= 3);
            const lastPoint = await point(
              `[data-testid="rail-destinations"] a[href="${initial.last}"]`,
            );
            await page.send('Input.dispatchTouchEvent', {
              type: 'touchStart',
              touchPoints: [lastPoint],
            });
            await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
            await sleep(300);
            check(
              'touchActivatesBottom',
              await page.evaluate(`location.pathname===${JSON.stringify(initial.last)}`),
            );
            for (const expected of [mode === 'collapsed' ? 'expanded' : 'collapsed', mode]) {
              const p = await point('[data-testid="rail-toggle"]');
              await page.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [p] });
              await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
              await sleep(100);
              check('touchToggleTo' + expected, (await state()).mode === expected);
            }

            await page.send('Emulation.setTouchEmulationEnabled', {
              enabled: false,
              maxTouchPoints: 1,
            });
          } else
            row.overflow = 'Not applicable at this height; shorter heights must exercise overflow';
          await reset();
          // Real Tab traversal starting at the browser document, through skip link and toggle.
          const forward = [];
          for (let i = 0; i < 25; i++) {
            await key('Tab');
            const f = await page.evaluate(
              `(()=>{const a=document.activeElement,s=document.querySelector('[data-testid="rail-destinations"]'),r=a.getBoundingClientRect(),b=s.getBoundingClientRect(),cs=getComputedStyle(a);return {inside:s.contains(a),href:a.getAttribute('href'),name:a.getAttribute('aria-label'),visible:r.top-4>=b.top&&r.bottom+4<=b.bottom&&r.left-4>=b.left&&r.right+4<=b.left+s.clientWidth,focus:a.matches(':focus-visible')&&parseFloat(cs.outlineWidth)>=2,tooltip:document.querySelector('[role="tooltip"]')?.textContent}})()`,
            );
            if (f.inside) {
              forward.push(f);
              if (f.href === initial.last) break;
            }
          }
          row.forward = forward;
          check(
            'everyDestinationTabReachable',
            JSON.stringify(forward.map((f) => f.href)) === JSON.stringify(initial.hrefs) &&
              forward.every((f) => f.visible && f.focus),
          );
          if (mode === 'collapsed') {
            await sleep(150);
            check(
              'bottomFocusTooltip',
              await page.evaluate(
                `document.querySelector('[role="tooltip"]')?.textContent===document.activeElement.getAttribute('aria-label')`,
              ),
            );
            check(
              'tooltipInsideViewport',
              await page.evaluate(
                `(()=>{const r=document.querySelector('[role="tooltip"]').getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth})()`,
              ),
            );
            await screenshot(page, resolve(OUT, name + '-focus.png'), null, false);
            await key('Escape');
            check(
              'tooltipEscapeDismisses',
              await page.evaluate(`!document.querySelector('[role="tooltip"]')`),
            );
          }
          const backward = [];
          for (let i = 1; i < initial.hrefs.length; i++) {
            await key('Tab', 8);
            backward.push(
              await page.evaluate(
                `(()=>{const a=document.activeElement,r=a.getBoundingClientRect(),s=document.querySelector('[data-testid="rail-destinations"]').getBoundingClientRect();return {href:a.getAttribute('href'),visible:r.top-4>=s.top&&r.bottom+4<=s.bottom,focus:a.matches(':focus-visible')}})()`,
              ),
            );
          }
          row.backward = backward;
          check(
            'reverseTabReachable',
            backward.every((f) => f.visible && f.focus) && backward.at(-1).href === '/',
          );
          await key('Tab', 8);
          check(
            'toggleKeyboardReachable',
            await page.evaluate(`document.activeElement.dataset.testid==='rail-toggle'`),
          );
          await key(' ');
          check('spaceToggles', (await state()).mode !== mode);
          await key('Enter');
          check('enterTogglesBack', (await state()).mode === mode);
          await pointer('[data-testid="rail-toggle"]');
          check('pointerToggles', (await state()).mode !== mode);
          await pointer('[data-testid="rail-toggle"]');
          await reset();
          check('toggleBackPersists', (await state()).mode === mode);
          if (mode === 'collapsed') {
            const p = await point('[data-testid="rail-destinations"] a');
            await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...p });
            await sleep(150);
            check(
              'hoverTooltip',
              await page.evaluate(
                `document.querySelector('[role="tooltip"]')?.textContent==='Home'`,
              ),
            );
            const hint = await point('[role="tooltip"]');
            await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...hint });
            await sleep(180);
            check(
              'tooltipHoverable',
              await page.evaluate(`!!document.querySelector('[role="tooltip"]')`),
            );
            await key('Escape');
          }
          await screenshot(page, resolve(OUT, name + '.png'), null, false);
          row.passed = true;
          save();
          console.log(name + ' PASS');
        }
      }
  // The larger sidebar must not turn the tablet Workflow canvas into an unreadable sliver.
  for (const width of [1440, 1024, 768])
    for (const mode of ['expanded', 'collapsed']) {
      await setViewport(page, width, 600, { mobile: false });
      await reset();
      if ((await state()).mode !== mode) await pointer('[data-testid="rail-toggle"]');
      await openPage(page, BASE + '/workflow');
      const deadline = Date.now() + 10000;
      while (
        Date.now() < deadline &&
        !(await page.evaluate(`!!document.querySelector('[data-testid="workflow-canvas"]')`))
      )
        await sleep(100);
      const canvas = await page.evaluate(
        `(()=>{const c=document.querySelector('[data-testid="workflow-canvas"]'),r=c?.getBoundingClientRect();return {width:r?.width,overflow:document.documentElement.scrollWidth>innerWidth}})()`,
      );
      assert(canvas.width >= 280 && !canvas.overflow, `${width} ${mode}: readable Workflow canvas`);
      report.cases.push({ name: `workflow-${width}-${mode}`, canvas, passed: true });
      save();
      await screenshot(page, resolve(OUT, `workflow-${width}-${mode}.png`), null, false);
    }
  // Resize through phone composition with a stored collapsed choice; desktop mode must return.
  for (const width of [390, 320]) {
    await setViewport(page, 1024, 600);
    await reset();
    if ((await state()).mode !== 'collapsed') await pointer('[data-testid="rail-toggle"]');
    await setViewport(page, width, 480, { mobile: true });
    await reset();
    const row = { name: `${width}x480-phone`, checks: {} };
    report.cases.push(row);
    const check = (name, value) => {
      row.checks[name] = value;
      assert(value, `${row.name}: ${name}`);
    };
    check(
      'noDesktopToggle',
      await page.evaluate(
        `document.querySelector('[data-testid="rail-toggle"]').getClientRects().length===0`,
      ),
    );
    check(
      'fourPlusMore',
      await page.evaluate(
        `(()=>{const n=document.querySelector('nav'),a=[...n.querySelectorAll('a,button')].filter(a=>a.getClientRects().length);return a.length===5&&a.map(a=>a.textContent.trim()).join('|')==='Home|Campaign|Skill Map|Workflow|More'})()`,
      ),
    );
    await pointer('[data-testid="rail-more"]');
    await key('Tab');
    await key('Escape');
    check(
      'escapeFocusReturn',
      await page.evaluate(
        `document.querySelector('[data-testid="rail-more-menu"]').hidden&&document.activeElement.dataset.testid==='rail-more'`,
      ),
    );
    check(
      'noHorizontalOverflow',
      await page.evaluate('document.documentElement.scrollWidth<=innerWidth'),
    );
    await screenshot(page, resolve(OUT, row.name + '.png'), null, false);
    await setViewport(page, 1024, 600, { mobile: false });
    await reset();
    check('desktopChoiceSurvivesPhone', (await state()).mode === 'collapsed');
    row.passed = true;
    save();
    console.log(row.name + ' PASS');
  }
  report.healthAfter = await (await fetch(BASE + '/api/health')).json();
  if (HEAD) assert.equal(report.healthAfter.build_id, HEAD);
  report.status = 'PASSED';
} catch (error) {
  report.status = 'FAILED';
  report.error = String(error);
  console.error(error);
  await screenshot(page, resolve(OUT, 'failure.png'), null, false).catch(() => {});
  process.exitCode = 1;
} finally {
  save();
  await close();
}
