#!/usr/bin/env node
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { parse as parseYaml } from 'yaml';

import {
  BLOOMLAB_TERMS,
  GENERIC_OR_INSTANCE_TERMS,
  HISTORICAL_TERMS,
  NATIVE_CONFIGURATION_TERMS,
  SURFACES,
} from './ghl-terminology-policy.mjs';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const relativePath = (path) => relative(ROOT, path).replaceAll('\\', '/');
const read = (path) => readFileSync(resolve(ROOT, path), 'utf8');
const walk = (root) =>
  readdirSync(root).flatMap((name) => {
    const path = resolve(root, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const containsTerm = (text, term, insensitive = false) =>
  new RegExp(`(?<![\\p{L}\\p{N}])${escape(term)}(?![\\p{L}\\p{N}])`, insensitive ? 'iu' : 'u').test(
    text,
  );

const registry = walk(resolve(ROOT, 'content/ghl-features'))
  .filter((path) => extname(path) === '.yaml')
  .map((path) => ({ path: relativePath(path), ...parseYaml(readFileSync(path, 'utf8')) }))
  .sort((a, b) => a.id.localeCompare(b.id));
const registryById = new Map(registry.map((feature) => [feature.id, feature]));
const officialByName = new Map(registry.map((feature) => [feature.official_name, feature]));
const aliasByName = new Map(
  registry.flatMap((feature) =>
    (feature.aliases ?? []).map((alias) => [
      alias,
      { id: feature.id, official: feature.official_name },
    ]),
  ),
);

const problems = [];
const assertRegistryIds = (entry, kind) => {
  for (const id of entry.feature_ids ?? []) {
    if (!registryById.has(id)) problems.push(`${kind} ${entry.term} references missing ${id}`);
  }
};
for (const entry of NATIVE_CONFIGURATION_TERMS) assertRegistryIds(entry, 'configuration term');

const segments = [];
const push = (file, location, text, visibleLabel = false) => {
  if (typeof text === 'string' && text.trim())
    segments.push({ file, location, text, visibleLabel });
};
const flattenYaml = (file, value, pointer = '$') => {
  if (typeof value === 'string') push(file, pointer, value);
  else if (Array.isArray(value))
    value.forEach((item, index) => flattenYaml(file, item, `${pointer}[${index}]`));
  else if (value && typeof value === 'object')
    Object.entries(value).forEach(([key, item]) => flattenYaml(file, item, `${pointer}.${key}`));
};
const extractTypeScript = (path, sourceText = readFileSync(path, 'utf8')) => {
  const file = relativePath(path);
  const source = ts.createSourceFile(
    file,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    extname(path) === '.tsx' ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const visit = (node) => {
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isJsxText(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node)
    ) {
      const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
      const parent = node.parent;
      const visibleLabel =
        ts.isJsxText(node) &&
        ts.isJsxElement(parent) &&
        parent.children.every(ts.isJsxText) &&
        /^(h[1-6]|label|legend|button|option|summary)$/.test(
          parent.openingElement.tagName.getText(source),
        );
      push(file, `line ${line + 1}`, node.text ?? node.getText(source), visibleLabel);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
};

const scopedFiles = new Set();
for (const surface of SURFACES) {
  for (const root of surface.roots) {
    const absolute = resolve(ROOT, root);
    if (!statSync(absolute).isDirectory())
      problems.push(`surface ${surface.id} root is not a directory: ${root}`);
    for (const path of walk(absolute)) {
      const extension = extname(path);
      const file = relativePath(path);
      if (
        !['.ts', '.tsx', '.yaml', '.mdx'].includes(extension) ||
        /\.test\.[^.]+$/.test(file) ||
        file.startsWith('content/ghl-features/')
      )
        continue;
      scopedFiles.add(file);
    }
  }
  const [proofPath, proofNeedle] = surface.proof;
  if (!read(proofPath).includes(proofNeedle))
    problems.push(
      `surface ${surface.id} lost registry/classification proof ${proofPath}: ${proofNeedle}`,
    );
}

for (const file of [...scopedFiles].sort()) {
  const path = resolve(ROOT, file);
  if (extname(path) === '.yaml') flattenYaml(file, parseYaml(readFileSync(path, 'utf8')));
  else if (extname(path) === '.mdx')
    readFileSync(path, 'utf8')
      .split(/\r?\n/)
      .forEach((line, index) => push(file, `line ${index + 1}`, line));
  else extractTypeScript(path);
}

if (process.argv.includes('--negative-control'))
  extractTypeScript(resolve(ROOT, 'negative-control.tsx'), '<h2>Custom fields</h2>');

const hits = {
  registry_ids: [],
  official_names: [],
  configuration_terms: [],
  bloomlab_terms: [],
  generic_or_instances: [],
  historical_terms: [],
};
const record = (kind, segment, term, feature_ids = []) =>
  hits[kind].push({ file: segment.file, location: segment.location, term, feature_ids });

const singularVariants = new Map();
for (const feature of registry) {
  const words = feature.official_name.split(' ');
  const last = words.at(-1);
  let singular = null;
  if (last?.endsWith('ies')) singular = `${last.slice(0, -3)}y`;
  else if (last?.endsWith('sses')) singular = last.slice(0, -2);
  else if (last?.endsWith('s') && !last.endsWith('ss')) singular = last.slice(0, -1);
  if (singular) singularVariants.set([...words.slice(0, -1), singular].join(' '), feature);
}

for (const segment of segments) {
  for (const id of segment.text.match(/GHL-[A-Z0-9]+(?:-[A-Z0-9]+)+/g) ?? []) {
    if (!registryById.has(id))
      problems.push(`${segment.file} ${segment.location}: unknown registry id ${id}`);
    else record('registry_ids', segment, id, [id]);
  }
  for (const [name, feature] of officialByName) {
    if (containsTerm(segment.text, name)) record('official_names', segment, name, [feature.id]);
    const label = segment.text.trim().replace(/\s+/g, ' ');
    if (segment.visibleLabel && label !== name && label.toLowerCase() === name.toLowerCase())
      problems.push(
        `${segment.file} ${segment.location}: native label ${JSON.stringify(label)} must use official_name ${JSON.stringify(name)} (${feature.id})`,
      );
  }
  for (const [alias, target] of aliasByName) {
    if (!containsTerm(segment.text, alias)) continue;
    const historical = HISTORICAL_TERMS.find(
      (entry) =>
        entry.term === alias && entry.path === segment.file && segment.text.includes(entry.marker),
    );
    if (historical) record('historical_terms', segment, alias, [target.id]);
    else
      problems.push(
        `${segment.file} ${segment.location}: stale alias ${JSON.stringify(alias)}; use ${JSON.stringify(target.official)}`,
      );
  }
  for (const entry of NATIVE_CONFIGURATION_TERMS) {
    if (containsTerm(segment.text, entry.term))
      record('configuration_terms', segment, entry.term, entry.feature_ids);
  }
  for (const term of BLOOMLAB_TERMS) {
    if (containsTerm(segment.text, term)) record('bloomlab_terms', segment, term);
  }
  for (const term of GENERIC_OR_INSTANCE_TERMS) {
    if (containsTerm(segment.text, term)) record('generic_or_instances', segment, term);
  }
  for (const [variant, feature] of singularVariants) {
    if (!containsTerm(segment.text, variant)) continue;
    if (GENERIC_OR_INSTANCE_TERMS.includes(variant)) continue;
    problems.push(
      `${segment.file} ${segment.location}: unclassified native-name variant ${JSON.stringify(variant)} for ${feature.id} (${feature.official_name})`,
    );
  }
  for (const historical of HISTORICAL_TERMS) {
    if (!containsTerm(segment.text, historical.term)) continue;
    if (segment.file === historical.path && segment.text.includes(historical.marker))
      record('historical_terms', segment, historical.term);
    else
      problems.push(
        `${segment.file} ${segment.location}: historical term ${JSON.stringify(historical.term)} lacks its approved historical context`,
      );
  }

  const brandPattern =
    /\b(?:HighLevel|GoHighLevel|GHL)(?:'s|’s)?\s+([A-Z][A-Za-z0-9&/-]*(?:\s+(?:[A-Z][A-Za-z0-9&/-]*|AI|API)){0,3})/gu;
  for (const match of segment.text.matchAll(brandPattern)) {
    const whole = match[0];
    const candidate = match[1];
    if (BLOOMLAB_TERMS.some((term) => whole.startsWith(term))) continue;
    const known = [
      ...officialByName.keys(),
      ...NATIVE_CONFIGURATION_TERMS.map((entry) => entry.term),
      ...GENERIC_OR_INSTANCE_TERMS,
      ...HISTORICAL_TERMS.map((entry) => entry.term),
    ].some(
      (term) =>
        candidate === term || candidate.startsWith(`${term} `) || term.startsWith(`${candidate} `),
    );
    if (!known)
      problems.push(
        `${segment.file} ${segment.location}: unclassified feature-like phrase ${JSON.stringify(whole)}`,
      );
  }
}

for (const historical of HISTORICAL_TERMS) {
  const source = segments.filter((segment) => segment.file === historical.path);
  if (!source.some((segment) => segment.text.includes(historical.marker)))
    problems.push(`historical policy marker disappeared: ${historical.path}: ${historical.marker}`);
}

const dedupe = (rows) => {
  const unique = new Map();
  for (const row of rows) unique.set(`${row.file}\0${row.location}\0${row.term}`, row);
  return [...unique.values()].sort(
    (a, b) =>
      a.file.localeCompare(b.file) ||
      a.location.localeCompare(b.location) ||
      a.term.localeCompare(b.term),
  );
};
for (const key of Object.keys(hits)) hits[key] = dedupe(hits[key]);

const surfaceReport = SURFACES.map((surface) => {
  const files = [...scopedFiles].filter((file) =>
    surface.roots.some((root) => file === root || file.startsWith(`${root}/`)),
  );
  const allHits = Object.values(hits)
    .flat()
    .filter((hit) => files.includes(hit.file));
  return { id: surface.id, files: files.length, classified_occurrences: allHits.length };
});
const report = {
  schema_version: 2,
  coverage_boundary:
    'Known registry IDs, names, aliases, native heading casing and branded phrases are checked. Arbitrary unprefixed feature names and contextual generic-name exceptions are not exhaustively classified; GHL-005/GHL-010 remain PARTIAL.',
  registry_records: registry.length,
  scoped_files: scopedFiles.size,
  text_segments: segments.length,
  surfaces: surfaceReport,
  counts: Object.fromEntries(Object.entries(hits).map(([key, rows]) => [key, rows.length])),
  problems: [...new Set(problems)].sort(),
  inventory: hits,
};
const outputDirectory = resolve(ROOT, '.content');
const negativeControl = process.argv.includes('--negative-control');
mkdirSync(outputDirectory, { recursive: true });
if (!negativeControl)
  writeFileSync(
    resolve(outputDirectory, 'ghl-terminology.json'),
    `${JSON.stringify(report, null, 2)}\n`,
  );
const markdown = [
  '# HighLevel terminology audit',
  '',
  report.coverage_boundary,
  `Registry records: ${report.registry_records}`,
  `Learner-facing source files: ${report.scoped_files}`,
  `Extracted text segments: ${report.text_segments}`,
  '',
  '| Surface | Files | Classified occurrences |',
  '| --- | ---: | ---: |',
  ...surfaceReport.map(
    (surface) => `| ${surface.id} | ${surface.files} | ${surface.classified_occurrences} |`,
  ),
  '',
  '| Classification | Occurrences |',
  '| --- | ---: |',
  ...Object.entries(report.counts).map(
    ([kind, count]) => `| ${kind.replaceAll('_', ' ')} | ${count} |`,
  ),
  '',
  report.problems.length ? `Problems: ${report.problems.length}` : 'Problems: 0',
  ...report.problems.map((problem) => `- ${problem}`),
  '',
].join('\n');
if (!negativeControl) writeFileSync(resolve(outputDirectory, 'ghl-terminology.md'), markdown);

if (report.problems.length) {
  console.error(`GHL-005/GHL-010: ${report.problems.length} terminology problem(s).`);
  for (const problem of report.problems) console.error(`- ${problem}`);
  process.exitCode = 1;
} else {
  console.log(
    `GHL-005/GHL-010: ${registry.length} registry records; ${scopedFiles.size} learner-facing files; ${segments.length} text segments; no detected ID, alias, native-heading or branded-phrase problems (bounded coverage).`,
  );
  console.log('Reports: .content/ghl-terminology.json and .content/ghl-terminology.md');
}
