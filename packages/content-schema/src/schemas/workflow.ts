import { z } from 'zod';

import { featureRef, isoDateTime, requireUnique, timeZone } from './common.ts';

/**
 * A workflow as data (spec SIM-016, TA§28): trigger, nodes, edges and settings. `position` is
 * layout only — moving a node never changes behaviour. Node and trigger features must exist in
 * the registry; the compiler checks that (and that none of them is REAL_GHL).
 */

export const WORKFLOW_NODE_TYPES = ['action', 'wait', 'branch', 'goal', 'end'] as const;

/** The operators a filter or condition may use; the engine's list, restated for authors. */
export const CONDITION_OPERATORS = [
  'is',
  'is_not',
  'contains',
  'not_contains',
  'exists',
  'not_exists',
  'gt',
  'lt',
] as const;

const conditionValue = z.union([z.string(), z.number(), z.boolean()]);

/**
 * One comparison: a field address, an operator, and (except for exists / not_exists) a value.
 * Conditions are data, never expressions (WFL-009). The addresses the engine can read are its
 * business; the compiler checks shape here and the engine's graph validation checks reach.
 */
export const ConditionSchema = z
  .strictObject({
    field: z
      .string()
      .regex(/^[a-z_]+(?:\.[a-zA-Z0-9_]+)+$/, 'A field address such as contact.tags'),
    operator: z.enum(CONDITION_OPERATORS),
    value: conditionValue.optional(),
  })
  .superRefine((condition, ctx) => {
    const needsValue = !['exists', 'not_exists'].includes(condition.operator);
    if (needsValue && condition.value === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['value'],
        message: `${condition.operator} compares against a value; give one`,
      });
    }
  });

/** Conditions inside a group are ANDed; groups inside a branch are ORed (GHL-WF-IF-ELSE). */
export const ConditionGroupSchema = z.strictObject({
  conditions: z.array(ConditionSchema).min(1),
});

export const BranchSchema = z.strictObject({
  name: z
    .string()
    .trim()
    .min(1)
    .refine((name) => name.toLowerCase() !== 'none', 'None is the automatic fallback branch'),
  groups: z.array(ConditionGroupSchema).min(1),
});

/** What an If/Else node's `config` must look like. */
export const IfElseConfigSchema = z
  .strictObject({ branches: z.array(BranchSchema).min(1) })
  .superRefine((config, ctx) => {
    requireUnique(
      ctx,
      config.branches.map((branch) => branch.name.toLowerCase()),
      ['branches'],
      'branch name',
    );
  });

export const WAIT_TYPES = ['period', 'date', 'appointment', 'reply', 'condition'] as const;

const duration = z.number().min(0);

/**
 * What a Wait node's `config` must look like, per wait type (GHL-WF-WAIT). A date wait names an
 * instant with an explicit offset — the engine refuses a bare local time (D-098).
 */
export const WaitConfigSchema = z
  .strictObject({
    wait_type: z.enum(WAIT_TYPES),
    days: duration.optional(),
    hours: duration.optional(),
    minutes: duration.optional(),
    at: isoDateTime.optional(),
    relative: z.enum(['at', 'before', 'after']).optional(),
    channel: z.enum(['sms', 'email', 'any']).optional(),
    timeout_hours: duration.optional(),
    groups: z.array(ConditionGroupSchema).min(1).optional(),
  })
  .superRefine((config, ctx) => {
    const issue = (path: string, message: string) =>
      ctx.addIssue({ code: 'custom', path: [path], message });
    switch (config.wait_type) {
      case 'period': {
        const total = (config.days ?? 0) * 1440 + (config.hours ?? 0) * 60 + (config.minutes ?? 0);
        if (total <= 0) issue('days', 'A period wait needs days, hours or minutes');
        break;
      }
      case 'date':
        if (!config.at) issue('at', 'A date wait needs `at`, an instant with an offset');
        break;
      case 'appointment':
        if (
          config.relative &&
          config.relative !== 'at' &&
          (config.hours ?? 0) * 60 + (config.minutes ?? 0) <= 0
        ) {
          issue('hours', 'A before/after appointment wait needs hours or minutes');
        }
        break;
      case 'condition':
        if (!config.groups) issue('groups', 'A condition wait needs condition groups');
        break;
      case 'reply':
        break;
    }
  });

