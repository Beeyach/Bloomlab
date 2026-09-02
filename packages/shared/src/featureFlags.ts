import type { RuntimeEnvironment } from './environment';

/**
 * Simple feature flags (TA§72, INF-010). Flags keep half-finished interfaces out of the
 * product; a flagged-off route is unreachable in the UI and by URL.
 *
 * `system_diagnostics` is a developer surface (versions, environment, API health) and is
 * never enabled in production. The remaining flags are the ones named by the spec and stay
 * off until their phases land.
 */
export const FEATURE_FLAGS = [
  'system_diagnostics',
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
  voice_calls: false,
  workflow_lab_v2: false,
  ai_negotiation: false,
  custom_objects: false,
  ghl_verification: false,
};

const FLAGS_BY_ENVIRONMENT: Readonly<Record<RuntimeEnvironment, FeatureFlagSet>> = {
  local: { ...ALL_OFF, system_diagnostics: true },
  preview: { ...ALL_OFF, system_diagnostics: true },
  production: ALL_OFF,
};

export function getFeatureFlags(environment: RuntimeEnvironment): FeatureFlagSet {
  return FLAGS_BY_ENVIRONMENT[environment];
}

export function isFeatureEnabled(flags: FeatureFlagSet, flag: FeatureFlag): boolean {
  return flags[flag];
}
