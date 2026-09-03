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
