import {
  FUNNEL_BLOCK_REFERENCES,
  isReferencingRole,
  type AccountState,
  type Funnel,
  type FunnelBlock,
  type FunnelBlockRole,
  type FunnelStep,
  type FunnelStepPurpose,
} from '@bloomlab/simulator-core';

import { newBlockId, newStepId } from './commands';

/**
 * Editing a funnel draft (FUN-001, FUN-002).
 *
 * Pure functions over a definition: every one takes a funnel and returns a new funnel, so the
 * editor's undo history is a list of definitions and nothing has to be un-done by hand. Nothing
 * here touches the account — a draft becomes account state only when the learner saves, as one
 * `FUNNEL_UPDATED` event (D-119).
 *
 * Reordering is a `move`, not a drag coordinate: the Lab offers both a pointer drag and a
 * keyboard/menu path, and both end in the same call. A drag in progress is never an edit; only
 * the drop is (SYNC-007).
 */

export const stepIndex = (funnel: Funnel, stepId: string): number =>
  funnel.steps.findIndex((step) => step.id === stepId);

export const findStep = (funnel: Funnel, stepId: string | null): FunnelStep | null =>
  stepId ? (funnel.steps.find((step) => step.id === stepId) ?? null) : null;

export const findBlock = (funnel: Funnel, blockId: string | null): FunnelBlock | null => {
  if (!blockId) return null;
  for (const step of funnel.steps) {
    const found = step.blocks.find((block) => block.id === blockId);
    if (found) return found;
  }
  return null;
};

export const stepOfBlock = (funnel: Funnel, blockId: string): FunnelStep | null =>
  funnel.steps.find((step) => step.blocks.some((block) => block.id === blockId)) ?? null;

const replaceStep = (funnel: Funnel, stepId: string, make: (step: FunnelStep) => FunnelStep) => ({
  ...funnel,
  steps: funnel.steps.map((step) => (step.id === stepId ? make(step) : step)),
});

/** Moves an item within a list, clamped to the list. Returns the same array when nothing moves. */
function moved<T>(rows: readonly T[], from: number, to: number): T[] {
  const target = Math.max(0, Math.min(rows.length - 1, to));
  if (from < 0 || from >= rows.length || from === target) return [...rows];
  const next = [...rows];
  const [item] = next.splice(from, 1);
  next.splice(target, 0, item as T);
  return next;
}

/* ---- steps ------------------------------------------------------------------------------- */

/**
 * Adds a step at the end. A new step continues nowhere; the step before it is pointed at the new
 * one, because a step nothing reaches is an error the learner would have to fix immediately and
 * "add a step at the end of my funnel" plainly means "after the last one".
 */
export function addStep(
  funnel: Funnel,
  name: string,
  purpose: FunnelStepPurpose,
  id: string = newStepId(),
): Funnel {
  const step: FunnelStep = { id, name, purpose, blocks: [], next_step_id: null };
  const last = funnel.steps[funnel.steps.length - 1];
  const steps = funnel.steps.map((row) =>
    last && row.id === last.id && row.next_step_id === null ? { ...row, next_step_id: id } : row,
  );
  return { ...funnel, steps: [...steps, step] };
}

export const renameStep = (funnel: Funnel, stepId: string, name: string): Funnel =>
  replaceStep(funnel, stepId, (step) => ({ ...step, name }));

export const setStepPurpose = (
  funnel: Funnel,
  stepId: string,
  purpose: FunnelStepPurpose,
): Funnel => replaceStep(funnel, stepId, (step) => ({ ...step, purpose }));

export const setNextStep = (funnel: Funnel, stepId: string, nextStepId: string | null): Funnel =>
  replaceStep(funnel, stepId, (step) => ({ ...step, next_step_id: nextStepId }));

/**
 * Removes a step and every reference to it. A destination that pointed at the removed step falls
 * back to what that step pointed at, so removing a middle step joins the funnel back up rather
 * than stranding everything after it.
 */
export function removeStep(funnel: Funnel, stepId: string): Funnel {
  const removed = findStep(funnel, stepId);
  const heir = removed?.next_step_id === stepId ? null : (removed?.next_step_id ?? null);
  const steps = funnel.steps
    .filter((step) => step.id !== stepId)
    .map((step) => ({
      ...step,
      next_step_id: step.next_step_id === stepId ? heir : step.next_step_id,
      blocks: step.blocks.map((block) =>
        block.target_step_id === stepId ? { ...block, target_step_id: heir } : block,
      ),
    }));
  return { ...funnel, steps };
}

