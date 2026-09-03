import { content } from '../../content/bundle';

type Scenario = (typeof content.scenarios)[number];
type Workflow = Scenario['initial_account_state']['workflows'][number];
type Node = Workflow['nodes'][number];

export interface Step {
  id: string;
  kind: 'trigger' | Node['type'];
  title: string;
  detail: string | null;
}

const featureName = (id: string | undefined): string =>
  content.ghl_features.find((feature) => feature.id === id)?.official_name ?? id ?? 'Step';

function describeConfig(node: Node): string | null {
  const config = (node.config ?? {}) as Record<string, unknown>;
  if (typeof config.template === 'string') return config.template;
  if (typeof config.tag === 'string') return `tag: ${config.tag}`;
  if (typeof config.duration === 'string' || typeof config.duration === 'number')
    return `wait ${String(config.duration)}${typeof config.unit === 'string' ? ` ${config.unit}` : ''}`;
  if (typeof config.condition === 'string') return config.condition;
  return null;
}

/** The workflow's path in execution order: the trigger, then each node following the edges. */
export function workflowSteps(workflow: Workflow): Step[] {
  const filters = workflow.trigger.filters
    .map((filter) => `${filter.field} ${filter.operator} ${filter.value}`)
    .join(', ');
  const steps: Step[] = [
    {
      id: 'trigger',
      kind: 'trigger',
      title: featureName(workflow.trigger.ghl_feature_id),
      detail: filters ? `filter: ${filters}` : null,
    },
  ];
  const targets = new Set(workflow.edges.map((edge) => edge.to));
  let current = workflow.nodes.find((node) => !targets.has(node.id)) ?? workflow.nodes[0];
  const seen = new Set<string>();
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    const node: Node = current;
    steps.push({
      id: node.id,
      kind: node.type,
      title: node.type === 'end' ? 'Exit' : (node.label ?? featureName(node.ghl_feature_id)),
      detail: node.type === 'end' ? null : describeConfig(node),
    });
    const next = workflow.edges.find((edge) => edge.from === node.id)?.to;
    current = next ? workflow.nodes.find((node) => node.id === next) : undefined;
  }
  return steps;
}
