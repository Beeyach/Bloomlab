import {
  FUNNEL_BLOCK_REFERENCES,
  isReferencingRole,
  type AccountState,
  type Funnel,
  type FunnelBlock,
  type FunnelStep,
} from '../state.ts';

/**
 * Funnel validation and reading order (FUN-001, FUN-002, D-119).
 *
 * The editor lets a learner leave a funnel half-built, exactly as the Workflow Lab does. Entering
 * SIMULATE is where the architecture has to hold together, and this is the check: every problem
 * names the step and block it belongs to, in words a learner can act on, and nothing is repaired
 * quietly. A funnel with any error is not walked; warnings are said out loud and walked anyway,
 * because "this step asks for nothing" is a design opinion, not a broken graph.
 */

export interface FunnelIssue {
  code:
    | 'NO_STEPS'
    | 'EMPTY_STEP'
    | 'MISSING_REFERENCE'
    | 'BROKEN_REFERENCE'
    | 'UNREACHABLE_STEP'
    | 'DEAD_END'
    | 'CTA_WITHOUT_DESTINATION'
    | 'NO_ASK'
    | 'CAPTURE_AFTER_CHECKOUT';
  severity: 'error' | 'warning';
  step_id: string | null;
  block_id: string | null;
  message: string;
}

/** Every block in the funnel in the order a visitor meets it: steps in order, blocks in order. */
export interface FunnelPosition {
  step: FunnelStep;
  block: FunnelBlock;
  /** Index of the block across the whole funnel, which is what an order rule compares. */
  index: number;
}

export function readingOrder(funnel: Funnel): FunnelPosition[] {
  const positions: FunnelPosition[] = [];
  for (const step of funnel.steps) {
    for (const block of step.blocks) positions.push({ step, block, index: positions.length });
  }
  return positions;
}

/** The step a visitor starts on: the first authored step, or none when the funnel has none. */
export const firstStep = (funnel: Funnel): FunnelStep | null => funnel.steps[0] ?? null;

export const stepOf = (funnel: Funnel, stepId: string | null): FunnelStep | null =>
  stepId ? (funnel.steps.find((step) => step.id === stepId) ?? null) : null;

/**
 * Where a step sends the visitor when it is completed through a given block. A call to action may
 * name its own destination; anything else uses the step's `next_step_id`. Null ends the funnel.
 */
export function stepAfter(
  funnel: Funnel,
  stepId: string,
  viaBlockId: string | null = null,
): string | null {
  const step = stepOf(funnel, stepId);
  if (!step) return null;
  const block = viaBlockId ? step.blocks.find((row) => row.id === viaBlockId) : undefined;
  return block?.target_step_id ?? step.next_step_id;
}

/** Every step a visitor can reach from the first one, following destinations. */
export function reachableSteps(funnel: Funnel): Set<string> {
  const start = firstStep(funnel);
  const seen = new Set<string>();
  if (!start) return seen;
  const queue = [start.id];
  while (queue.length > 0) {
    const id = queue.shift() as string;
    if (seen.has(id)) continue;
    seen.add(id);
    const step = stepOf(funnel, id);
    if (!step) continue;
    const destinations = [
      step.next_step_id,
      ...step.blocks.map((block) => block.target_step_id),
    ].filter((value): value is string => typeof value === 'string');
    for (const next of destinations) if (!seen.has(next)) queue.push(next);
  }
  return seen;
}

/** Roles that ask the visitor for something, which is what makes a step more than a page. */
const ASKS = new Set(['form', 'survey', 'calendar', 'checkout', 'cta']);

/**
 * Everything wrong with a funnel, in the order a learner would meet it. An error means the
 * visitor cannot be run; a warning means the architecture is questionable but coherent.
 */
