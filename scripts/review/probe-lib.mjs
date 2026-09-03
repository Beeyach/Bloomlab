// Shared helpers for the two-device probes (sync-probe, learning-probe): a page driver over the
// DevTools protocol with text-based waits, real input events, offline emulation per device
// (including its service worker), and the diagnostics rows the probes read.
import { openPage, serviceWorkerSessions, session, setViewport, sleep } from './cdp.mjs';

export function probeHelpers({ base }) {
  const ORIGIN = new URL(base).origin;

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

  const hasButton = (name) =>
    `[...document.querySelectorAll('button')].some((b) => b.textContent.trim() === ${JSON.stringify(name)})`;
  const bodyHas = (text) => `document.body.textContent.includes(${JSON.stringify(text)})`;
  const testText = (testid) =>
    `(document.querySelector('[data-testid=${JSON.stringify(testid)}]')?.textContent?.trim() ?? null)`;

  async function click(page, selectorOrText) {
    const box = await page.evaluate(`(() => {
      const wanted = ${JSON.stringify(selectorOrText)};
      const el = wanted.startsWith('#') || wanted.includes('[')
        ? document.querySelector(wanted)
        : [...document.querySelectorAll('button, a')].find((b) => b.textContent.trim() === wanted);
      if (!el) return null;
      el.scrollIntoView({ block: 'center' });
      const r = el.getBoundingClientRect();
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      const at = document.elementFromPoint(x, y);
      return { x, y, hit: at ? at.tagName + ' ' + (at.textContent || '').trim().slice(0, 30) : null, sameElement: !!at && (at === el || el.contains(at)) };
    })()`);
    if (!box) throw new Error(`Nothing to click for ${selectorOrText}`);
    if (!box.sameElement) console.log(`click ${selectorOrText}: point hits ${box.hit}`);
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

  /** Sets a React-controlled <select> by data-testid and fires the change React listens to. */
  const selectOption = (page, testid, value) =>
    page.evaluate(`(() => {
      const el = document.querySelector('[data-testid=${JSON.stringify(testid)}]');
      if (!el) return false;
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
      setter.call(el, ${JSON.stringify(value)});
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return el.value === ${JSON.stringify(value)};
    })()`);

  const text = (page, selector) =>
    page.evaluate(
      `document.querySelector(${JSON.stringify(selector)})?.textContent?.trim() ?? null`,
    );

  const indicator = (page) => text(page, '[role=status]');

  /** The diagnostics rows that matter for sync: records, link and sync/cursor lines. */
  const diag = (page) =>
    page.evaluate(
      "[...document.querySelectorAll('dd')].map((d) => d.textContent.trim()).filter((t) => /^(device \\d|linked|not linked|Synced|Saved|Offline|Syncing)/.test(t))",
    );

  /** Clicks "Sync now" on /system and waits until the outbox is empty. */
  async function syncNow(page) {
    await waitFor(page, hasButton('Sync now'));
    await click(page, 'Sync now');
    return waitFor(page, bodyHas('sync_queue 0'));
  }

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
        await openPage(s.page, `${base}${path}`);
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

  /** Device A creates a key on /sync and links; returns the display key. */
  async function createKeyAndLink(A) {
    await A.go('/sync');
    await waitFor(A.page, hasButton('Create a sync key'));
    await click(A.page, 'Create a sync key');
    await waitFor(A.page, "!!document.querySelector('[data-testid=sync-key]')");
    const key = await text(A.page, '[data-testid=sync-key]');
    await click(A.page, 'input[type=checkbox]');
    await waitFor(
      A.page,
      "(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Link this device'); return !!b && !b.disabled; })()",
    );
    await click(A.page, 'Link this device');
    const linked = await waitFor(
      A.page,
      `${bodyHas('Connected devices')} || !!document.querySelector('[role=alert]')`,
    );
    return { key, linked: linked && (await waitFor(A.page, bodyHas('This device'), 8)) };
  }

  /** Device B enters an existing key on /sync and links. */
  async function linkWithKey(B, key) {
    await B.go('/sync');
    await waitFor(B.page, hasButton('I already have a key'));
    await click(B.page, 'I already have a key');
    await waitFor(B.page, "!!document.querySelector('input')");
    await typeInto(B.page, 'input', key.toLowerCase());
    await click(B.page, 'Link this device');
    const linked = await waitFor(
      B.page,
      `${bodyHas('Connected devices')} || !!document.querySelector('[role=alert]')`,
    );
    return linked && !(await text(B.page, '[role=alert]'));
  }

  return {
    ORIGIN,
    waitFor,
    hasButton,
    bodyHas,
    testText,
    click,
    typeInto,
    selectOption,
    text,
    indicator,
    diag,
    syncNow,
    device,
    createKeyAndLink,
    linkWithKey,
  };
}
