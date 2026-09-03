import { Suspense } from 'react';
import { Route, Routes } from 'react-router';

import { getFeatureFlags, type FeatureFlagSet } from '@bloomlab/shared';

import { NotFound } from '../screens/NotFound';
import { FeatureFlagsProvider } from './FeatureFlagsProvider';
import { RootLayout } from './RootLayout';
import { RouteLoading } from './RouteLoading';
import { ScreenErrorBoundary } from './ScreenErrorBoundary';
import { enabledRoutes } from './routes';
import { getRuntimeEnvironment } from './runtime';

export function App({
  flags = getFeatureFlags(getRuntimeEnvironment()),
}: {
  flags?: FeatureFlagSet;
}) {
  return (
    <FeatureFlagsProvider flags={flags}>
      <Routes>
        <Route element={<RootLayout />}>
          {enabledRoutes(flags).map(({ id, path, Component }) => (
            <Route
              key={id}
              path={path}
              element={
                <ScreenErrorBoundary resetKey={path}>
                  <Suspense fallback={<RouteLoading />}>
                    <Component />
                  </Suspense>
                </ScreenErrorBoundary>
              }
            />
          ))}
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </FeatureFlagsProvider>
  );
}
