/**
 * Ids for derived learner rows (skill progress, campaign progress, review queue). They are
 * recomputed from evidence on every device, so two devices must produce the same id for the
 * same skill — and two learners must not (D1 keys rows by id). Hence `<prefix>:<key>:<hash of
 * learner id>`. Evidence and attempts keep random ids: they are append-only facts.
 */
export function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export const derivedId = (prefix: 'sp' | 'cp' | 'rq', key: string, learnerId: string): string =>
  `${prefix}:${key}:${fnv1a(learnerId)}`;

/** True when a derived id belongs to `learnerId` (used to purge rows after re-keying). */
export const derivedIdBelongsTo = (id: string, learnerId: string): boolean =>
  id.endsWith(`:${fnv1a(learnerId)}`);

/** Prefix of the one evidence row whose id is not random: an Academy unit completion. */
const UNIT_COMPLETION_PREFIX = 'ue';

/**
 * The id of the exposure row that records "this learner finished this unit, for this skill"
 * (D-062). Deterministic, so two devices that finish the same unit while offline mint the same
 * id: the append merge treats one id as one row (`superseded`, no conflict dialog) and they
 * converge on a single completion instead of a union of two. The learner hash keeps two
 * learners off one D1 primary key exactly as `derivedId` does — and is why linking re-keys
 * these rows (`adoptLearner`). Every other evidence row keeps its random id: two attempts are
 * two facts.
 */
export const unitCompletionId = (unitId: string, skillId: string, learnerId: string): string =>
  `${UNIT_COMPLETION_PREFIX}:${unitId}:${skillId}:${fnv1a(learnerId)}`;

export const isUnitCompletionId = (id: string): boolean =>
  id.startsWith(`${UNIT_COMPLETION_PREFIX}:`);
