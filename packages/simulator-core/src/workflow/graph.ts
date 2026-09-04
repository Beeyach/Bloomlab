import {
  CONDITION_OPERATORS,
  type AccountState,
  type Workflow,
  type WorkflowNode,
} from '../state.ts';
import { actionCapabilityFor, triggerCapabilityFor } from './capabilities.ts';
import { readBranches } from './conditions.ts';
import { readTimeWindow } from './timewindow.ts';

/**
 * Graph validation (WFL-002, WFL-003, D-106).
 *
 * The editor lets a learner leave a workflow half-built. Running a test is where a definition
 * has to be whole, and this is the check: every problem is reported with the node it belongs to
 * and words a learner can act on, nothing is repaired quietly, and a workflow with any issue is
 * refused rather than run around the gaps.
 */

export interface GraphIssue {
  code:
    | 'NO_TRIGGER'
    | 'UNKNOWN_FEATURE'
    | 'UNSUPPORTED_FEATURE'
    | 'UNKNOWN_FILTER'
    | 'INVALID_FILTER'
    | 'NO_NODES'
    | 'DUPLICATE_NODE'
    | 'DANGLING_EDGE'
    | 'NO_ENTRY'
    | 'MULTIPLE_ENTRY'
    | 'AMBIGUOUS_NEXT'
    | 'CYCLE'
    | 'BRANCH_EDGE_MISMATCH'
    | 'BRANCH_NO_FALLBACK'
    | 'INVALID_CONFIG'
    | 'UNREACHABLE_NODE'
    | 'INVALID_SETTINGS';
  node_id: string | null;
  message: string;
}

const issue = (code: GraphIssue['code'], node_id: string | null, message: string): GraphIssue => ({
  code,
  node_id,
  message,
});

/** Edges out of a node. */
export const outgoing = (workflow: Workflow, nodeId: string) =>
  workflow.edges.filter((edge) => edge.from === nodeId);

/** The node a run starts at: the one nothing points to. */
export function entryNodes(workflow: Workflow): WorkflowNode[] {
  const targets = new Set(workflow.edges.map((edge) => edge.to));
  return workflow.nodes.filter((node) => !targets.has(node.id));
}

const isFallback = (branch: string | null): boolean =>
  branch === null || branch.trim().toLowerCase() === 'none';

