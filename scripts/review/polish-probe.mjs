// Five-width route-family sweep. DOM assertions plus screenshots; not a subjective design or
// physical-device certification. State-specific controlled probes complement this initial-state map.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { session, openPage, setViewport, screenshot, sleep } from './cdp.mjs';
import { probeHelpers } from './probe-lib.mjs';
import { SCREEN_MATRIX } from './screen-matrix.mjs';
const base = process.env.BASE ?? 'http://127.0.0.1:4183';
const out = resolve(process.env.REVIEW_OUT ?? '.review/phase-26-polish');
mkdirSync(out, { recursive: true });
const { page, close } = await session();
const { waitFor } = probeHelpers({ base });
const report = { base, head: process.env.REVIEW_HEAD ?? null, screens: [], failures: [] };
try {
  if (report.head) {
    report.health = await (await fetch(base + '/api/health')).json();
    assert.equal(report.health.build_id, report.head);
  }
  for (const width of [1440, 1024, 768, 390, 320]) {
    await setViewport(page, width, 800);
    for (const [name, path] of SCREEN_MATRIX) {
      await openPage(page, base + path);
      assert(
        await waitFor(
          page,
          `!!document.querySelector('main h1') && ![...document.querySelectorAll('[role=status]')].some(e=>/^(Loading|Opening the unit|Opening saved|Reading saved)/.test(e.textContent.trim()))`,
        ),
        name + ' not ready',
      );
      await page.evaluate(
        `Promise.all(document.getAnimations().filter(a=>a.effect?.getTiming().iterations !== Infinity).map(a=>a.finished.catch(()=>null)))`,
      );
      await sleep(100);
      if (report.head)
        assert.equal(
          await page.evaluate("document.querySelector('[data-build-id]')?.dataset.buildId"),
          report.head,
        );
      const measured = await page.evaluate(`(() => {
        const visible = e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden';
        const name = e => (e.getAttribute('aria-label') || e.textContent || e.name || e.tagName).trim().slice(0,65);
        const controls = [...document.querySelectorAll('main button, main input, main select, main textarea, [aria-label="Sound cues"]')].filter(visible);
        const fields = controls.filter(e=>['INPUT','SELECT','TEXTAREA'].includes(e.tagName));
        // Native associated labels activate checkboxes/radios even when they are siblings.
        // Measure an actual labelled hit area, not just the small visual check glyph.
        const target = e => e.matches('input[type=checkbox],input[type=radio]')
          ? [...e.labels].filter(visible).sort((a,b)=>b.getBoundingClientRect().height-a.getBoundingClientRect().height)[0] || e
          : e;
        const small = controls.map(target).filter(e=>{const r=e.getBoundingClientRect(); return r.height < 43.5 || r.width < 43.5;}).map(name);
        const mono = [...document.querySelectorAll('main *')].filter(e => visible(e) && [...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim()) && getComputedStyle(e).fontFamily.includes('monospace')).map(name);
        const eyebrows = [...document.querySelectorAll('main *')].filter(e => visible(e) && [...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim()) && getComputedStyle(e).textTransform === 'uppercase' && parseFloat(getComputedStyle(e).fontSize) < 13).map(name);
        return { title: document.querySelector('main h1')?.textContent, width: innerWidth, scrollWidth: document.documentElement.scrollWidth, small, smallFont: fields.filter(e=>!e.matches('[type=radio],[type=checkbox]')&&parseFloat(getComputedStyle(e).fontSize)<16).map(name), mono, eyebrows, controls: controls.length };
      })()`);
      const failures = [];
      if (measured.scrollWidth > width + 1) failures.push('page horizontal overflow');
      if (width < 768 && measured.small.length) failures.push('small touch targets');
      if (width < 768 && measured.smallFont.length) failures.push('input text below 16 px');
      if (measured.mono.length) failures.push('user-facing monospace');
      if (measured.eyebrows.length) failures.push('small uppercase eyebrow');
      report.screens.push({ name, path, ...measured, failures });
      report.failures.push(...failures.map((failure) => ({ name, width, failure })));
      await screenshot(page, resolve(out, name + '-' + width + '.png'), undefined, false);
      console.log(
        JSON.stringify({ name, width, failures, small: measured.small, mono: measured.mono }),
      );
    }
  }
  report.status = report.failures.length ? 'FAILED' : 'PASSED';
  assert.equal(report.failures.length, 0, JSON.stringify(report.failures));
} catch (error) {
  report.status = 'FAILED';
  report.error = String(error);
  throw error;
} finally {
  writeFileSync(resolve(out, 'polish-probe.json'), JSON.stringify(report, null, 2));
  await close();
}
