import {
  CONTEXT_SOURCES,
  type AssertionDefinition,
  type ContextSource,
  type ExerciseDefinition,
  type GradingArchitecture,
  type GradingContext,
  type GradingEvent,
} from '../src/index.ts';

/** A run's events, written the way a runtime would emit them: in order, in simulator time. */
export function events(
  rows: { type: string; at: string; fields?: GradingEvent['fields'] }[],
): GradingEvent[] {
  return rows.map((row, index) => ({
    type: row.type,
    at: row.at,
    index,
    fields: row.fields ?? {},
  }));
}

export function context(partial: Partial<GradingContext> = {}): GradingContext {
  return {
    state: partial.state ?? {},
    events: partial.events ?? [],
    references: partial.references ?? {},
    architecture: partial.architecture ?? null,
    provides: partial.provides ?? CONTEXT_SOURCES,
  };
}

/** A context that supplies only some sources, for proving the grader refuses to guess. */
export const providing = (...sources: ContextSource[]) => context({ provides: sources });

export function exercise(partial: Partial<ExerciseDefinition> = {}): ExerciseDefinition {
  return {
    id: partial.id ?? 'EX-BUILD_IT-fixture',
    type: partial.type ?? 'BUILD_IT',
    mode: partial.mode ?? 'practice',
    expected_outcomes: partial.expected_outcomes ?? [],
    critical_failures: partial.critical_failures ?? [],
    grading: partial.grading ?? { mode: 'deterministic', pass_threshold: 70 },
  };
}

export const assertion = (partial: Partial<AssertionDefinition>): AssertionDefinition => ({
  id: partial.id ?? 'a1',
  description: partial.description ?? 'a fixture assertion',
  type: partial.type ?? 'state',
  ...partial,
});

/** Glowhaus's booking confirmation, normalized the way the grader reads architecture. */
export const architecture = (
  overrides: Partial<GradingArchitecture['workflows'][number]> = {},
): GradingArchitecture => ({
  workflows: [
    {
      id: 'wf-no-show-recovery',
      name: 'No-show recovery',
      trigger: { ghl_feature_id: 'GHL-WF-APPOINTMENT-STATUS' },
      nodes: [
        { id: 'n1', type: 'branch', ghl_feature_id: 'GHL-WF-IF-ELSE' },
        { id: 'n2', type: 'action', ghl_feature_id: 'GHL-WF-SEND-SMS' },
        { id: 'n3', type: 'action', ghl_feature_id: 'GHL-WF-SEND-INTERNAL-NOTIFICATION' },
        { id: 'n4', type: 'wait', ghl_feature_id: 'GHL-WF-WAIT' },
        { id: 'n5', type: 'end' },
      ],
      settings: { allow_reentry: false },
      ...overrides,
    },
  ],
});
