import type {
  Workflow,
  WorkflowEdge,
  WorkflowNode,
  WorkflowSettings,
  WorkflowTriggerFilter,
} from '@bloomlab/simulator-core';

import { paletteEntry } from './palette';

/**
 * Pure edits over a workflow definition (WFL-002).
 *
 * Every editor gesture — add, remove, connect, reorder, move, configure — is one of these
 * functions: definition in, definition out, nothing else touched. The draft history records the
 * results; the engine validates and runs them. Positions are layout only (SIM-016): the functions
 * that place a node keep the canvas tidy and change no behaviour.
 */

export const COLUMN = 320;
export const ROW = 150;

const nextNodeId = (workflow: Workflow): string => {
  let n = workflow.nodes.length + 1;
  while (workflow.nodes.some((node) => node.id === `n${n}`)) n += 1;
  return `n${n}`;
};

/** The node nothing leads to — where the walk starts. */
export const entryNode = (workflow: Workflow): WorkflowNode | null => {
  const targets = new Set(workflow.edges.map((edge) => edge.to));
  return workflow.nodes.find((node) => !targets.has(node.id)) ?? null;
};

export const outgoing = (workflow: Workflow, id: string): WorkflowEdge[] =>
  workflow.edges.filter((edge) => edge.from === id);

export const incoming = (workflow: Workflow, id: string): WorkflowEdge[] =>
  workflow.edges.filter((edge) => edge.to === id);

/** The branch names an If/Else offers for its connections, None last. */
export function branchNames(node: WorkflowNode): string[] {
  if (node.type !== 'branch') return [];
  const branches = Array.isArray(node.config.branches)
    ? (node.config.branches as { name?: unknown }[])
    : [];
  return [
    ...branches
      .map((branch) => (typeof branch.name === 'string' ? branch.name : ''))
      .filter(Boolean),
    'None',
  ];
}

/* ---- adding and removing ------------------------------------------------------------------ */

/** A step, placed after `afterId` when given (and re-linked into the chain), else at the tail. */
export function addNode(
  workflow: Workflow,
  featureId: string | null,
  type: WorkflowNode['type'],
  afterId: string | null = null,
  branch: string | null = null,
): { workflow: Workflow; node: WorkflowNode } {
  const id = nextNodeId(workflow);
  const after = afterId ? workflow.nodes.find((node) => node.id === afterId) : null;
  const tail = after ?? lastInChain(workflow);
  const node: WorkflowNode = {
    id,
    type,
    ghl_feature_id: type === 'end' ? null : featureId,
    label: null,
    config: defaultConfig(featureId, type),
    position: tail
      ? { x: tail.position.x + (branch && branch !== 'None' ? 0 : 0), y: tail.position.y + ROW }
      : { x: 0, y: ROW },
  };
  let edges = workflow.edges;
  if (tail) {
    // Splice into the chain: what followed the tail on this branch now follows the new node.
    const following = edges.find(
      (edge) =>
        edge.from === tail.id &&
        (tail.type === 'branch'
          ? (edge.branch ?? 'None').toLowerCase() === (branch ?? 'None').toLowerCase()
          : true),
    );
    edges = edges.filter((edge) => edge !== following);
    edges = [
      ...edges,
      { from: tail.id, to: id, branch: tail.type === 'branch' ? (branch ?? 'None') : null },
    ];
    if (following && type !== 'end')
      edges = [...edges, { from: id, to: following.to, branch: null }];
  }
  return { workflow: tidy({ ...workflow, nodes: [...workflow.nodes, node], edges }), node };
}

export function removeNode(workflow: Workflow, id: string): Workflow {
  const before = incoming(workflow, id);
  const after = outgoing(workflow, id);
  let edges = workflow.edges.filter((edge) => edge.from !== id && edge.to !== id);
  // Close the gap: whoever led here now leads to whatever this led to, when that is unambiguous.
  if (after.length === 1) {
    const next = after[0] as WorkflowEdge;
    edges = [...edges, ...before.map((edge) => ({ ...edge, to: next.to }))];
  }
  return tidy({ ...workflow, nodes: workflow.nodes.filter((node) => node.id !== id), edges });
}

/** Connects `from` to `to`, replacing whatever `from` led to on that branch. Refuses self-loops. */
export function connect(
  workflow: Workflow,
  from: string,
  to: string,
  branch: string | null = null,
): Workflow {
  if (from === to) return workflow;
  const source = workflow.nodes.find((node) => node.id === from);
  if (!source || !workflow.nodes.some((node) => node.id === to)) return workflow;
  const label = source.type === 'branch' ? (branch ?? 'None') : null;
  const edges = workflow.edges.filter(
    (edge) =>
      !(
        edge.from === from &&
        (edge.branch ?? null)?.toLowerCase() === (label ?? null)?.toLowerCase()
      ),
  );
  return { ...workflow, edges: [...edges, { from, to, branch: label }] };
}

export function disconnect(workflow: Workflow, from: string, to: string): Workflow {
  return {
    ...workflow,
    edges: workflow.edges.filter((edge) => !(edge.from === from && edge.to === to)),
  };
}

/* ---- configuring ----------------------------------------------------------------------- */

export const updateNode = (
  workflow: Workflow,
  id: string,
  patch: Partial<WorkflowNode>,
): Workflow => ({
  ...workflow,
  nodes: workflow.nodes.map((node) => (node.id === id ? { ...node, ...patch } : node)),
});

export const setNodeConfig = (
  workflow: Workflow,
  id: string,
  config: Record<string, unknown>,
): Workflow => updateNode(workflow, id, { config });

