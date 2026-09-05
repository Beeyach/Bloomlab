import type { Exercise } from '@bloomlab/content-schema';
import type { GradingContext } from '@bloomlab/exercise-engine';
import { validateScenario, type SimulatorScenario } from '@bloomlab/simulator-core';

import { content } from '../content/bundle';
import { registerRuntime, type ExerciseRuntime } from '../exercise/runtime';
import { currentRun } from '../simulator/currentRun';
import { gradingContextFrom } from '../simulator/grading';
import { DEFAULT_REPORTING_SCENARIO_ID } from './useReportingRun';

/**
 * The Reporting Lab as an exercise runtime (REP-002, D-146).
 *
 * A reporting exercise is graded from the run the learner has been reading: the shared account's
 * state, the run's own events and its instants, plus the choice and the reasoning they supplied.
 * There is no second report engine in here and no screenshot — the same run the Lab draws its
 * report from is the run this grades against, because they are the same run.
 *
 * It supplies no architecture. A bottleneck diagnosis is not a build: there is nothing the
 * learner made for an architecture assertion to inspect, and claiming otherwise would let a check
 * pass on work nobody did.
 *
 * Ownership follows the account. The Workflow Lab's runtime declines this scenario the same way
 * it declines the CRM training account, so `runtimeFor` has exactly one claimant.
 */
export const REPORTING_RUNTIME_ID = 'reporting-lab';

const scenarios = content.scenarios as unknown as SimulatorScenario[];

const runnable = (scenarioId: string | undefined): SimulatorScenario | null => {
  if (scenarioId !== DEFAULT_REPORTING_SCENARIO_ID) return null;
  const scenario = scenarios.find((row) => row.id === scenarioId);
  return scenario && validateScenario(scenario).length === 0 ? scenario : null;
};

export const reportingExerciseRuntime: ExerciseRuntime = {
  id: REPORTING_RUNTIME_ID,
  provides: ['state', 'events', 'references'],
  // The funnel families run in the Funnel Lab even on this account: an autopsy reads a funnel's
  // traffic, which is that Lab's job, and two claimants for one exercise is a build fault.
  handles: (exercise: Exercise) =>
    exercise.type !== 'FUNNEL_ASSEMBLY' &&
    exercise.type !== 'FUNNEL_AUTOPSY' &&
    runnable(exercise.scenario) !== null,
  async context(
    exercise: Exercise,
    learner: Record<string, unknown>,
  ): Promise<GradingContext | null> {
    const scenario = runnable(exercise.scenario);
    if (!scenario) return null;
    // The run this device is working in — the same rule every Lab uses (D-108). No run means the
    // learner never opened the report: refuse, never invent one to grade against.
    const run = await currentRun(scenario.id);
    if (!run) return null;
    return gradingContextFrom(run.state, {
      subjectContactId: exercise.starting_state.contact_id ?? null,
      learner,
    });
  },
};

registerRuntime(reportingExerciseRuntime);
