/** Public immutable CI identity, compiled into both browser and Worker. Never a secret. */
declare const __BLOOMLAB_BUILD_ID__: string;
export const BUILD_ID =
  typeof __BLOOMLAB_BUILD_ID__ === 'undefined' ? 'local' : __BLOOMLAB_BUILD_ID__;
