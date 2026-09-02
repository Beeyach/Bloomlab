#!/usr/bin/env node
/**
 * Validates Bloomlab's project-control documents (spec §125–§127, §139, §163).
 *
 *  - Phase 0 spec package files exist
 *  - REQUIREMENTS_MATRIX.md rows: 6 cells, known prefix, unique ID, valid priority / status / phase, non-empty text and spec ref
 *  - IMPLEMENTATION_STATUS.md: status sections (PASSED, IN PROGRESS, PARTIAL, BLOCKED, FAILED, DEFERRED) agree with the matrix
 *  - ACCEPTANCE_TESTS.md: every referenced ID exists; every non-deferred P0 / P1 requirement has acceptance criteria
 *  - Every requirement ID referenced in any control document exists
 *
 * Usage: node scripts/validate-requirements.mjs
 * Exit code 1 on errors. No dependencies.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

const PREFIXES = [
  'PRD', 'CUR', 'MAS', 'EXR', 'SIM', 'WFL', 'CRM', 'FUN', 'CAL', 'CONV', 'PAY', 'REP', 'SAL', 'PRI', 'NEG', 'CALL',
  'FLD', 'PORT', 'DES', 'HOL', 'MOT', 'RSP', 'A11Y', 'SYNC', 'DATA', 'AI', 'VOI', 'INF', 'PERF', 'SEC', 'CNT', 'GHL',
];
const PRIORITIES = ['P0', 'P1', 'P2', 'P3'];
const STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'IMPLEMENTED_UNVERIFIED', 'PASSED', 'PARTIAL', 'BLOCKED', 'DEFERRED', 'FAILED'];
const MAX_PHASE = 26;

const REQUIRED_FILES = [
  'BLOOMLAB_MASTER_SPEC.md',
  'CLAUDE.md',
  'PRODUCT_VISION.md',
  'CURRICULUM_MASTER_MAP.md',
  'DESIGN_SYSTEM.md',
  'TECH_ARCHITECTURE.md',
  'CONTENT_ARCHITECTURE.md',
  'SIMULATOR_SPEC.md',
  'EXERCISE_ENGINE.md',
  'REQUIREMENTS_MATRIX.md',
  'ACCEPTANCE_TESTS.md',
  'IMPLEMENTATION_STATUS.md',
  'KNOWN_LIMITATIONS.md',
  'CHANGELOG.md',
  'docs/DECISIONS.md',
];

const STATUS_SECTIONS = {
  'PASSED': 'PASSED',
  'IN PROGRESS': 'IN_PROGRESS',
  'PARTIAL': 'PARTIAL',
  'BLOCKED': 'BLOCKED',
  'FAILED': 'FAILED',
  'DEFERRED': 'DEFERRED',
};

const ID_RE = new RegExp(`\\b(?:${PREFIXES.join('|')})-\\d{3}\\b`, 'g');

const errors = [];
const warnings = [];
const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf8').split(/\r?\n/);
const pad = (n) => String(n).padStart(3, '0');

// 1. Required files
const missing = REQUIRED_FILES.filter((f) => !existsSync(resolve(ROOT, f)));
missing.forEach((f) => errors.push(`missing required file: ${f}`));

// 2. Requirements matrix
const matrix = new Map();
if (!missing.includes('REQUIREMENTS_MATRIX.md')) {
  read('REQUIREMENTS_MATRIX.md').forEach((line, i) => {
    if (!/^\| [A-Z0-9]+-\d{3} \|/.test(line)) return;
    const where = `REQUIREMENTS_MATRIX.md:${i + 1}`;
    const cells = line.replace(/^\| /, '').replace(/ \|$/, '').split(' | ').map((c) => c.trim());
    if (cells.length !== 6) {
      errors.push(`${where}: expected 6 cells, got ${cells.length}`);
      return;
    }
    const [id, text, priority, phase, status, spec] = cells;
    const prefix = id.slice(0, id.lastIndexOf('-'));
    if (!PREFIXES.includes(prefix)) errors.push(`${where}: unknown prefix "${prefix}" (spec §125)`);
    if (matrix.has(id)) errors.push(`${where}: duplicate ID ${id}`);
    if (!PRIORITIES.includes(priority)) errors.push(`${where}: invalid priority "${priority}" (spec §127)`);
    if (!STATUSES.includes(status)) errors.push(`${where}: invalid status "${status}" (spec §126)`);
    const phaseOk =
      phase === 'all' ||
      (phase === '—' && status === 'DEFERRED') ||
      (/^\d+$/.test(phase) && Number(phase) <= MAX_PHASE);
    if (!phaseOk) errors.push(`${where}: invalid phase "${phase}" (0–${MAX_PHASE}, "all", or "—" for DEFERRED)`);
    if (!text) errors.push(`${where}: empty requirement text`);
    if (!spec) errors.push(`${where}: empty spec reference`);
    matrix.set(id, { id, prefix, text, priority, phase, status, spec, line: i + 1 });
  });
  if (matrix.size === 0) errors.push('REQUIREMENTS_MATRIX.md: no requirement rows found');

  // numbering gaps per prefix (warning only — IDs are never reused, so gaps are legal but suspicious)
  const byPrefix = new Map();
  for (const r of matrix.values()) {
    if (!byPrefix.has(r.prefix)) byPrefix.set(r.prefix, []);
    byPrefix.get(r.prefix).push(Number(r.id.slice(-3)));
  }
  for (const [prefix, nums] of byPrefix) {
    const have = new Set(nums);
    for (let n = 1; n <= Math.max(...nums); n++) {
      if (!have.has(n)) warnings.push(`${prefix}: numbering gap at ${prefix}-${pad(n)}`);
    }
  }
}

// 3. IMPLEMENTATION_STATUS.md sections agree with matrix
if (!missing.includes('IMPLEMENTATION_STATUS.md') && matrix.size) {
  const sections = new Map();
  let current = null;
  for (const line of read('IMPLEMENTATION_STATUS.md')) {
    const h = line.match(/^## (.+)$/);
    if (h) {
      current = h[1].trim().toUpperCase();
      if (!sections.has(current)) sections.set(current, new Set());
      continue;
    }
    if (current) for (const m of line.matchAll(ID_RE)) sections.get(current).add(m[0]);
  }
  for (const [section, status] of Object.entries(STATUS_SECTIONS)) {
    const listed = sections.get(section) ?? new Set();
    const expected = new Set([...matrix.values()].filter((r) => r.status === status).map((r) => r.id));
    for (const id of listed) {
      if (!matrix.has(id)) errors.push(`IMPLEMENTATION_STATUS.md: "## ${section}" lists unknown ID ${id}`);
      else if (!expected.has(id)) errors.push(`IMPLEMENTATION_STATUS.md: ${id} listed under "## ${section}" but matrix status is ${matrix.get(id).status}`);
    }
    for (const id of expected) {
      if (!listed.has(id)) errors.push(`IMPLEMENTATION_STATUS.md: ${id} has matrix status ${status} but is not listed under "## ${section}"`);
    }
  }
}

// 4. ACCEPTANCE_TESTS.md coverage
if (!missing.includes('ACCEPTANCE_TESTS.md') && matrix.size) {
  const atIds = new Set(read('ACCEPTANCE_TESTS.md').join('\n').match(ID_RE) ?? []);
  for (const r of matrix.values()) {
    if ((r.priority === 'P0' || r.priority === 'P1') && r.status !== 'DEFERRED' && !atIds.has(r.id)) {
      errors.push(`ACCEPTANCE_TESTS.md: ${r.id} (${r.priority}) has no acceptance criteria`);
    }
  }
}

// 5. Every referenced ID in every control document exists
for (const f of REQUIRED_FILES) {
  if (missing.includes(f) || f === 'BLOOMLAB_MASTER_SPEC.md' || f === 'REQUIREMENTS_MATRIX.md') continue;
  const ids = new Set(read(f).join('\n').match(ID_RE) ?? []);
  for (const id of ids) if (!matrix.has(id)) errors.push(`${f}: references unknown requirement ${id}`);
}

// 6. Report
const countBy = (key) => {
  const out = {};
  for (const r of matrix.values()) out[r[key]] = (out[r[key]] ?? 0) + 1;
  return out;
};
console.log(`Requirements: ${matrix.size}`);
console.log(`By status:   ${JSON.stringify(countBy('status'))}`);
console.log(`By priority: ${JSON.stringify(countBy('priority'))}`);
const passed = [...matrix.values()].filter((r) => r.status === 'PASSED').map((r) => r.id);
console.log(`PASSED:      ${passed.length ? passed.join(', ') : 'none'}`);

if (warnings.length) {
  console.log(`\nWarnings (${warnings.length}):`);
  warnings.forEach((w) => console.log(`  - ${w}`));
}
if (errors.length) {
  console.error(`\nErrors (${errors.length}):`);
  errors.forEach((e) => console.error(`  - ${e}`));
  process.exit(1);
}
console.log('\nOK — control documents are consistent.');
