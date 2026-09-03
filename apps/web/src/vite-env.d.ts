/// <reference types="vite/client" />

/** The compiled curriculum (spec §100, CNT-006), provided by the Vite plugin at build time. */
declare module 'virtual:bloomlab-content' {
  import type { ContentBundle } from '@bloomlab/content-schema';

  const bundle: ContentBundle;
  export default bundle;
}

declare module 'virtual:bloomlab-content/version' {
  import type { ContentVersionInfo } from '@bloomlab/content-schema';

  const info: ContentVersionInfo;
  export default info;
}

/** Every Academy unit's MDX body as a lazily imported React component (Phase 8). */
declare module 'virtual:bloomlab-content/units' {
  import type { ElementType, JSX } from 'react';

  export interface UnitContentProps {
    components?: Record<string, ElementType>;
  }
  export type UnitContent = (props: UnitContentProps) => JSX.Element;
  export const unitModules: Record<string, () => Promise<{ default: UnitContent }>>;
}
