import { z } from 'zod';

import { EXERCISE_TYPES, type ExerciseType } from '../ids.ts';
import {
  clientRef,
  featureRef,
  markdown,
  portfolioRef,
  ref,
  requireUnique,
  rubricRef,
  scenarioRef,
  skillRef,
  stringList,
  title,
} from './common.ts';
import { WorkflowDefinitionSchema } from './workflow.ts';

/**
 * Data-driven exercise definition (spec §27, TA§31, EXR-001). A new exercise is a new file
 * here, not a new React page. `id` is the spec's `exercise_id`.
 */

/** How the attempt counts as mastery evidence (spec §29–§30 states). */
export const EXERCISE_MODES = ['guided', 'practice', 'independent', 'pressure'] as const;
export type ExerciseMode = (typeof EXERCISE_MODES)[number];

export const HINT_LEVELS = ['nudge', 'concept_reminder', 'worked_example'] as const;

/** Families that run inside the simulator and therefore need a scenario and simulated features. */
export const SIMULATOR_EXERCISE_TYPES: readonly ExerciseType[] = [
  'BUILD_IT',
  'FIX_IT',
  'RUN_THE_LEAD',
  'EDGE_CASE',
  'REBUILD_BLIND',
];

/** Families that count as "Sales Use" in the coverage matrix (CUR-033). */
export const SALES_EXERCISE_TYPES: readonly ExerciseType[] = [
  'PROSPECT_IT',
  'AUDIT_IT',
  'WRITE_IT',
  'SAY_IT',
  'PRICE_IT',
  'NEGOTIATE_IT',
  'EXPLAIN_IT',
];

const assertionBase = {
  id: z.string().regex(/^a[0-9]+$|^[a-z][a-z0-9_]*$/, 'Assertion IDs are short lower-case tokens'),
  description: z.string().trim().min(5),
};

/** The six deterministic assertion types (TA§32, EXR-002). */
export const AssertionSchema = z.discriminatedUnion('type', [
  z.strictObject({
    ...assertionBase,
    type: z.literal('state'),
    path: z.string().min(1),
    operator: z.enum(['equals', 'contains', 'not_contains', 'exists', 'absent', 'gte', 'lte']),
    value: z.union([z.string(), z.number(), z.boolean()]).optional(),
  }),
  z.strictObject({
    ...assertionBase,
    type: z.literal('event'),
    event: z.string().min(1),
    count: z.strictObject({
      exactly: z.number().int().min(0).optional(),
      min: z.number().int().min(0).optional(),
      max: z.number().int().min(0).optional(),
    }),
    where: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
  }),
  z.strictObject({
    ...assertionBase,
    type: z.literal('timing'),
    event: z.string().min(1),
    relative_to: z.string().min(1),
    offset_minutes: z.number(),
    tolerance_minutes: z.number().min(0).default(0),
  }),
  z.strictObject({
    ...assertionBase,
    type: z.literal('architecture'),
    requirement: z.enum([
      'trigger_exists',
      'action_exists',
      'branch_exists',
      'feature_used',
      'feature_not_used',
      'node_count_max',
      'reentry_disabled',
    ]),
    ghl_feature: featureRef.optional(),
    value: z.union([z.string(), z.number()]).optional(),
  }),
  z.strictObject({
    ...assertionBase,
    type: z.literal('negative'),
    event: z.string().min(1),
    where: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
  }),
  z.strictObject({
    ...assertionBase,
    type: z.literal('sequence'),
    before: z.string().min(1),
    after: z.string().min(1),
  }),
]);

export type Assertion = z.infer<typeof AssertionSchema>;

const hint = z.strictObject({
  level: z.enum(HINT_LEVELS),
  text: markdown,
});

const fieldwork = z.strictObject({
  required: z.boolean(),
  tasks: stringList.min(1),
  evidence: z
    .array(z.enum(['screenshot', 'configuration_answers', 'explanation', 'test_results']))
    .min(1),
  reasoning_questions: stringList.default([]),
});

/** Seed state for the simulator beyond the scenario's account state. */
const startingState = z.strictObject({
  workflows: z.array(WorkflowDefinitionSchema).default([]),
  /** Learner-facing notes about the starting position (e.g. "The reminder workflow already exists"). */
  notes: z.string().optional(),
  /** For RUN THE LEAD: the contact that will be enrolled. */
  contact_id: z.string().optional(),
});

const gradingWeights = z
  .strictObject({
    correctness: z.number().int().min(0).max(100),
    edge_cases: z.number().int().min(0).max(100),
    architecture: z.number().int().min(0).max(100),
    maintainability: z.number().int().min(0).max(100),
    explanation: z.number().int().min(0).max(100),
  })
  .refine(
    (w) =>
      w.correctness + w.edge_cases + w.architecture + w.maintainability + w.explanation === 100,
    'Grading weights must sum to 100',
  );

