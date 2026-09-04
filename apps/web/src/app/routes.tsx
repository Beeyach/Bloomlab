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
    Component: lazy(() => import('../screens/CommandCenter')),
  },
  {
    id: 'campaign',
    path: '/campaign',
    Component: lazy(() => import('../screens/CampaignScreen')),
  },
  {
    id: 'skills',
    path: '/skills',
    Component: lazy(() => import('../screens/SkillMap')),
  },
  {
    id: 'skill',
    path: '/skills/:skillId',
    Component: lazy(() => import('../screens/SkillMap')),
  },
  {
    id: 'academy-unit',
    path: '/academy/:unitId',
    Component: lazy(() => import('../academy/AcademyUnit')),
  },
  {
    id: 'exercise',
    path: '/exercise/:exerciseId',
    Component: lazy(() => import('../exercise/ExerciseRunner')),
  },
  {
    id: 'crm',
    path: '/crm',
    Component: lazy(() => import('../crm/CrmLab')),
  },
  {
    id: 'workflow',
    path: '/workflow',
    Component: lazy(() => import('../workflow/WorkflowLab')),
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
    id: 'simulator',
    path: '/system/simulator',
    flag: 'system_diagnostics',
    Component: lazy(() => import('../screens/SimulatorHarness')),
  },
  {
    id: 'holo-diagnostic',
    path: '/system/holo',
    flag: 'system_diagnostics',
    Component: lazy(() => import('../screens/HoloDiagnostic')),
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