export function validateWorkflowGraph(workflow: Workflow, account: AccountState): GraphIssue[] {
  const issues: GraphIssue[] = [];
  const nodesById = new Map(workflow.nodes.map((node) => [node.id, node]));

  // Trigger.
  if (!workflow.trigger.ghl_feature_id) {
    issues.push(issue('NO_TRIGGER', null, 'The workflow has no trigger. Choose what starts it.'));
  } else {
    const trigger = triggerCapabilityFor(workflow.trigger.ghl_feature_id);
    if (!trigger) {
      issues.push(
        issue(
          'UNSUPPORTED_FEATURE',
          null,
          `${workflow.trigger.ghl_feature_id} is not a trigger the simulator can fire. It is practised in GHL.`,
        ),
      );
    } else {
      for (const filter of workflow.trigger.filters) {
        const field = trigger.filters.find((row) => row.key === filter.field);
        if (!field) {
          issues.push(
            issue(
              'UNKNOWN_FILTER',
              null,
              `${filter.field} is not a filter this trigger offers. It offers ${trigger.filters.map((row) => row.key).join(', ')}.`,
            ),
          );
          continue;
        }
        if (!(CONDITION_OPERATORS as readonly string[]).includes(filter.operator)) {
          issues.push(issue('INVALID_FILTER', null, `${filter.operator} is not a comparison.`));
        }
        const needsValue = !['exists', 'not_exists'].includes(filter.operator);
        if (needsValue && (filter.value === undefined || filter.value === '')) {
          issues.push(
            issue('INVALID_FILTER', null, `The ${field.label} filter compares against nothing.`),
          );
        }
      }
    }
  }

  // Nodes.
  if (workflow.nodes.length === 0) {
    issues.push(
      issue('NO_NODES', null, 'The workflow has no steps. Add an action after the trigger.'),
    );
    return issues;
  }
  const seen = new Set<string>();
  for (const node of workflow.nodes) {
    if (seen.has(node.id))
      issues.push(issue('DUPLICATE_NODE', node.id, `Two steps share the id ${node.id}.`));
    seen.add(node.id);
  }
  for (const node of workflow.nodes) {
    if (node.type === 'end') continue;
    if (node.type === 'goal') {
      issues.push(
        issue(
          'UNSUPPORTED_FEATURE',
          node.id,
          'Goal Event is taught as a concept and practised in GHL; the simulator does not jump contacts between steps.',
        ),
      );
      continue;
    }
    if (!node.ghl_feature_id) {
      issues.push(
        issue('UNKNOWN_FEATURE', node.id, `${node.label ?? node.id} has no feature chosen.`),
      );
      continue;
    }
    const capability = actionCapabilityFor(node.ghl_feature_id);
    if (!capability) {
      issues.push(
        issue(
          'UNSUPPORTED_FEATURE',
          node.id,
          `${node.ghl_feature_id} is not an action the simulator runs. It is practised in GHL.`,
        ),
      );
      continue;
    }
    if (capability.nodeType !== node.type) {
      issues.push(
        issue(
          'INVALID_CONFIG',
          node.id,
          `${node.ghl_feature_id} is a ${capability.nodeType} step, but this node is a ${node.type}.`,
        ),
      );
    }
    for (const problem of capability.validate(node.config, account)) {
      issues.push(issue('INVALID_CONFIG', node.id, problem));
    }
    if (
      node.type === 'action' &&
      actionCapabilityFor(node.ghl_feature_id)?.feature === 'GHL-WF-ADD-CONTACT-TAG'
    ) {
      // Tags are a vocabulary; naming an unknown one is allowed (GHL creates it) and left alone.
    }
  }

  // Edges.
  for (const edge of workflow.edges) {
    if (!nodesById.has(edge.from))
      issues.push(
        issue('DANGLING_EDGE', null, `A connection starts at ${edge.from}, which is not a step.`),
      );
    if (!nodesById.has(edge.to))
      issues.push(
        issue(
          'DANGLING_EDGE',
          edge.from,
          `A connection from ${edge.from} goes to ${edge.to}, which is not a step.`,
        ),
      );
  }
  const dangling = issues.some((row) => row.code === 'DANGLING_EDGE');

  // Entry.
  const entries = entryNodes(workflow);
  if (entries.length === 0 && !dangling) {
    issues.push(
      issue(
        'NO_ENTRY',
        null,
        'Every step has something before it, so nothing can start. Connections loop.',
      ),
    );
  } else if (entries.length > 1) {
    issues.push(
      issue(
        'MULTIPLE_ENTRY',
        null,
        `Several steps have nothing before them (${entries.map((node) => node.id).join(', ')}). Connect them so one step follows the trigger.`,
      ),
    );
  }

  // Branch structure and fan-out.
  for (const node of workflow.nodes) {
    const out = outgoing(workflow, node.id);
    if (node.type === 'branch') {
      const { branches } = readBranches(node.config.branches);
      const names = branches.map((branch) => branch.name.toLowerCase());
      const labelled = out.filter((edge) => !isFallback(edge.branch));
      for (const edge of labelled) {
        if (!names.includes((edge.branch ?? '').toLowerCase())) {
          issues.push(
            issue(
              'BRANCH_EDGE_MISMATCH',
              node.id,
              `A connection is labelled "${edge.branch}", but no branch has that name.`,
            ),
          );
        }
      }
      for (const name of branches.map((branch) => branch.name)) {
        if (!labelled.some((edge) => (edge.branch ?? '').toLowerCase() === name.toLowerCase())) {
          issues.push(
            issue(
              'BRANCH_EDGE_MISMATCH',
              node.id,
              `Branch "${name}" has no connection out. Every branch needs a next step.`,
            ),
          );
        }
      }
      const fallbacks = out.filter((edge) => isFallback(edge.branch));
      if (fallbacks.length === 0) {
        issues.push(
          issue(
            'BRANCH_NO_FALLBACK',
            node.id,
            'The None branch has no connection. Contacts who match no branch need somewhere to go.',
          ),
        );
      } else if (fallbacks.length > 1) {
        issues.push(
          issue('AMBIGUOUS_NEXT', node.id, 'The None branch has more than one connection.'),
        );
      }
      const counted = new Map<string, number>();
      for (const edge of labelled) {
        const key = (edge.branch ?? '').toLowerCase();
        counted.set(key, (counted.get(key) ?? 0) + 1);
      }
      for (const [name, count] of counted) {
        if (count > 1)
          issues.push(
            issue('AMBIGUOUS_NEXT', node.id, `Branch "${name}" has more than one connection.`),
          );
      }
    } else if (out.length > 1) {
      issues.push(
        issue(
          'AMBIGUOUS_NEXT',
          node.id,
          `${node.label ?? node.id} connects to ${out.length} steps. Only an If/Else may fan out.`,
        ),
      );
    } else if (out.length === 1 && out[0]?.branch && !isFallback(out[0].branch)) {
      issues.push(
        issue(
          'BRANCH_EDGE_MISMATCH',
          node.id,
          `${node.label ?? node.id} is not an If/Else, so its connection cannot be labelled "${out[0].branch}".`,
        ),
      );
    }
    if (node.type === 'end' && out.length > 0) {
      issues.push(issue('AMBIGUOUS_NEXT', node.id, 'An End step cannot connect onwards.'));
    }
  }

  // Cycles and reachability, from the entry.
  if (!dangling && entries.length === 1) {
    const start = entries[0] as WorkflowNode;
    const visited = new Set<string>();
    const stack = new Set<string>();
    let cycle = false;
    const walk = (id: string) => {
      if (stack.has(id)) {
        cycle = true;
        return;
      }
      if (visited.has(id)) return;
      visited.add(id);
      stack.add(id);
      for (const edge of outgoing(workflow, id)) walk(edge.to);
      stack.delete(id);
    };
    walk(start.id);
    if (cycle)
      issues.push(
        issue(
          'CYCLE',
          null,
          'The connections loop back on themselves. A workflow runs forward only.',
        ),
      );
    for (const node of workflow.nodes) {
      if (!visited.has(node.id)) {
        issues.push(
          issue(
            'UNREACHABLE_NODE',
            node.id,
            `${node.label ?? node.id} is not connected to the path from the trigger.`,
          ),
        );
      }
    }
  }

  // Settings.
  if (workflow.settings.timezone !== null) {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: workflow.settings.timezone });
    } catch {
      issues.push(
        issue('INVALID_SETTINGS', null, `${workflow.settings.timezone} is not a timezone.`),
      );
    }
  }
  const hours = readTimeWindow(workflow.settings.time_window);
  for (const problem of hours.problems) issues.push(issue('INVALID_SETTINGS', null, problem));

  return issues;
}

/** True when the graph has nothing that would stop a test run. */
export const isRunnable = (workflow: Workflow, account: AccountState): boolean =>
  validateWorkflowGraph(workflow, account).length === 0;
