// DATA-009: actual file chooser/preview/confirmation over a disposable learner, never real data.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { session, openPage, setViewport, screenshot } from './cdp.mjs';
import { probeHelpers } from './probe-lib.mjs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:4183';
const OUT = resolve(process.env.REVIEW_OUT ?? '.review/phase-26-restore');
const HEAD = process.env.REVIEW_HEAD;
const { waitFor, click, hasButton } = probeHelpers({ base: BASE });
mkdirSync(OUT, { recursive: true });
const browser = await session();
const { page } = browser;
const results = { base: BASE, head: HEAD ?? null, widths: [] };
const choose = (text) =>
  page.evaluate(`(() => {
  const input = document.querySelector('input[type=file]');
  const files = new DataTransfer(); files.items.add(new File([${JSON.stringify(text)}], 'controlled-backup.json', { type: 'application/json' }));
  input.files = files.files; input.dispatchEvent(new Event('change', { bubbles: true }));
})()`);
const readNotes = () =>
  page.evaluate(`new Promise((resolve, reject) => {
  const request = indexedDB.open('bloomlab'); request.onsuccess = () => {
    const database = request.result, tx = database.transaction('notes'), read = tx.objectStore('notes').getAll();
    read.onsuccess = () => resolve(read.result); tx.oncomplete = () => database.close(); tx.onerror = reject;
  }; request.onerror = reject;
})`);
try {
  await openPage(page, `${BASE}/sync`);
  assert(await waitFor(page, '!!document.querySelector("input[type=file]")'));
  const learner = await page.evaluate(
    `new Promise(resolve => { const request = indexedDB.open('bloomlab'); request.onsuccess = () => { const database = request.result, tx = database.transaction('device'), read = tx.objectStore('device').getAll(); read.onsuccess = () => resolve(read.result[0].learner_id); tx.oncomplete = () => database.close(); }; })`,
  );
  const at = '2026-09-09T12:00:00.000Z';
  const backup = {
    format: 'bloomlab-data',
    schema_version: 1,
    exported_at: at,
    versions: {
      app: '0.1.0',
      content: '2026.09.27',
      content_hash: 'controlled-fixture',
      simulator: '2026.09.23-r1',
      rules: '2026.09.09-r5',
    },
    progress: { skill_progress: [], campaign_progress: [], review_queue: [] },
    evidence: { skill_evidence: [], exercise_attempts: [], private_assets: [] },
    projects: { sim_projects: [], client_progress: [] },
    notes: [
      {
        id: 'phase26-restored-note',
        learner_id: learner,
        device_id: 'original-controlled-device',
        created_at: at,
        updated_at: at,
        revision: 1,
        deleted_at: null,
        body: 'Controlled recovered note',
        target_kind: 'general',
        target_ref: null,
      },
    ],
    simulator_saves: { sim_events: [], sim_snapshots: [] },
    portfolio_metadata: { portfolio_projects: [], portfolio_assets: [] },
  };
  if (HEAD) {
    const health = await (await fetch(`${BASE}/api/health`)).json();
    const browserHead = await page.evaluate('document.documentElement.dataset.buildId');
    assert.equal(health.build_id, HEAD);
    assert.equal(browserHead, HEAD);
    results.identity = { worker: health.build_id, browser: browserHead };
  }
  for (const width of [1440, 1024, 768, 390, 320]) {
    await setViewport(page, width, 480);
    await choose(JSON.stringify(backup));
    assert(await waitFor(page, hasButton('Confirm restore')));
    assert.equal((await readNotes()).length, 0, 'selection is read-only');
    await page.evaluate('document.querySelector("#restore-title").scrollIntoView()');
    const layout = await page.evaluate(
      `(() => { const input = document.querySelector('input[type=file]'); return { width: innerWidth, scroll: document.documentElement.scrollWidth, inputFont: parseFloat(getComputedStyle(input).fontSize), inputHeight: input.getBoundingClientRect().height }; })()`,
    );
    assert(layout.scroll <= width + 1, `Restore overflow at ${width}`);
    assert(layout.inputFont >= 16 && layout.inputHeight >= 44);
    await screenshot(page, `${OUT}/restore-${width}.png`, undefined, false);
    await page.evaluate(
      '[...document.querySelectorAll("h3")].find(e => e.textContent === "Review restore").scrollIntoView()',
    );
    await screenshot(page, `${OUT}/confirmation-${width}.png`, undefined, false);
    await click(page, 'Cancel restore');
    assert(await waitFor(page, 'document.body.textContent.includes("Restore cancelled")'));
    assert.equal((await readNotes()).length, 0);
    results.widths.push(layout);
  }
  await choose('{malformed');
  assert(
    await waitFor(
      page,
      'document.querySelector("[role=alert]")?.textContent.includes("valid JSON")',
    ),
  );
  assert.equal((await readNotes()).length, 0);
  await choose(JSON.stringify({ ...backup, schema_version: 999 }));
  assert(
    await waitFor(
      page,
      'document.querySelector("[role=alert]")?.textContent.includes("Unsupported")',
    ),
  );
  assert.equal((await readNotes()).length, 0);
  await page.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  });
  await page.send('Network.enable');
  await page.send('Network.emulateNetworkConditions', {
    offline: true,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
  });
  await choose(JSON.stringify(backup));
  assert(await waitFor(page, hasButton('Confirm restore')));
  // The preview heading gets focus; Tab reaches confirmation without a mouse or drag.
  assert(await waitFor(page, 'document.activeElement?.textContent === "Review restore"'));
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
  const focus = await page.evaluate(
    `({ text: document.activeElement.textContent.trim(), visible: document.activeElement.matches(':focus-visible'), outline: getComputedStyle(document.activeElement).outlineStyle })`,
  );
  assert.equal(focus.text, 'Confirm restore');
  assert(focus.visible && focus.outline !== 'none');
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
  assert(await waitFor(page, 'document.body.textContent.includes("Restored 1 missing records")'));
  assert(
    await waitFor(page, 'document.activeElement?.type === "file"'),
    'focus returns to the enabled file chooser',
  );
  assert.equal((await readNotes())[0].body, 'Controlled recovered note');
  await page.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
  });
  await openPage(page, `${BASE}/sync`);
  assert(await waitFor(page, '!!document.querySelector("input[type=file]")'));
  assert.equal((await readNotes())[0].body, 'Controlled recovered note');
  await choose(JSON.stringify(backup));
  assert(await waitFor(page, hasButton('Confirm restore')));
  assert(
    await page.evaluate(
      '[...document.querySelectorAll("button")].find(b => b.textContent.trim() === "Confirm restore").disabled',
    ),
  );
  // Real touch cancel on a deliberately short phone, with reduced motion still enabled.
  await page.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
  const box = await page.evaluate(
    `(() => { const b = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Cancel restore'); b.scrollIntoView({block:'center'}); const r=b.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`,
  );
  await page.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [box] });
  await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  assert(await waitFor(page, 'document.body.textContent.includes("Restore cancelled")'));
  results.malformed =
    results.unsupported =
    results.offline =
    results.reopen =
    results.duplicate =
    results.keyboard =
    results.touch =
    results.reducedMotion =
      true;
  writeFileSync(`${OUT}/restore-probe.json`, JSON.stringify(results, null, 2));
  console.log(
    'Restore: five short-height widths, read-only preview/cancel/refusals, offline atomic restore, reopen, duplicate, keyboard/focus and touch PASS',
  );
} catch (error) {
  console.error(
    await page.evaluate(
      '({ url: location.href, focus: document.activeElement?.textContent, alerts: [...document.querySelectorAll("[role=alert], [role=status]")].map(e => e.textContent), text: document.querySelector("main")?.innerText.slice(-5000) })',
    ),
  );
  throw error;
} finally {
  await browser.close();
}
