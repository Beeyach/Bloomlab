// Presentation verification only. Completed Field Ready / Holo records are explicitly controlled
// fixtures, never human acceptance. Exercise pass/failure comes from the real AI-Off local runner.
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { session, openPage, setViewport, screenshot, sleep } from './cdp.mjs';
import { probeHelpers } from './probe-lib.mjs';
import { fieldworkFixtures } from './fieldwork-fixtures.mjs';
import { seedFieldReady } from './field-ready-fixtures.mjs';

const base = process.env.BASE ?? 'http://127.0.0.1:4183';
const out = resolve(process.env.REVIEW_OUT ?? '.review/phase-26-moments');
const bundle = JSON.parse(readFileSync('.content/bundle.json', 'utf8'));
const exercise = bundle.exercises.find((e) => e.advanced_topics.includes('connect.webhooks'));
const { page, close } = await session();
const { waitFor, click, typeInto } = probeHelpers({ base });
const report = { head: process.env.REVIEW_HEAD ?? null, base, cases: [], sound: {}, holo: {} };
mkdirSync(out, { recursive: true });
const wait = async (expression) => assert(await waitFor(page, expression), expression);
const go = async (path) => {
  await openPage(page, base + path);
};
const mode = (reduced) =>
  page.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: reduced ? 'reduce' : 'no-preference' }],
  });
