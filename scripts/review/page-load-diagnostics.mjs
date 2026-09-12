// Diagnose a blank startup without retaining request bodies, headers, query strings,
// exception messages or learner text. This observes navigation; it never retries it.
export async function pageLoadDiagnostics(page, base) {
  const origin = new URL(base).origin;
  const requests = new Map();
  const exceptions = [];
  const resourcePath = (value) => {
    try {
      const url = new URL(value, base);
      return url.origin === origin ? url.pathname : '[external resource]';
    } catch {
      return '[invalid URL]';
    }
  };
  const stop = [
    page.on('Network.requestWillBeSent', ({ requestId, type, request }) => {
      if (!['Document', 'Script', 'Stylesheet'].includes(type)) return;
      requests.set(requestId, { type, path: resourcePath(request.url) });
      if (requests.size > 100) requests.delete(requests.keys().next().value);
    }),
    page.on('Network.responseReceived', ({ requestId, response }) => {
      const row = requests.get(requestId);
      if (row)
        Object.assign(row, {
          status: response.status,
          fromServiceWorker: response.fromServiceWorker === true,
          fromDiskCache: response.fromDiskCache === true,
        });
    }),
    page.on('Network.loadingFinished', ({ requestId }) => {
      const row = requests.get(requestId);
      if (row) row.finished = true;
    }),
    page.on('Network.loadingFailed', ({ requestId, errorText, canceled }) => {
      const row = requests.get(requestId);
      if (row)
        Object.assign(row, {
          error: /^net::ERR_[A-Z_]+$/.test(errorText) ? errorText : '[request failed]',
          canceled: canceled === true,
        });
    }),
    page.on('Runtime.exceptionThrown', ({ exceptionDetails }) => {
      exceptions.push({
        path: resourcePath(exceptionDetails.url ?? ''),
        line: exceptionDetails.lineNumber,
        column: exceptionDetails.columnNumber,
      });
      if (exceptions.length > 20) exceptions.shift();
    }),
  ];
  try {
    await page.send('Network.enable');
  } catch (error) {
    stop.forEach((unsubscribe) => unsubscribe());
    throw error;
  }
  return {
    reset() {
      requests.clear();
      exceptions.length = 0;
    },
    snapshot() {
      return {
        requests: [...requests.values()].map((row) => ({ ...row })),
        exceptions: exceptions.map((row) => ({ ...row })),
      };
    },
    stop() {
      stop.forEach((unsubscribe) => unsubscribe());
    },
  };
}
