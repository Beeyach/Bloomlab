import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { session, openPage, setViewport, screenshot, sleep } from './cdp.mjs';
import { probeHelpers } from './probe-lib.mjs';

const base = process.env.BASE ?? 'http://127.0.0.1:4183';
const out = resolve(process.env.REVIEW_OUT ?? '.review/remediation/keyboard');
mkdirSync(out, { recursive: true });
const bundle = JSON.parse(readFileSync('.content/bundle.json', 'utf8'));
const exercise = bundle.exercises.find((e) => e.id === 'EX-WHAT_WOULD_YOU_BUILD-connect-webhooks');
const report = { head: process.env.REVIEW_HEAD ?? 'working-tree', base, flows: [] };
for (const width of [1440, 390]) {
  const { page, close } = await session();
  const { waitFor } = probeHelpers({ base });
  const wait = async (condition) =>
    assert(await waitFor(page, `Boolean(${condition})`, 160), condition);
  const key = async (key, code = key) => {
    await page.send('Input.dispatchKeyEvent', {
      type: 'keyDown',
      key,
      code,
      windowsVirtualKeyCode: key === 'Tab' ? 9 : key === 'Enter' ? 13 : 0,
      ...(key === 'Enter' ? { text: '\r' } : {}),
    });
    await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code });
    await sleep(key === 'Enter' ? 400 : 35);
  };
  async function focus(selector) {
    for (let i = 0; i < 180; i++) {
      if (await page.evaluate(`document.activeElement?.matches(${JSON.stringify(selector)})`)) {
        const ring = await page.evaluate(
          `(() => {const e=document.activeElement,s=getComputedStyle(e);return e.matches(':focus-visible') && s.outlineStyle!=='none' && parseFloat(s.outlineWidth)>=2})()`,
        );
        if (!ring)
          console.error(
            await page.evaluate(
              `(() => {const e=document.activeElement,s=getComputedStyle(e);return {path:location.pathname,width:innerWidth,tag:e.outerHTML.slice(0,350),visible:e.matches(':focus-visible'),outline:s.outline,shadow:s.boxShadow}})()`,
            ),
          );
        assert(ring, `visible focus: ${selector}`);
        return;
      }
      await key('Tab');
    }
    console.error(
      await page.evaluate(`(() => ({path:location.pathname,width:innerWidth,
      active:document.activeElement?.outerHTML?.slice(0,500),
      dialogs:[...document.querySelectorAll('dialog[open]')].map(e=>e.getAttribute('aria-label')),
      matches:[...document.querySelectorAll(${JSON.stringify(selector)})].map(e=>({text:e.textContent,rects:e.getClientRects().length}))}))()`),
    );
    await screenshot(page, resolve(out, `${width}-failed-focus.png`));
    assert.fail(`Unreachable by Tab: ${selector}`);
  }
  async function navigate(path) {
    const selector = `nav a[href="${path}"]`;
    if (
      !(await page.evaluate(
        `!![...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>e.getClientRects().length)`,
      ))
    ) {
      await focus('[data-testid="rail-more"]');
      await key('Enter');
    }
    await focus(selector);
    await key('Enter');
    await wait(`location.pathname===${JSON.stringify(path)}`);
    await wait("document.querySelector('main h1')");
  }
  try {
    await page.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `
      const transport=window.fetch.bind(window);
      window.fetch=(input,init)=>{
        const url=new URL(typeof input==='string'?input:input.url,location.href);
        if(url.origin!==location.origin || /^\\/api\\/(ai|calls|voice)/.test(url.pathname))
          return Promise.resolve(Response.json({error:'Provider routes disabled for keyboard review'},{status:503}));
        return transport(input,init);
      };`,
    });
    await setViewport(page, width, 480);
    await page.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
    });
    await openPage(page, base + '/');
    await wait("document.querySelector('#session-title')");
    if (process.env.REVIEW_HEAD) {
      assert.equal(
        (await (await fetch(base + '/api/health')).json()).build_id,
        process.env.REVIEW_HEAD,
      );
      assert.equal(
        await page.evaluate(
          "document.querySelector('[data-build-id]')?.getAttribute('data-build-id')",
        ),
        process.env.REVIEW_HEAD,
      );
    }
    await focus('section[aria-labelledby="session-title"] button');
    await key('Enter');
    await wait("document.querySelector('[data-testid=session-plan] a')");
    await focus('[data-testid="session-plan"] a');
    await key('Enter');
    await wait(
      "location.pathname.startsWith('/academy/') || location.pathname.startsWith('/exercise/')",
    );
    await wait("document.querySelector('main h1')");
    report.flows.push({
      width,
      flow: 'build-session-open-first-item',
      path: await page.evaluate('location.pathname'),
    });
    await navigate('/search');
    await focus('main input[type="search"]');
    await page.send('Input.insertText', { text: exercise.title });
    await wait(`document.querySelector('main a[href="/exercise/${exercise.id}"]')`);
    await focus(`main a[href="/exercise/${exercise.id}"]`);
    await key('Enter');
    await wait("document.querySelector('main textarea')");
    for (const check of exercise.fixture_checks) {
      await focus(`[data-testid="write-${check.field}"]`);
      await page.send('Input.insertText', { text: check.expected_json });
    }
    await focus('section[aria-labelledby="submit-title"] button');
    await key('Enter');
    await wait("document.querySelector('[data-outcome=passed]')");
    await screenshot(page, resolve(out, `${width}-keyboard-result.png`));
    report.flows.push({ width, flow: 'search-open-write-submit-real-deterministic-pass' });
    for (const path of [
      '/workflow',
      '/crm',
      '/funnel',
      '/calendar',
      '/conversations',
      '/reporting',
      '/payments',
      '/incident',
      '/playground',
    ]) {
      await navigate(path);
      await wait(
        "document.querySelector('main button:not(:disabled), main a, main input, main select')",
      );
      await focus('main button:not(:disabled), main a, main input, main select');
      assert(await page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'));
      report.flows.push({ width, flow: 'navigate-lab-reach-control', path });
    }
  } finally {
    await close();
  }
}
writeFileSync(resolve(out, 'keyboard-probe.json'), JSON.stringify(report, null, 2) + '\n');
console.log(
  `PASS keyboard-only: ${report.flows.length} flows. No scripted focus/click or provider calls.`,
);
