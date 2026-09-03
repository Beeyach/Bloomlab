import { isFullyGradable, requiredSources, type ContextSource } from '@bloomlab/exercise-engine';
import type { Exercise } from '@bloomlab/content-schema';

/**
 * What can actually produce a grading context right now.
 *
 * The runner never fabricates a run. `learner` — what the learner chose and wrote — is the one
 * source Phase 9 can supply on its own. A workflow build, an execution log or a repaired system
 * comes from the shared GHL simulator (Phase 10) and the labs above it (Phases 11–14), each of
 * which registers itself here when it exists. Until then an exercise that needs one is honestly
 * un-runnable rather than quietly graded against nothing (EXR-024).
 */
export interface ExerciseRuntime {
  id: string;
  /** Context sources this runtime can fill for an exercise. */
  provides: readonly ContextSource[];
  /** Which exercises it can run. */
  handles(exercise: Exercise): boolean;
}

/** Phase 10 pushes the simulator runtime here; Phase 9 ships the registry empty on purpose. */
export const EXERCISE_RUNTIMES: ExerciseRuntime[] = [];

/** The sources available for one exercise: the learner's own work plus any registered runtime. */
export function availableSources(exercise: Exercise): ContextSource[] {
  const sources = new Set<ContextSource>(['learner']);
  for (const runtime of EXERCISE_RUNTIMES) {
    if (runtime.handles(exercise)) for (const source of runtime.provides) sources.add(source);
  }
  return [...sources];
}

/** Sources the exercise's own assertions need that nothing can supply yet. */
export function missingSources(exercise: Exercise): ContextSource[] {
  const available = availableSources(exercise);
  return requiredSources(exercise).filter((source) => !available.includes(source));
}

/** True when every authored check can be judged today, so the attempt may be submitted. */
export function canGradeNow(exercise: Exercise): boolean {
  return isFullyGradable(exercise, availableSources(exercise));
}

/** Plain words for what is still missing, for the runner's runtime panel. */
export const SOURCE_DEPENDENCY: Record<ContextSource, string> = {
  state: 'the simulated account state',
  events: 'a real execution log',
  references: 'the run’s own clock',
  architecture: 'the workflow you build',
  learner: 'your own answer',
};

/** Which phase owns each missing source, named exactly rather than as "later". */
export const SOURCE_PHASE: Record<ContextSource, string> = {
  state: 'the simulator core (Phase 10)',
  events: 'the simulator core (Phase 10)',
  references: 'the simulator core (Phase 10)',
  architecture: 'the Workflow Lab (Phase 12) on the simulator core (Phase 10)',
  learner: 'this runner',
};
