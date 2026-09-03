import { z } from 'zod';

import { featureRef, requireUnique, timeZone } from './common.ts';

/**
 * A workflow as data (spec SIM-016, TA§28): trigger, nodes, edges and settings. `position` is
 * layout only — moving a node never changes behaviour. Node and trigger features must exist in
 * the registry; the compiler checks that (and that none of them is REAL_GHL).
 */

export const WORKFLOW_NODE_TYPES = ['action', 'wait', 'branch', 'goal', 'end'] as const;

const filter = z.strictObject({
  field: z.string().min(1),
  operator: z.enum(['is', 'is_not', 'contains', 'exists', 'not_exists', 'gt', 'lt']),
  value: z.union([z.string(), z.number(), z.boolean()]).optional(),
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
