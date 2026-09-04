import type { Exercise } from '@bloomlab/content-schema';
import type { GradingArchitecture, GradingContext } from '@bloomlab/exercise-engine';
import { SIMULATOR_EXERCISE_TYPES } from '@bloomlab/content-schema';
import {
  initialAccount,
  validateScenario,
  type AccountState,
  type SimulatorScenario,
  type Workflow,
} from '@bloomlab/simulator-core';

import { content } from '../content/bundle';
import { CRM_SCENARIO_ID } from '../crm/useCrmRun';
import { registerRuntime, type ExerciseRuntime } from '../exercise/runtime';
import { gradingContextFrom } from '../simulator/grading';
import { currentRun } from '../simulator/currentRun';

/**
 * The Workflow Lab as an exercise runtime (EXR-004 … EXR-007, EXR-019, EXR-023, D-112).
 *
 * A workflow exercise is graded from the run the learner has been working in: the account's
 * state, the run's own events and instants, and — what no earlier runtime could supply — the
 * **architecture the learner built**. Architecture is read from the account's workflow
 * definitions, not from anything the runner keeps: a workflow the scenario did not author, or an
 * authored one the learner has changed (its version is past 1), is theirs; an authored workflow
 * left as it was is the scenario's starting condition and is not offered as their answer.
 *
 * The claim is exactly the exercises the Lab owns: a simulator-family exercise on a runnable
 * scenario that is not the CRM training account. The CRM runtime claims that account; roleplay
 * scenarios have no simulator run to grade from. `runtimeFor` refuses two claimants, and the
 * test for this module walks every authored exercise to prove there are never two.
 */
export const WORKFLOW_RUNTIME_ID = 'workflow-lab';

const scenarios = content.scenarios as unknown as SimulatorScenario[];

const runnable = (scenarioId: string | undefined): SimulatorScenario | null => {
  if (!scenarioId || scenarioId === CRM_SCENARIO_ID) return null;
  const scenario = scenarios.find((row) => row.id === scenarioId);
  return scenario && validateScenario(scenario).length === 0 ? scenario : null;
};

/** The learner's workflows, normalised the way the grader reads architecture (no positions). */
export function learnerArchitecture(
  account: AccountState,
  scenario: SimulatorScenario,
): GradingArchitecture {
  const authored = initialAccount(scenario).workflows;
  const theirs = Object.values(account.workflows).filter((workflow) => {
    const original = authored[workflow.id];
    return !original || workflow.version > original.version;
  });
  return { workflows: theirs.map(normalise) };
}

const normalise = (workflow: Workflow): GradingArchitecture['workflows'][number] => ({
  id: workflow.id,
  name: workflow.name,
  trigger: workflow.trigger.ghl_feature_id
    ? {
        ghl_feature_id: workflow.trigger.ghl_feature_id,
        filters: workflow.trigger.filters.map((filter) => ({ ...filter })),
      }
    : null,
  nodes: workflow.nodes.map((node) => ({
    id: node.id,
    type: node.type,
    ghl_feature_id: node.ghl_feature_id,
    label: node.label,
  })),
  settings: { allow_reentry: workflow.settings.allow_reentry },
});

export const workflowExerciseRuntime: ExerciseRuntime = {
  id: WORKFLOW_RUNTIME_ID,
  provides: ['state', 'events', 'references', 'architecture'],
  handles: (exercise: Exercise) =>
    SIMULATOR_EXERCISE_TYPES.includes(exercise.type) && runnable(exercise.scenario) !== null,
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
      architecture: learnerArchitecture(run.state.account, scenario),
    });
  },
};

registerRuntime(workflowExerciseRuntime);
