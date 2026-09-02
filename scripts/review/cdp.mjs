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

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function launchChrome() {
  const profile = join(tmpdir(), `bloomlab-review-${process.pid}-${Date.now()}`);
  mkdirSync(profile, { recursive: true });
  const proc = spawn(
    CHROME,
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--no-first-run',
      '--no-default-browser-check',
      // Port 0: Chrome picks a free port and writes it to DevToolsActivePort in the profile.
      '--remote-debugging-port=0',
      `--user-data-dir=${profile}`,
      '--window-size=1280,900',
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
  throw new Error(`Chrome did not expose the DevTools endpoint (CHROME=${CHROME})`);
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
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (r.exceptionDetails) {
      throw new Error(
        `${r.exceptionDetails.text} ${r.exceptionDetails.exception?.description ?? ''}`,
      );
    }
    return r.result.value;
  };
  return { ready, send, once, evaluate, close: () => ws.close() };
}

/** Navigates and waits for the lazy route chunk and the fonts. */
export async function openPage(page, url) {
  const loaded = page.once('Page.loadEventFired');
  await page.send('Page.navigate', { url });
  await loaded;
  for (let i = 0; i < 60; i++) {
    if (await page.evaluate("!!document.querySelector('main h1, main h2, h1')")) break;
    await sleep(100);
  }
  await page.evaluate(
    'document.fonts.ready.then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))',
  );
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

export async function screenshot(page, file, clip) {
  const { data } = await page.send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
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
  const close = async () => {
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
