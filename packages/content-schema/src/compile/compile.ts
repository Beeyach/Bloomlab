import type { ContentBundle, ContentIssue } from '../bundle.ts';
import { CONTENT_TYPES, type ContentType } from '../ids.ts';
import { LockSchema, ManifestSchema, type Lock, type Manifest } from '../schemas/index.ts';
import { buildContentCoverage, buildFreshness, buildGhlCoverage } from './coverage.ts';
import { parseYamlObject } from './parse.ts';
import { buildCampaignPaths, buildIndexes, buildSearchIndex } from './resolve.ts';
import {
  LOCK_PATH,
  MANIFEST_PATH,
  classifySources,
  countSourceFiles,
  hashSources,
  type ContentSources,
} from './sources.ts';
import { IssueList, crossValidate, parseAndValidateFiles } from './validate.ts';

export interface CompileOptions {
  /** Fail when the lock file does not match the sources (CI, production builds). */
  enforceLock?: boolean;
  /** Reference date for freshness; injected by tests for determinism. */
  now?: Date;
  /** Days after which a registry record counts as stale. */
  staleAfterDays?: number;
  /** Treat warnings as errors (not the default: warnings are reported, never fatal). */
  strict?: boolean;
}

export interface CompileResult {
  bundle: ContentBundle | null;
  issues: ContentIssue[];
  manifest: Manifest | null;
  lock: Lock | null;
  content_hash: string;
  file_count: number;
}

/** Thrown by `compileSources` when the content cannot be built. `issues` has every problem. */
export class ContentBuildError extends Error {
  readonly issues: ContentIssue[];

  constructor(issues: ContentIssue[]) {
    super(formatIssues(issues.filter((issue) => issue.level === 'error')));
    this.name = 'ContentBuildError';
    this.issues = issues;
  }
}

export function formatIssue(issue: ContentIssue): string {
  const where = [issue.file ?? '(content)', issue.path ? `@ ${issue.path}` : '']
    .filter(Boolean)
    .join(' ');
  return `${issue.level === 'error' ? 'ERROR' : 'warn '} [${issue.code}] ${where}: ${issue.message}`;
}

export function formatIssues(issues: ContentIssue[]): string {
  if (issues.length === 0) return 'Content build failed';
  const plural = issues.length === 1 ? '' : 's';
  return [
    `Content build failed with ${issues.length} error${plural}:`,
    ...issues.map(formatIssue),
  ].join('\n');
}

function readManifest(sources: ContentSources, issues: IssueList): Manifest | null {
  const text = sources.files[MANIFEST_PATH];
  if (text === undefined) {
    issues.error(
      'MANIFEST',
      MANIFEST_PATH,
      `Missing ${MANIFEST_PATH} (content_version, schema_version)`,
    );
    return null;
  }
  try {
    const result = ManifestSchema.safeParse(parseYamlObject(text, MANIFEST_PATH));
    if (result.success) return result.data;
    for (const issue of result.error.issues)
      issues.error('MANIFEST', MANIFEST_PATH, issue.message, { path: issue.path.join('.') });
  } catch (error) {
    issues.error('MANIFEST', MANIFEST_PATH, error instanceof Error ? error.message : String(error));
  }
  return null;
}

function readLock(sources: ContentSources, issues: IssueList): Lock | null {
  const text = sources.files[LOCK_PATH];
  if (text === undefined) return null;
  try {
    const result = LockSchema.safeParse(parseYamlObject(text, LOCK_PATH));
    if (result.success) return result.data;
    for (const issue of result.error.issues)
      issues.error('LOCK_MISMATCH', LOCK_PATH, issue.message, { path: issue.path.join('.') });
  } catch (error) {
    issues.error(
      'LOCK_MISMATCH',
      LOCK_PATH,
      error instanceof Error ? error.message : String(error),
    );
  }
  return null;
}

