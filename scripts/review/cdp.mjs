// Minimal Chrome DevTools Protocol driver for visual reviews (Node 22: global fetch + WebSocket).
// Headless Chrome gives exact viewport emulation, full-page captures, real mouse/touch input with a
// live frame loop, and `prefers-reduced-motion` emulation — everything the in-app browser pane
// cannot do reliably (see docs/reviews/phase-2-visual-review.md, "Method").
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME =
  process.env.CHROME ??
  (process.platform === 'win32'
    ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
    : process.platform === 'darwin'
      ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
      : 'google-chrome');

/*
 * Extra flags for the environment the probe happens to be running in. A container that runs as
 * root needs `--no-sandbox` or Chrome refuses to start at all, which reads as "the probe is
 * broken" rather than "the probe cannot launch here". `CHROME_FLAGS` covers anything else a host
 * needs, space separated.
 */
const EXTRA_FLAGS = [
  ...(process.getuid?.() === 0 ? ['--no-sandbox', '--disable-dev-shm-usage'] : []),
  ...(process.env.CHROME_FLAGS ? process.env.CHROME_FLAGS.split(/\s+/).filter(Boolean) : []),
];

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function launchChrome() {
  const profile = join(tmpdir(), `bloomlab-review-${process.pid}-${Date.now()}`);
  mkdirSync(profile, { recursive: true });
  const proc = spawn(
    CHROME,
    [
      '--headless=new',
      '--disable-gpu',
      // Overflow reviews opt into real scrollbar gutters to catch narrow-rail clipping.
      ...(process.env.REVIEW_SCROLLBARS === '1' ? [] : ['--hide-scrollbars']),
      '--no-first-run',
      '--no-default-browser-check',
      // Port 0: Chrome picks a free port and writes it to DevToolsActivePort in the profile.
      '--remote-debugging-port=0',
      `--user-data-dir=${profile}`,
      '--window-size=1280,900',
      ...EXTRA_FLAGS,
      'about:blank',
    ],
    { stdio: 'ignore' },
  );
  for (let i = 0; i < 300; i++) {
    try {
      const port = readFileSync(join(profile, 'DevToolsActivePort'), 'utf8').split(/\r?\n/)[0];
      const version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page) {
        return { proc, browserWs: version.webSocketDebuggerUrl, pageWs: page.webSocketDebuggerUrl };
      }
    } catch {
      /* not up yet */
    }
    await sleep(150);
  }
  proc.kill();
  throw new Error(
    `Chrome did not expose the DevTools endpoint (CHROME=${CHROME}, flags=${EXTRA_FLAGS.join(' ') || 'none'})`,
  );
}

export function connect(url) {
  const ws = new WebSocket(url);
  let nextId = 0;
  const pending = new Map();
  const listeners = new Set();
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id !== undefined && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(`${msg.error.message} ${msg.error.data ?? ''}`));
      else resolve(msg.result);
    } else if (msg.method) {
      for (const l of listeners) l(msg);
    }
  });
  const ready = new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve);
    ws.addEventListener('error', reject);
  });
  // `sessionId` addresses a flattened target session (e.g. a service worker) on the browser socket.
  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const id = ++nextId;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  const once = (method) =>
    new Promise((resolve) => {
      const l = (m) => {
        if (m.method === method) {
          listeners.delete(l);
          resolve(m.params);
        }
      };
      listeners.add(l);
    });
  const on = (method, listener) => {
    const receive = (message) => {
      if (message.method === method) listener(message.params);
    };
    listeners.add(receive);
    return () => listeners.delete(receive);
  };
  const evaluate = async (expression) => {
    let r;
    try {
      r = await send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true,
      });
    } catch (error) {
      const preview = expression.replace(/\s+/g, ' ').trim().slice(0, 180);
      throw new Error(
        `${error instanceof Error ? error.message : String(error)} [evaluate: ${preview}]`,
        { cause: error },
      );
    }
    if (r.exceptionDetails) {
      throw new Error(
        `${r.exceptionDetails.text} ${r.exceptionDetails.exception?.description ?? ''}`,
      );
    }
    return r.result.value;
  };
  return { ready, send, once, on, evaluate, close: () => ws.close() };
}

/** Navigates and waits for the lazy route chunk and the fonts. */
export async function openPage(page, url) {
  const loaded = page.once('Page.loadEventFired');
  const navigation = await page.send('Page.navigate', { url });
  if (navigation.errorText) throw new Error('Navigation failed: ' + navigation.errorText);
  // Fragment navigation stays in the current document and deliberately has no load event.
  // The search probe exercises this path; route-specific content still has its own ready check.
  if (navigation.loaderId) {
    let timer;
    try {
      await Promise.race([
        loaded,
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('Page load timed out')), 30_000);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }
  for (let i = 0; i < 60; i++) {
    if (await page.evaluate("!!document.querySelector('main h1, main h2, h1')")) break;
    await sleep(100);
  }
  await page.evaluate(
    'document.fonts.ready.then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))',
  );
}

/** Clear only a synthetic probe fixture after its old document has stopped writing to it. */
export async function resetIndexedDbFixture(page, base) {
  const unloaded = page.once('Page.loadEventFired');
  const navigation = await page.send('Page.navigate', { url: 'about:blank' });
  if (navigation.errorText) throw new Error('Fixture unload failed: ' + navigation.errorText);
  if (navigation.loaderId) {
    let timer;
    try {
      await Promise.race([
        unloaded,
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('Fixture unload timed out')), 30_000);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }
  await page.send('Storage.clearDataForOrigin', {
    origin: new URL(base).origin,
    storageTypes: 'indexeddb',
  });
}

/** Below 768 px the page is emulated as a touch device (coarse pointer, 5 touch points). */
export async function setViewport(page, width, height, { mobile = width < 768 } = {}) {
  await page.send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile,
  });
  await page.send('Emulation.setTouchEmulationEnabled', {
    enabled: mobile,
    maxTouchPoints: mobile ? 5 : 1,
  });
}

