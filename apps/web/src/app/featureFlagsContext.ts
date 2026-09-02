import { createContext, useContext } from 'react';

import type { FeatureFlagSet } from '@bloomlab/shared';

export const FeatureFlagsContext = createContext<FeatureFlagSet | null>(null);

export function useFeatureFlags(): FeatureFlagSet {
  const flags = useContext(FeatureFlagsContext);
  if (!flags) throw new Error('useFeatureFlags must be used inside <FeatureFlagsProvider>');
  return flags;
}
