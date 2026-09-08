import { describe, expect, it } from 'vitest';
import type { AiGrading } from '@bloomlab/shared';
import content from 'virtual:bloomlab-content';
import { callGradingContract, validateLearnerQuotations } from './grading';

const grade = (reason: string): AiGrading => ({
  score: 82,
  rubric_results: [{ id: 'jargon', passed: true, reason }],
  critical_issue: null,
  strengths: [],
  improvements: [],
  next_probe: 'Ask about ownership.',
  confidence: 0.9,
});

describe('CALL-003 proposal provider contract', () => {
  const rubric = content.rubrics.find((r) => r.id === 'CALL_PERFORMANCE_RUBRIC_V1')!;
  const contract = callGradingContract(rubric);
  const wire = () => ({
    ...grade(''),
    rubric_results: Object.fromEntries(
      [...rubric.items]
        .reverse()
        .map(({ id }) => [
          id,
          { passed: true, reason: 'Turn 4 checks written scope and acceptance.' },
        ]),
    ),
  });
  it('requires all eight named properties in the provider schema and restores authored public order', () => {
    expect(contract.format).toMatchObject({
      properties: {
        rubric_results: {
          type: 'object',
          additionalProperties: false,
          required: rubric.items.map((r) => r.id),
        },
      },
    });
    expect(contract.parse(wire()).rubric_results.map((r) => r.id)).toEqual(
      rubric.items.map((r) => r.id),
    );
  });
  it('rejects the live failure mechanism: missing or substituted dimensions cannot be accepted', () => {
    const missing = wire();
    delete missing.rubric_results.questions;
    expect(() => contract.parse(missing)).toThrow();
    const extra = wire();
    extra.rubric_results.summary = { passed: true, reason: 'A summary cannot replace the rubric.' };
    expect(() => contract.parse(extra)).toThrow();
    expect(() => contract.parse(grade('One dimension only'))).toThrow();
  });
  it('keeps critical consistency, field bounds and exact learner quotations mandatory', () => {
    expect(() => contract.parse({ ...wire(), critical_issue: 'Required failure alone' })).toThrow(
      'Critical result mismatch',
    );
    const failed = wire();
    failed.rubric_results.pitch_timing!.passed = false;
    expect(() => contract.parse(failed)).toThrow('Critical result mismatch');
    expect(() => contract.parse({ ...wire(), score: 101 })).toThrow();
    const misattributed = wire();
    misattributed.rubric_results.jargon!.reason = 'The learner offered "guaranteed growth".';
    expect(() =>
      validateLearnerQuotations(contract.parse(misattributed), [
        'We should review the written scope.',
      ]),
    ).toThrow('not confirmed');
  });
});
const learner = ["I've asked Tina to inspect one unanswered quote.", 'Who owns follow-up?'];
describe('CALL-003 learner evidence citations', () => {
  it.each([
    "Learner used Gary's terminology ('Tina', 'ServiceTitan').",
    'Learner mentioned "ServiceTitan".',
    'Learner asked “Which part of following up a replacement quote do you want to understand?”.',
    'Learner said ‘Send me a short agenda’.',
  ])('rejects client-only wording credited in a rubric explanation: %s', (reason) => {
    expect(() => validateLearnerQuotations(grade(reason), learner)).toThrow('not confirmed');
  });
  it.each([
    'Learner used concrete language: "Tina" and “unanswered quote”.',
    "Learner's question 'Who owns follow-up?' checks ownership.",
    "Learner said 'I've asked Tina to inspect one unanswered quote.'",
    'Learner asked about ownership in response to the client context.',
  ])('accepts literal learner quotations and contextual paraphrases: %s', (reason) => {
    expect(() => validateLearnerQuotations(grade(reason), learner)).not.toThrow();
  });
  it('checks strengths and critical claims while allowing clearly separate future suggestions', () => {
    const result = grade('The learner checks ownership.');
    result.strengths = ['Used "ServiceTitan".'];
    expect(() => validateLearnerQuotations(result, learner)).toThrow();
    result.strengths = [];
    result.critical_issue = 'Promised "a guaranteed conversion increase".';
    expect(() => validateLearnerQuotations(result, learner)).toThrow();
    result.critical_issue = null;
    result.improvements = ['Next time, ask "Who will verify the handover?"'];
    expect(() => validateLearnerQuotations(result, learner)).not.toThrow();
  });
});
