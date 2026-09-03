import { beforeEach, describe, expect, it } from 'vitest';

import {
  DEMONSTRATION_RULES,
  EVIDENCE_KINDS,
  evaluateSkill,
  isDemonstration,
  type EvidenceKind,
  type EvidenceResult,
  type HintLevel,
} from '../src/index.ts';
import { BETA, at, evidence, resetCounter } from './fixtures.ts';

beforeEach(resetCounter);

/**
 * Exactly which evidence resets the review clock (`last_demonstrated`). The skill starts with
 * one unassisted demonstration on day 1; the candidate is added on day 5; the clock has moved
 * only if `last_demonstrated` is now day 5.
 */
const prior = () => evidence({ skill: BETA.id, kind: 'independent_exercise', at: at(1) });

function clockMoves(candidate: ReturnType<typeof evidence>): boolean {
  const result = evaluateSkill(BETA, [prior(), candidate], new Date(at(6)));
  expect(result.last_demonstrated).not.toBeNull();
  return result.last_demonstrated === candidate.occurred_at;
}

type Row = {
  kind: EvidenceKind;
  result?: EvidenceResult;
  hints?: HintLevel[];
  realGhl?: boolean;
  critical?: string[];
  resets: boolean;
};

const byKind: Row[] = [
  { kind: 'retrieval', resets: true },
  { kind: 'explanation', resets: true },
  { kind: 'sales_use', resets: true },
  { kind: 'fieldwork', realGhl: true, resets: true },
  { kind: 'real_ghl', realGhl: true, resets: true },
  { kind: 'pressure_test', resets: true },
  { kind: 'independent_exercise', resets: true },
  { kind: 'deterministic_exercise', resets: true },
  { kind: 'guided_practice', resets: false },
  { kind: 'quiz', result: 'passed', resets: false },
  { kind: 'exposure', result: 'exposed', resets: false },
];

const byResult: Row[] = [
  { kind: 'independent_exercise', result: 'failed', resets: false },
  { kind: 'independent_exercise', result: 'partial', resets: false },
  { kind: 'independent_exercise', result: 'passed', critical: ['c1'], resets: false },
  { kind: 'retrieval', result: 'failed', resets: false },
  { kind: 'sales_use', result: 'partial', resets: false },
];

const byAssistance: Row[] = [
  { kind: 'independent_exercise', hints: ['nudge'], resets: true },
  { kind: 'independent_exercise', hints: ['nudge', 'nudge'], resets: true },
  { kind: 'independent_exercise', hints: ['nudge', 'nudge', 'nudge'], resets: false },
  { kind: 'independent_exercise', hints: ['concept_reminder'], resets: false },
  { kind: 'retrieval', hints: ['worked_example'], resets: false },
  { kind: 'explanation', hints: ['worked_example'], resets: false },
];

const byProof: Row[] = [
  { kind: 'fieldwork', realGhl: false, resets: false },
  { kind: 'real_ghl', realGhl: false, resets: false },
];

const label = (row: Row) =>
  `${row.kind} ${row.result ?? 'passed'}${row.hints?.length ? ` with ${row.hints.join('+')}` : ''}${
    row.realGhl === false ? ' without proof' : ''
  }${row.critical ? ' with a critical failure' : ''} → ${row.resets ? 'resets' : 'does not reset'}`;

const toEvidence = (row: Row) =>
  evidence({
    skill: BETA.id,
    kind: row.kind,
    at: at(5),
    exercise: row.kind === 'exposure' || row.kind === 'quiz' ? null : 'EX-EDGE_CASE-two',
    ...(row.result ? { result: row.result } : {}),
    ...(row.hints ? { hints: row.hints } : {}),
    ...(row.realGhl !== undefined ? { realGhl: row.realGhl } : {}),
    ...(row.critical ? { critical: row.critical } : {}),
  });

describe('what resets the review clock (DEMONSTRATION_RULES)', () => {
  it('is declared explicitly, kind by kind', () => {
    expect([...DEMONSTRATION_RULES.kinds]).toEqual([
      'deterministic_exercise',
      'independent_exercise',
      'pressure_test',
      'explanation',
      'sales_use',
      'fieldwork',
      'real_ghl',
      'retrieval',
    ]);
    expect(DEMONSTRATION_RULES.results).toEqual(['passed']);
    expect(DEMONSTRATION_RULES.max_assistance).toBe('light');
    expect([...DEMONSTRATION_RULES.proof_required_for]).toEqual(['fieldwork', 'real_ghl']);
    // Every kind is classified one way or the other; none is left implicit.
    const covered = new Set(byKind.map((row) => row.kind));
    expect([...EVIDENCE_KINDS].filter((kind) => !covered.has(kind))).toEqual([]);
  });

  it.each(byKind.map((row) => [label(row), row] as const))('by kind: %s', (_, row) => {
    const candidate = toEvidence(row);
    expect(isDemonstration(candidate)).toBe(row.resets);
    expect(clockMoves(candidate)).toBe(row.resets);
  });

  it.each(byResult.map((row) => [label(row), row] as const))('by result: %s', (_, row) => {
    const candidate = toEvidence(row);
    expect(isDemonstration(candidate)).toBe(row.resets);
    expect(clockMoves(candidate)).toBe(row.resets);
  });

  it.each(byAssistance.map((row) => [label(row), row] as const))('by assistance: %s', (_, row) => {
    const candidate = toEvidence(row);
    expect(isDemonstration(candidate)).toBe(row.resets);
    expect(clockMoves(candidate)).toBe(row.resets);
  });

  it.each(byProof.map((row) => [label(row), row] as const))('by proof: %s', (_, row) => {
    const candidate = toEvidence(row);
    expect(isDemonstration(candidate)).toBe(row.resets);
    expect(clockMoves(candidate)).toBe(row.resets);
  });

  it('a failed retrieval moves nothing forward and forces NEEDS_REFRESH', () => {
    const history = [
      prior(),
      evidence({
        skill: BETA.id,
        kind: 'independent_exercise',
        at: at(2),
        exercise: 'EX-EDGE_CASE-two',
      }),
      evidence({ skill: BETA.id, kind: 'retrieval', result: 'failed', at: at(5) }),
    ];
    const result = evaluateSkill(BETA, history, new Date(at(6)));
    expect(result.last_demonstrated).toBe(at(2));
    expect(result.state).toBe('NEEDS_REFRESH');
    expect(result.refresh_reason).toBe('failed_retrieval');
  });

  it('unverified fieldwork is not a pass anywhere: not GUIDED, not a demonstration', () => {
    const unproven = evidence({ skill: BETA.id, kind: 'fieldwork', at: at(1), realGhl: false });
    const result = evaluateSkill(BETA, [unproven], new Date(at(2)));
    expect(result.state).toBe('LEARNING');
    expect(result.counts.passes).toBe(0);
    expect(result.last_demonstrated).toBeNull();
  });
});
