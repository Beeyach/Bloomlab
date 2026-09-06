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
import { FUNNEL_BLOCK_ROLES, FUNNEL_STEP_PURPOSES } from './funnel.ts';
import {
  AUDIT_METRICS,
  CONVERSATION_METRICS,
  ConversationSchema,
  EXPLANATION_METRICS,
  MESSAGE_FIELD_METRICS,
  MESSAGE_METRICS,
  MESSAGE_TYPES,
  PROSPECT_METRICS,
  SALES_STATE_ROOTS,
  SalesConfigSchema,
  WRITING_AUDIENCES,
} from './sales.ts';
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
  /** Phase 13: a funnel is assembled in the Funnel Lab, inside the shared account (EXR-011). */
  'FUNNEL_ASSEMBLY',
  /**
   * Phase 15: a funnel's own traffic is inspected and diagnosed (EXR-010). A different job from
   * FUNNEL_ASSEMBLY, which builds architecture — this one reads what visitors actually did, so it
   * needs a funnel with traffic rather than an empty account to build in (§72).
   */
  'FUNNEL_AUTOPSY',
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

/**
 * Which bucket a check belongs to (EXR-003). `critical_failures` are always critical, so only
 * the three scored tiers are authorable; an expected outcome without a tier is `required`,
 * which is what every exercise written before Phase 9 means.
 */
export const ASSERTION_TIERS = ['required', 'quality', 'bonus'] as const;
export type AuthorableAssertionTier = (typeof ASSERTION_TIERS)[number];

/** The five scored dimensions of a workflow build (EXR-023, spec §31). */
export const SCORING_DIMENSIONS = [
  'correctness',
  'edge_cases',
  'architecture',
  'maintainability',
  'explanation',
] as const;

const assertionBase = {
  id: z.string().regex(/^a[0-9]+$|^[a-z][a-z0-9_]*$/, 'Assertion IDs are short lower-case tokens'),
  description: z.string().trim().min(5),
  tier: z.enum(ASSERTION_TIERS).optional(),
  /** Which weighted dimension the check counts toward; placed by type when absent (EXR-023). */
  dimension: z.enum(SCORING_DIMENSIONS).optional(),
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
      // Funnel architecture (EXR-011). These are deliberately partial-order rules rather than a
      // single expected sequence: a scenario with several defensible orderings must be able to
      // pass all of them, so an exercise states what must be true, never what must be in slot 3.
      'funnel_step_exists',
      'funnel_step_order',
      'funnel_block_exists',
      'funnel_block_absent',
      'funnel_block_order',
      'funnel_reference_connected',
      'funnel_step_count_max',
    ]),
    ghl_feature: featureRef.optional(),
    value: z.union([z.string(), z.number()]).optional(),
    /** The block role a funnel requirement is about. */
    role: z.enum(FUNNEL_BLOCK_ROLES).optional(),
    /** The step purpose a funnel requirement is about, or the step a block must sit in. */
    purpose: z.enum(FUNNEL_STEP_PURPOSES).optional(),
    /** An order rule: what must come first, and what must come after it. */
    before: z.string().min(1).optional(),
    after: z.string().min(1).optional(),
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

/**
 * Deterministic markers for written work (EXR-002 "learner response metadata"). Each key names a
 * fact the exercise wants to detect — `merge_field`, `names_missing_information` — and lists the
 * phrases that count as naming it. The runner matches them case-insensitively against what the
 * learner wrote and exposes the result as `decision.reasoning_mentions` (the keys found) and
 * `answer.<key>` (a boolean), which state assertions then read. The vocabulary is content, never
 * code, and it is never shown to the learner (D-070). This is not rubric grading: it decides one
 * authored marker, not the quality of an argument.
 */
/**
 * The structured architectures an exercise offers, when its level offers them (EXR-009: the
 * later-level version of the same family authors none and takes the decision as writing). The
 * options are content — the exercise's own instructions name them — never a list in React.
 */
const decisionOption = z.strictObject({
  value: z.string().regex(/^[a-z][a-z0-9_]*$/, 'Decision values are lower-case tokens'),
  label: z.string().trim().min(2),
});