export function validateFunnel(funnel: Funnel, account: AccountState): FunnelIssue[] {
  const issues: FunnelIssue[] = [];
  const problem = (
    code: FunnelIssue['code'],
    severity: FunnelIssue['severity'],
    message: string,
    step_id: string | null = null,
    block_id: string | null = null,
  ) => issues.push({ code, severity, message, step_id, block_id });

  if (funnel.steps.length === 0) {
    problem('NO_STEPS', 'error', 'This funnel has no steps yet. Add the first one to run it.');
    return issues;
  }

  const reachable = reachableSteps(funnel);

  for (const step of funnel.steps) {
    if (step.blocks.length === 0) {
      problem('EMPTY_STEP', 'error', `“${step.name}” has nothing on it.`, step.id);
    }
    if (!reachable.has(step.id)) {
      problem(
        'UNREACHABLE_STEP',
        'error',
        `Nothing sends a visitor to “${step.name}”. Point a step or a call to action at it, or remove it.`,
        step.id,
      );
    }
    if (step.blocks.length > 0 && !step.blocks.some((block) => ASKS.has(block.role))) {
      problem(
        'NO_ASK',
        'warning',
        `“${step.name}” never asks the visitor for anything, so they cannot move on from it.`,
        step.id,
      );
    }

    for (const block of step.blocks) {
      if (isReferencingRole(block.role)) {
        if (block.reference_id === null) {
          problem(
            'MISSING_REFERENCE',
            'error',
            `The ${label(block.role)} on “${step.name}” is not connected to anything in the account yet.`,
            step.id,
            block.id,
          );
        } else if (!account[FUNNEL_BLOCK_REFERENCES[block.role]][block.reference_id]) {
          // The save refuses a dangling reference, so this only fires when the entity was removed
          // from the account afterwards. Reported rather than repaired.
          problem(
            'BROKEN_REFERENCE',
            'error',
            `The ${label(block.role)} on “${step.name}” uses ${block.reference_id}, which the account no longer has.`,
            step.id,
            block.id,
          );
        }
      }
      if (
        block.role === 'cta' &&
        block.target_step_id === null &&
        step.next_step_id === null &&
        step !== funnel.steps[funnel.steps.length - 1]
      ) {
        problem(
          'CTA_WITHOUT_DESTINATION',
          'warning',
          `The call to action on “${step.name}” has nowhere to send the visitor.`,
          step.id,
          block.id,
        );
      }
    }
  }

  // A step that asks for something but continues nowhere leaves the visitor mid-funnel with no
  // confirmation. It is a real architecture fault, but a survivable one: a warning.
  for (const step of funnel.steps) {
    const asks = step.blocks.some((block) => ASKS.has(block.role));
    const goesOn =
      step.next_step_id !== null || step.blocks.some((block) => block.target_step_id !== null);
    if (asks && !goesOn && step !== funnel.steps[funnel.steps.length - 1]) {
      problem(
        'DEAD_END',
        'warning',
        `“${step.name}” asks for something and then stops. Nothing confirms it for the visitor.`,
        step.id,
      );
    }
  }

  // Asking for the sale and then asking for details reverses the exchange: the visitor has
  // already paid before the account knows who they are.
  const order = readingOrder(funnel);
  const firstCheckout = order.find((position) => position.block.role === 'checkout');
  const laterCapture = firstCheckout
    ? order.find(
        (position) =>
          position.index > firstCheckout.index &&
          (position.block.role === 'form' || position.block.role === 'survey'),
      )
    : undefined;
  if (firstCheckout && laterCapture) {
    problem(
      'CAPTURE_AFTER_CHECKOUT',
      'warning',
      `The checkout comes before the ${label(laterCapture.block.role)} on “${laterCapture.step.name}”, so a buyer pays before the account has their details.`,
      laterCapture.step.id,
      laterCapture.block.id,
    );
  }

  return issues;
}

/** True when nothing stops the visitor from walking this funnel. */
export const isWalkable = (funnel: Funnel, account: AccountState): boolean =>
  validateFunnel(funnel, account).every((issue) => issue.severity !== 'error');

const LABELS: Record<string, string> = {
  form: 'form',
  survey: 'survey',
  calendar: 'calendar',
  checkout: 'checkout',
};

const label = (role: string): string => LABELS[role] ?? role;
