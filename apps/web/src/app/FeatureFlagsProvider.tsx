import type { ReactNode } from 'react';

import type { FeatureFlagSet } from '@bloomlab/shared';

import { FeatureFlagsContext } from './featureFlagsContext';

export function FeatureFlagsProvider({
  flags,
  children,
}: {
  flags: FeatureFlagSet;
  children: ReactNode;
}) {
  return <FeatureFlagsContext.Provider value={flags}>{children}</FeatureFlagsContext.Provider>;
}