/** Whether the lock still describes these sources; the message says what to do when not. */
export function checkLock(
  manifest: Manifest,
  lock: Lock | null,
  contentHash: string,
): string | null {
  if (!lock)
    return `No ${LOCK_PATH}: run \`npm run content:lock\` to record content_version ${manifest.content_version}`;
  if (lock.content_version !== manifest.content_version) {
    return `${LOCK_PATH} records ${lock.content_version} but ${MANIFEST_PATH} says ${manifest.content_version}: run \`npm run content:lock\``;
  }
  if (lock.content_hash !== contentHash) {
    return `Content changed since content_version ${manifest.content_version} was locked: bump content_version in ${MANIFEST_PATH} and run \`npm run content:lock\``;
  }
  return null;
}

/**
 * source → validate → resolve → compile (spec §100). Never throws; `bundle` is null when there
 * are errors. `compileSources` is the throwing convenience wrapper.
 */
export async function validateSources(
  sources: ContentSources,
  options: CompileOptions = {},
): Promise<CompileResult> {
  const issues = new IssueList();
  const now = options.now ?? new Date();
  const contentHash = hashSources(sources);
  const fileCount = countSourceFiles(sources);

  const manifest = readManifest(sources, issues);
  const lock = readLock(sources, issues);
  if (manifest && options.enforceLock) {
    const problem = checkLock(manifest, lock, contentHash);
    if (problem) issues.error('LOCK_MISMATCH', LOCK_PATH, problem);
  }

  const { files, rejected } = classifySources(sources);
  for (const { path, reason } of rejected) issues.error('INVALID_FORMAT', path, reason);

  const parsed = await parseAndValidateFiles(files, issues);
  const { graph } = crossValidate(parsed, issues);

  const errors = issues.errors;
  const fatal = options.strict ? issues.issues : errors;
  if (fatal.length > 0 || !manifest) {
    return {
      bundle: null,
      issues: issues.issues,
      manifest,
      lock,
      content_hash: contentHash,
      file_count: fileCount,
    };
  }

  const counts = Object.fromEntries(CONTENT_TYPES.map((type) => [type, 0])) as Record<
    ContentType,
    number
  >;
  counts.skills = parsed.skills.length;
  counts['ghl-features'] = parsed.ghl_features.length;
  counts.campaigns = parsed.campaigns.length;
  counts['learning-units'] = parsed.learning_units.length;
  counts.exercises = parsed.exercises.length;
  counts.scenarios = parsed.scenarios.length;
  counts.clients = parsed.clients.length;
  counts['voice-characters'] = parsed.voice_characters.length;
  counts.rubrics = parsed.rubrics.length;
  counts.projects = parsed.projects.length;
  counts.portfolio = parsed.portfolio.length;
  counts.glossary = parsed.glossary.length;

  const bundle: ContentBundle = {
    content_version: manifest.content_version,
    content_hash: contentHash,
    schema_version: manifest.schema_version,
    counts,
    skills: parsed.skills,
    ghl_features: parsed.ghl_features,
    campaigns: parsed.campaigns,
    learning_units: parsed.learning_units,
    exercises: parsed.exercises,
    scenarios: parsed.scenarios,
    clients: parsed.clients,
    voice_characters: parsed.voice_characters,
    rubrics: parsed.rubrics,
    projects: parsed.projects,
    portfolio: parsed.portfolio,
    glossary: parsed.glossary,
    graph,
    campaign_paths: buildCampaignPaths(parsed, graph),
    indexes: buildIndexes(parsed),
    coverage: { content: buildContentCoverage(parsed), ghl: buildGhlCoverage(parsed) },
    freshness: buildFreshness(parsed, now, options.staleAfterDays),
    search: buildSearchIndex(parsed),
    warnings: issues.warnings,
  };
  return {
    bundle,
    issues: issues.issues,
    manifest,
    lock,
    content_hash: contentHash,
    file_count: fileCount,
  };
}

/** Compiles or throws `ContentBuildError` (the build fails; CNT-005). */
export async function compileSources(
  sources: ContentSources,
  options: CompileOptions = {},
): Promise<ContentBundle> {
  const result = await validateSources(sources, options);
  if (!result.bundle) throw new ContentBuildError(result.issues);
  return result.bundle;
}
