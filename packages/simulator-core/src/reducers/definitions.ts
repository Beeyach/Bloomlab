import { fail } from '../errors.ts';
import { requireString, type SimulatorEvent } from '../events.ts';
import {
  CONDITION_OPERATORS,
  type AccountState,
  type Workflow,
  type WorkflowEdge,
  type WorkflowNode,
  type WorkflowTriggerFilter,
} from '../state.ts';
import { isValidTimeZone } from '../time.ts';
import { readTimeWindow } from '../workflow/timewindow.ts';
import { entity, put, result, type ReducerResult } from './shared.ts';

/**
 * Workflow definitions as account events (WFL-002, D-107).
 *
 * A learner's edits become part of the shared account the same way a tag does: through an event
 * the engine validates, applies, logs and can replay. `WORKFLOW_CREATED` adds a definition;
 * `WORKFLOW_UPDATED` replaces one and bumps its version, so a run that enrolled against version 3
 * still says so after the workflow is on version 7 (D-104). Both check *shape* — ids, node types,
 * edges that name real steps — and leave runnability to graph validation at test time, because
 * an editor has to be allowed to save half-built work.
 */

const NODE_TYPES = ['action', 'wait', 'branch', 'goal', 'end'] as const;
const ID = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Turns the payload's `workflow` into a definition, refusing anything malformed. */
export function readDefinition(raw: unknown, eventType: string, version: number): Workflow {
  if (!isRecord(raw)) fail('INVALID_PAYLOAD', `${eventType} needs a workflow object`, { raw });
  const candidate = raw as Record<string, unknown>;
  const id = typeof candidate.id === 'string' && ID.test(candidate.id) ? candidate.id : null;
  if (!id) fail('INVALID_PAYLOAD', `${eventType} needs a workflow id`, { id: candidate.id });
  const name =
    typeof candidate.name === 'string' && candidate.name.trim() ? candidate.name.trim() : null;
  if (!name) fail('INVALID_PAYLOAD', `Workflow ${id} needs a name`, { id });

  const trigger = isRecord(candidate.trigger) ? candidate.trigger : {};
  const featureId = typeof trigger.ghl_feature_id === 'string' ? trigger.ghl_feature_id : '';
  const filters: WorkflowTriggerFilter[] = Array.isArray(trigger.filters)
    ? trigger.filters.map((filter, index) => {
        if (
          !isRecord(filter) ||
          typeof filter.field !== 'string' ||
          typeof filter.operator !== 'string'
        ) {
          fail(
            'INVALID_PAYLOAD',
            `Workflow ${id} filter ${index + 1} needs a field and an operator`,
            { filter },
          );
        }
        const shaped = filter as Record<string, unknown>;
        if (!(CONDITION_OPERATORS as readonly string[]).includes(shaped.operator as string)) {
          fail('INVALID_PAYLOAD', `Workflow ${id} filter ${index + 1} has an unknown operator`, {
            filter,
          });
        }
        const out: WorkflowTriggerFilter = {
          field: shaped.field as string,
          operator: shaped.operator as WorkflowTriggerFilter['operator'],
        };
        if (shaped.value !== undefined && shaped.value !== null) {
          if (!['string', 'number', 'boolean'].includes(typeof shaped.value)) {
            fail(
              'INVALID_PAYLOAD',
              `Workflow ${id} filter ${index + 1} has a value that is not text, a number or a flag`,
              { filter },
            );
          }
          out.value = shaped.value as string | number | boolean;
        }
        return out;
      })
    : [];

  if (!Array.isArray(candidate.nodes))
    fail('INVALID_PAYLOAD', `Workflow ${id} needs a list of nodes`, { id });
  const nodes: WorkflowNode[] = (candidate.nodes as unknown[]).map((node, index) => {
    if (!isRecord(node) || typeof node.id !== 'string' || !ID.test(node.id)) {
      fail('INVALID_PAYLOAD', `Workflow ${id} node ${index + 1} needs an id`, { node });
    }
    const shaped = node as Record<string, unknown>;
    if (!(NODE_TYPES as readonly string[]).includes(shaped.type as string)) {
      fail(
        'INVALID_PAYLOAD',
        `Workflow ${id} node ${shaped.id} has an unknown type ${String(shaped.type)}`,
        { node },
      );
    }
    const position = isRecord(shaped.position) ? shaped.position : {};
    const x = typeof position.x === 'number' && Number.isFinite(position.x) ? position.x : 0;
    const y = typeof position.y === 'number' && Number.isFinite(position.y) ? position.y : 0;
    return {
      id: shaped.id as string,
      type: shaped.type as WorkflowNode['type'],
      ghl_feature_id:
        typeof shaped.ghl_feature_id === 'string' && shaped.ghl_feature_id
          ? shaped.ghl_feature_id
          : null,
      label: typeof shaped.label === 'string' && shaped.label.trim() ? shaped.label.trim() : null,
      config: isRecord(shaped.config) ? structuredCloneSafe(shaped.config) : {},
      position: { x, y },
    };
  });
  const ids = new Set<string>();
  for (const node of nodes) {
    if (ids.has(node.id))
      fail('DUPLICATE_ENTITY', `Workflow ${id} has two nodes called ${node.id}`, {
        node_id: node.id,
      });
    ids.add(node.id);
  }

  const edges: WorkflowEdge[] = Array.isArray(candidate.edges)
    ? (candidate.edges as unknown[]).map((edge, index) => {
        if (!isRecord(edge) || typeof edge.from !== 'string' || typeof edge.to !== 'string') {
          fail('INVALID_PAYLOAD', `Workflow ${id} connection ${index + 1} needs from and to`, {
            edge,
          });
        }
        const shaped = edge as Record<string, unknown>;
        if (!ids.has(shaped.from as string) || !ids.has(shaped.to as string)) {
          fail(
            'UNKNOWN_ENTITY',
            `Workflow ${id} connection ${index + 1} names a node that does not exist`,
            { edge },
          );
        }
        return {
          from: shaped.from as string,
          to: shaped.to as string,
          branch: typeof shaped.branch === 'string' && shaped.branch ? shaped.branch : null,
        };
      })
    : [];

  const settings = isRecord(candidate.settings) ? candidate.settings : {};
  const timezone =
    typeof settings.timezone === 'string' && settings.timezone ? settings.timezone : null;
  if (timezone && !isValidTimeZone(timezone)) {
    fail('INVALID_TIMEZONE', `Workflow ${id} names a timezone the runtime does not know`, {
      timezone,
    });
  }
  const hours = readTimeWindow(settings.time_window);
  if (hours.problems.length > 0) {
    fail('INVALID_PAYLOAD', `Workflow ${id}: ${hours.problems.join('; ')}`, {
      time_window: settings.time_window,
    });
  }

  return {
    id,
    name,
    trigger: { ghl_feature_id: featureId, filters },
    nodes,
    edges,
    settings: {
      allow_reentry: settings.allow_reentry === true,
      timezone,
      notes: typeof settings.notes === 'string' && settings.notes ? settings.notes : null,
      time_window: hours.timeWindow,
    },
    version,
  };
}

