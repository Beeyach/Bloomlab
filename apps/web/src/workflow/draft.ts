import type { Workflow } from '@bloomlab/simulator-core';

/**
 * Undo and redo over workflow-definition drafts (WFL-002, D-110).
 *
 * A draft is the definition the learner is editing. Every edit that means something — a step
 * added, a connection made, a setting changed, a drag *ended* — pushes a new present and clears
 * the future; undo and redo move along that list. The list is the editor's, not the engine's:
 * undoing never appends to or rewrites the account's event history. What reaches the account is
 * the draft the learner saves, as one `WORKFLOW_UPDATED` event, and an undo after a save is simply
 * an unsaved draft again.
 */

export interface DraftHistory {
  past: Workflow[];
  present: Workflow;
  future: Workflow[];
  /** The definition as last saved to the account, to tell "dirty" from "clean". */
  saved: Workflow;
}

/** Enough to walk back a long session, small enough to never matter. */
const LIMIT = 200;

export const startHistory = (present: Workflow): DraftHistory => ({
  past: [],
  present,
  future: [],
  saved: present,
});

/** One meaningful edit. A no-op edit (same definition) leaves the history alone. */
export function edit(history: DraftHistory, next: Workflow): DraftHistory {
  if (sameDefinition(history.present, next)) return history;
  const past = [...history.past, history.present];
  return {
    ...history,
    past: past.length > LIMIT ? past.slice(past.length - LIMIT) : past,
    present: next,
    future: [],
  };
}

export const canUndo = (history: DraftHistory): boolean => history.past.length > 0;
export const canRedo = (history: DraftHistory): boolean => history.future.length > 0;

export function undo(history: DraftHistory): DraftHistory {
  const previous = history.past.at(-1);
  if (!previous) return history;
  return {
    ...history,
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
  };
}

export function redo(history: DraftHistory): DraftHistory {
  const [next, ...rest] = history.future;
  if (!next) return history;
  return { ...history, past: [...history.past, history.present], present: next, future: rest };
}

/** After the account accepted the draft: the present is now what is saved. History is kept. */
export const markSaved = (
  history: DraftHistory,
  saved: Workflow = history.present,
): DraftHistory => ({
  ...history,
  saved,
});

/** True when the present differs from what the account holds. */
export const isDirty = (history: DraftHistory): boolean =>
  !sameDefinition(history.present, history.saved);

/** Positions are layout, and layout is part of a draft: moving a node is an undoable edit. */
export const sameDefinition = (a: Workflow, b: Workflow): boolean =>
  JSON.stringify(a) === JSON.stringify(b);
