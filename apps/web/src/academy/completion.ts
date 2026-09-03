import { useLiveQuery } from 'dexie-react-hooks';

import type { LearningUnit } from '@bloomlab/content-schema';

import { db, type BloomlabDatabase } from '../data/db';
import { ensureDevice } from '../data/device';
import { recordEvidence } from '../data/learning';
import { unitCompletionId } from '../data/learning/ids';

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
 *
 * One logical completion is one row per taught skill, on every device (D-062): the row's id is
 * derived from the unit, the skill and the learner, so a device that finishes the unit while
 * offline mints the id another device would have minted. Locally that means a second Finish
 * writes nothing; after a sync it means the two pushes address one row and the append merge
 * supersedes the later one instead of keeping both.
 */
export async function completeUnit(
  unit: Pick<LearningUnit, 'id' | 'skills'>,
  database: BloomlabDatabase = db,
): Promise<{ recorded: boolean; occurred_at: string }> {
  const existing = await findUnitCompletion(unit.id, database);
  if (existing) return { recorded: false, occurred_at: existing.occurred_at };
  const device = await ensureDevice(database);
  const evidenceIds = Object.fromEntries(
    unit.skills.map((skillId) => [skillId, unitCompletionId(unit.id, skillId, device.learner_id)]),
  );
  try {
    const { evidence } = await recordEvidence(
      {
        skill_ids: unit.skills,
        kind: 'exposure',
        result: 'exposed',
        source: { type: 'learning_unit', id: unit.id },
        evidence_ids: evidenceIds,
      },
      database,
    );
    const occurredAt = evidence[0]?.occurred_at ?? new Date().toISOString();
    return { recorded: true, occurred_at: occurredAt };
  } catch (error) {
    // A completion that arrived from another device between the check and the write (or two
    // Finishes racing) collides on that id rather than adding a row: report the one that stands.
    const now = await findUnitCompletion(unit.id, database);
    if (now) return { recorded: false, occurred_at: now.occurred_at };
    throw error;
  }
}
