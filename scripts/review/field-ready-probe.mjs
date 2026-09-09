import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { session, openPage, setViewport, screenshot } from './cdp.mjs';
import { probeHelpers } from './probe-lib.mjs';
const base = process.env.BASE ?? 'http://127.0.0.1:5174';
const out = resolve(process.env.REVIEW_OUT ?? '.review/phase-24-field-ready');
mkdirSync(out, { recursive: true });
const { page, close } = await session();
const { waitFor } = probeHelpers({ base });
const report = { head: process.env.REVIEW_HEAD ?? 'working-tree', base, widths: [], checks: [] };
try {
  if (process.env.REVIEW_HEAD) {
    report.health = await (await fetch(base + '/api/health')).json();
    assert.equal(report.health.build_id, process.env.REVIEW_HEAD);
  }
  for (const width of [1440, 1024, 768, 390, 320]) {
    await setViewport(page, width, 1000);
    await openPage(page, `${base}/campaign`);
    assert(
      await waitFor(page, "document.querySelectorAll('a[href*=placement]').length===8"),
      'Eight placement links',
    );
    if (process.env.REVIEW_HEAD)
      assert.equal(
        await page.evaluate(
          "document.querySelector('[data-build-id]')?.getAttribute('data-build-id')",
        ),
        process.env.REVIEW_HEAD,
      );
    const check = await page.evaluate(
      `(()=>{const links=[...document.querySelectorAll('a[href*=placement]')];return {overflow:document.documentElement.scrollWidth>innerWidth,links:links.length,minTarget:Math.min(...links.map(e=>e.getBoundingClientRect().height)),monospace:[...document.querySelectorAll('main *')].some(e=>getComputedStyle(e).fontFamily.includes('monospace'))};})()`,
    );
    assert(!check.overflow, `Campaign overflow ${width}`);
    assert(check.minTarget >= 40, `Placement targets ${width}`);
    assert(!check.monospace);
    await screenshot(
      page,
      resolve(out, `placement-${width}.png`),
      { x: 0, y: 0, width, height: 1000 },
      false,
    );
    await openPage(page, `${base}/exercise/EX-WHAT_WOULD_YOU_BUILD-qa-release`);
    assert(
      await waitFor(page, "document.querySelectorAll('select').length===20"),
      'Nineteen QA statuses and release decision',
    );
    assert(
      await page.evaluate('document.documentElement.scrollWidth<=innerWidth'),
      `QA overflow ${width}`,
    );
    await screenshot(
      page,
      resolve(out, `qa-${width}.png`),
      { x: 0, y: 0, width, height: 1000 },
      false,
    );
    for (const [name, path] of [
      ['delivery-order', '/exercise/EX-ARCHITECTURE_DECISION-delivery-sequence'],
      ['onboarding', '/exercise/EX-WRITE_IT-glowhaus-onboarding'],
      ['handoff', '/exercise/EX-WRITE_IT-glowhaus-handoff'],
      ['scope-change', '/exercise/EX-WRITE_IT-glowhaus-scope-change'],
      ['independent-copy', '/exercise/EX-WRITE_IT-consultation-copy'],
      ['capstone-defense', '/exercise/EX-ARCHITECTURE_DECISION-capstone-defense'],
      ['core-fieldwork', '/exercise/EX-FIELDWORK-field-ready-core'],
      ['customer-path-unit', '/academy/LU-customer-path'],
    ]) {
      await openPage(page, base + path);
      assert(
        await waitFor(
          page,
          "document.querySelector('main h1') && !document.body.textContent.includes('Opening exercise')",
        ),
      );
      assert(
        await waitFor(
          page,
          name === 'customer-path-unit'
            ? "document.body.textContent.includes('Finish this unit')"
            : "Boolean(document.querySelector('main textarea,main fieldset,main button'))",
        ),
      );
      const state = await page.evaluate(
        `(()=>{const fields=[...document.querySelectorAll('main textarea,main select,main input:not([type=checkbox]):not([type=radio])')].filter(e=>e.getClientRects().length);return {overflow:document.documentElement.scrollWidth>innerWidth+1,smallInput:fields.some(e=>parseFloat(getComputedStyle(e).fontSize)<16),smallButton:[...document.querySelectorAll('button[aria-label^=Move]')].some(e=>e.getBoundingClientRect().height<44)};})()`,
      );
      assert(
        !state.overflow && !state.smallInput && !state.smallButton,
        `${name} at ${width}: ${JSON.stringify(state)}`,
      );
      if (['independent-copy', 'capstone-defense'].includes(name))
        assert(
          await page.evaluate(
            "![...document.querySelectorAll('button')].some(e=>/draft|generate|nudge|worked example/i.test(e.textContent))",
          ),
          'No automatic drafting or hint controls',
        );
      await screenshot(
        page,
        resolve(out, `${name}-${width}.png`),
        { x: 0, y: 0, width, height: 1000 },
        false,
      );
      if (name === 'delivery-order') {
        const before = await page.evaluate("document.querySelector('fieldset ol h3').textContent");
        await page.evaluate(
          "[...document.querySelectorAll('button[aria-label$=earlier]')].find(b=>!b.disabled).focus()",
        );
        await page.send('Input.dispatchKeyEvent', {
          type: 'keyDown',
          key: 'Enter',
          code: 'Enter',
          text: '\r',
        });
        await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter' });
        assert(
          await waitFor(
            page,
            `document.querySelector('fieldset ol h3').textContent!==${JSON.stringify(before)}`,
          ),
        );
        const after = await page.evaluate("document.querySelector('fieldset ol h3').textContent");
        await page.send('Page.reload');
        assert(
          await waitFor(
            page,
            `document.querySelector('fieldset ol h3')?.textContent===${JSON.stringify(after)}`,
          ),
          'Keyboard reorder persists',
        );
      }
    }
    report.widths.push({ width, ...check, qaChecks: 19 });
  }
  await page.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  });
  await openPage(page, `${base}/exercise/EX-WHAT_WOULD_YOU_BUILD-placement-funnel`);
  assert(
    await waitFor(
      page,
      "[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Run it')",
    ),
    'Placement runnable',
  );
  await page.evaluate(
    `(()=>{const values={'Average order value':'500','Booking rate':'50','Close rate':'20','Cost per customer':'200','Cost per lead':'10','Show rate':'50'};for(const label of document.querySelectorAll('label')){const input=label.querySelector('input');if(!input)continue;const text=label.querySelector('span')?.textContent.trim();if(!(text in values))continue;Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,values[text]);input.dispatchEvent(new Event('input',{bubbles:true}));}})()`,
  );
  await page.evaluate(
    "[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Run it').click()",
  );
  assert(
    await waitFor(page, "document.body.textContent.includes('Independent — no assistance used')"),
    'Placement passed from real numeric answers',
  );
  await page.send('Page.reload', {});
  assert(
    await waitFor(page, "document.body.textContent.includes('Independent — no assistance used')"),
    'Placement result persists',
  );
  report.checks.push(
    'Eight placement assessments linked',
    'Five widths: campaign and nineteen-area QA',
    'Five widths: delivery order, onboarding, handoff, scope change, independent copy, capstone defense, core Fieldwork and Academy',
    'Keyboard delivery reorder survives reload; 44px controls and 16px form text',
    'Real numeric placement submission and reload',
    'Reduced-motion preference enabled',
  );
} finally {
  writeFileSync(resolve(out, 'report.json'), JSON.stringify(report, null, 2));
  await close();
}
