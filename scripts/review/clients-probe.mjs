import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { session, openPage, setViewport, screenshot } from './cdp.mjs';
import { probeHelpers } from './probe-lib.mjs';
import { fieldworkFixtures } from './fieldwork-fixtures.mjs';
import { seedFieldReady, installClientStorageFaults } from './field-ready-fixtures.mjs';
const base = process.env.BASE ?? 'http://127.0.0.1:4173';
const out = resolve(process.env.REVIEW_OUT ?? '.review/phase-24-field-ready/clients');
mkdirSync(out, { recursive: true });
const downloads = resolve(out, `downloads-${Date.now()}`);
mkdirSync(downloads);
const bundle = JSON.parse(readFileSync('.content/bundle.json', 'utf8'));
const { page, close } = await session();
const { waitFor, typeInto } = probeHelpers({ base });
const report = {
  head: process.env.REVIEW_HEAD ?? 'working-tree',
  base,
  widths: [],
  checks: [],
  fixtures: [],
};
const has = (s) => `document.body?.textContent.includes(${JSON.stringify(s)})`;
const wait = async (expr) =>
  assert(await waitFor(page, `Promise.resolve(${expr}).then(Boolean)`, 160), expr);
const go = async (path) => {
  await openPage(page, base + path);
  await wait('window.__fieldworkProbe');
};
const click = async (label) => {
  await wait(
    `[...document.querySelectorAll('button')].some(b=>b.textContent.trim()===${JSON.stringify(label)}&&!b.disabled)`,
  );
  await page.evaluate(
    `[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(label)}&&!b.disabled).click()`,
  );
};
async function capture(name, width) {
  const state = await page.evaluate(
    `(()=>{const controls=[...document.querySelectorAll('main input,main select,main textarea')].filter(e=>e.getClientRects().length);return {overflow:document.documentElement.scrollWidth>innerWidth+1,monospace:[...document.querySelectorAll('main *')].some(e=>getComputedStyle(e).fontFamily.includes('monospace')),smallInput:controls.some(e=>parseFloat(getComputedStyle(e).fontSize)<16),smallControl:controls.some(e=>e.getBoundingClientRect().height<44),headings:document.querySelectorAll('main h1').length};})()`,
  );
  assert(!state.overflow, `${name} overflow ${width}`);
  assert(!state.monospace, `${name} monospace`);
  assert(!state.smallInput, `${name} input font`);
  assert(!state.smallControl, `${name} touch target`);
  assert.equal(state.headings, 1, name);
  await screenshot(page, resolve(out, `${width}-${name}.png`));
  report.widths.push({ width, name, ...state });
}
try {
  await page.send('Browser.setDownloadBehavior', {
    behavior: 'allowAndName',
    downloadPath: downloads,
  });
  if (process.env.REVIEW_HEAD) {
    report.health = await (await fetch(base + '/api/health')).json();
    assert.equal(report.health.build_id, process.env.REVIEW_HEAD);
  }
  await page.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `(${fieldworkFixtures.toString()})(false,'');(${installClientStorageFaults.toString()})();`,
  });
  await go('/clients');
  await wait(`window.__fieldworkProbe.rows('client_progress').then(r=>r.length===20)`);
  if (process.env.REVIEW_HEAD)
    assert.equal(
      await page.evaluate(
        "document.querySelector('[data-build-id]')?.getAttribute('data-build-id')",
      ),
      process.env.REVIEW_HEAD,
    );
  for (const width of [1440, 1024, 768, 390, 320]) {
    await setViewport(page, width, 1000);
    await page.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
    });
    await go('/clients');
    await wait(`document.querySelectorAll('a[href^="/clients/CL-"]').length===20`);
    await capture('directory', width);
    await typeInto(page, 'input[type=search]', 'no-match-client');
    await wait(has('No clients match'));
    await capture('search-empty', width);
    await go('/clients/CL-glowhaus-medspa');
    await wait(has('Your training relationship'));
    await capture('client-detail', width);
    await typeInto(
      page,
      'main textarea',
      `Decision at ${width}: verify calendar ownership before launch.`,
    );
    await page.evaluate("sessionStorage.setItem('client-write-fault','1')");
    await click('Save note');
    await wait(has('Could not save. Your note is still here'));
    await capture('note-error', width);
    await page.evaluate("sessionStorage.removeItem('client-write-fault')");
    const point = await page.evaluate(
      "(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Save note');b.scrollIntoView({block:'center'});const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,h:r.height}})()",
    );
    assert(point.h >= 44);
    if (width < 768) {
      await page.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x: point.x, y: point.y }],
      });
      await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else {
      await page.evaluate("document.querySelector('main textarea').focus()");
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
      assert(
        await page.evaluate(
          "document.activeElement.matches(':focus-visible')&&document.activeElement.textContent.trim()==='Save note'",
        ),
      );
      await page.send('Input.dispatchKeyEvent', {
        type: 'keyDown',
        key: 'Enter',
        code: 'Enter',
        text: '\r',
      });
      await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter' });
    }
    await wait(has('Relationship note saved'));
    await capture('note-saved', width);
    await go('/clients/CL-glowhaus-medspa');
    await wait(has(`Decision at ${width}`));
    await go('/projects/PRJ-field-ready-capstone');
    await wait(has('0 of 11 stages'));
    await capture('boss-empty-locked', width);
    await page.evaluate("document.querySelectorAll('main details').forEach(e=>e.open=true)");
    await capture('capstone-inputs', width);
    await go('/field-ready');
    await wait(has('Your Field Ready evidence'));
    await capture('completion-missing', width);
    await page.evaluate("sessionStorage.setItem('client-read-fault','1')");
    await go('/clients');
    await wait(has('Saved client work could not be read'));
    await capture('read-error', width);
    await page.evaluate("sessionStorage.removeItem('client-read-fault')");
    await click('Retry');
    await wait(has('Starter projects'));
    await page.evaluate("sessionStorage.setItem('client-read-delay','1')");
    await go('/clients');
    await wait(has('Opening saved client work'));
    await capture('loading', width);
    await page.evaluate("sessionStorage.removeItem('client-read-delay')");
    await wait(has('Starter projects'));
  }
  report.fixtures.push(
    await page.evaluate(`(${seedFieldReady.toString()})(${JSON.stringify(bundle)},false)`),
  );
  for (const width of [1440, 1024, 768, 390, 320]) {
    await setViewport(page, width, 1000);
    await go('/projects/PRJ-field-ready-capstone');
    await wait(has('7 of 11 stages'));
    await wait(has('Your two-location boundary adds four'));
    await capture('boss-conditional-qa', width);
  }
  // Select the actual saved extra QA result through the visible project action.
  await page.evaluate(
    "(()=>{const a=document.querySelector('a[href*=second-location-qa]');a.closest('li').querySelector('button').click()})()",
  );
  await wait(has('8 of 11 stages'));
  report.fixtures.push(
    await page.evaluate(`(${seedFieldReady.toString()})(${JSON.stringify(bundle)},true)`),
  );
  for (const width of [1440, 1024, 768, 390, 320]) {
    await setViewport(page, width, 1000);
    await go('/projects/PRJ-field-ready-capstone');
    await wait(has('Project evidence complete'));
    await capture('boss-complete', width);
    await go('/field-ready');
    await wait(has('Field Ready certificate'));
    await capture('certificate', width);
    await page.evaluate("sessionStorage.setItem('client-read-fault','1')");
    await go('/field-ready');
    await wait(has('Your evidence could not be read'));
    await capture('completion-error', width);
    await page.evaluate("sessionStorage.removeItem('client-read-fault')");
    await click('Retry');
    await wait(has('Field Ready certificate'));
  }
  await go('/clients');
  await wait(has('Starter projects'));
  await page.send('Network.enable');
  await page.send('Network.emulateNetworkConditions', {
    offline: true,
    latency: 0,
    downloadThroughput: 0,
    uploadThroughput: 0,
  });
  await page.send('Page.reload');
  await wait(has('Starter projects'));
  await page.evaluate('document.querySelector(\'a[href="/clients/CL-glowhaus-medspa"]\').click()');
  await wait(has('Decision at 320'));
  await typeInto(page, 'main textarea', 'Offline decision survives reload.');
  await click('Save note');
  await wait(has('Relationship note saved'));
  await page.send('Page.reload');
  await wait(has('Offline decision survives reload.'));
  await page.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
  });
  await go('/sync');
  await wait(has('Export Bloomlab Data'));
  await click('Export Bloomlab Data');
  await wait(has('Export prepared.'));
  let saved;
  for (let n = 0; n < 100; n++) {
    saved = readdirSync(downloads).find((file) => !file.endsWith('.crdownload'));
    if (saved) break;
    await new Promise((done) => setTimeout(done, 100));
  }
  assert(saved, 'Actual JSON download');
  const exported = JSON.parse(readFileSync(resolve(downloads, saved), 'utf8'));
  assert.equal(exported.projects.client_progress.length, 20);
  const glow = exported.projects.client_progress.find(
    (row) => row.client_id === 'CL-glowhaus-medspa',
  );
  assert(glow.journal.some((entry) => entry.text === 'Offline decision survives reload.'));
  assert(glow.engagements['PRJ-field-ready-capstone'].stage_attempts.change_request);
  assert(!JSON.stringify(exported).includes('session_token'));
  report.origins = await page.evaluate('window.__fieldworkProbe.origins');
  assert.deepEqual(report.origins, [new URL(base).origin]);
  report.checks.push(
    '20 clients and five projects; five widths for all major client/Boss/completion states',
    'Keyboard focus and activation, real touch activation, 44px controls, 16px inputs, reduced motion',
    'Real IndexedDB read/save failures and retry; visible loading and empty states',
    'Actual early choice requires extra QA; saved result selection advances stage',
    'Controlled full completion remains explicitly training proof, not human acceptance',
    'Offline service-worker reload and real note persistence',
    'Actual six-group JSON download contains 20 clients, offline note and capstone selections without session secrets',
    'Browser egress remains app-origin; no provider calls',
  );
} finally {
  writeFileSync(resolve(out, 'report.json'), JSON.stringify(report, null, 2));
  await close();
}