export const moveStep = (funnel: Funnel, stepId: string, to: number): Funnel => ({
  ...funnel,
  steps: moved(funnel.steps, stepIndex(funnel, stepId), to),
});

/* ---- blocks ------------------------------------------------------------------------------ */

export function addBlock(
  funnel: Funnel,
  stepId: string,
  role: FunnelBlockRole,
  id: string = newBlockId(),
  at?: number,
): Funnel {
  const block: FunnelBlock = {
    id,
    role,
    headline: null,
    body: null,
    reference_id: null,
    target_step_id: null,
  };
  return replaceStep(funnel, stepId, (step) => {
    const blocks = [...step.blocks];
    blocks.splice(at ?? blocks.length, 0, block);
    return { ...step, blocks };
  });
}

export function removeBlock(funnel: Funnel, blockId: string): Funnel {
  return {
    ...funnel,
    steps: funnel.steps.map((step) => ({
      ...step,
      blocks: step.blocks.filter((block) => block.id !== blockId),
    })),
  };
}

/** Moves a block within its own step. Blocks do not move between steps; that is a remove and add. */
export function moveBlock(funnel: Funnel, blockId: string, to: number): Funnel {
  const step = stepOfBlock(funnel, blockId);
  if (!step) return funnel;
  const from = step.blocks.findIndex((block) => block.id === blockId);
  return replaceStep(funnel, step.id, (row) => ({ ...row, blocks: moved(row.blocks, from, to) }));
}

export interface BlockEdits {
  headline?: string | null;
  body?: string | null;
  reference_id?: string | null;
  target_step_id?: string | null;
}

export function editBlock(funnel: Funnel, blockId: string, edits: BlockEdits): Funnel {
  const clean = (value: string | null | undefined): string | null | undefined =>
    typeof value === 'string' ? (value.trim() ? value.trim() : null) : value;
  return {
    ...funnel,
    steps: funnel.steps.map((step) => ({
      ...step,
      blocks: step.blocks.map((block) =>
        block.id === blockId
          ? {
              ...block,
              ...(edits.headline !== undefined ? { headline: clean(edits.headline) ?? null } : {}),
              ...(edits.body !== undefined ? { body: clean(edits.body) ?? null } : {}),
              ...(edits.reference_id !== undefined ? { reference_id: edits.reference_id } : {}),
              ...(edits.target_step_id !== undefined
                ? { target_step_id: edits.target_step_id }
                : {}),
            }
          : block,
      ),
    })),
  };
}

export const renameFunnel = (funnel: Funnel, name: string): Funnel => ({ ...funnel, name });

/* ---- what a block can be connected to ---------------------------------------------------- */

export interface ReferenceChoice {
  id: string;
  name: string;
  /** A short line about the entity, so the learner picks by what it is, not by its id. */
  detail: string;
}

/**
 * The account entities a block of this role may use. Read from the account, never a hardcoded
 * list: a form the scenario never declared is not offered, and that is the point.
 */
export function referenceChoices(account: AccountState, role: FunnelBlockRole): ReferenceChoice[] {
  if (!isReferencingRole(role)) return [];
  switch (FUNNEL_BLOCK_REFERENCES[role]) {
    case 'forms':
      return Object.values(account.forms).map((form) => ({
        id: form.id,
        name: form.name,
        detail: `${form.fields.length} field${form.fields.length === 1 ? '' : 's'}: ${form.fields.join(', ')}`,
      }));
    case 'surveys':
      return Object.values(account.surveys).map((survey) => ({
        id: survey.id,
        name: survey.name,
        detail: `${survey.fields.length} question${survey.fields.length === 1 ? '' : 's'}: ${survey.fields.join(', ')}`,
      }));
    case 'calendars':
      return Object.values(account.calendars).map((calendar) => ({
        id: calendar.id,
        name: calendar.name,
        detail: `${calendar.duration_minutes} minutes`,
      }));
    case 'products':
      return Object.values(account.products).map((product) => ({
        id: product.id,
        name: product.name,
        detail: product.recurring ? `${money(product.price)} recurring` : money(product.price),
      }));
  }
}

const money = (amount: number): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);

export { money };