/**
 * Captures the page (or a clip). `beyondViewport` lays the whole document out for the capture,
 * which moves `position: fixed` elements (sheets, dialogs) to the document's bottom; pass
 * `false` to capture the viewport exactly as a user sees it.
 */
export async function screenshot(page, file, clip, beyondViewport = true) {
  const { data } = await page.send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: beyondViewport,
    ...(clip ? { clip: { ...clip, scale: 1 } } : {}),
  });
  writeFileSync(file, Buffer.from(data, 'base64'));
}

export async function session() {
  const { proc, browserWs, pageWs } = await launchChrome();
  const page = connect(pageWs);
  const browser = connect(browserWs);
  await Promise.all([page.ready, browser.ready]);
  await page.send('Page.enable');
  await page.send('Runtime.enable');
  if (process.env.REVIEW_AI_OFF === '1') {
    // Field-Ready C1 runs the real product with both sides of the AI boundary unavailable:
    // `ai.mode` is held at Off in the product's own IndexedDB workspace and browser requests to
    // Worker AI routes are refused before transport. The interval matters because several real
    // probes deliberately clear IndexedDB while testing reset/recovery behavior.
    await page.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `(() => {
        if (!/^https?:$/.test(location.protocol)) return;
        const key = '__bloomlab_ai_off_attempts';
        const originalFetch = globalThis.fetch.bind(globalThis);
        globalThis.fetch = (input, init) => {
          const url = String(input instanceof Request ? input.url : input);
          if (/\\/api\\/ai\\//.test(url)) {
            const attempts = JSON.parse(sessionStorage.getItem(key) || '[]');
            attempts.push({ url: new URL(url, location.href).pathname, method: init?.method || (input instanceof Request ? input.method : 'GET') });
            sessionStorage.setItem(key, JSON.stringify(attempts));
            return Promise.reject(new TypeError('AI Worker routes are disabled for Field-Ready acceptance'));
          }
          return originalFetch(input, init);
        };
        const holdOff = () => {
          const request = indexedDB.open('bloomlab');
          request.onsuccess = () => {
            const database = request.result;
            if (
              !database.objectStoreNames.contains('workspace') ||
              !database.objectStoreNames.contains('device')
            ) {
              database.close();
              return;
            }
            const transaction = database.transaction(['workspace', 'device'], 'readwrite');
            const devices = transaction.objectStore('device').getAll();
            devices.onsuccess = () => {
              const owner = devices.result[0];
              if (!owner) return;
              transaction.objectStore('workspace').put({
                key: 'ai.mode',
                learner_id: owner.learner_id,
                device_id: owner.device_id,
                value: 'Off',
                updated_at: new Date().toISOString(),
              });
            };
            transaction.oncomplete = () => database.close();
            transaction.onerror = () => database.close();
          };
        };
        setTimeout(holdOff, 250);
        setInterval(holdOff, 1000);
      })();`,
    });
  }
  const close = async () => {
    if (process.env.REVIEW_AI_OFF === '1') {
      const evidence = await page
        .evaluate(
          `new Promise((resolve) => {
          const attempts = JSON.parse(sessionStorage.getItem('__bloomlab_ai_off_attempts') || '[]');
          const request = indexedDB.open('bloomlab');
          request.onerror = () => resolve({ mode: null, attempted_ai_routes: attempts, error: 'database unavailable' });
          request.onsuccess = () => {
            const database = request.result;
            if (!database.objectStoreNames.contains('workspace')) {
              database.close(); resolve({ mode: null, attempted_ai_routes: attempts }); return;
            }
            const tx = database.transaction('workspace', 'readonly');
            const read = tx.objectStore('workspace').get('ai.mode');
            read.onsuccess = () => { database.close(); resolve({ mode: read.result?.value ?? null, attempted_ai_routes: attempts }); };
            read.onerror = () => { database.close(); resolve({ mode: null, attempted_ai_routes: attempts, error: 'workspace read failed' }); };
          };
        })`,
        )
        .catch((error) => ({ mode: null, attempted_ai_routes: [], error: error.message }));
      console.log(`AI_OFF_BOUNDARY ${JSON.stringify(evidence)}`);
    }
    try {
      await browser.send('Browser.close');
    } catch {
      /* fall through to kill */
    }
    proc.kill();
  };
  return { page, browser, close };
}

/**
 * Attaches to every service worker of `origin` and returns a sender bound to those sessions.
 * Page-level network emulation does not reach a worker's own fetches, so offline tests must
 * apply conditions here as well.
 */
export async function serviceWorkerSessions(browser, origin) {
  const { targetInfos } = await browser.send('Target.getTargets');
  const workers = targetInfos.filter(
    (t) => t.type === 'service_worker' && t.url.startsWith(origin),
  );
  const sessions = [];
  for (const worker of workers) {
    const { sessionId } = await browser.send('Target.attachToTarget', {
      targetId: worker.targetId,
      flatten: true,
    });
    sessions.push(sessionId);
  }
  return {
    count: sessions.length,
    send: (method, params = {}) =>
      Promise.all(sessions.map((sessionId) => browser.send(method, params, sessionId))),
  };
}
