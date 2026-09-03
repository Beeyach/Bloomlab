/** The version slice of the compiled curriculum, provided by the Vite plugin (spec §101). */
declare module 'virtual:bloomlab-content/version' {
  import type { ContentVersionInfo } from '@bloomlab/content-schema';

  const info: ContentVersionInfo;
  export default info;
}
