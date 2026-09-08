// A fresh browser with a real installed service worker and controlled health failures.
// No learner session, microphone or paid provider request is used.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { openPage, screenshot, session, setViewport } from './cdp.mjs';
import { probeHelpers } from './probe-lib.mjs';

const base = process.env.BASE ?? 'http://localhost:4173';
const out = resolve(process.env.REVIEW_OUT ?? '.review/update-check');
mkdirSync(out, { recursive: true });
const { waitFor } = probeHelpers({ base });
const { page, close } = await session();
const report = { base, scope: 'Native Chromium, real service worker, controlled health failures.' };
const notice = "document.querySelector('[data-testid=app-update]')";
const button = `${notice}?.querySelector('button')`;
try {
  await page.send('Page.addScriptToEvaluateOnNewDocument', {
    source:
      "sessionStorage.setItem('update-probe-loads',String(Number(sessionStorage.getItem('update-probe-loads')||0)+1))",
  });
  await setViewport(page, 1440, 900);
  await page.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  });
  await openPage(page, base);
  assert(await waitFor(page, "!!document.querySelector('[data-build-id]')"));
  assert(await waitFor(page, '!!navigator.serviceWorker.controller', 300));
  const build = await page.evaluate("document.querySelector('[data-build-id]').dataset.buildId");
  const health = await page.evaluate("fetch('/api/health',{cache:'no-store'}).then(r=>r.json())");
  assert.equal(health.build_id, build);
  if (process.env.EXPECTED_BUILD) assert.equal(build, process.env.EXPECTED_BUILD);
  const loads = await page.evaluate("sessionStorage.getItem('update-probe-loads')");

  await page.evaluate(`(() => {
    const original = window.fetch.bind(window);
    const probe = window.__updateCheckProbe = { mode: 'fail', requests: 0 };
    window.fetch = async (input, init) => {
      const url = new URL(typeof input === 'string' ? input : input.url ?? input, location.href);
      if (url.pathname !== '/api/health') return original(input, init);
      probe.requests++;
      if (probe.mode === 'fail') return new Response('{}', { status: 503 });
      if (probe.mode === 'hold') await new Promise(resolve => probe.release = resolve);
      return original(input, init);
    };
    window.dispatchEvent(new Event('focus'));
  })()`);
  // Startup may still own the coalesced check. Simulate a later focus once it settles.
  assert(
    await waitFor(
      page,
      "(window.dispatchEvent(new Event('focus')), window.__updateCheckProbe.requests > 0)",
    ),
  );
  assert(await waitFor(page, `${notice}?.textContent.includes('Could not check for updates')`));
  assert.equal(await page.evaluate(`${button}.textContent.trim()`), 'Check for updates');
  assert(
    await page.evaluate(
      `${notice}.querySelector('[role=status]')?.getAttribute('aria-live')==='polite'`,
    ),
  );
  assert.equal(await page.evaluate(`${notice}.textContent.includes('Update available')`), false);
  report.widths = [];
  for (const width of [1440, 1024, 768, 390, 320]) {
    await setViewport(page, width, 900, { mobile: width < 768 });
    const metrics = await page.evaluate(`(() => {
      const el = ${button}, box = el.getBoundingClientRect();
      return { overflow: document.documentElement.scrollWidth > innerWidth + 1,
        width: box.width, height: box.height, disabled: el.disabled };
    })()`);
    assert.equal(metrics.overflow, false);
    assert(metrics.width >= 44 && metrics.height >= 44 && !metrics.disabled);
    await screenshot(page, resolve(out, `update-check-${width}.png`), undefined, false);
    report.widths.push({ viewport: width, ...metrics });
  }

  // A touch retry that still fails must leave a usable recovery action.
  await setViewport(page, 390, 900, { mobile: true });
  const previous = await page.evaluate('window.__updateCheckProbe.requests');
  const point = await page.evaluate(`(() => {
    const el = ${button}; el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect(); return { x: r.x+r.width/2, y: r.y+r.height/2 };
  })()`);
  await page.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
  await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  assert(
    await waitFor(
      page,
      `window.__updateCheckProbe.requests>${previous} && ${button}?.textContent.trim()==='Check for updates'`,
    ),
  );
  assert(await page.evaluate(`${notice}.textContent.includes('Could not check for updates')`));
  report.failed_touch_retry = 'passed';

  // A keyboard retry shows progress and recovers to the current build without a reload.
  await setViewport(page, 1440, 900);
  await page.evaluate(`window.__updateCheckProbe.mode='hold';${button}.focus()`);
  assert(await page.evaluate(`document.activeElement===${button}`));
  await page.send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'Enter',
    code: 'Enter',
    text: '\r',
    windowsVirtualKeyCode: 13,
  });
  await page.send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: 'Enter',
    code: 'Enter',
    windowsVirtualKeyCode: 13,
  });
  assert(
    await waitFor(
      page,
      `${button}?.getAttribute('aria-disabled')==='true' && ${button}?.textContent.trim()==='Checking…'`,
    ),
  );
  assert(await waitFor(page, "typeof window.__updateCheckProbe.release==='function'"));
  await page.evaluate("window.__updateCheckProbe.mode='pass';window.__updateCheckProbe.release()");
  assert(await waitFor(page, `!${notice}`));
  assert.equal(await page.evaluate("sessionStorage.getItem('update-probe-loads')"), loads);
  assert.equal(
    await page.evaluate("document.querySelector('[data-build-id]').dataset.buildId"),
    build,
  );
  report.browser_build = build;
  report.worker_build = health.build_id;
  report.keyboard_retry = 'passed';
  report.reloaded = false;
  report.status = 'passed';
} catch (error) {
  report.status = 'failed';
  report.error = String(error);
  report.failure_state = await page
    .evaluate(
      `({ notice: ${notice}?.textContent,
      button: ${button}?.outerHTML, requests: window.__updateCheckProbe?.requests,
      mode: window.__updateCheckProbe?.mode })`,
    )
    .catch(() => null);
  await screenshot(page, resolve(out, 'failure.png'), undefined, false).catch(() => {});
  throw error;
} finally {
  report.finished_at = new Date().toISOString();
  writeFileSync(resolve(out, 'update-check-probe.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  await close();
}
