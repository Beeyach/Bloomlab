import { canonical } from './hash.ts';
import type { Workflow } from './state.ts';

/**
 * Workflow behaviour, separated from workflow layout (SIM-016).
 *
 * A workflow is data: trigger, filters, nodes, edges and settings decide what it does; `position`
 * decides only where a node sits on a canvas. Moving a node from x=100 to x=900 must therefore
 * change nothing about how it evaluates, and `behaviouralWorkflow` is what makes that testable —
 * it is the workflow with every coordinate removed.
 *
 * Phase 12's Workflow Lab is what executes these. Phase 10 owns the contract and the guarantee.
 */

export interface BehaviouralWorkflow {
  id: string;
  name: string;
  trigger: Workflow['trigger'];
  nodes: {
    id: string;
    type: string;
    ghl_feature_id: string | null;
    label: string | null;
    config: Record<string, unknown>;
  }[];
  edges: Workflow['edges'];
  settings: Workflow['settings'];
}

export const behaviouralWorkflow = (workflow: Workflow): BehaviouralWorkflow => ({
  id: workflow.id,
  name: workflow.name,
  trigger: workflow.trigger,
  nodes: workflow.nodes.map((node) => ({
    id: node.id,
    type: node.type,
    ghl_feature_id: node.ghl_feature_id,
    label: node.label,
    config: node.config,
  })),
  edges: workflow.edges,
  settings: workflow.settings,
});

/** True when two workflows differ only in where their nodes are drawn. */
export const workflowsAreBehaviourallyEqual = (a: Workflow, b: Workflow): boolean =>
  canonical(behaviouralWorkflow(a)) === canonical(behaviouralWorkflow(b));