/** A deep copy of plain config data, refusing anything that is not data. */
function structuredCloneSafe(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

export function workflowCreated(account: AccountState, event: SimulatorEvent): ReducerResult {
  const definition = readDefinition(event.payload.workflow, event.type, 1);
  if (account.workflows[definition.id]) {
    fail('DUPLICATE_ENTITY', `A workflow ${definition.id} already exists`, {
      workflow_id: definition.id,
    });
  }
  return result({ ...account, workflows: put(account.workflows, definition.id, definition) }, [
    {
      kind: 'input',
      at: event.at,
      workflow_id: definition.id,
      event_id: event.id,
      data: { name: definition.name, version: 1, nodes: definition.nodes.length },
      reason: 'workflow_created',
    },
  ]);
}

export function workflowUpdated(account: AccountState, event: SimulatorEvent): ReducerResult {
  const id = requireString(event.payload, 'workflow_id', event.type);
  const existing = entity(account.workflows, id, 'workflow', event.type);
  const definition = readDefinition(event.payload.workflow, event.type, existing.version + 1);
  if (definition.id !== id) {
    fail('INVALID_PAYLOAD', `${event.type} updates ${id} but the definition is ${definition.id}`, {
      workflow_id: id,
      definition_id: definition.id,
    });
  }
  return result({ ...account, workflows: put(account.workflows, id, definition) }, [
    {
      kind: 'input',
      at: event.at,
      workflow_id: id,
      event_id: event.id,
      data: { name: definition.name, version: definition.version, nodes: definition.nodes.length },
      reason: 'workflow_updated',
    },
  ]);
}
