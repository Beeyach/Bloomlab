// Two-device sync check (SYNC-001, SYNC-004, SYNC-009, SYNC-010, SYNC-011): two separate headless
// Chrome profiles against one server. Device A creates a Bloomlab Sync Key through the UI, device
// B links with it, a note written on A appears on B, both devices edit the same note while
// offline, and reconnecting shows the "Two versions were changed" chooser on the second device;
// choosing keeps that version everywhere. Writes sync-probe.json and captures to .review/.
//   BASE=https://bloomlab-preview.example.workers.dev node scripts/review/sync-probe.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  openPage,
  screenshot,
  serviceWorkerSessions,
  session,
  setViewport,
  sleep,
} from './cdp.mjs';

const OUT = resolve(process.env.REVIEW_OUT ?? '.review');
const BASE = process.env.BASE ?? 'http://localhost:4173';
const ORIGIN = new URL(BASE).origin;

const conditions = (offline) => ({
  offline,
  latency: 0,
  downloadThroughput: -1,
  uploadThroughput: -1,
});

async function waitFor(page, expression, tries = 80) {
  for (let i = 0; i < tries; i++) {
    if (await page.evaluate(expression)) return true;
    await sleep(125);
  }
  return false;
}

async function click(page, selectorOrText) {
  const box = await page.evaluate(`(() => {
    const wanted = ${JSON.stringify(selectorOrText)};
    const el = wanted.startsWith('#') || wanted.includes('[')
      ? document.querySelector(wanted)
      : [...document.querySelectorAll('button, a')].find((b) => b.textContent.trim() === wanted);
    if (!el) return null;
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);
  if (!box) throw new Error(`Nothing to click for ${selectorOrText}`);
  await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...box });
  await page.send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    ...box,
    button: 'left',
    clickCount: 1,
  });
  await page.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    ...box,
    button: 'left',
    clickCount: 1,
  });
}

async function typeInto(page, selector, text) {
  await page.evaluate(
    `(() => { const el = document.querySelector(${JSON.stringify(selector)}); el.focus(); el.select?.(); })()`,
  );
  await page.send('Input.insertText', { text });
}

const text = (page, selector) =>
  page.evaluate(`document.querySelector(${JSON.stringify(selector)})?.textContent?.trim() ?? null`);

const indicator = (page) => text(page, '[role=status]');

const newestNote = (page) =>
  page.evaluate(
    "(() => { const t = document.querySelector('textarea'); return t ? t.value : null; })()",
  );

async function device(name) {
  const s = await session();
  await s.page.send('Network.enable');
  await setViewport(s.page, 1024, 900, { mobile: false });
  // One attachment per service worker: emulation state belongs to the session that set it, so
  // going back online must reuse the session that went offline.
  let workers = null;
  return {
    name,
    ...s,
    async go(path) {
      await openPage(s.page, `${BASE}${path}`);
    },
    async setOffline(on) {
      workers ??= await serviceWorkerSessions(s.browser, ORIGIN);
      if (workers.count) {
        await workers.send('Network.enable').catch(() => undefined);
        await workers
          .send('Network.emulateNetworkConditions', conditions(on))
          .catch(() => undefined);
      }
      await s.page.send('Network.emulateNetworkConditions', conditions(on));
      await sleep(300);
    },
  };
}

mkdirSync(OUT, { recursive: true });
const report = { base: BASE, steps: [] };
const step = (name, data) => {
  report.steps.push({ name, ...data });
  console.log(name, JSON.stringify(data));
};

const A = await device('A');
const B = await device('B');
try {
  // ---------- A creates a key ----------
  await A.go('/sync');
  await waitFor(
    A.page,
    "[...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Create a sync key')",
  );
  await click(A.page, 'Create a sync key');
  await waitFor(A.page, "!!document.querySelector('[data-testid=sync-key]')");
  const key = await text(A.page, '[data-testid=sync-key]');
  await screenshot(A.page, `${OUT}/sync-a-key.png`, { x: 0, y: 0, width: 1024, height: 900 });
  await click(A.page, 'input[type=checkbox]');
  const enabled = await waitFor(
    A.page,
    "(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Link this device'); return !!b && !b.disabled; })()",
  );
  await click(A.page, 'Link this device');
  const aLinked = await waitFor(
    A.page,
    "document.body.textContent.includes('Connected devices') || !!document.querySelector('[role=alert]')",
  );
  step('A created a key and linked', {
    keyFormat: /^BLM(-[0-9A-HJKMNP-TV-Z]{4}){13}$/.test(key ?? ''),
    buttonEnabled: enabled,
    linked:
      aLinked && (await waitFor(A.page, "document.body.textContent.includes('This device')", 8)),
    alert: await text(A.page, '[role=alert]'),
  });

  // ---------- B links with the same key (captured at phone width) ----------
  await setViewport(B.page, 390, 900, { mobile: true });
  await B.go('/sync');
  await waitFor(
    B.page,
    "[...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'I already have a key')",
  );
  await screenshot(B.page, `${OUT}/sync-b-unlinked-390.png`, {
    x: 0,
    y: 0,
    width: 390,
    height: 900,
  });
  await click(B.page, 'I already have a key');
  await waitFor(B.page, "!!document.querySelector('input')");
  await typeInto(B.page, 'input', key.toLowerCase());
  await click(B.page, 'Link this device');
  const bLinked = await waitFor(
    B.page,
    "document.body.textContent.includes('Connected devices') || !!document.querySelector('[role=alert]')",
  );
  await sleep(800);
  await screenshot(B.page, `${OUT}/sync-b-linked-390.png`, { x: 0, y: 0, width: 390, height: 900 });
  await setViewport(B.page, 1024, 900, { mobile: false });
  await sleep(300);
  await screenshot(B.page, `${OUT}/sync-b-linked.png`, { x: 0, y: 0, width: 1024, height: 900 });
  step('B linked with the key', {
    linked: bLinked && !(await text(B.page, '[role=alert]')),
    alert: await text(B.page, '[role=alert]'),
    devicesListed: await B.page.evaluate(
      "[...document.querySelectorAll('li')].map((li) => li.textContent.trim().slice(0, 40))",
    ),
  });

  // ---------- A writes a note, B receives it ----------
  await A.go('/system');
  await waitFor(
    A.page,
    "[...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Add test note')",
  );
  await click(A.page, 'Add test note');
  await sleep(300);
  await click(A.page, 'Sync now');
  await waitFor(A.page, "document.body.textContent.includes('sync_queue 0')");
  const aNote = await newestNote(A.page);
  await B.go('/system');
  await waitFor(
    B.page,
    "[...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Sync now')",
  );
  await click(B.page, 'Sync now');
  const bGotNote = await waitFor(
    B.page,
    `(() => { const t = document.querySelector('textarea'); return !!t && t.value === ${JSON.stringify(aNote)}; })()`,
  );
  step('note synced A → B', {
    aNote,
    bNote: await newestNote(B.page),
    received: bGotNote,
    aIndicator: await indicator(A.page),
    bIndicator: await indicator(B.page),
  });

  // ---------- both edit offline, then reconnect: conflict on the second device ----------
  await A.setOffline(true);
  await B.setOffline(true);
  await typeInto(A.page, 'textarea', 'Edited on device A');
  await click(A.page, 'Save note');
  await typeInto(B.page, 'textarea', 'Edited on device B');
  await click(B.page, 'Save note');
  await sleep(400);
  step('both edited offline', {
    aIndicator: await indicator(A.page),
    bIndicator: await indicator(B.page),
    aNote: await newestNote(A.page),
    bNote: await newestNote(B.page),
  });

  await A.setOffline(false);
  await click(A.page, 'Sync now');
  await waitFor(A.page, "document.body.textContent.includes('sync_queue 0')");
  await B.setOffline(false);
  await click(B.page, 'Sync now');
  const chooser = await waitFor(
    B.page,
    "document.body.textContent.includes('Two versions were changed')",
  );
  await sleep(1000);
  await screenshot(B.page, `${OUT}/sync-b-conflict.png`, undefined, false);
  step('conflict shown on B', {
    chooser,
    dialog: await B.page.evaluate(
      `(() => { const d = document.querySelector('dialog'); if (!d) return null; const r = d.getBoundingClientRect(); const cs = getComputedStyle(d); return { open: d.open, top: Math.round(r.top), height: Math.round(r.height), opacity: cs.opacity, transform: cs.transform, scrollY }; })()`,
    ),
    bNoteStillLocal: await newestNote(B.page),
    versions: await B.page.evaluate(
      "[...document.querySelectorAll('dialog pre')].map((p) => p.textContent)",
    ),
  });

  // ---------- B keeps its version; A ends up with it ----------
  await click(B.page, "Keep this device's version");
  await waitFor(B.page, "!document.body.textContent.includes('Two versions were changed')");
  await click(B.page, 'Sync now');
  await waitFor(B.page, "document.body.textContent.includes('sync_queue 0')");
  await click(A.page, 'Sync now');
  const converged = await waitFor(
    A.page,
    "(() => { const t = document.querySelector('textarea'); return !!t && t.value === 'Edited on device B'; })()",
  );
  step('resolved: both devices agree', {
    converged,
    aNote: await newestNote(A.page),
    bNote: await newestNote(B.page),
    aIndicator: await indicator(A.page),
    bIndicator: await indicator(B.page),
  });

  // ---------- revoke B from A ----------
  await A.go('/sync');
  const revokeVisible = await waitFor(
    A.page,
    "[...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Revoke')",
  );
  step('A opened connected devices', {
    revokeVisible,
    alert: await text(A.page, '[role=alert]'),
    page: (await text(A.page, 'main'))?.slice(0, 300),
  });
  await click(A.page, 'Revoke');
  await waitFor(A.page, "document.body.textContent.includes('Revoked')");
  await B.go('/system');
  await click(B.page, 'Sync now');
  await sleep(1000);
  step('B revoked from A', {
    aDevices: await A.page.evaluate(
      "[...document.querySelectorAll('li')].map((li) => li.textContent.trim().slice(0, 60))",
    ),
    bLinkRow: await B.page.evaluate(
      "[...document.querySelectorAll('dd')].map((d) => d.textContent).find((t) => t.includes('linked')) ?? null",
    ),
  });
  report.ok = report.steps.every((s) => Object.values(s).every((v) => v !== false));
} catch (error) {
  report.error = String(error?.stack ?? error);
  console.error(report.error);
} finally {
  writeFileSync(`${OUT}/sync-probe.json`, JSON.stringify(report, null, 2));
  await A.close();
  await B.close();
}
