import type { RuntimeEnvironment } from './environment';

/**
 * Simple feature flags (TA§72, INF-010). Flags keep half-finished interfaces out of the
 * product; a flagged-off route is unreachable in the UI and by URL.
 *
 * `system_diagnostics` (versions, environment, API health) and `design_gallery` (every
 * primitive and semantic component in every state, for visual review) are developer
 * surfaces and are never enabled in production. The remaining flags are the ones named by
 * the spec and stay off until their phases land.
 */
export const FEATURE_FLAGS = [
  'system_diagnostics',
  'design_gallery',
  'voice_calls',
  'workflow_lab_v2',
  'ai_negotiation',
  'custom_objects',
  'ghl_verification',
] as const;

export type FeatureFlag = (typeof FEATURE_FLAGS)[number];

export type FeatureFlagSet = Readonly<Record<FeatureFlag, boolean>>;

const ALL_OFF: FeatureFlagSet = {
  system_diagnostics: false,
  design_gallery: false,
  voice_calls: false,
  workflow_lab_v2: false,
  ai_negotiation: false,
  custom_objects: false,
  ghl_verification: false,
};

const FLAGS_BY_ENVIRONMENT: Readonly<Record<RuntimeEnvironment, FeatureFlagSet>> = {
  local: { ...ALL_OFF, system_diagnostics: true, design_gallery: true, voice_calls: true },
  preview: { ...ALL_OFF, system_diagnostics: true, design_gallery: true, voice_calls: true },
  production: ALL_OFF,
};

export function getFeatureFlags(environment: RuntimeEnvironment): FeatureFlagSet {
  return FLAGS_BY_ENVIRONMENT[environment];
}

export function isFeatureEnabled(flags: FeatureFlagSet, flag: FeatureFlag): boolean {
  return flags[flag];
}