/** Changes the feature behind a step; the type follows the feature and the config starts over. */
export function setNodeFeature(workflow: Workflow, id: string, featureId: string): Workflow {
  const entry = paletteEntry(featureId);
  const type: WorkflowNode['type'] = entry?.nodeType ?? 'action';
  return updateNode(workflow, id, {
    ghl_feature_id: featureId,
    type,
    config: defaultConfig(featureId, type),
  });
}

export const setTrigger = (workflow: Workflow, featureId: string): Workflow => ({
  ...workflow,
  trigger: { ghl_feature_id: featureId, filters: [] },
});

export const setTriggerFilters = (
  workflow: Workflow,
  filters: WorkflowTriggerFilter[],
): Workflow => ({
  ...workflow,
  trigger: { ...workflow.trigger, filters },
});

export const setSettings = (workflow: Workflow, patch: Partial<WorkflowSettings>): Workflow => ({
  ...workflow,
  settings: { ...workflow.settings, ...patch },
});

export const rename = (workflow: Workflow, name: string): Workflow => ({ ...workflow, name });

/* ---- layout ---------------------------------------------------------------------------- */

export const moveNode = (workflow: Workflow, id: string, x: number, y: number): Workflow =>
  updateNode(workflow, id, { position: { x: Math.round(x), y: Math.round(y) } });

/** Swaps a node with its predecessor or successor along a straight chain. Behaviour changes; layout follows. */
export function reorder(workflow: Workflow, id: string, direction: 'up' | 'down'): Workflow {
  const after = outgoing(workflow, id);
  if (after.length > 1) return workflow;
  if (direction === 'down') {
    // Moving a step down is moving the step after it up; the entry step has no step before it,
    // so the checks below belong to the step that does.
    const next = after[0];
    if (!next) return workflow;
    return reorder(workflow, next.to, 'up');
  }
  const before = incoming(workflow, id);
  if (before.length !== 1) return workflow;
  const prev = before[0] as WorkflowEdge;
  const prevNode = workflow.nodes.find((node) => node.id === prev.from);
  if (!prevNode || prevNode.type === 'branch') return workflow;
  {
    // A → prev → id → next  becomes  A → id → prev → next
    const intoPrev = incoming(workflow, prev.from);
    if (intoPrev.length > 1) return workflow;
    const next = after[0] ?? null;
    let edges = workflow.edges.filter(
      (edge) => edge !== prev && !intoPrev.includes(edge) && (!next || edge !== next),
    );
    edges = [
      ...edges,
      ...intoPrev.map((edge) => ({ ...edge, to: id })),
      { from: id, to: prev.from, branch: null },
      ...(next ? [{ from: prev.from, to: next.to, branch: null }] : []),
    ];
    return tidy({ ...workflow, edges });
  }
}

/** Steps in walking order from the entry, following the first connection; branches list their paths. */
export interface OrderedStep {
  node: WorkflowNode;
  depth: number;
  /** The branch this step sits on, when it follows an If/Else. */
  branch: string | null;
}

export function orderedSteps(workflow: Workflow): OrderedStep[] {
  const out: OrderedStep[] = [];
  const seen = new Set<string>();
  const walk = (id: string, depth: number, branch: string | null) => {
    if (seen.has(id)) return;
    const node = workflow.nodes.find((row) => row.id === id);
    if (!node) return;
    seen.add(id);
    out.push({ node, depth, branch });
    const edges = outgoing(workflow, id);
    if (node.type === 'branch') {
      for (const name of branchNames(node)) {
        const edge = edges.find(
          (row) => (row.branch ?? 'None').toLowerCase() === name.toLowerCase(),
        );
        if (edge) walk(edge.to, depth + 1, name);
      }
    } else {
      for (const edge of edges) walk(edge.to, depth, branch);
    }
  };
  const entry = entryNode(workflow);
  if (entry) walk(entry.id, 0, null);
  for (const node of workflow.nodes)
    if (!seen.has(node.id)) out.push({ node, depth: 0, branch: null });
  return out;
}

/** Recomputes positions from the walking order so a re-linked chain reads top to bottom. */
export function tidy(workflow: Workflow): Workflow {
  const steps = orderedSteps(workflow);
  const laneOf = new Map<string, number>();
  let lanes = 0;
  const positioned = new Map<string, { x: number; y: number }>();
  steps.forEach((step, index) => {
    const key = step.branch ?? '';
    if (!laneOf.has(key)) laneOf.set(key, key === '' ? 0 : ++lanes);
    positioned.set(step.node.id, { x: (laneOf.get(key) ?? 0) * COLUMN, y: (index + 1) * ROW });
  });
  return {
    ...workflow,
    nodes: workflow.nodes.map((node) => ({
      ...node,
      position: positioned.get(node.id) ?? node.position,
    })),
  };
}

const lastInChain = (workflow: Workflow): WorkflowNode | null => {
  const steps = orderedSteps(workflow);
  const last = steps.at(-1);
  return last ? last.node : null;
};

/** A sensible starting config so a freshly placed step is honest about what it still needs. */
export function defaultConfig(
  featureId: string | null,
  type: WorkflowNode['type'],
): Record<string, unknown> {
  if (type === 'wait') return { wait_type: 'period', days: 1 };
  if (type === 'branch') {
    return {
      branches: [
        { name: 'Yes', groups: [{ conditions: [{ field: 'contact.phone', operator: 'exists' }] }] },
      ],
    };
  }
  switch (featureId) {
    case 'GHL-WF-WEBHOOK':
      return { method: 'POST' };
    case 'GHL-WF-SEND-INTERNAL-NOTIFICATION':
      return { channel: 'in-app' };
    case 'GHL-WF-REMOVE-FROM-WORKFLOW':
      return { workflow: 'this' };
    default:
      return {};
  }
}
