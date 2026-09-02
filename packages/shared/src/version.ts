/**
 * Release version metadata (spec §101, INF-013).
 *
 * Every saved attempt records app, content and simulator versions so evidence stays
 * historically valid when GHL or curriculum changes. `SIMULATOR_VERSION` is owned by
 * `@bloomlab/simulator-core`; `CONTENT_VERSION` comes from the compiled content bundle once
 * the content compiler exists (Phase 5) and is `null` until then.
 */
export const APP_VERSION = '0.1.0';

export const CONTENT_VERSION: string | null = null;
