import { describe, expect, it } from 'vitest';
import { FieldworkSchema, reasoningItems, ExerciseSchema } from '../src/index.ts';
import { exercise } from './fixtures.ts';
const legacy = {
  required: true,
  tasks: ['Build the system'],
  evidence: ['screenshot', 'configuration_answers', 'explanation', 'test_results'],
  reasoning_questions: ['Why this design?'],
};
const item = { key: 'answer', prompt: 'Describe the configuration' };
describe('FLD-001 content contract', () => {
  it('preserves existing enum evidence/string reasoning authoring', () => {
    const parsed = FieldworkSchema.parse(legacy);
    expect(reasoningItems(parsed)).toEqual([
      { key: 'reasoning_1', prompt: 'Why this design?', required: true },
    ]);
  });
  it('supports optional screenshots and stable keyed proof, rejecting duplicates and missing reasoning', () => {
    const value = {
      ...legacy,
      proof: {
        screenshots: [{ ...item, required: false }],
        configuration: [item],
        explanations: [item],
        tests: [item],
      },
    };
    expect(FieldworkSchema.parse(value).proof?.screenshots[0]?.required).toBe(false);
    expect(
      FieldworkSchema.safeParse({ ...value, proof: { ...value.proof, tests: [item, item] } })
        .success,
    ).toBe(false);
    expect(FieldworkSchema.safeParse({ ...value, reasoning_questions: [] }).success).toBe(false);
  });
  it('continues to reject FIELDWORK without required real GHL work', () => {
    expect(
      ExerciseSchema.safeParse({
        ...exercise,
        id: 'EX-FIELDWORK-test',
        type: 'FIELDWORK',
        fieldwork: { ...legacy, required: false },
      }).success,
    ).toBe(false);
  });
});
