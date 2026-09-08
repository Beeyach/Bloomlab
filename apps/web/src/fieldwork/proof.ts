import { reasoningItems, type Exercise } from '@bloomlab/content-schema';
import type { EvidenceAsset, FieldworkResponse } from '@bloomlab/shared';

export const contractFor = (exercise: Exercise) => JSON.stringify(exercise.fieldwork);
export const emptyFieldwork = (exercise: Exercise): FieldworkResponse => ({
  version: 1,
  contract: contractFor(exercise),
  phase: 'build',
  configuration: {},
  explanations: {},
  tests: {},
  screenshots: {},
  reasoning: {},
  confirmed: false,
  checkpoint: null,
});
export function proofMissing(exercise: Exercise, proof: FieldworkResponse): string[] {
  const config = exercise.fieldwork?.proof;
  if (exercise.type !== 'FIELDWORK' || !exercise.fieldwork?.required || !config)
    return ['This fieldwork definition needs structured proof.'];
  if (proof.contract !== contractFor(exercise))
    return ['This task changed. Review the updated instructions and keep your saved answers.'];
  const missing: string[] = [];
  for (const group of ['configuration', 'explanations'] as const)
    for (const item of config[group])
      if (item.required && !proof[group][item.key]?.trim()) missing.push(item.prompt);
  for (const item of config.screenshots)
    if (item.required && !proof.screenshots[item.key]) missing.push(`Screenshot: ${item.prompt}`);
  for (const item of config.tests)
    if (item.required) {
      const test = proof.tests[item.key];
      if (!test?.observed.trim() || test.status !== 'passed')
        missing.push(`Fix/retest: ${item.prompt}`);
    }
  return missing;
}
export function completionMissing(exercise: Exercise, proof: FieldworkResponse): string[] {
  const missing = proofMissing(exercise, proof);
  if (!proof.checkpoint) missing.push('Save the proof checkpoint before reasoning.');
  for (const item of exercise.fieldwork ? reasoningItems(exercise.fieldwork) : [])
    if (item.required && !proof.reasoning[item.key]?.trim()) missing.push(item.prompt);
  if (!proof.confirmed)
    missing.push('Confirm you performed this work in your GHL training/subaccount.');
  return missing;
}
export function evidenceReferences(exercise: Exercise, proof: FieldworkResponse): string[] {
  const config = exercise.fieldwork!.proof!;
  return [
    ...config.screenshots
      .filter((i) => proof.screenshots[i.key])
      .map((i) => `asset:${proof.screenshots[i.key]}`),
    ...(['configuration', 'explanations'] as const).flatMap((group) =>
      config[group].filter((i) => proof[group][i.key]?.trim()).map((i) => `${group}:${i.key}`),
    ),
    ...config.tests
      .filter((i) => proof.tests[i.key]?.status === 'passed' && proof.tests[i.key]?.observed.trim())
      .map((i) => `test:${i.key}`),
    ...reasoningItems(exercise.fieldwork!)
      .filter((i) => proof.reasoning[i.key]?.trim())
      .map((i) => `reasoning:${i.key}`),
  ].slice(0, 60);
}
export function validAsset(
  asset: EvidenceAsset,
  exercise: Exercise,
  attemptId: string,
  key: string,
  id: string,
) {
  return (
    asset.asset_id === id &&
    asset.attempt_id === attemptId &&
    asset.exercise_id === exercise.id &&
    asset.item_key === key &&
    asset.status === 'ready' &&
    !asset.deleted_at
  );
}
