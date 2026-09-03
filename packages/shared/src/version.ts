/**
 * Release version metadata (spec §101, INF-013).
 *
 * Every saved attempt records app, content and simulator versions so evidence stays
 * historically valid when GHL or curriculum changes. `SIMULATOR_VERSION` is owned by
 * `@bloomlab/simulator-core`; the content version comes from the compiled content bundle
 * (`virtual:bloomlab-content/version`, stamped from `content/content.yaml` by the compiler).
 */
export const APP_VERSION = '0.1.0';
