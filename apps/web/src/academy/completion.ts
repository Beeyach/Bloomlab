import { useLiveQuery } from 'dexie-react-hooks';

import type { LearningUnit } from '@bloomlab/content-schema';

import { db, type BloomlabDatabase } from '../data/db';
import { recordEvidence } from '../data/learning';

export interface UnitCompletion {
  occurred_at: string;
}

/**
 * The learner's explicit completion of a unit, if any: the exposure evidence row whose source is
 * this learning unit. Opening a unit records nothing; only "Finish this unit" does.
 */
export async function findUnitCompletion(
  unitId: string,
  database: BloomlabDatabase = db,
): Promise<UnitCompletion | null> {
  const device = await database.device.toCollection().first();
  if (!device) return null;
  const row = await database.skill_evidence
    .filter(
      (evidence) =>
        evidence.deleted_at === null &&
        evidence.learner_id === device.learner_id &&
        evidence.kind === 'exposure' &&
        evidence.source.type === 'learning_unit' &&
        evidence.source.id === unitId,
    )
    .first();
  return row ? { occurred_at: row.occurred_at } : null;
}

/** Undefined while loading, null when the unit has not been finished on this learner's record. */
export function useUnitCompletion(
  unitId: string,
  database: BloomlabDatabase = db,
): UnitCompletion | null | undefined {
  return useLiveQuery(() => findUnitCompletion(unitId, database), [unitId, database]);
}

/**
 * Records that the learner finished reading a unit: exposure evidence for every skill the unit
 * teaches, through the one evidence write path (recordEvidence recomputes progress). Exposure
 * moves a skill from UNSEEN to LEARNING and never further; it carries no score and no assistance.
 * A unit already finished is not recorded again — the engine has no use for a second exposure —
 * so reopening or re-reading a unit never inflates the record (D-062).
 */
export async function completeUnit(
  unit: Pick<LearningUnit, 'id' | 'skills'>,
  database: BloomlabDatabase = db,
): Promise<{ recorded: boolean; occurred_at: string }> {
  const existing = await findUnitCompletion(unit.id, database);
  if (existing) return { recorded: false, occurred_at: existing.occurred_at };
  const { evidence } = await recordEvidence(
    {
      skill_ids: unit.skills,
      kind: 'exposure',
      result: 'exposed',
      source: { type: 'learning_unit', id: unit.id },
    },
    database,
  );
  const occurredAt = evidence[0]?.occurred_at ?? new Date().toISOString();
  return { recorded: true, occurred_at: occurredAt };
}
