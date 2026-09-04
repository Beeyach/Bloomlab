import type { Funnel } from '@bloomlab/simulator-core';

/**
 * Undo and redo over funnel drafts (FUN-001, D-110 applied to funnels).
 *
 * The same shape the Workflow Lab's draft history has, over a different definition: every edit
 * that means something — a step added, a block moved, a reference connected — pushes a new
 * present and clears the future. The list is the editor's, not the engine's: undoing never
 * appends to or rewrites the account's event history. What reaches the account is the draft the
 * learner saves, as one `FUNNEL_UPDATED` event, and an undo after a save is an unsaved draft
 * again.
 *
 * A drag in progress is not an edit. Only the drop calls `edit`, which is what keeps a reorder
 * from writing a coordinate stream into the outbox (SYNC-007).
 */

export interface FunnelHistory {
  past: Funnel[];
  present: Funnel;
  future: Funnel[];
  /** The definition as last saved to the account, to tell "dirty" from "clean". */
  saved: Funnel;
}

/** Enough to walk back a long session, small enough to never matter. */
const LIMIT = 200;

export const startHistory = (present: Funnel): FunnelHistory => ({
  past: [],
  present,
  future: [],
  saved: present,
});

/** One meaningful edit. A no-op edit (same definition) leaves the history alone. */
export function edit(history: FunnelHistory, next: Funnel): FunnelHistory {
  if (sameDefinition(history.present, next)) return history;
  const past = [...history.past, history.present];
  return {
    ...history,
    past: past.length > LIMIT ? past.slice(past.length - LIMIT) : past,
    present: next,
    future: [],
  };
}

export const canUndo = (history: FunnelHistory): boolean => history.past.length > 0;
export const canRedo = (history: FunnelHistory): boolean => history.future.length > 0;

export function undo(history: FunnelHistory): FunnelHistory {
  const previous = history.past.at(-1);
  if (!previous) return history;
  return {
    ...history,
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
  };
}

export function redo(history: FunnelHistory): FunnelHistory {
  const [next, ...rest] = history.future;
  if (!next) return history;
  return { ...history, past: [...history.past, history.present], present: next, future: rest };
}

/** After the account accepted the draft: the present is now what is saved. History is kept. */
export const markSaved = (
  history: FunnelHistory,
  saved: Funnel = history.present,
): FunnelHistory => ({
  ...history,
  saved,
});

/** True when the present differs from what the account holds. Versions are the engine's. */
export const isDirty = (history: FunnelHistory): boolean =>
  !sameDefinition(history.present, history.saved);

const withoutVersion = (funnel: Funnel) => {
  const { version: _version, ...rest } = funnel;
  return rest;
};

/** Two drafts are the same when their architecture is, whatever version the account is on. */
export const sameDefinition = (a: Funnel, b: Funnel): boolean =>
  JSON.stringify(withoutVersion(a)) === JSON.stringify(withoutVersion(b));
