import type { Exercise } from '@bloomlab/content-schema';
import type { GradingArchitecture, GradingContext } from '@bloomlab/exercise-engine';
import {
  FUNNEL_BLOCK_REFERENCES,
  initialAccount,
  isReferencingRole,
  validateScenario,
  type AccountState,
  type Funnel,
  type SimulatorScenario,
} from '@bloomlab/simulator-core';

import { content } from '../content/bundle';
import { registerRuntime, type ExerciseRuntime } from '../exercise/runtime';
import { currentRun } from '../simulator/currentRun';
import { gradingContextFrom } from '../simulator/grading';

/**
 * The Funnel Lab as an exercise runtime (EXR-011, D-121).
 *
 * A FUNNEL ASSEMBLY exercise is graded from the run the learner has been working in: the shared
 * account's state, the run's own events and instants, and the **funnels the learner built**.
 * Architecture is read from the account's funnel definitions, not from anything the runner keeps
 * — a funnel the scenario did not author, or an authored one the learner has changed (its version
 * is past 1), is theirs; an authored funnel left as it was is a starting condition, not an answer.
 *
 * The claim is exactly one exercise family. `handles` narrows to `FUNNEL_ASSEMBLY` on a runnable
 * scenario, and the Workflow Lab's runtime declines that family for the same reason — `runtimeFor`
 * refuses two claimants, and a test walks every authored exercise to prove there is never one.
 */
export const FUNNEL_RUNTIME_ID = 'funnel-lab';

const scenarios = content.scenarios as unknown as SimulatorScenario[];

const runnable = (scenarioId: string | undefined): SimulatorScenario | null => {
  if (!scenarioId) return null;
  const scenario = scenarios.find((row) => row.id === scenarioId);
  return scenario && validateScenario(scenario).length === 0 ? scenario : null;
};

/** The learner's funnels, normalised the way the grader reads architecture. */
export function learnerFunnels(
  account: AccountState,
  scenario: SimulatorScenario,
): GradingArchitecture['funnels'] {
  const authored = initialAccount(scenario).funnels;
  return Object.values(account.funnels)
    .filter((funnel) => {
      const original = authored[funnel.id];
      return !original || funnel.version > original.version;
    })
    .map((funnel) => normalise(funnel, account));
}

const normalise = (
  funnel: Funnel,
  account: AccountState,
): NonNullable<GradingArchitecture['funnels']>[number] => ({
  id: funnel.id,
  name: funnel.name,
  steps: funnel.steps.map((step) => ({
    id: step.id,
    name: step.name,
    purpose: step.purpose,
    blocks: step.blocks.map((block) => ({
      id: block.id,
      role: block.role,
      reference_id: block.reference_id,
      // Whether the reference still resolves in the account it belongs to. A grade must be able
      // to tell "connected to a real form" from "names a form that was removed".
      reference_resolved:
        block.reference_id !== null &&
        isReferencingRole(block.role) &&
        Boolean(account[FUNNEL_BLOCK_REFERENCES[block.role]][block.reference_id]),
    })),
  })),
});

export const funnelExerciseRuntime: ExerciseRuntime = {
  id: FUNNEL_RUNTIME_ID,
  provides: ['state', 'events', 'references', 'architecture'],
  handles: (exercise: Exercise) =>
    exercise.type === 'FUNNEL_ASSEMBLY' && runnable(exercise.scenario) !== null,
  async context(
    exercise: Exercise,
    learner: Record<string, unknown>,
  ): Promise<GradingContext | null> {
    const scenario = runnable(exercise.scenario);
    if (!scenario) return null;
    // The run this device is working in — the same rule the Labs use (D-108) — so the grade is of
    // the account the learner can see. No run means they never opened it: refuse, never invent.
    const run = await currentRun(scenario.id);
    if (!run) return null;
    return gradingContextFrom(run.state, {
      subjectContactId: exercise.starting_state.contact_id ?? null,
      learner,
      architecture: {
        // A funnel exercise reads funnels. Claiming the learner's workflows here would let a
        // workflow assertion be graded from a Lab that never asked them to build one.
        workflows: [],
        funnels: learnerFunnels(run.state.account, scenario),
      },
    });
  },
};

registerRuntime(funnelExerciseRuntime);
