import type { Exercise } from '@bloomlab/content-schema';
import type { FieldworkResponse } from '@bloomlab/shared';
import { db, type BloomlabDatabase } from '../data/db';
import { editFieldwork, type AttemptContext } from '../exercise/attempt';
import { completionMissing, proofMissing, validAsset } from './proof';
import { localEvidence, readEvidence } from './assets';

export async function verifyAssets(
  exercise: Exercise,
  proof: FieldworkResponse,
  attemptId: string,
  database: BloomlabDatabase = db,
) {
  for (const item of exercise.fieldwork?.proof?.screenshots ?? []) {
    const id = proof.screenshots[item.key];
    if (!id) continue;
    const local = await localEvidence(id, database);
    if (local && local.status !== 'uploaded')
      throw new Error('Upload or remove the selected screenshot before continuing.');
    const asset = await readEvidence(id, database);
    if (!validAsset(asset, exercise, attemptId, item.key, id))
      throw new Error('A screenshot is missing or deleted. Replace it before continuing.');
  }
}
export async function checkpointProof(
  exercise: Exercise,
  context: AttemptContext,
  attemptId: string,
  database: BloomlabDatabase = db,
) {
  return editFieldwork(
    exercise,
    context,
    async (proof) => {
      const missing = proofMissing(exercise, proof);
      if (missing.length) throw new Error(`Complete the proof first: ${missing.join(' ')}`);
      await verifyAssets(exercise, proof, attemptId, database);
      return { ...proof, checkpoint: new Date().toISOString(), phase: 'reasoning' };
    },
    database,
  );
}
export async function verifyCompletion(
  exercise: Exercise,
  proof: FieldworkResponse | undefined,
  attemptId: string,
  database: BloomlabDatabase = db,
) {
  if (!proof) throw new Error('Complete the practical proof before submitting.');
  const missing = completionMissing(exercise, proof);
  if (missing.length) throw new Error(`Not complete yet: ${missing.join(' ')}`);
  await verifyAssets(exercise, proof, attemptId, database);
}
