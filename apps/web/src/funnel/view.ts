import { db, type BloomlabDatabase } from '../data/db';

/**
 * Which view the Funnel Lab is in on this device (FUN-002, D-120).
 *
 * The mode and the preview width are **device preferences**, exactly like the run choice in
 * `simulator/currentRun.ts`: the learner's own way of looking at the account, not part of the
 * account and not learner work. They are kept on the device record — never in the simulator run,
 * never synced, never in `localStorage` — so a reload comes back to the mode the learner left in
 * without the choice travelling to another device as if it were a fact about the funnel.
 *
 * The funnel and step being edited live in the URL instead, so a link is a link and the browser's
 * own history works. That is the same split the Workflow Lab made in Phase 12.
 */

export const FUNNEL_MODES = ['build', 'preview', 'simulate'] as const;
export type FunnelMode = (typeof FUNNEL_MODES)[number];

export const PREVIEW_DEVICES = ['desktop', 'tablet', 'mobile'] as const;
export type PreviewDevice = (typeof PREVIEW_DEVICES)[number];

/** The width each preview renders at, in CSS pixels. Real reflow, never a scaled screenshot. */
export const PREVIEW_WIDTHS: Record<PreviewDevice, number> = {
  desktop: 1200,
  tablet: 768,
  mobile: 390,
};

export const DEFAULT_MODE: FunnelMode = 'build';
export const DEFAULT_DEVICE: PreviewDevice = 'desktop';

const MODE_KEY = 'funnel:mode';
const DEVICE_KEY = 'funnel:device';

const isMode = (value: unknown): value is FunnelMode =>
  typeof value === 'string' && (FUNNEL_MODES as readonly string[]).includes(value);

const isDevice = (value: unknown): value is PreviewDevice =>
  typeof value === 'string' && (PREVIEW_DEVICES as readonly string[]).includes(value);

export interface FunnelView {
  mode: FunnelMode;
  device: PreviewDevice;
}

/** What this device last chose, or the defaults. A stale or unknown value reads as the default. */
export async function savedView(database: BloomlabDatabase = db): Promise<FunnelView> {
  const device = await database.device.toCollection().first();
  const views = device?.lab_views ?? {};
  return {
    mode: isMode(views[MODE_KEY]) ? views[MODE_KEY] : DEFAULT_MODE,
    device: isDevice(views[DEVICE_KEY]) ? views[DEVICE_KEY] : DEFAULT_DEVICE,
  };
}

/** Records the choice. Touches nothing else on the device record and no run. */
export async function rememberView(
  patch: Partial<FunnelView>,
  database: BloomlabDatabase = db,
): Promise<void> {
  const device = await database.device.toCollection().first();
  if (!device) return;
  const views = { ...(device.lab_views ?? {}) };
  if (patch.mode) views[MODE_KEY] = patch.mode;
  if (patch.device) views[DEVICE_KEY] = patch.device;
  await database.device.put({ ...device, lab_views: views });
}
