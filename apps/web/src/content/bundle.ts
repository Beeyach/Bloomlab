import bundle from 'virtual:bloomlab-content';

import type { ContentBundle, ContentType } from '@bloomlab/content-schema';

/**
 * The app's only door to curriculum content (CNT-001, CNT-006): the bundle compiled at build
 * time from `content/`. Nothing in the client parses YAML or MDX.
 */
export const content: ContentBundle = bundle;

/** Stamped on every saved attempt alongside app and simulator versions (spec §101). */
export const CONTENT_VERSION: string = bundle.content_version;

export const CONTENT_HASH: string = bundle.content_hash;

export function contentCount(type: ContentType): number {
  return content.counts[type];
}
