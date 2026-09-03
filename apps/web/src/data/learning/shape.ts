import type { SkillEvidence } from '@bloomlab/mastery-engine';

import type { SkillEvidenceRecord } from '../types';

/** The engine's evidence shape: the record without the sync-only envelope fields. */
export function stripEnvelope(record: SkillEvidenceRecord): SkillEvidence {
  const {
    created_at: _c,
    updated_at: _u,
    revision: _r,
    device_id: _d,
    deleted_at: _x,
    ...rest
  } = record;
  return rest;
}
