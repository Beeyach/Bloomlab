import { describe, expect, it } from 'vitest';

import { parseRuntimeEnvironment, RUNTIME_ENVIRONMENTS } from './environment';
import { FEATURE_FLAGS, getFeatureFlags, isFeatureEnabled } from './featureFlags';

describe('feature flags', () => {
  it('defines a value for every flag in every environment', () => {
    for (const environment of RUNTIME_ENVIRONMENTS) {
      const flags = getFeatureFlags(environment);
      for (const flag of FEATURE_FLAGS) {
        expect(typeof flags[flag]).toBe('boolean');
      }
    }
  });

  it('turns every flag off in production', () => {
    const flags = getFeatureFlags('production');
    for (const flag of FEATURE_FLAGS) {
      expect(isFeatureEnabled(flags, flag)).toBe(false);
    }
  });

  it('enables the developer surfaces only outside production', () => {
    for (const flag of ['system_diagnostics', 'design_gallery'] as const) {
      expect(isFeatureEnabled(getFeatureFlags('local'), flag)).toBe(true);
      expect(isFeatureEnabled(getFeatureFlags('preview'), flag)).toBe(true);
      expect(isFeatureEnabled(getFeatureFlags('production'), flag)).toBe(false);
    }
  });

  it('enables call acceptance in preview while keeping production calls off', () => {
    expect(getFeatureFlags('preview').voice_calls).toBe(true);
    expect(getFeatureFlags('production').voice_calls).toBe(false);
  });
});

describe('parseRuntimeEnvironment', () => {
  it('accepts the three known environments', () => {
    for (const environment of RUNTIME_ENVIRONMENTS) {
      expect(parseRuntimeEnvironment(environment)).toBe(environment);
    }
  });

  it('rejects unknown values instead of defaulting', () => {
    expect(() => parseRuntimeEnvironment('staging')).toThrow(/Unknown runtime environment/);
    expect(() => parseRuntimeEnvironment(undefined)).toThrow(/Unknown runtime environment/);
  });
});
