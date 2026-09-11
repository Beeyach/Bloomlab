/* global window, location, indexedDB */
// Controlled app-origin HTTP fixtures. No real GHL work or screenshot interpretation.
export function fieldworkFixtures(live, png) {
  const original = window.fetch.bind(window);
  const p = (window.__fieldworkProbe = {
    failUpload: false,
    holdUpload: false,
    requests: [],
    origins: JSON.parse(sessionStorage.getItem('phase22-origins') ?? '[]'),
    live,
  });
  const recordOrigin = (address) => {
    const url = new URL(address, location.href);
    if (!['https:', 'http:'].includes(url.protocol)) return;
    if (!p.origins.includes(url.origin)) p.origins.push(url.origin);
    sessionStorage.setItem('phase22-origins', JSON.stringify(p.origins));
  };
  new PerformanceObserver((list) =>
    list.getEntries().forEach((entry) => recordOrigin(entry.name)),
  ).observe({ type: 'resource', buffered: true });
  let release;
  p.release = async () => {
    // The busy label commits before uploadEvidence reaches fetch. On a recomposed phone viewport
    // the review driver can therefore ask to release the controlled request a frame too early.
    // Wait for the request to register its gate so the fixture cannot lose that release signal.
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (release) {
        const ready = release;
        release = undefined;
        ready();
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error('Controlled fieldwork upload did not reach its hold point');
  };
  p.rows = (name) =>
    new Promise((resolve, reject) => {
      const req = indexedDB.open('bloomlab');
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction(name);
        const read = tx.objectStore(name).getAll();
        read.onsuccess = () => resolve(read.result);
        tx.oncomplete = () => db.close();
      };
    });
  p.put = (name, row) =>
    new Promise((resolve, reject) => {
      const req = indexedDB.open('bloomlab');
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction(name, 'readwrite');
        tx.objectStore(name).put(row);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
    });
  const assets = JSON.parse(sessionStorage.getItem('phase22-fixture-assets') ?? '{}');
  window.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url, location.href);
    recordOrigin(url.href);
    if (url.origin !== location.origin) throw new Error('Unexpected fieldwork egress');
    if (url.pathname.startsWith('/api/sync/') && url.pathname !== '/api/sync/link')
      return Response.json({ error: 'Controlled review holds automatic sync' }, { status: 503 });
    if (!url.pathname.startsWith('/api/evidence/')) return original(input, init);
    const method = init.method ?? 'GET';
    const id = url.pathname.split('/')[4];
    p.requests.push({
      path: url.pathname,
      method,
      bytes: init.body instanceof Blob ? init.body.size : 0,
    });
    if (method === 'PUT') {
      if (p.holdUpload) {
        p.holdUpload = false;
        await new Promise((r) => {
          release = r;
        });
      }
      if (p.failUpload) {
        p.failUpload = false;
        throw new TypeError('Controlled offline upload');
      }
    }
    if (live) return original(input, init);
    if (method === 'PUT') {
      assets[id] = {
        asset_id: id,
        attempt_id: url.searchParams.get('attempt_id'),
        exercise_id: url.searchParams.get('exercise_id'),
        item_key: url.searchParams.get('item_key'),
        status: 'ready',
        deleted_at: null,
        width: 1,
        height: 1,
        byte_length: init.body.size,
        mime_type: init.body.type,
        checksum: 'controlled-image-checksum',
      };
    }
    if (method === 'DELETE' && assets[id])
      assets[id] = { ...assets[id], status: 'deleted', deleted_at: new Date().toISOString() };
    sessionStorage.setItem('phase22-fixture-assets', JSON.stringify(assets));
    if (url.pathname.endsWith('/image'))
      return new Response(
        Uint8Array.from(atob(png), (c) => c.charCodeAt(0)),
        { headers: { 'content-type': 'image/png' } },
      );
    return assets[id]
      ? Response.json(assets[id])
      : Response.json({ error: 'Screenshot not found.' }, { status: 404 });
  };
}
