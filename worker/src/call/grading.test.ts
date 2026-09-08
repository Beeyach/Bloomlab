import { describe, expect, it } from 'vitest';
import type { AiGrading } from '@bloomlab/shared';
import { validateLearnerQuotations } from './grading';

const grade = (reason: string): AiGrading => ({
  score: 82,
  rubric_results: [{ id: 'jargon', passed: true, reason }],
  critical_issue: null,
  strengths: [],
  improvements: [],
  next_probe: 'Ask about ownership.',
  confidence: 0.9,
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
