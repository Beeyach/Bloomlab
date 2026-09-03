import { lazy, type LazyExoticComponent, type ComponentType } from 'react';

import { type FeatureFlag, type FeatureFlagSet, isFeatureEnabled } from '@bloomlab/shared';

export interface AppRoute {
  id: string;
  path: string;
  /** When set, the route is registered only if the flag is on (INF-010). */
  flag?: FeatureFlag;
  /** Lazy so every screen is its own chunk from day one (PERF-001). */
  Component: LazyExoticComponent<ComponentType>;
}

export const APP_ROUTES: readonly AppRoute[] = [
  {
    id: 'home',
    path: '/',
    Component: lazy(() => import('../screens/FoundationHome')),
  },
  {
    id: 'sync',
    path: '/sync',
    Component: lazy(() => import('../screens/SyncScreen')),
  },
  {
    id: 'system',
    path: '/system',
    flag: 'system_diagnostics',
    Component: lazy(() => import('../screens/SystemDiagnostics')),
  },
  {
    id: 'design',
    path: '/design',
    flag: 'design_gallery',
    Component: lazy(() => import('../screens/DesignGallery')),
  },
];

export function enabledRoutes(flags: FeatureFlagSet): AppRoute[] {
  return APP_ROUTES.filter((route) => !route.flag || isFeatureEnabled(flags, route.flag));
}
