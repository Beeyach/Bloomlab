import {
  isFullyGradable,
  requiredSources,
  type ContextSource,
  type GradingContext,
} from '@bloomlab/exercise-engine';
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
  /**
   * The real context, read out of whatever the runtime owns. Async because a run lives in
   * IndexedDB. A runtime that returns null could not produce one after all — the attempt is then
   * refused rather than graded against nothing.
   */
  context(exercise: Exercise, learner: Record<string, unknown>): Promise<GradingContext | null>;
}

/**
 * Phase 9 shipped this empty on purpose. Phase 11 puts the first entry in it: the CRM Lab, which
 * owns one real account and can therefore supply state, events and references for an exercise
 * authored against that account. Registration is by id, so a hot reload replaces rather than
 * duplicates.
 */
export const EXERCISE_RUNTIMES: ExerciseRuntime[] = [];

export function registerRuntime(runtime: ExerciseRuntime): void {
  const at = EXERCISE_RUNTIMES.findIndex((entry) => entry.id === runtime.id);
  if (at === -1) EXERCISE_RUNTIMES.push(runtime);
  else EXERCISE_RUNTIMES[at] = runtime;
}

/** The runtime that owns this exercise, or none. Two claiming the same exercise is a build fault. */
export function runtimeFor(exercise: Exercise): ExerciseRuntime | null {
  const claimants = EXERCISE_RUNTIMES.filter((runtime) => runtime.handles(exercise));
  if (claimants.length > 1) {
    throw new Error(
      `Exercise ${exercise.id} is claimed by more than one runtime: ${claimants
        .map((runtime) => runtime.id)
        .join(', ')}`,
    );
  }
  return claimants[0] ?? null;
}

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

/**
 * Which surface supplies each source. Each Lab registers a runtime for the exercises it owns —
 * the CRM Lab its account, the Workflow Lab its builds, the Funnel Lab its funnels and their
 * traffic, the Reporting Lab its report. A source is missing only for an exercise none of them
 * claims — a roleplay scenario, say — and the runner says so rather than grading it.
 */
export const SOURCE_PHASE: Record<ContextSource, string> = {
  state: 'a Lab run of this exercise’s scenario',
  events: 'a Lab run of this exercise’s scenario',
  references: 'a Lab run of this exercise’s scenario',
  architecture:
    'the Lab you build in — the Workflow Lab for a workflow, the Funnel Lab for a funnel',
  learner: 'this runner',
};