/**
 * Long-form answers the exercise asks for by name (EXR-010, D-143).
 *
 * The runner already collects one piece of writing. Some work needs more than one and needs them
 * kept apart: a FUNNEL AUTOPSY asks what the problem is and what might explain it, and the whole
 * lesson is that those are different kinds of statement. One textarea would let them blur, so
 * each authored field is its own saved answer, graded on its own.
 *
 * The fields are content. React renders whatever the exercise authors and knows none of their
 * names.
 */
const writtenField = z.strictObject({
  key: z.string().regex(/^[a-z][a-z0-9_]*$/, 'Written field keys are lower-case tokens'),
  label: z.string().trim().min(2),
  /** The question under the label, in the learner's words. Never a hint at the answer. */
  help: z.string().trim().min(4),
  rows: z.number().int().min(2).max(20).default(5),
  /**
   * Who this answer is for (SAL-007). `owner` is the reader who will never open a workflow
   * builder, so builder vocabulary in it is counted as jargon; `builder` is the person who will
   * maintain the thing, where the same words are exactly right.
   */
  audience: z.enum(WRITING_AUDIENCES).default('none'),
  /** The brief's word cap, counted the same way in the work area and in the grade. */
  max_words: z.number().int().min(20).max(2000).optional(),
  /** Ask for the one thing the reader is being asked to do (SAL-003's CTA, SAL-008's next step). */
  next_step: z.boolean().default(false),
  /** Offer this exercise's evidence to cite, so a claim can be checked against something. */
  cites_evidence: z.boolean().default(false),
  /** Which of the written pieces Phase 16 trains this is (EXR-014, SAL-013). */
  message_type: z.enum(MESSAGE_TYPES).optional(),
});

const responseMarkers = z.record(
  z.string().regex(/^[a-z][a-z0-9_]*$/, 'Marker keys are lower-case tokens'),
  z.array(z.string().trim().min(2)).min(1),
);

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
  /** For FUNNEL AUTOPSY: the funnel whose traffic is being read (EXR-010). */
  funnel_id: z.string().optional(),
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

/** The parts of an exercise a sales state path is judged against. */
interface SalesPathSubject {
  type: ExerciseType;
  written_fields: { key: string; audience: string; message_type?: string }[];
  sales: { frame: { element: string }[] };
  conversation: { nodes: { covers: string[]; situation?: string }[] } | null;
}

const listing = (values: readonly string[]): string => values.join(', ');

/**
 * Why an authored `state` check on a sales projection could never be judged. Empty means the
 * path names a figure this exercise's own work actually produces.
 */
