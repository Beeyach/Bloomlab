import { lazy, type LazyExoticComponent } from 'react';
import {
  unitModules,
  type UnitContent,
  type UnitContentProps,
} from 'virtual:bloomlab-content/units';

export type { UnitContent, UnitContentProps };

/**
 * The compiled body of every learning unit as a lazy component: one chunk per unit, fetched only
 * when that unit is opened (PERF-001). The MDX was compiled at build time from
 * `content/learning-units/`; the client never parses MDX (CNT-006).
 */
export const UNIT_COMPONENTS: Readonly<Record<string, LazyExoticComponent<UnitContent>>> =
  Object.fromEntries(Object.entries(unitModules).map(([unitId, loader]) => [unitId, lazy(loader)]));
