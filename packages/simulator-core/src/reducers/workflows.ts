import { fail } from '../errors.ts';
import { optionalString, requireString, type SimulatorEvent } from '../events.ts';
import { canonical, fnv1a } from '../hash.ts';
import type { AccountState, WorkflowRun, WorkflowRunContext } from '../state.ts';
import { behaviouralWorkflow } from '../workflow.ts';
import { entity, put, result, type ReducerResult } from './shared.ts';

/**
 * Workflow-run history (SIM-016, WFL-011).
 *
 * Phase 10 owns the *entities and events*: a contact is enrolled, a node is recorded as
 * completed, a run exits with a reason. It does not own execution — nothing here walks a contact
 * from node to node, evaluates a branch or serves a wait. That is the Workflow Lab in Phase 12,
 * and pretending otherwise would put fake execution in the log that later has to be unwound.
 *
 * What Phase 10 does enforce is re-entry, because it is a property of the workflow definition and
 * needs no execution to decide: a workflow with `allow_reentry: false` refuses a second active
 * enrolment of the same contact, and says so as an exit record rather than a silent drop.
 */

const runId = (workflowId: string, contactId: string, sequence: number) =>
  `wr-${workflowId}-${contactId}-${sequence}`;

const ACTIVE: WorkflowRun['status'][] = ['active', 'waiting'];

export function workflowEnrolled(account: AccountState, event: SimulatorEvent): ReducerResult {
  const workflowId = requireString(event.payload, 'workflow_id', event.type);
  const workflow = entity(account.workflows, workflowId, 'workflow', event.type);
  const contactId = requireString(event.payload, 'contact_id', event.type);
  entity(account.contacts, contactId, 'contact', event.type);

  const active = Object.values(account.workflow_runs).find(
    (run) =>
      run.workflow_id === workflowId && run.contact_id === contactId && ACTIVE.includes(run.status),
  );
  if (active && !workflow.settings.allow_reentry) {
    return result(account, [
      {
        kind: 'exit',
        at: event.at,
        workflow_id: workflowId,
        workflow_run_id: active.id,
        contact_id: contactId,
        event_id: event.id,
        data: { allow_reentry: false, existing_run_id: active.id },
        reason: 'duplicate_enrolment',
      },
    ]);
  }

  const id = runId(workflowId, contactId, event.sequence);
  const context = readContext(event.payload.context);
  const run: WorkflowRun = {
    id,
    workflow_id: workflowId,
    contact_id: contactId,
    status: 'active',
    current_node_id: null,
    completed_node_ids: [],
    enrolled_at: event.at,
    exit_reason: null,
    exited_at: null,
    wait: null,
    context: { ...context, trigger_event_id: optionalString(event.payload, 'trigger_event_id') },
    definition_version: workflow.version,
    definition_hash: fnv1a(canonical(behaviouralWorkflow(workflow))),
  };
  return result(
    { ...account, workflow_runs: put(account.workflow_runs, id, run) },
    [
      {
        kind: 'trigger',
        at: event.at,
        workflow_id: workflowId,
        workflow_run_id: id,
        contact_id: contactId,
        event_id: event.id,
        data: {
          trigger_feature: workflow.trigger.ghl_feature_id,
          filters: workflow.trigger.filters,
          trigger_values: event.payload.trigger_values ?? null,
          reentry: Boolean(active),
          definition_version: workflow.version,
        },
      },
    ],
    // Enrolment starts the walk: the first WORKFLOW_ADVANCED finds the entry node (D-101).
    [
      {
        type: 'WORKFLOW_ADVANCED',
        at: event.at,
        origin: 'generated',
        source: { kind: 'workflow_trigger', id: workflowId, caused_by: event.id },
        payload: { workflow_run_id: id, from_node_id: null },
      },
    ],
  );
}

/** What enrolled the contact, from the trigger's match; anything missing is simply null. */
function readContext(raw: unknown): Omit<WorkflowRunContext, 'trigger_event_id'> {
  const source = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const id = (key: string) => (typeof source[key] === 'string' ? (source[key] as string) : null);
  return {
    appointment_id: id('appointment_id'),
    opportunity_id: id('opportunity_id'),
    form_id: id('form_id'),
    message_id: id('message_id'),
  };
}

export function workflowStepCompleted(account: AccountState, event: SimulatorEvent): ReducerResult {
  const id = requireString(event.payload, 'workflow_run_id', event.type);
  const run = entity(account.workflow_runs, id, 'workflow run', event.type);
  const nodeId = requireString(event.payload, 'node_id', event.type);
  const workflow = entity(account.workflows, run.workflow_id, 'workflow', event.type);
  if (!workflow.nodes.some((node) => node.id === nodeId)) {
    fail('UNKNOWN_ENTITY', `Workflow ${workflow.id} has no node ${nodeId}`, {
      workflow_id: workflow.id,
      node_id: nodeId,
    });
  }
  if (!ACTIVE.includes(run.status)) {
    fail('INVALID_PAYLOAD', `Workflow run ${id} is ${run.status} and cannot complete a step`, {
      workflow_run_id: id,
      status: run.status,
    });
  }
  const updated: WorkflowRun = {
    ...run,
    status: 'active',
    current_node_id: nodeId,
    completed_node_ids: run.completed_node_ids.includes(nodeId)
      ? run.completed_node_ids
      : [...run.completed_node_ids, nodeId],
  };
  return result({ ...account, workflow_runs: put(account.workflow_runs, id, updated) }, [
    {
      kind: 'step_completed',
      at: event.at,
      workflow_id: run.workflow_id,
      workflow_run_id: id,
      node_id: nodeId,
      contact_id: run.contact_id,
      event_id: event.id,
      data: { completed: updated.completed_node_ids.length },
    },
  ]);
}

export function workflowExited(account: AccountState, event: SimulatorEvent): ReducerResult {
  const id = requireString(event.payload, 'workflow_run_id', event.type);
  const run = entity(account.workflow_runs, id, 'workflow run', event.type);
  if (!ACTIVE.includes(run.status)) {
    fail('INVALID_PAYLOAD', `Workflow run ${id} has already ended as ${run.status}`, {
      workflow_run_id: id,
      status: run.status,
    });
  }
  const reason = optionalString(event.payload, 'reason') ?? 'completed';
  const updated: WorkflowRun = {
    ...run,
    status: reason === 'completed' ? 'completed' : 'exited',
    exit_reason: reason,
    exited_at: event.at,
    wait: null,
  };
  return result(
    { ...account, workflow_runs: put(account.workflow_runs, id, updated) },
    [
      {
        kind: 'exit',
        at: event.at,
        workflow_id: run.workflow_id,
        workflow_run_id: id,
        node_id: run.current_node_id,
        contact_id: run.contact_id,
        event_id: event.id,
        data: {
          completed: run.completed_node_ids.length,
          removed_by: optionalString(event.payload, 'workflow_id') ?? null,
          was_waiting: run.status === 'waiting',
        },
        reason,
      },
    ],
    [],
    // A run that leaves while waiting no longer needs its wake.
    run.wait ? { unschedule: [run.wait.token] } : {},
  );
}
