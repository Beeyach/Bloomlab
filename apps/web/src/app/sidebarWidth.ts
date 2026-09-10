import { useSyncExternalStore } from 'react';

export const SIDEBAR_WIDTH_KEY = 'bloomlab.sidebar.width.v1';
export const SIDEBAR_DEFAULT = 200;
export const SIDEBAR_MIN = 176;
export const SIDEBAR_MAX = 280;
// At 768px, keep the 536px content area whose Workflow canvas was visually verified.
export const SIDEBAR_CONTENT_MIN = 536;

export function sidebarWidth(value: unknown): number {
  const number =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value.trim())
        ? Number(value)
        : NaN;
  return Number.isFinite(number)
    ? Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, Math.round(number)))
    : SIDEBAR_DEFAULT;
}

function subscribe(resize: () => void) {
  window.addEventListener('resize', resize);
  return () => window.removeEventListener('resize', resize);
}
const maximum = () =>
  Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, innerWidth - SIDEBAR_CONTENT_MIN));
export function useSidebarMaximum() {
  return useSyncExternalStore(subscribe, maximum, () => SIDEBAR_MAX);
}
