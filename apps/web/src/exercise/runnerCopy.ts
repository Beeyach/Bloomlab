import type { Exercise } from '@bloomlab/content-schema';
import type { GradeReport } from '@bloomlab/exercise-engine';
import type { AssistanceLevel, HintLevel } from '@bloomlab/mastery-engine';

/**
 * How each family is presented (spec §27, §158). The runner branches on the exercise's **type**,
 * never on its id: a new exercise of a known family is content, not code (EXR-001).
 */
export interface FamilyTreatment {
  /** The family's own name, as the learner sees it. */
  family: string;
  /** One line about what this family asks of them. */
  stance: string;
  /** Heading over the work area. */
  workTitle: string;
  /** Label of the written response field. */
  responseLabel: string;
  responseHelp: string;
  /** Incident treatment for a broken system; understated, never a siren (DES-013). */
  tone: 'normal' | 'incident';
  /** Whether a link back to the unit is offered at all for this family (EXR-019). */
  offersLesson: boolean;
}

const DEFAULT_TREATMENT: FamilyTreatment = {
  family: 'Exercise',
  stance: 'Work it through, then submit.',
  workTitle: 'Your work',
  responseLabel: 'Your answer',
  responseHelp: 'Saved as you type, on this device.',
  tone: 'normal',
  offersLesson: true,
};

export const FAMILY_TREATMENTS: Partial<Record<Exercise['type'], Partial<FamilyTreatment>>> = {
  BUILD_IT: {
    family: 'Build it',
    stance: 'An objective, and the features you are allowed to use.',
    workTitle: 'Your build',
    responseLabel: 'How you would build it',
    responseHelp: 'Your plan is saved with the attempt. The build itself happens in the Lab.',
  },
  FIX_IT: {
    family: 'Fix it',
    stance: 'Something broke. Find out why.',
    workTitle: 'Your diagnosis',
    responseLabel: 'What is causing it, and what you would change',
    responseHelp: 'Read the symptoms first. The cause is not always where the symptom shows.',
    tone: 'incident',
  },
  RUN_THE_LEAD: {
    family: 'Run the lead',
    stance: 'Predict first, then run it and compare.',
    workTitle: 'Your prediction',
    responseLabel: 'What happens, in order',
    responseHelp: 'Written down before the run, and not editable afterwards.',
  },
  EDGE_CASE: {
    family: 'Edge case',
    stance: 'One variable changed. Does the system still hold?',
    workTitle: 'Your verdict',
    responseLabel: 'What the contact receives, and when',
    responseHelp: 'Say what breaks and what you would change.',
  },
  ARCHITECTURE_DECISION: {
    family: 'Architecture decision',
    stance: 'Choose where the fact lives, and defend it.',
    workTitle: 'Your decision',
    responseLabel: 'Why, and what would go wrong with the runner-up',
    responseHelp: 'Two sentences is enough. Name the alternative you rejected.',
  },
  REBUILD_BLIND: {
    family: 'Rebuild blind',
    stance: 'No lesson, no hints, no worked example.',
    workTitle: 'Your rebuild',
    responseLabel: 'The system you would build, step by step',
    responseHelp: 'From memory. Nothing here will show you the answer.',
    offersLesson: false,
  },
  WHAT_WOULD_YOU_BUILD: {
    family: 'What would you build?',
    stance: 'A business problem. No feature named.',
    workTitle: 'Your answer',
    responseLabel: 'What is happening, what you still need to know, and what you would build first',
    responseHelp: 'Several answers are defensible. Say what you would deliberately not build yet.',
  },
};

export function treatmentFor(exercise: Exercise): FamilyTreatment {
  const overrides = FAMILY_TREATMENTS[exercise.type] ?? {};
  const treatment = { ...DEFAULT_TREATMENT, ...overrides };
  // A pressure exercise offers no support of any kind, whatever its family normally allows.
  if (exercise.mode === 'pressure') treatment.offersLesson = false;
  return treatment;
}

export const MODE_WORDS: Record<Exercise['mode'], string> = {
  guided: 'Guided',
  practice: 'Practice',
  independent: 'No hints',
  pressure: 'Pressure test',
};

export const HINT_WORDS: Record<HintLevel, string> = {
  nudge: 'Nudge',
  concept_reminder: 'Concept reminder',
  worked_example: 'Worked example',
};

/** Quietly, without shaming (MAS-007). */
export const ASSISTANCE_WORDS: Record<AssistanceLevel, string> = {
  independent: 'Independent',
  light: 'Light',
  guided: 'Guided',
  heavy: 'Heavy',
};

export const OUTCOME_WORDS: Record<GradeReport['outcome'], string> = {
  passed: 'Passed',
  failed: 'Needs another run',
  partial: 'Partly evaluated',
};

export function reasonSentence(report: GradeReport): string {
  switch (report.reason) {
    case 'critical_failure':
      return 'A critical check failed, so the attempt does not pass whatever the score says.';
    case 'below_threshold':
      return `Below the pass mark of ${report.pass_threshold}%.`;
    case 'threshold_met':
      return 'Every critical check held and the score cleared the pass mark.';
    case 'rubric_pending':
      return `The deterministic checks ran. The written half is judged against ${report.rubric_pending}, which arrives with the AI gateway in Phase 19.`;
    case 'unevaluated_assertions':
      return 'Some checks need a runtime that does not exist yet, so this attempt cannot be scored.';
    case 'nothing_to_grade':
      return 'This exercise authored no deterministic check to score.';
  }
}

export const TIER_WORDS = {
  critical: 'Critical',
  required: 'Required checks',
  quality: 'Quality checks',
  bonus: 'Bonus checks',
} as const;