function salesPathIssues(exercise: SalesPathSubject, root: string, rest: string[]): string[] {
  const key = rest.join('.');
  const problems: string[] = [];
  const needs = (ok: boolean, message: string) => {
    if (!ok) problems.push(message);
  };
  const known = (metrics: readonly string[]) =>
    needs(metrics.includes(key), `${root}.${key} is not one of ${listing(metrics)}`);

  switch (root) {
    case 'prospects':
      needs(exercise.type === 'PROSPECT_IT', 'Only PROSPECT IT judges prospects');
      known(PROSPECT_METRICS);
      break;
    case 'audit':
      needs(exercise.type === 'AUDIT_IT', 'Only AUDIT IT collects findings');
      known(AUDIT_METRICS);
      break;
    case 'message': {
      needs(exercise.written_fields.length > 0, 'message.* needs at least one written field');
      if (rest[0] === 'fields') {
        const field = rest[1] ?? '';
        const metric = rest.slice(2).join('.');
        needs(
          exercise.written_fields.some((candidate) => candidate.key === field),
          `message.fields.${field} needs a written field named ${field}`,
        );
        needs(
          (MESSAGE_FIELD_METRICS as readonly string[]).includes(metric),
          `message.fields.<field>.${metric} is not one of ${listing(MESSAGE_FIELD_METRICS)}`,
        );
      } else known(MESSAGE_METRICS);
      break;
    }
    case 'explanation': {
      needs(
        exercise.written_fields.some((field) => field.audience !== 'none'),
        'explanation.* needs written fields written for an audience',
      );
      if (rest[0] === 'frame') {
        const element = rest[1] ?? '';
        needs(
          exercise.sales.frame.some((entry) => entry.element === element),
          `explanation.frame.${element} needs a sales.frame entry for ${element}`,
        );
      } else known(EXPLANATION_METRICS);
      break;
    }
    case 'conversation': {
      const nodes = exercise.conversation?.nodes ?? [];
      needs(nodes.length > 0, 'conversation.* needs an authored conversation');
      if (rest[0] === 'topics') {
        const topic = rest[1] ?? '';
        needs(
          nodes.some((node) => node.covers.includes(topic)),
          `no turn of this thread covers ${topic}`,
        );
      } else if (rest[0] === 'situations') {
        const situation = rest[1] ?? '';
        needs(
          nodes.some((node) => node.situation === situation),
          `no turn of this thread stages ${situation}`,
        );
      } else known(CONVERSATION_METRICS);
      break;
    }
  }
  return problems;
}

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
    response_markers: responseMarkers.default({}),
    /** Named long-form answers, when one textarea is not the right shape (EXR-010). */
    written_fields: z.array(writtenField).default([]),
    decision_options: z.array(decisionOption).default([]),
    /** The selling families' authored half: evidence, prospect briefs, the frame (Phase 16). */
    sales: SalesConfigSchema.default({
      evidence: [],
      prospect_briefs: [],
      min_findings: 3,
      frame: [],
    }),
    /** An authored written client thread (CONV-002). */
    conversation: ConversationSchema.nullable().default(null),
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
      exercise.decision_options.map((option) => option.value),
      ['decision_options'],
      'decision option',
    );
    requireUnique(
      ctx,
      exercise.written_fields.map((field) => field.key),
      ['written_fields'],
      'written field',
    );
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
    if (exercise.type === 'PROSPECT_IT' && exercise.prospects.length < 3) {
      issue(['prospects'], 'PROSPECT IT needs at least three businesses');
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
    // ---- checks the Phase 9 grader relies on: a malformed rule must fail the build, never
    // reach a learner as a check that silently cannot be judged (EXR-002, CNT-005).
    const markerKeys = new Set(Object.keys(exercise.response_markers));
    const checkAssertion = (
      assertion: Assertion,
      where: 'expected_outcomes' | 'critical_failures',
      index: number,
    ) => {
      const at = (field: string) => [where, index, field];
      if (where === 'critical_failures' && assertion.tier) {
        issue(at('tier'), 'Critical failures are always the critical tier; drop the tier');
      }
      if (assertion.type === 'event') {
        const { exactly, min, max } = assertion.count;
        if (exactly === undefined && min === undefined && max === undefined) {
          issue(at('count'), 'An event assertion needs exactly, min or max');
        }
        if (min !== undefined && max !== undefined && min > max) {
          issue(at('count'), `min ${min} is above max ${max}`);
        }
      }
      if (assertion.type === 'architecture') {
        const needsFeature = [
          'trigger_exists',
          'action_exists',
          'feature_used',
          'feature_not_used',
        ];
        if (needsFeature.includes(assertion.requirement) && !assertion.ghl_feature) {
          issue(at('ghl_feature'), `${assertion.requirement} names the GHL feature it looks for`);
        }
        if (assertion.requirement === 'node_count_max' && typeof assertion.value !== 'number') {
          issue(at('value'), 'node_count_max needs a numeric limit');
        }
        const needsRole = [
          'funnel_block_exists',
          'funnel_block_absent',
          'funnel_reference_connected',
        ];
        if (needsRole.includes(assertion.requirement) && !assertion.role) {
          issue(at('role'), `${assertion.requirement} names the block role it looks for`);
        }
        if (assertion.requirement === 'funnel_step_exists' && !assertion.purpose) {
          issue(at('purpose'), 'funnel_step_exists names the step purpose it looks for');
        }
        if (
          assertion.requirement === 'funnel_step_count_max' &&
          typeof assertion.value !== 'number'
        ) {
          issue(at('value'), 'funnel_step_count_max needs a numeric limit');
        }
        if (assertion.requirement === 'funnel_block_order') {
          const roles = FUNNEL_BLOCK_ROLES as readonly string[];
          if (!assertion.before || !roles.includes(assertion.before))
            issue(at('before'), 'funnel_block_order names the block role that comes first');
          if (!assertion.after || !roles.includes(assertion.after))
            issue(at('after'), 'funnel_block_order names the block role that comes after');
        }
        if (assertion.requirement === 'funnel_step_order') {
          const purposes = FUNNEL_STEP_PURPOSES as readonly string[];
          if (!assertion.before || !purposes.includes(assertion.before))
            issue(at('before'), 'funnel_step_order names the step purpose that comes first');
          if (!assertion.after || !purposes.includes(assertion.after))
            issue(at('after'), 'funnel_step_order names the step purpose that comes after');
        }
        if (assertion.requirement === 'funnel_reference_connected') {
          const referencing = ['form', 'survey', 'calendar', 'checkout'];
          if (assertion.role && !referencing.includes(assertion.role))
            issue(at('role'), `A ${assertion.role} block connects to no account entity`);
        }
      }
      if (assertion.type === 'state') {
        const [root, ...rest] = assertion.path.split('.');
        // A decision the exercise offers as options must expect one of them.
        if (
          root === 'decision' &&
          rest[0] === 'choice' &&
          assertion.operator === 'equals' &&
          exercise.decision_options.length > 0 &&
          !exercise.decision_options.some((option) => option.value === assertion.value)
        ) {
          issue(
            at('value'),
            `decision.choice "${String(assertion.value)}" is not one of the decision_options`,
          );
        }
        const needsValue = ['equals', 'contains', 'not_contains', 'gte', 'lte'];
        if (needsValue.includes(assertion.operator) && assertion.value === undefined) {
          issue(at('value'), `Operator ${assertion.operator} needs a value to compare`);
        }
        // A check on written work must name a marker the exercise actually defines, or nothing
        // deterministic could ever decide it.
        if (root === 'answer') {
          const key = rest.join('.');
          if (!markerKeys.has(key)) {
            issue(at('path'), `answer.${key} needs a response_markers entry named ${key}`);
          }
        }
        // A check on a named written answer must name a field the exercise actually asks for, or
        // nothing the learner can type could ever satisfy it.
        if (root === 'written') {
          const written = new Set(exercise.written_fields.map((field) => field.key));
          const field = (rest[0] ?? '').replace(/_mentions$/, '').replace(/_answered$/, '');
          if (!written.has(field)) {
            issue(at('path'), `written.${rest.join('.')} needs a written field named ${field}`);
          }
        }
        if (
          root === 'decision' &&
          rest[0] === 'reasoning_mentions' &&
          typeof assertion.value === 'string' &&
          !markerKeys.has(assertion.value)
        ) {
          issue(
            at('value'),
            `decision.reasoning_mentions "${assertion.value}" needs a response_markers entry`,
          );
        }
        // A check on one of the sales projections must name a figure that projection produces,
        // for an exercise whose family produces it at all. Otherwise it is a criterion the
        // learner can never meet, however well they do the work.
        if ((SALES_STATE_ROOTS as readonly string[]).includes(root ?? '')) {
          for (const message of salesPathIssues(exercise, root ?? '', rest)) {
            issue(at('path'), message);
          }
        }
      }
    };
    exercise.expected_outcomes.forEach((assertion, index) =>
      checkAssertion(assertion, 'expected_outcomes', index),
    );
    exercise.critical_failures.forEach((assertion, index) =>
      checkAssertion(assertion, 'critical_failures', index),
    );
    // ---- the selling families (Phase 16). What a family needs to be runnable at all is checked
    // here, so an exercise that cannot be done never reaches a learner as one that can.
    const evidenceIds = new Set(exercise.sales.evidence.map((item) => item.id));
    for (const [index, field] of exercise.written_fields.entries()) {
      if (field.cites_evidence && evidenceIds.size === 0) {
        issue(
          ['written_fields', index, 'cites_evidence'],
          `${field.key} offers evidence to cite, but the exercise authors none`,
        );
      }
    }
    for (const [index, entry] of exercise.sales.frame.entries()) {
      for (const marker of entry.markers) {
        if (!markerKeys.has(marker)) {
          issue(
            ['sales', 'frame', index, 'markers'],
            `${marker} needs a response_markers entry named ${marker}`,
          );
        }
      }
    }
    for (const [index, item] of exercise.sales.evidence.entries()) {
      if (!item.client) continue;
      const belongs =
        exercise.prospects.includes(item.client) ||
        item.client === exercise.client ||
        exercise.prospects.length === 0;
      if (!belongs) {
        issue(['sales', 'evidence', index, 'client'], `${item.client} is not one of the prospects`);
      }
    }
    if (exercise.type === 'PROSPECT_IT') {
      const briefed = new Set(exercise.sales.prospect_briefs.map((brief) => brief.client));
      for (const prospect of exercise.prospects) {
        if (!briefed.has(prospect)) {
          issue(['sales', 'prospect_briefs'], `${prospect} has no prospect brief`);
        }
      }
      for (const [index, brief] of exercise.sales.prospect_briefs.entries()) {
        if (!exercise.prospects.includes(brief.client)) {
          issue(
            ['sales', 'prospect_briefs', index, 'client'],
            `${brief.client} is not one of this exercise's prospects`,
          );
        }
        // Evidence about another business cannot justify a decision about this one.
        for (const [axisIndex, axis] of brief.axes.entries()) {
          for (const id of axis.evidence) {
            const item = exercise.sales.evidence.find((candidate) => candidate.id === id);
            if (item && item.client && item.client !== brief.client) {
              issue(
                ['sales', 'prospect_briefs', index, 'axes', axisIndex, 'evidence'],
                `${id} is evidence about ${item.client}, not ${brief.client}`,
              );
            }
          }
        }
      }
      // Somebody has to be worth skipping, or the exercise teaches "contact everyone" (SAL-002).
      if (
        exercise.sales.prospect_briefs.length > 0 &&
        !exercise.sales.prospect_briefs.some((brief) => brief.acceptable_decisions.includes('skip'))
      ) {
        issue(
          ['sales', 'prospect_briefs'],
          'At least one prospect must be one it is right to skip',
        );
      }
    }
    if (exercise.type === 'AUDIT_IT' && exercise.sales.evidence.length === 0) {
      issue(['sales', 'evidence'], 'AUDIT IT needs the evidence the learner is auditing');
    }
    if (exercise.type === 'AUDIT_IT' && !exercise.sales.evidence.some((item) => item.direct)) {
      issue(
        ['sales', 'evidence'],
        'AUDIT IT needs at least one directly observed item, or nothing can be Verified',
      );
    }
    if (exercise.type === 'EXPLAIN_IT') {
      // The requirement is the same system for two audiences (EXR-018); one answer is a different
      // exercise, and the schema will not let it be authored as this one.
      const audiences = new Set(
        exercise.written_fields
          .filter((field) => field.audience !== 'none')
          .map((field) => field.audience),
      );
      if (!audiences.has('owner') || !audiences.has('builder')) {
        issue(
          ['written_fields'],
          'EXPLAIN IT asks for the owner version and the builder version; author a written field for each audience',
        );
      }
    }
    if (exercise.conversation) {
      const client = exercise.conversation.client ?? exercise.client;
      if (!client) {
        issue(['conversation', 'client'], 'A thread needs a client, on the exercise or on itself');
      }
    }
    if (exercise.type === 'RUN_THE_LEAD' && !exercise.starting_state.contact_id) {
      issue(['starting_state', 'contact_id'], 'RUN THE LEAD names the contact that gets enrolled');
    }
    if (exercise.type === 'FUNNEL_AUTOPSY') {
      if (!exercise.starting_state.funnel_id) {
        issue(
          ['starting_state', 'funnel_id'],
          'FUNNEL AUTOPSY names the funnel whose traffic is being read',
        );
      }
      // The distinction between what is observed and what might explain it is the requirement,
      // not a presentation choice, so the schema will not let an autopsy collapse them into one.
      const keys = new Set(exercise.written_fields.map((field) => field.key));
      for (const required of ['problem', 'hypothesis']) {
        if (!keys.has(required)) {
          issue(
            ['written_fields'],
            `FUNNEL AUTOPSY asks for a separate ${required}; add a written field named ${required}`,
          );
        }
      }
    }
  });

export type Exercise = z.infer<typeof ExerciseSchema>;