export const ExerciseSchema = z
  .strictObject({
    id: ref('exercises'),
    type: z.enum(EXERCISE_TYPES),
    title,
    mode: z.enum(EXERCISE_MODES),
    difficulty: z.number().int().min(1).max(5),
    estimated_minutes: z.number().int().min(2).max(480),
    skills: z.array(skillRef).min(1),
    scenario: scenarioRef.optional(),
    /** Defaults to the scenario's client; explicit for exercises without a scenario. */
    client: clientRef.optional(),
    /** PROSPECT IT: the businesses to judge. */
    prospects: z.array(clientRef).default([]),
    instructions: markdown,
    allowed_features: z.array(featureRef).default([]),
    starting_state: startingState.default({ workflows: [] }),
    expected_outcomes: z.array(AssertionSchema).default([]),
    critical_failures: z.array(AssertionSchema).default([]),
    grading: z.strictObject({
      mode: z.enum(['deterministic', 'rubric', 'mixed']),
      rubric: rubricRef.optional(),
      weights: gradingWeights.optional(),
      pass_threshold: z.number().int().min(1).max(100).default(70),
    }),
    hints: z.array(hint).max(3).default([]),
    fieldwork: fieldwork.nullable().default(null),
    portfolio: portfolioRef.nullable().default(null),
    /** WRITE IT / SAY IT / EXPLAIN IT: what kind of piece, in the spec's own words. */
    format: z.string().optional(),
  })
  .superRefine((exercise, ctx) => {
    const issue = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: 'custom', path, message });
    requireUnique(ctx, exercise.skills, ['skills'], 'skill');
    requireUnique(ctx, exercise.allowed_features, ['allowed_features'], 'allowed feature');
    requireUnique(
      ctx,
      [...exercise.expected_outcomes, ...exercise.critical_failures].map((a) => a.id),
      ['expected_outcomes'],
      'assertion id',
    );
    const expectedType = /^EX-([A-Z_]+)-/.exec(exercise.id)?.[1];
    if (expectedType !== exercise.type)
      issue(['type'], `Type ${exercise.type} does not match the ID prefix`);
    if (SIMULATOR_EXERCISE_TYPES.includes(exercise.type)) {
      if (!exercise.scenario) issue(['scenario'], `${exercise.type} exercises run in a scenario`);
      if (exercise.grading.mode === 'rubric')
        issue(
          ['grading', 'mode'],
          `${exercise.type} is graded deterministically (or mixed), never rubric-only`,
        );
      if (exercise.expected_outcomes.length === 0)
        issue(['expected_outcomes'], `${exercise.type} needs deterministic expected outcomes`);
    }
    if (exercise.grading.mode !== 'deterministic' && !exercise.grading.rubric) {
      issue(['grading', 'rubric'], `Grading mode ${exercise.grading.mode} needs a rubric`);
    }
    if (exercise.grading.mode === 'deterministic' && exercise.grading.rubric) {
      issue(['grading', 'rubric'], 'Deterministic grading must not name a rubric');
    }
    if (exercise.type === 'FIELDWORK' && !exercise.fieldwork?.required) {
      issue(['fieldwork'], 'FIELDWORK exercises require real GHL fieldwork');
    }
    if (exercise.type === 'PROSPECT_IT' && exercise.prospects.length < 2) {
      issue(['prospects'], 'PROSPECT IT judges several businesses');
    }
    if (exercise.type !== 'PROSPECT_IT' && exercise.prospects.length > 0) {
      issue(['prospects'], 'Only PROSPECT IT lists prospects');
    }
    if (!exercise.scenario && !exercise.client && exercise.prospects.length === 0) {
      issue(['scenario'], 'An exercise needs a scenario, a client, or prospects');
    }
    if (exercise.mode === 'pressure' && exercise.hints.length > 0) {
      issue(['hints'], 'Pressure-test exercises offer no hints');
    }
    if (
      exercise.type === 'REBUILD_BLIND' &&
      exercise.hints.some((h) => h.level === 'worked_example')
    ) {
      issue(['hints'], 'REBUILD BLIND never provides a worked example');
    }
    if (exercise.type === 'RUN_THE_LEAD' && !exercise.starting_state.contact_id) {
      issue(['starting_state', 'contact_id'], 'RUN THE LEAD names the contact that gets enrolled');
    }
  });

export type Exercise = z.infer<typeof ExerciseSchema>;