/** Business hours (Workflow Settings → Time Window): ISO weekdays 1–7 and HH:MM bounds. */
export const TimeWindowSchema = z
  .strictObject({
    days: z.array(z.number().int().min(1).max(7)).min(1),
    start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'HH:MM'),
    end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'HH:MM'),
  })
  .refine((window) => window.start < window.end, 'A time window must end after it starts');

const filter = z.strictObject({
  field: z.string().min(1),
  operator: z.enum(CONDITION_OPERATORS),
  value: conditionValue.optional(),
});

const node = z.strictObject({
  id: z.string().regex(/^n[0-9]+$|^[a-z][a-z0-9_-]*$/, 'Node IDs are short lower-case tokens'),
  type: z.enum(WORKFLOW_NODE_TYPES),
  /** Required for everything except `end`; the registry feature this node represents. */
  ghl_feature_id: featureRef.optional(),
  label: z.string().min(1).optional(),
  config: z.record(z.string(), z.unknown()).default({}),
  position: z.strictObject({ x: z.number(), y: z.number() }),
});

const edge = z.strictObject({
  from: z.string().min(1),
  to: z.string().min(1),
  /** Branch label for `branch` nodes (e.g. `yes` / `no`). */
  branch: z.string().min(1).optional(),
});

export const WorkflowDefinitionSchema = z
  .strictObject({
    id: z.string().regex(/^wf-[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Workflow IDs look like wf-…'),
    name: z.string().min(1),
    trigger: z.strictObject({
      ghl_feature_id: featureRef,
      filters: z.array(filter).default([]),
    }),
    nodes: z.array(node).min(1),
    edges: z.array(edge).default([]),
    settings: z
      .strictObject({
        allow_reentry: z.boolean().default(false),
        timezone: timeZone.optional(),
        notes: z.string().optional(),
        /** Workflow Settings → Time Window: outbound messages are held until the window opens. */
        time_window: TimeWindowSchema.nullable().optional(),
      })
      .default({ allow_reentry: false }),
  })
  .superRefine((workflow, ctx) => {
    requireUnique(
      ctx,
      workflow.nodes.map((n) => n.id),
      ['nodes'],
      'node id',
    );
    const ids = new Set(workflow.nodes.map((n) => n.id));
    workflow.nodes.forEach((n, index) => {
      if (n.type !== 'end' && !n.ghl_feature_id) {
        ctx.addIssue({
          code: 'custom',
          path: ['nodes', index, 'ghl_feature_id'],
          message: `Node ${n.id} (${n.type}) needs a ghl_feature_id`,
        });
      }
      // Structured configs: a wait and a branch have one shape each, checked here so an author
      // finds out at compile time, not when a learner's test contact reaches the step.
      const shaped =
        n.type === 'wait' ? WaitConfigSchema : n.type === 'branch' ? IfElseConfigSchema : null;
      if (shaped) {
        const result = shaped.safeParse(n.config);
        if (!result.success) {
          for (const issue of result.error.issues) {
            ctx.addIssue({
              code: 'custom',
              path: ['nodes', index, 'config', ...issue.path.map(String)],
              message: `Node ${n.id}: ${issue.message}`,
            });
          }
        }
      }
    });
    workflow.edges.forEach((e, index) => {
      if (!ids.has(e.from))
        ctx.addIssue({
          code: 'custom',
          path: ['edges', index, 'from'],
          message: `Unknown node ${e.from}`,
        });
      if (!ids.has(e.to))
        ctx.addIssue({
          code: 'custom',
          path: ['edges', index, 'to'],
          message: `Unknown node ${e.to}`,
        });
    });
  });

export type WorkflowDefinition = z.infer<typeof WorkflowDefinitionSchema>;
