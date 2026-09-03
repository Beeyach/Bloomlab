import type { SyncEnvelope, SyncKind } from './sync';

/** What the server does with an incoming write (spec §91, TA§14; SYNC-008, SYNC-009). */
export type MergeDecision =
  | { action: 'apply'; revision: number }
  /** The server state is the valid latest; the client adopts it. */
  | { action: 'superseded' }
  /** Divergent edits on a snapshot entity from another device: the learner must choose. */
  | { action: 'conflict' };

/**
 * Pure merge rule, shared so the Worker applies it and clients can predict it. `baseRevision`
 * is the server revision the client last saw for the record; a match means the client built
 * on the latest state (fast-forward). Anything else is a divergence, resolved per entity kind,
 * never by silently discarding work.
 */
export function decideMerge(
  kind: SyncKind,
  existing: SyncEnvelope | null,
  incoming: SyncEnvelope,
  baseRevision: number,
  force = false,
): MergeDecision {
  if (!existing) return { action: 'apply', revision: 1 };
  const next = { action: 'apply' as const, revision: existing.revision + 1 };
  if (force) return next;
  if (existing.revision === baseRevision) return next;
  switch (kind) {
    case 'append':
      // Evidence rows are immutable and id-addressed: the same id means the same row.
      return { action: 'superseded' };
    case 'simple':
      return incoming.updated_at > existing.updated_at ? next : { action: 'superseded' };
    case 'snapshot':
      // The same device catching up with itself is not a conflict.
      return existing.device_id === incoming.device_id ? next : { action: 'conflict' };
  }
}
