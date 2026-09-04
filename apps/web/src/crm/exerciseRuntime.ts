import type { Exercise } from '@bloomlab/content-schema';
import type { GradingContext } from '@bloomlab/exercise-engine';

import { gradingContextFrom, SIMULATOR_PROVIDES } from '../simulator/grading';
import { registerRuntime, type ExerciseRuntime } from '../exercise/runtime';
import { currentCrmRun } from './currentRun';
import { CRM_SCENARIO_ID } from './useCrmRun';

/**
 * The CRM Lab as an exercise runtime (D-097, CRM-003).
 *
 * CRM-003 asks that a poor architectural choice be allowed and that a **later consequence** teach
 * why it was poor. A consequence a learner is told about is an article. This is the other thing:
 * an exercise graded from the account the learner has actually been working in, so the cost of
 * holding a changing value as three tags shows up as a report that comes back wrong, in their own
 * data, and the fix is made in the CRM rather than described.
 *
 * What it claims is exactly what the CRM Lab owns: the account state, the run's own event history,
 * and the instants derived from it. It does **not** claim `architecture` — a workflow a learner
 * builds is the Workflow Lab's to supply in Phase 12 — so an exercise needing one is still
 * honestly un-runnable rather than graded against nothing (EXR-024).
 *
 * `handles` is deliberately narrow: an exercise authored against the CRM training account, and
 * nothing else. EXR-004 … EXR-007 and every workflow exercise stay exactly as un-runnable as they
 * were before Phase 11, because this runtime declines them.
 */
export const CRM_RUNTIME_ID = 'crm-lab';

export const crmExerciseRuntime: ExerciseRuntime = {
  id: CRM_RUNTIME_ID,
  provides: SIMULATOR_PROVIDES,
  handles: (exercise: Exercise) => exercise.scenario === CRM_SCENARIO_ID,
  async context(
    exercise: Exercise,
    learner: Record<string, unknown>,
  ): Promise<GradingContext | null> {
    // The run the Lab shows on this device — the same rule, so the grade is of the account the
    // learner can see, never of another run that happens to be newer (D-099).
    const run = await currentCrmRun(CRM_SCENARIO_ID);
    // No account means the learner never opened the Lab. Returning null refuses the grade rather
    // than inventing a starting state and failing them for work they were never able to do.
    if (!run) return null;
    return gradingContextFrom(run.state, {
      subjectContactId: exercise.starting_state.contact_id ?? null,
      learner,
    });
  },
};

registerRuntime(crmExerciseRuntime);
