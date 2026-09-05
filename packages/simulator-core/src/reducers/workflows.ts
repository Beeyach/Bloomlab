import { fail } from '../errors.ts';
import { optionalString, requireString, type SimulatorEvent } from '../events.ts';
import { canonical, fnv1a } from '../hash.ts';
import type { AccountState, SimulatorState, WorkflowRun, WorkflowRunContext } from '../state.ts';
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

/**
 * How many enrolments one chain of consequences may contain before the engine calls it a loop
 * (SIM-011, D-141, D-148).
 *
 * HighLevel's builder has no edge back to an earlier step, and Bloomlab's graph validation
 * refuses one for the same reason — so the workflow loop a real account actually suffers is not
 * inside one definition. It is two workflows triggering each other: this one adds a tag that
 * enrols the contact in that one, which adds a tag that enrols them back here, and neither ever
 * changes anything that would stop it.
 *
 * What tells that apart from a learner testing the same workflow ninety times is the causation
 * chain, not the clock and not the origin. A Test Contact run fires a trigger event the learner
 * put in, and the enrolment it generates is one link from that root; the account clock does not
 * move between tests, and every test enrolment is a generated event, so neither of those can
 * separate the two. A loop's tenth enrolment, on the other hand, is ten enrolments deep in a
 * single chain of `caused_by`. So the bound is on the chain.
 *
 * Catching it here rather than at the engine's global cascade limit is what makes it teachable.
 * A `CASCADE_LIMIT` refusal abandons the whole operation and leaves a diagnostic; this refuses
 * one enrolment, records the failure with the count and the workflow on it, and leaves the
 * account — the contact, their tags, the runs that already completed — exactly as it was.
 */
export const MAX_ENROLMENTS_IN_ONE_CHAIN = 10;

/**
 * How many times this contact has already been enrolled inside the chain of consequences that
 * led to this event. Walks `caused_by` back through the log, which is what makes a loop's tenth
 * enrolment distinguishable from a learner's tenth test: the test's chain has one.
 */
function enrolmentsInChain(
  state: SimulatorState,
  event: SimulatorEvent,
  contactId: string,
): number {
  const byId = new Map(state.log.map((entry) => [entry.id, entry]));
  const seen = new Set<string>();
  let cause = event.source?.caused_by;
  let found = 0;
  while (cause && !seen.has(cause)) {
    seen.add(cause);
    const prior = byId.get(cause);
    if (!prior) break;
    if (prior.type === 'WORKFLOW_ENROLLED' && prior.payload.contact_id === contactId) found += 1;
    cause = prior.source?.caused_by;
  }
  return found;
}

export function workflowEnrolled(
  account: AccountState,
  event: SimulatorEvent,
  state: SimulatorState,
): ReducerResult {
  const workflowId = requireString(event.payload, 'workflow_id', event.type);
  const workflow = entity(account.workflows, workflowId, 'workflow', event.type);
  const contactId = requireString(event.payload, 'contact_id', event.type);
  entity(account.contacts, contactId, 'contact', event.type);

  // A loop is stopped before it starts a run, so the cascade ends here rather than at the
  // engine's last-resort limit, and the record says exactly what was going round.
  const inChain = enrolmentsInChain(state, event, contactId);
  if (inChain >= MAX_ENROLMENTS_IN_ONE_CHAIN) {
    return result(account, [
      {
        kind: 'failure',
        at: event.at,
        workflow_id: workflowId,
        contact_id: contactId,
        event_id: event.id,
        data: {
          enrolments_in_this_chain: inChain,
          limit: MAX_ENROLMENTS_IN_ONE_CHAIN,
          trigger_feature: workflow.trigger.ghl_feature_id,
          caused_by: event.source?.caused_by ?? null,
        },
        reason: 'workflow_loop',
      },
    ]);
  }

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
  // Who put the contact here. A trigger reaction names the event it matched; anything else — a
  // Test Contact started at the first step, a scenario, the Academy — is a direct enrolment, and
  // the record says so, so no timeline ever claims the configured GHL trigger fired when it did not.
  const triggerEventId = optionalString(event.payload, 'trigger_event_id');
  const enrolledBy: 'trigger' | 'direct' = triggerEventId ? 'trigger' : 'direct';
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
    context: { ...context, trigger_event_id: triggerEventId },
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
          enrolled_by: enrolledBy,
          trigger_event_id: triggerEventId,
          test: event.payload.test === true,
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
