#!/usr/bin/env node
/**
 * Content compiler CLI (spec §99–§101, CNT-005 … CNT-007, CNT-011).
 *
 *   node scripts/content.mjs build   compile content/, write .content/ reports; exit 1 on errors
 *   node scripts/content.mjs check   same, plus the version lock must match (CI)
 *   node scripts/content.mjs lock    record the current sources under content_version
 *
 * Runs the TypeScript compiler sources directly (Node 22.18 strips types).
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  formatIssue,
  renderSummary,
  validateContentDir,
  writeLock,
  writeReports,
} from '@bloomlab/content-schema/node';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const CONTENT_DIR = resolve(ROOT, 'content');
const OUT_DIR = resolve(ROOT, '.content');

const command = process.argv[2] ?? 'build';

async function build(enforceLock) {
  const result = await validateContentDir(CONTENT_DIR, { enforceLock });
  const errors = result.issues.filter((issue) => issue.level === 'error');
  const warnings = result.issues.filter((issue) => issue.level === 'warning');
  for (const issue of errors) console.error(formatIssue(issue));
  if (!result.bundle) {
    console.error(
      `\nContent build failed: ${errors.length} error${errors.length === 1 ? '' : 's'} in ${result.file_count} files.`,
    );
    process.exit(1);
  }
  const written = await writeReports(result.bundle, OUT_DIR);
  console.log(renderSummary(result.bundle));
  if (warnings.length === 0) console.log('no warnings');
  console.log(`reports: ${written.map((path) => path.replace(ROOT, '.')).join(', ')}`);
}

switch (command) {
  case 'build':
    await build(false);
    break;
  case 'check':
    await build(true);
    break;
  case 'lock': {
    const lock = await writeLock(CONTENT_DIR);
    console.log(
      `locked content_version ${lock.content_version} (${lock.content_hash.slice(0, 12)}, ${lock.files} files)`,
    );
    break;
  }
  default:
    console.error(`Unknown command "${command}". Use build, check or lock.`);
    process.exit(2);
}
