// Only timing/status for the two sync transports. Never retain payloads, headers or URL secrets.
const MAX_REQUESTS = 80;
const SYNC_PATHS = new Set(['/api/sync/push', '/api/sync/pull']);

export function createSyncTimingCollector(limit = MAX_REQUESTS) {
  const requests = [];
  const active = new Map();
  let firstTimestamp = null;
  let omittedRequests = 0;
  const elapsed = (event, entry) => Math.round((event.timestamp - entry.timestamp) * 1000);

  function request(event) {
    let path;
    try {
      path = new URL(event.request.url).pathname;
    } catch {
      return;
    }
    if (!SYNC_PATHS.has(path) || !Number.isFinite(event.timestamp)) return;
    if (requests.length >= limit) {
      omittedRequests += 1;
      return;
    }
    firstTimestamp ??= event.timestamp;
    const row = { path, atMs: Math.round((event.timestamp - firstTimestamp) * 1000) };
    requests.push(row);
    active.set(event.requestId, { row, timestamp: event.timestamp });
  }

  function response(event) {
    const entry = active.get(event.requestId);
    if (!entry || !Number.isFinite(event.timestamp)) return;
    const status = event.response.status;
    if (Number.isInteger(status) && status >= 100 && status <= 599) entry.row.status = status;
    entry.row.responseMs = elapsed(event, entry);
  }

  function finish(event) {
    const entry = active.get(event.requestId);
    if (!entry || !Number.isFinite(event.timestamp)) return;
    entry.row.totalMs = elapsed(event, entry);
    active.delete(event.requestId);
  }

  function fail(event) {
    const entry = active.get(event.requestId);
    if (!entry) return;
    entry.row.failed = true;
    entry.row.canceled = event.canceled === true;
    finish(event);
  }

  return {
    request,
    response,
    finish,
    fail,
    summary: () => ({ requests: requests.map((row) => ({ ...row })), omittedRequests }),
  };
}
