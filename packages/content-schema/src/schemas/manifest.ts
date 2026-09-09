import { z } from 'zod';
import { advancedTopics } from './advanced.ts';

/**
 * `content/content.yaml`: the release stamp of the curriculum (spec §101, CNT-007, INF-013).
 * `content_version` is date-based (`2026.09.17`, optionally `.n` for a second release that day)
 * and must be bumped whenever any content file changes; the lock file enforces that.
 */
export const CONTENT_VERSION_PATTERN = /^\d{4}\.\d{2}\.\d{2}(?:\.\d+)?$/;

export const ManifestSchema = z.strictObject({
  content_version: z.string().regex(CONTENT_VERSION_PATTERN, 'Expected YYYY.MM.DD or YYYY.MM.DD.n'),
  /** Bumped when the schemas change shape in a way that invalidates older bundles. */
  schema_version: z.number().int().min(1),
  advanced_coverage: advancedTopics,
  advanced_paths_enforced: z.boolean().default(false),
  notes: z.string().optional(),
});

export type Manifest = z.infer<typeof ManifestSchema>;

/** `content/content.lock.yaml`, written by `npm run content:lock`. */
export const LockSchema = z.strictObject({
  content_version: z.string().regex(CONTENT_VERSION_PATTERN),
  /** SHA-256 over every content source file (path + bytes), hex. */
  content_hash: z.string().regex(/^[0-9a-f]{64}$/),
  files: z.number().int().min(1),
});

export type Lock = z.infer<typeof LockSchema>;
