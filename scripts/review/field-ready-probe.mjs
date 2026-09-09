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
  for (const width of [1440, 1024, 768, 390, 320]) {
    await setViewport(page, width, 1000);
    await openPage(page, `${base}/campaign`);
    assert(
      await waitFor(page, "document.querySelectorAll('a[href*=placement]').length===8"),
      'Eight placement links',
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
    'Real numeric placement submission and reload',
    'Reduced-motion preference enabled',
  );
} finally {
  writeFileSync(resolve(out, 'report.json'), JSON.stringify(report, null, 2));
  await close();
}
