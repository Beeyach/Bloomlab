// Controlled evidence only: proves technical routing, never real learner or GHL acceptance.
import { content } from '../content/bundle';
import { recordEvidence } from '../data/learning/evidence';
import type { BloomlabDatabase } from '../data/db';
import type { EvidenceResult, HintLevel } from '@bloomlab/mastery-engine';
import { emptyResponse } from '../exercise/response';
import { evidenceKindFor } from '../exercise/finalize';
export async function projectEvidence(
  database: BloomlabDatabase,
  exerciseId: string,
  options: { choice?: string; at?: string; result?: EvidenceResult; hints?: HintLevel[] } = {},
) {
  const exercise = content.exercises.find((row) => row.id === exerciseId)!;
  const at = options.at ?? '2026-09-09T12:00:00.000Z';
  return recordEvidence(
    {
      skill_ids: exercise.skills,
      kind: evidenceKindFor(exercise, 'normal'),
      result: options.result ?? 'passed',
      source: { type: exercise.type === 'FIELDWORK' ? 'fieldwork' : 'exercise', id: exercise.id },
      exercise_id: exercise.id,
      exercise_type: exercise.type,
      score: 100,
      hints_used: options.hints ?? [],
      difficulty: exercise.difficulty,
      mode: exercise.mode,
      occurred_at: at,
      started_at: at,
      response: {
        ...emptyResponse(),
        choice:
          exercise.decision_options.find((option) => option.value === options.choice)?.value ??
          exercise.decision_options[0]?.value ??
          null,
        text: 'Controlled canonical evidence fixture; not a real client or human GHL result.',
      },
      real_ghl:
        exercise.type === 'FIELDWORK'
          ? { required: true, provided: true, evidence: ['fixture:test:training-proof'] }
          : null,
    },
    database,
    { recompute: false },
  );
}
