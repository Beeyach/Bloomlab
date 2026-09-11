// Five-width route-family sweep. DOM assertions plus screenshots; not a subjective design or
// physical-device certification. State-specific controlled probes complement this initial-state map.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { session, openPage, setViewport, screenshot, sleep } from './cdp.mjs';
import { probeHelpers } from './probe-lib.mjs';
import { REQUIRED_WIDTHS, SCREEN_INVENTORY } from './screen-matrix.mjs';
const base = process.env.BASE ?? 'http://127.0.0.1:4183';
const out = resolve(process.env.REVIEW_OUT ?? '.review/phase-26-polish');
mkdirSync(out, { recursive: true });
const { page, close } = await session();
const { waitFor } = probeHelpers({ base });
const report = {
  base,
  head: process.env.REVIEW_HEAD ?? null,
  inventory: 'router/content-derived',
  requiredWidths: REQUIRED_WIDTHS,
  screens: [],
  failures: [],
};
try {
  if (report.head) {
    report.health = await (await fetch(base + '/api/health')).json();
    assert.equal(report.health.build_id, report.head);
  }
  for (const width of REQUIRED_WIDTHS) {
    await setViewport(page, width, 800);
    for (const { name, path, family, route_id: routeId } of SCREEN_INVENTORY) {
      await page.send('Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }],
      });
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
        const main = document.querySelector('main');
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
        const headings = [...document.querySelectorAll('main h1, main h2, main h3')].filter(visible);
        const painted = [...document.querySelectorAll('main *')].filter(visible);
        const gradientText = painted.filter(e => {
          const style=getComputedStyle(e);
          return style.backgroundImage.includes('gradient') && (style.backgroundClip==='text' || style.webkitBackgroundClip==='text');
        }).map(name);
        const giantGradientHero = [...document.querySelectorAll('main > header, main > section > header')].filter(visible).filter(e => {
          const style=getComputedStyle(e), rect=e.getBoundingClientRect();
          return style.backgroundImage.includes('gradient') && rect.height > innerHeight * .45;
        }).map(name);
        const emojiNavigation = [...document.querySelectorAll('nav a, nav button, aside a, aside button')].filter(visible).filter(e=>/\\p{Extended_Pictographic}/u.test(e.textContent ?? '')).map(name);
        const genericArt = [...document.querySelectorAll('main img')].filter(visible).filter(e=>/(rocket|trophy|confetti|stock saas|generic ai|ai avatar)/i.test((e.alt??'')+' '+(e.src??''))).map(name);
        const randomBlobs = painted.filter(e=>/(^|[-_])(blob|orb)([-_]|$)/i.test((e.id??'')+' '+(e.className??''))).map(name);
        const iconHeadings = headings.filter(e=>e.querySelector('svg,img')).length;
        const rounded = controls.filter(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return r.height>0&&parseFloat(s.borderRadius)>=r.height/2-1}).length;
        const surfaces=[...document.querySelectorAll('main section, main article')].filter(visible);
        const glass = surfaces.filter(e=>getComputedStyle(e).backdropFilter!=='none').length;
        const words=(main?.innerText??'').trim().split(/\\s+/).filter(Boolean).length;
        const area=Math.max(1,(main?.getBoundingClientRect().width??innerWidth)*(main?.getBoundingClientRect().height??innerHeight));
        return {
          title: document.querySelector('main h1')?.textContent,
          width: innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
          small,
          smallFont: fields.filter(e=>!e.matches('[type=radio],[type=checkbox]')&&parseFloat(getComputedStyle(e).fontSize)<16).map(name),
          mono,
          eyebrows,
          controls: controls.length,
          density: { words, headings: headings.length, sections: surfaces.length, controls: controls.length, unitsPer100kPx: Number((((words + headings.length*8 + controls.length*12) / area)*100000).toFixed(2)) },
          prohibitedSignals: {
            gradientText,
            giantGradientHero,
            emojiNavigation,
            genericArt,
            randomBlobs,
            iconBesideEveryHeading: headings.length >= 3 && iconHeadings === headings.length,
            glassEverywhere: surfaces.length >= 5 && glass / surfaces.length > .8,
            excessivePills: controls.length >= 8 && rounded / controls.length > .8,
            genericWelcomeBack: /\\bwelcome back\\b/i.test(main?.innerText??''),
          }
        };
      })()`);
      const failures = [];
      if (measured.scrollWidth > width + 1) failures.push('page horizontal overflow');
      if (width < 768 && measured.small.length) failures.push('small touch targets');
      if (width < 768 && measured.smallFont.length) failures.push('input text below 16 px');
      if (measured.mono.length) failures.push('user-facing monospace');
      if (measured.eyebrows.length) failures.push('small uppercase eyebrow');
      for (const [signal, value] of Object.entries(measured.prohibitedSignals))
        if (Array.isArray(value) ? value.length > 0 : value)
          failures.push(`§70 prohibited signal: ${signal}`);
      let reducedMotion = null;
      if (width === 390) {
        await page.send('Emulation.setEmulatedMedia', {
          features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
        });
        await page.evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
        reducedMotion = await page.evaluate(`(() => {
          const visible=e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden';
          const animations=document.getAnimations().filter(a=>a.effect?.target&&visible(a.effect.target));
          return { checked:true, visibleAnimations:animations.length, infinite:animations.filter(a=>a.effect.getTiming().iterations===Infinity).map(a=>a.effect.target?.className||a.effect.target?.tagName) };
        })()`);
        if (reducedMotion.infinite.length)
          failures.push('infinite visible animation under reduced motion');
      }
      report.screens.push({ name, path, family, routeId, ...measured, reducedMotion, failures });
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
  report.failureContext = await page
    .evaluate(
      `(() => ({
    path: location.pathname, width: innerWidth, title: document.querySelector('main h1')?.textContent,
    status: [...document.querySelectorAll('[role=status]')].map(e=>e.textContent.trim()),
    alerts: [...document.querySelectorAll('[role=alert]')].map(e=>e.textContent.trim()),
    main: document.querySelector('main')?.innerText.slice(0,2000),
  }))()`,
    )
    .catch((error) => ({ diagnosticError: String(error) }));
  await screenshot(page, resolve(out, 'failed-screen.png'), undefined, false).catch(() => {});
  throw error;
} finally {
  writeFileSync(resolve(out, 'polish-probe.json'), JSON.stringify(report, null, 2));
  await close();
}