async function capture(name, width) {
  await page.evaluate(
    `document.querySelector('[data-signature]')?.scrollIntoView({block:'start',behavior:'instant'})`,
  );
  const layout = await page.evaluate(
    `({ scroll: document.documentElement.scrollWidth, width: innerWidth, sound: document.querySelector('[aria-label="Sound cues"]')?.getBoundingClientRect().height })`,
  );
  assert(layout.scroll <= width + 1, name + ' overflow');
  assert(layout.sound >= 44, 'Sound toggle target');
  await screenshot(page, resolve(out, name + '-' + width + '.png'), undefined, false);
  report.cases.push({ name, ...layout });
}
try {
  await page.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `(${fieldworkFixtures.toString()})(false,'');`,
  });
  await go('/settings/ai');
  await wait('!!document.querySelector("main select")');
  await page.evaluate(
    `(() => { const el = document.querySelector('main select'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(el,'Off'); el.dispatchEvent(new Event('change',{bubbles:true})); })()`,
  );
  await wait(
    `document.querySelector('[aria-label="Sound cues"]')?.getAttribute('aria-pressed') === 'false'`,
  );
  await click(page, '[aria-label="Sound cues"]');
  await wait(`localStorage.getItem('bloomlab.sound.v1') === 'on'`);
  await go('/clients');
  await wait(
    `document.querySelector('[aria-label="Sound cues"]')?.getAttribute('aria-pressed') === 'true'`,
  );
  await click(page, '[aria-label="Sound cues"]');
  report.sound = {
    defaultsOff: true,
    explicitEnable: true,
    persistsOnNavigation: true,
    mute: true,
  };
  // A denied AudioContext does not affect a real exercise's grading/saving/navigation.
  await page.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `window.AudioContext = class { constructor() { throw new Error('Controlled audio denial'); } };`,
  });
  for (const width of [1440, 1024, 768, 390, 320]) {
    await setViewport(page, width, 600);
    await mode(false);
    await go('/clients/CL-glowhaus-medspa');
    await wait('!!document.querySelector("[data-signature=client-case]")');
    await capture('client-case', width);
    await go('/exercise/' + exercise.id);
    if (
      await waitFor(
        page,
        `[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Try again')`,
        3,
      )
    )
      await click(page, 'Try again');
    await wait('!!document.querySelector("textarea")');
    for (const check of exercise.fixture_checks)
      await typeInto(page, '[data-testid="write-' + check.field + '"]', 'null');
    await click(page, 'Run it');
    await wait('!!document.querySelector("[data-outcome=failed]")');
    assert(
      await page.evaluate(
        '!!document.querySelector("[data-signature=failed-test][data-motion=enabled]")',
      ),
    );
    await capture('failed-test', width);
    await click(page, 'Try again');
    await wait('!!document.querySelector("textarea")');
    for (const check of exercise.fixture_checks)
      await typeInto(page, '[data-testid="write-' + check.field + '"]', check.expected_json);
    await click(page, '[aria-label="Sound cues"]');
    await click(page, 'Run it');
    await wait('!!document.querySelector("[data-outcome=passed]")');
    await wait(
      `!!document.querySelector('[data-signature="independent-pass"][data-motion="enabled"]')`,
    );
    await capture('independent-pass', width);
    if (width === 1440) {
      await mode(true);
      await wait(
        `![...document.querySelectorAll('button')].some(b=>b.textContent==='Skip recognition')`,
      );
    } else if (width === 320) {
      await click(page, 'Skip recognition');
    }
    await click(page, '[aria-label="Sound cues"]');
    await page.send('Page.reload');
    await wait('!!document.querySelector("[data-outcome=passed]")');
    assert(
      await page.evaluate(
        '!!document.querySelector("[data-signature=independent-pass][data-motion=static]")',
      ),
      'Saved result must not celebrate again',
    );
    await go('/field-ready');
    await wait(`document.body.textContent.includes('Your Field Ready evidence')`);
    assert(
      await page.evaluate(
        '!!document.querySelector("[data-signature=field-ready][data-motion=static]")',
      ),
    );
    await capture('incomplete-field-ready', width);
  }
  await page.evaluate(`(${seedFieldReady.toString()})(${JSON.stringify(bundle)},true)`);
  for (const width of [1440, 1024, 768, 390, 320]) {
    for (const reduced of [false, true]) {
      await mode(reduced);
      await setViewport(page, width, 480);
      await go('/field-ready');
      await wait(`document.body.textContent.includes('Field Ready certificate')`);
      assert(
        await page.evaluate(
          `document.body.textContent.includes('No real client outcome is certified')`,
        ),
      );
      if (reduced)
        assert(
          await page.evaluate(
            `![...document.querySelectorAll('button')].some(b=>b.textContent==='Skip recognition')`,
          ),
        );
      await capture('controlled-certificate-' + (reduced ? 'reduced' : 'normal'), width);
    }
  }
  await mode(false);
  await setViewport(page, 1024, 600);
  await go('/skills');
  await wait(`!!document.querySelector('[data-skill] [data-variant]')`);
  await page.evaluate(
    `document.querySelector('[data-skill] [data-variant]').scrollIntoView({block:'center',behavior:'instant'})`,
  );
  // IntersectionObserver marks the previously off-screen card visible on the next frame.
  await sleep(200);
  const point = await page.evaluate(
    `(() => { const e=document.querySelector('[data-skill] [data-variant]'); e.scrollIntoView({block:'center'}); window.__momentHolo=e; const r=e.getBoundingClientRect(); return {x:r.x+r.width*.85,y:r.y+r.height*.2}; })()`,
  );
  await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
  await wait(`window.__momentHolo.dataset.tracking === 'true'`);
  await mode(true);
  await wait(
    `!window.__momentHolo.dataset.tracking && window.__momentHolo.style.getPropertyValue('--holo-lift') === '0.000'`,
  );
  report.holo.liveReducedMotion = true;
  await mode(false);
  await page.evaluate('new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))');
  await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x + 2, y: point.y });
  await wait(`window.__momentHolo.dataset.tracking === 'true'`);
  await page.evaluate('scrollTo(0,0)');
  await wait(`!window.__momentHolo.dataset.tracking`);
  await sleep(200);
  report.holo.offscreenNeutral = await page.evaluate(
    `window.__momentHolo.style.getPropertyValue('--holo-lift') === '0.000'`,
  );
  assert(report.holo.offscreenNeutral);
  if (report.head) {
    report.health = await (await fetch(base + '/api/health')).json();
    assert.equal(report.health.build_id, report.head);
    assert.equal(
      await page.evaluate("document.querySelector('[data-build-id]')?.dataset.buildId"),
      report.head,
    );
  }
  report.status = 'PASSED';
  console.log(
    'Signature moments: 30 width states, real failed/pass + static history, controlled Field Ready, sound denial, live Holo reduced/offscreen PASS',
  );
} catch (error) {
  report.status = 'FAILED';
  report.error = String(error);
  report.page = await page.evaluate('document.querySelector("main")?.innerText');
  throw error;
} finally {
  writeFileSync(resolve(out, 'moments-probe.json'), JSON.stringify(report, null, 2));
  await close();
}
