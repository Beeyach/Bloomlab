import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { session, openPage, setViewport, screenshot, sleep } from './cdp.mjs';
import { probeHelpers } from './probe-lib.mjs';
import { fieldworkFixtures } from './fieldwork-fixtures.mjs';
import { installClientStorageFaults } from './field-ready-fixtures.mjs';

const base = process.env.BASE ?? 'http://127.0.0.1:4183';
const out = resolve(process.env.REVIEW_OUT ?? '.review/remediation/home');
mkdirSync(out, { recursive: true });
const { page, close } = await session();
const { waitFor, typeInto, click } = probeHelpers({ base });
const report = { head: process.env.REVIEW_HEAD ?? 'working-tree', base, states: [] };
const wait = async (condition) =>
  assert(await waitFor(page, `Boolean(${condition})`, 160), condition);
const has = (text) => `document.body.textContent.includes(${JSON.stringify(text)})`;
async function go(path) {
  await openPage(page, base + path);
  await wait('window.__fieldworkProbe');
}
async function capture(state, width) {
  await wait("document.querySelector('main h1')");
  const layout = await page.evaluate(`(() => {
    const region = document.querySelector('#active-client-title')?.closest('section') ?? document.querySelector('main');
    return { overflow: document.documentElement.scrollWidth > innerWidth + 1,
      controls: [...region.querySelectorAll('a,button')].map(e => ({height: e.getBoundingClientRect().height, width:e.getBoundingClientRect().width})),
      shell: document.querySelector('[data-build-id]')?.getAttribute('data-build-id') };
  })()`);
  assert(!layout.overflow, `${state} ${width} overflow`);
  assert(layout.controls.every((c) => c.height >= 44 && c.width >= 44));
  if (process.env.REVIEW_HEAD) assert.equal(layout.shell, process.env.REVIEW_HEAD);
  await screenshot(page, resolve(out, `${width}-${state}.png`));
  report.states.push({ state, width, height: 480, ...layout });
}
try {
  if (process.env.REVIEW_HEAD) {
    report.health = await (await fetch(base + '/api/health')).json();
    assert.equal(report.health.build_id, process.env.REVIEW_HEAD);
  }
  await page.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `(${fieldworkFixtures.toString()})(false,'');(${installClientStorageFaults.toString()})();`,
  });
  await go('/');
  await wait(has('No saved client work yet'));
  for (const width of [1440, 1024, 768, 390, 320]) {
    await setViewport(page, width, 480);
    await capture('empty', width);
  }
  await go('/clients/CL-glowhaus-medspa');
  await wait(has('No relationship notes yet'));
  await typeInto(page, 'main textarea', 'Controlled review: verify calendar ownership.');
  await click(page, 'Save note');
  await wait(has('Relationship note saved'));
  for (const width of [1440, 1024, 768, 390, 320]) {
    await setViewport(page, width, 480);
    for (const motion of ['no-preference', 'reduce']) {
      await page.send('Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-reduced-motion', value: motion }],
      });
      await go('/');
      await wait(has('Most recently worked with'));
      await capture(`active-${motion}`, width);
    }
    await page.evaluate("sessionStorage.setItem('client-read-fault','1')");
    await go('/');
    await wait(has('This screen hit a problem.'));
    await capture('error', width);
    await page.evaluate("sessionStorage.removeItem('client-read-fault')");
    await click(page, 'Try again');
    await wait(has('Most recently worked with'));
    await page.evaluate("sessionStorage.setItem('client-read-delay','1')");
    await go('/');
    await wait(has('Reading your progress'));
    await capture('loading', width);
    await page.evaluate("sessionStorage.removeItem('client-read-delay')");
    await wait(has('Most recently worked with'));
    // Reach the new destination through actual Tab navigation; no element.focus().
    for (let n = 0; n < 100; n++) {
      if (
        await page.evaluate(
          "document.activeElement?.getAttribute('href') === '/clients/CL-glowhaus-medspa'",
        )
      )
        break;
      await page.send('Input.dispatchKeyEvent', {
        type: 'keyDown',
        key: 'Tab',
        code: 'Tab',
        windowsVirtualKeyCode: 9,
      });
      await page.send('Input.dispatchKeyEvent', {
        type: 'keyUp',
        key: 'Tab',
        code: 'Tab',
        windowsVirtualKeyCode: 9,
      });
    }
    assert(
      await page.evaluate(
        "document.activeElement?.getAttribute('href') === '/clients/CL-glowhaus-medspa' && document.activeElement.matches(':focus-visible')",
      ),
    );
    if (width < 768) {
      const box = await page.evaluate(
        '(()=>{const r=document.activeElement.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()',
      );
      await sleep(100);
      await page.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [box] });
      await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else {
      await page.send('Input.dispatchKeyEvent', {
        type: 'keyDown',
        key: 'Enter',
        code: 'Enter',
        text: '\r',
      });
      await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter' });
    }
    await wait(has('Your training relationship'));
    report.states.push({ state: 'destination-keyboard-touch', width, height: 480 });
  }
} finally {
  await close();
}
writeFileSync(resolve(out, 'home-probe.json'), JSON.stringify(report, null, 2) + '\n');
console.log(
  `PASS Home: ${report.states.length} states including five short widths, local work, recovery and input.`,
);
