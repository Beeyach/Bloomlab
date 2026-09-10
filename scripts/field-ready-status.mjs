#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const rows = readFileSync('REQUIREMENTS_MATRIX.md', 'utf8')
  .split(/\r?\n/)
  .filter((line) => /^\| [A-Z0-9]+-\d{3} \|/.test(line))
  .map((line) => {
    const [id, , priority, , status] = line
      .replace(/^\| /, '')
      .replace(/ \|$/, '')
      .split(' | ')
      .map((cell) => cell.trim());
    return { id, priority, status };
  });
const byId = new Map(rows.map((row) => [row.id, row]));
const expect = (id, status) =>
  assert.equal(byId.get(id)?.status, status, `${id} must be ${status}`);

for (const id of [
  'PRD-004',
  'PRD-009',
  'EXR-006',
  'DATA-006',
  'INF-011',
  'GHL-005',
  'GHL-010',
  'DES-018',
  'RSP-004',
  'A11Y-001',
])
  expect(id, 'PASSED');

for (const [id, status] of [
  ['EXR-008', 'PARTIAL'],
  ['PRI-002', 'PARTIAL'],
  ['NEG-003', 'PARTIAL'],
  ['DES-006', 'IN_PROGRESS'],
  ['DES-008', 'IN_PROGRESS'],
  ['DES-017', 'IN_PROGRESS'],
  ['RSP-002', 'IN_PROGRESS'],
  ['RSP-003', 'IN_PROGRESS'],
])
  expect(id, status);
expect('DES-009', 'IN_PROGRESS');

const parked = [
  'PRD-005',
  'CUR-015',
  'CUR-031',
  'FLD-001',
  'EXR-020',
  'CALL-002',
  'CALL-005',
  'CALL-006',
  'EXR-015',
  'VOI-006',
  'VOI-007',
  'SEC-005',
].sort();
assert.deepEqual(
  rows
    .filter((row) => row.status === 'IMPLEMENTED_UNVERIFIED')
    .map((row) => row.id)
    .sort(),
  parked,
  'The twelve human/real-GHL rows must remain the exact IMPLEMENTED_UNVERIFIED set',
);
const openP0P1 = rows.filter(
  (row) => ['P0', 'P1'].includes(row.priority) && row.status !== 'PASSED',
);
assert.equal(openP0P1.length, 21);
console.log(
  `Field-Ready status guard: 10 promoted; 8 target rows retained; 12 human/real-GHL rows unchanged; DES-009 IN_PROGRESS; ${openP0P1.length} P0/P1 rows open.`,
);
