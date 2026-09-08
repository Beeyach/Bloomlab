import { createHash } from 'node:crypto';

import { CONTENT_TYPES, type ContentType } from '../ids.ts';

/**
 * A content tree as text: relative POSIX paths (`skills/SK-….yaml`, `content.yaml`) to file
 * contents. Reading from disk is the Node entry's job; tests pass these in memory.
 */
export interface ContentSources {
  files: Record<string, string>;
}

export const MANIFEST_PATH = 'content.yaml';
export const LOCK_PATH = 'content.lock.yaml';

/** Formats each folder accepts (CNT-003): YAML for definitions, MDX for learning units. */
export const FOLDER_EXTENSIONS: Readonly<Record<ContentType, readonly string[]>> = {
  skills: ['.yaml', '.yml'],
  'ghl-features': ['.yaml', '.yml'],
  campaigns: ['.yaml', '.yml'],
  'learning-units': ['.mdx'],
  exercises: ['.yaml', '.yml'],
  scenarios: ['.yaml', '.yml'],
  clients: ['.yaml', '.yml'],
  'voice-characters': ['.yaml', '.yml'],
  rubrics: ['.yaml', '.yml'],
  projects: ['.yaml', '.yml'],
  portfolio: ['.yaml', '.yml'],
  glossary: ['.yaml', '.yml'],
};

/** Files that are allowed to sit in the tree without being content (docs, lock, manifest). */
const IGNORED_FILES = new Set([MANIFEST_PATH, LOCK_PATH, 'README.md']);

export interface SourceFile {
  path: string;
  type: ContentType;
  /** File name without extension: must equal the record's `id`. */
  stem: string;
  extension: string;
  text: string;
}

export function isIgnoredPath(path: string): boolean {
  if (IGNORED_FILES.has(path)) return true;
  const name = path.split('/').pop() ?? path;
  return name === 'README.md' || name.startsWith('.');
}

/** Splits the tree into typed source files; unknown folders and bad extensions become issues. */
export function classifySources(sources: ContentSources): {
  files: SourceFile[];
  rejected: { path: string; reason: string }[];
} {
  const files: SourceFile[] = [];
  const rejected: { path: string; reason: string }[] = [];
  for (const path of Object.keys(sources.files).sort()) {
    if (isIgnoredPath(path)) continue;
    const segments = path.split('/');
    const folder = segments[0] ?? '';
    const type = (CONTENT_TYPES as readonly string[]).includes(folder)
      ? (folder as ContentType)
      : null;
    if (!type || segments.length !== 2) {
      rejected.push({
        path,
        reason: `Not inside one of the content folders (${CONTENT_TYPES.join(', ')})`,
      });
      continue;
    }
    const name = segments[1] ?? '';
    const dot = name.lastIndexOf('.');
    const extension = dot >= 0 ? name.slice(dot) : '';
    const stem = dot >= 0 ? name.slice(0, dot) : name;
    if (!FOLDER_EXTENSIONS[type].includes(extension)) {
      rejected.push({
        path,
        reason: `${type} accepts ${FOLDER_EXTENSIONS[type].join(' / ')} files only`,
      });
      continue;
    }
    files.push({ path, type, stem, extension, text: sources.files[path] ?? '' });
  }
  return { files, rejected };
}

/** Everything the compiler consumes: the records and the manifest; never the lock, README or dotfiles. */
export function isHashed(path: string): boolean {
  return path === MANIFEST_PATH || (path !== LOCK_PATH && !isIgnoredPath(path));
}

/** SHA-256 over every hashed path and its bytes, in path order: the identity of a content set. */
export function hashSources(sources: ContentSources): string {
  const hash = createHash('sha256');
  for (const path of Object.keys(sources.files).sort()) {
    if (!isHashed(path)) continue;
    hash.update(path);
    hash.update('\0');
    hash.update(sources.files[path] ?? '');
    hash.update('\0');
  }
  return hash.digest('hex');
}

export function countSourceFiles(sources: ContentSources): number {
  return Object.keys(sources.files).filter(isHashed).length;
}
