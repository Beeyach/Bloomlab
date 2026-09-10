/** Resources actually requested by this page, never routes discovered by scanning the bundle. */
export function visitedAssetUrls(names: string[], origin: string): string[] {
  return [...new Set(names)].filter((name) => {
    const url = new URL(name, origin);
    return (
      url.origin === origin &&
      !url.search &&
      /^\/assets\/[^/]+-[\w-]+\.(?:js|css)$/.test(url.pathname)
    );
  });
}

/** A first visit may load its route before the new service worker controls the page. Preserve
 * only those already-requested assets from the HTTP cache; never force a reload or fetch a Lab
 * just because it exists. Subsequent requests use the service worker's runtime route cache. */
export function preserveFirstVisit(): void {
  if (!('serviceWorker' in navigator) || !('caches' in window)) return;
  void navigator.serviceWorker.ready
    .then(async () => {
      const cache = await caches.open('bloomlab-routes');
      const seen = new Set<string>();
      const preserve = async (entries: PerformanceEntry[]) => {
        const urls = visitedAssetUrls(
          entries.map((entry) => entry.name),
          location.origin,
        ).filter((url) => !seen.has(url));
        await Promise.all(
          urls.map(async (url) => {
            seen.add(url);
            if (await caches.match(url)) return;
            const response = await fetch(url, {
              cache: 'force-cache',
              credentials: 'omit',
              signal: AbortSignal.timeout(10000),
            });
            if (response.ok && /javascript|css/.test(response.headers.get('content-type') ?? ''))
              await cache.put(url, response);
          }),
        );
      };
      // Late dependencies may have started before control but finish after ready. Watching real
      // resource completions closes that gap without discovering any unvisited route.
      const observer = new PerformanceObserver((list) => {
        void preserve(list.getEntries()).catch(() => {});
      });
      observer.observe({ type: 'resource', buffered: true });
      await preserve(performance.getEntriesByType('resource'));
    })
    .catch(() => {
      /* Offline caching is best effort; local learner state is independent. */
    });
}
