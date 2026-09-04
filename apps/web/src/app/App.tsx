import { Suspense } from 'react';
import { Route, Routes } from 'react-router';

import { getFeatureFlags, type FeatureFlagSet } from '@bloomlab/shared';

// Registers the CRM Lab as an exercise runtime. A side-effect import because the registration
// must happen whether or not the learner has opened /crm — the Lab's screen is lazy-loaded, but
// an exercise authored against its account has to be gradable from the runner (D-097).
import '../crm/exerciseRuntime';
// And the Workflow Lab, which grades workflow exercises from the run the learner built in (D-112).
import '../workflow/exerciseRuntime';
// And the Funnel Lab, which grades a FUNNEL ASSEMBLY from the funnel the learner built (D-121).
import '../funnel/exerciseRuntime';
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
