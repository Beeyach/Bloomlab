import {
  optionalString,
  requireString,
  type PendingEvent,
  type SimulatorEvent,
} from '../events.ts';
import type { ExecutionDraft } from '../execution.ts';
import type { ScheduledDraft } from '../reducers/shared.ts';
import { entity, put, result, type ReducerResult } from '../reducers/shared.ts';
import type {
  AccountState,
  SimulatorState,
  WaitKind,
  Workflow,
  WorkflowNode,
  WorkflowRun,
  WorkflowWait,
} from '../state.ts';
import { addMinutes, hasOffset, instant, toZone } from '../time.ts';
import { actionCapabilityFor } from './capabilities.ts';
import { chooseBranch, conditionHolds, readBranches, readGroups } from './conditions.ts';
import { outgoing, entryNodes } from './graph.ts';
import { nextWindowOpening, withinWindow } from './timewindow.ts';
import { viewFor, workflowZone, type RunView } from './view.ts';

/**
 * Traversal (WFL-002, WFL-008, WFL-009, WFL-010; D-101).
 *
 * A run moves one node per internal event. `WORKFLOW_ADVANCED { from_node_id }` means "the run
 * has passed that node; find and execute the next one". An action node generates its effect (an
 * `SMS_SENT`, a `TAG_ADDED`, …) and then another `WORKFLOW_ADVANCED` for itself, in that order;
 * because the runner processes generated events breadth-first, the effect is applied before the
 * next node is evaluated, so an If/Else after an Add Tag sees the tag. A wait parks the run and
 * schedules or registers its wake; a branch chooses an edge and records why; an end exits.
 *
 * Nothing here mutates the account directly. Every CRM or message change is an event through the
 * ordinary path, attributed to the workflow and node that caused it, and every step leaves an
 * execution record — which is what the timeline, the grader and the Fix It exercises read.
 */

const ACTIVE: WorkflowRun['status'][] = ['active', 'waiting'];

const nodeById = (workflow: Workflow, id: string | null): WorkflowNode | null =>
  id === null ? null : (workflow.nodes.find((node) => node.id === id) ?? null);

const isFallback = (branch: string | null): boolean =>
  branch === null || branch.trim().toLowerCase() === 'none';

/** The one identity a wake has to present. Deterministic: run, node, and the event that parked it. */
export const waitToken = (runId: string, nodeId: string, sequence: number): string =>
  `${runId}:${nodeId}:${sequence}`;

const advance = (
  run: WorkflowRun,
  fromNodeId: string | null,
  branch: string | null,
  event: SimulatorEvent,
  workflow: Workflow,
): PendingEvent => ({
  type: 'WORKFLOW_ADVANCED',
  at: event.at,
  origin: 'generated',
  source: {
    kind: 'workflow_node',
    id: `${workflow.id}/${fromNodeId ?? 'trigger'}`,
    caused_by: event.id,
  },
  payload: {
    workflow_run_id: run.id,
    from_node_id: fromNodeId,
    ...(branch !== null ? { branch } : {}),
  },
});

const exit = (
  run: WorkflowRun,
  reason: string,
  event: SimulatorEvent,
  workflow: Workflow,
  node: WorkflowNode | null,
): PendingEvent => ({
  type: 'WORKFLOW_EXITED',
  at: event.at,
  origin: 'generated',
  source: { kind: 'workflow_node', id: `${workflow.id}/${node?.id ?? 'end'}`, caused_by: event.id },
  payload: { workflow_run_id: run.id, reason, workflow_id: workflow.id, node_id: node?.id ?? null },
});

/** The fields every record about a node carries, so history stays readable after an edit (D-104). */
const nodeFacts = (workflow: Workflow, node: WorkflowNode) => ({
  node_label: node.label,
  node_type: node.type,
  ghl_feature_id: node.ghl_feature_id,
  definition_version: workflow.version,
});

function record(
  kind: ExecutionDraft['kind'],
  event: SimulatorEvent,
  run: WorkflowRun,
  node: WorkflowNode | null,
  data: Record<string, unknown>,
  reason: string | null = null,
): ExecutionDraft {
  return {
    kind,
    at: event.at,
    workflow_id: run.workflow_id,
    workflow_run_id: run.id,
    node_id: node?.id ?? null,
    contact_id: run.contact_id,
    event_id: event.id,
    data,
    reason,
  };
}

/** Marks a run failed at a node: no half-active run is ever left behind. */
function failRun(
  account: AccountState,
  run: WorkflowRun,
  node: WorkflowNode | null,
  event: SimulatorEvent,
  workflow: Workflow,
  reason: string,
  detail: Record<string, unknown>,
): ReducerResult {
  const failed: WorkflowRun = {
    ...run,
    status: 'failed',
    current_node_id: node?.id ?? run.current_node_id,
    exit_reason: reason,
    exited_at: event.at,
    wait: null,
  };
  return result(
    { ...account, workflow_runs: put(account.workflow_runs, run.id, failed) },
    [
      record(
        'failure',
        event,
        run,
        node,
        { ...detail, ...(node ? nodeFacts(workflow, node) : {}) },
        reason,
      ),
      record('exit', event, run, node, { failed: true }, reason),
    ],
    [],
    run.wait ? { unschedule: [run.wait.token] } : {},
  );
}

/* ---- WORKFLOW_ADVANCED ----------------------------------------------------------------- */

export function workflowAdvanced(
  account: AccountState,
  event: SimulatorEvent,
  state: SimulatorState,
): ReducerResult {
  const runId = requireString(event.payload, 'workflow_run_id', event.type);
  const run = entity(account.workflow_runs, runId, 'workflow run', event.type);
  const workflow = entity(account.workflows, run.workflow_id, 'workflow', event.type);
  const fromNodeId = optionalString(event.payload, 'from_node_id');
  const branch = optionalString(event.payload, 'branch');

  // A run that has ended, or is parked, cannot advance from a stale continuation.
  if (run.status !== 'active') {
    return result(account, [
      record(
        'action_skipped',
        event,
        run,
        nodeById(workflow, fromNodeId),
        { status: run.status },
        'stale_advance',
      ),
    ]);
  }

  const records: ExecutionDraft[] = [];
  const fromNode = nodeById(workflow, fromNodeId);
  let current = run;
  if (fromNode) {
    // The step the run just passed is now complete.
    current = {
      ...current,
      completed_node_ids: current.completed_node_ids.includes(fromNode.id)
        ? current.completed_node_ids
        : [...current.completed_node_ids, fromNode.id],
    };
    // An action's own effect event already recorded what the account did (sent, skipped, failed),
    // so only steps without an effect of their own — waits and branches — get their completion
    // record here. One record per step, never two saying the same thing.
    if (fromNode.type !== 'action') {
      records.push(
        record('step_completed', event, current, fromNode, {
          completed: current.completed_node_ids.length,
          ...(branch !== null ? { branch } : {}),
          ...nodeFacts(workflow, fromNode),
        }),
      );
    }
  }

  // Which node comes next.
  let next: WorkflowNode | null;
  if (fromNode === null) {
    const entries = entryNodes(workflow);
    if (entries.length !== 1) {
      return failRun(
        account,
        current,
        null,
        event,
        workflow,
        entries.length === 0 ? 'no_entry' : 'ambiguous_entry',
        {
          entries: entries.map((node) => node.id),
        },
      );
    }
    next = entries[0] as WorkflowNode;
  } else {
    let edges = outgoing(workflow, fromNode.id);
    if (fromNode.type === 'branch') {
      edges = edges.filter((edge) =>
        branch === null
          ? isFallback(edge.branch)
          : (edge.branch ?? '').toLowerCase() === branch.toLowerCase(),
      );
    }
    if (edges.length > 1) {
      return failRun(account, current, fromNode, event, workflow, 'ambiguous_next', {
        edges: edges.map((edge) => edge.to),
      });
    }
    const edge = edges[0];
    next = edge ? nodeById(workflow, edge.to) : null;
    if (edge && !next) {
      return failRun(account, current, fromNode, event, workflow, 'dangling_edge', { to: edge.to });
    }
    if (!next) {
      // Nothing after the last step: the run completes, as it does in GHL without an End node.
      const completed: WorkflowRun = { ...current, current_node_id: fromNode.id };
      return result(
        { ...account, workflow_runs: put(account.workflow_runs, run.id, completed) },
        records,
        [exit(completed, 'completed', event, workflow, fromNode)],
      );
    }
  }

  current = { ...current, current_node_id: next.id };
  records.push(record('step_started', event, current, next, nodeFacts(workflow, next)));
  const view = viewFor(account, workflow, current, state.clock.timezone, event.at);
  if (!view) {
    return failRun(account, current, next, event, workflow, 'unknown_contact', {
      contact_id: run.contact_id,
    });
  }

  switch (next.type) {
    case 'end': {
      const done: WorkflowRun = {
        ...current,
        completed_node_ids: [...current.completed_node_ids, next.id],
      };
      return result(
        { ...account, workflow_runs: put(account.workflow_runs, run.id, done) },
        [...records, record('step_completed', event, done, next, nodeFacts(workflow, next))],
        [exit(done, 'completed', event, workflow, next)],
      );
    }
    case 'goal':
      return failRun(
        account,
        current,
        next,
        event,
        workflow,
        'unsupported_feature',
        nodeFacts(workflow, next),
      );
    case 'branch':
      return branchNode(account, current, next, event, workflow, view, records);
    case 'wait':
      return waitNode(account, current, next, event, workflow, view, records, state);
    case 'action':
      return actionNode(account, current, next, event, workflow, view, records);
  }
}

/* ---- action ---------------------------------------------------------------------------- */

function actionNode(
  account: AccountState,
  run: WorkflowRun,
  node: WorkflowNode,
  event: SimulatorEvent,
  workflow: Workflow,
  view: RunView,
  records: ExecutionDraft[],
): ReducerResult {
  const capability = actionCapabilityFor(node.ghl_feature_id);
  if (!capability || !capability.execute || capability.nodeType !== 'action') {
    return failRun(
      account,
      run,
      node,
      event,
      workflow,
      'unsupported_feature',
      nodeFacts(workflow, node),
    );
  }

  // Business hours: an outbound message outside the window is held until it opens (D-102).
  const hours = workflow.settings.time_window;
  if (capability.outbound && hours && !withinWindow(event.at, hours, view.zone)) {
    const wakeAt = nextWindowOpening(event.at, hours, view.zone);
    return park(
      account,
      run,
      node,
      event,
      workflow,
      {
        kind: 'period',
        wake_at: wakeAt,
        wake_reason: 'due',
        appointment_id: null,
        reply_channel: null,
        condition: null,
      },
      [...records],
      { time_window: hours, held_until: wakeAt, ...nodeFacts(workflow, node) },
      'time_window',
      /* resumeInto */ 'same_node',
    );
  }

  const outcome = capability.execute({ view, workflow, node, runId: run.id, event });
  if (outcome.failure) {
    return failRun(account, run, node, event, workflow, outcome.failure.reason, {
      ...outcome.failure.detail,
      ...nodeFacts(workflow, node),
    });
  }
  const updated: WorkflowRun = { ...run, current_node_id: node.id };
  const removesSelf = outcome.data.removes_self === true;
  return result(
    { ...account, workflow_runs: put(account.workflow_runs, run.id, updated) },
    [
      ...records,
      record('input', event, updated, node, { ...outcome.data, ...nodeFacts(workflow, node) }),
    ],
    // Effects first, then the continuation — breadth-first processing keeps that order, so the
    // next node sees what this one did. A node that removed its own run does not continue.
    removesSelf
      ? outcome.generated
      : [...outcome.generated, advance(updated, node.id, null, event, workflow)],
  );
}

/* ---- branch ---------------------------------------------------------------------------- */

function branchNode(
  account: AccountState,
  run: WorkflowRun,
  node: WorkflowNode,
  event: SimulatorEvent,
  workflow: Workflow,
  view: RunView,
  records: ExecutionDraft[],
): ReducerResult {
  const { branches, problems } = readBranches(node.config.branches);
  if (problems.length > 0) {
    return failRun(account, run, node, event, workflow, 'invalid_branch', {
      problems,
      ...nodeFacts(workflow, node),
    });
  }
  const choice = chooseBranch(branches, view);
  const updated: WorkflowRun = { ...run, current_node_id: node.id };
  return result(
    { ...account, workflow_runs: put(account.workflow_runs, run.id, updated) },
    [
      ...records,
      record('branch_result', event, updated, node, {
        chosen: choice.chosen ?? 'None',
        fallback: choice.chosen === null,
        branches: choice.branches.map((branch) => ({
          name: branch.name,
          passed: branch.passed,
          groups: branch.groups.map((group) => ({
            passed: group.passed,
            conditions: group.evaluations.map((row) => ({
              field: row.field,
              operator: row.operator,
              expected: row.expected,
              actual: row.actual,
              passed: row.passed,
            })),
          })),
        })),
        ...nodeFacts(workflow, node),
      }),
    ],
    [advance(updated, node.id, choice.chosen, event, workflow)],
  );
}

/* ---- wait ------------------------------------------------------------------------------ */

type WaitPlan = Omit<WorkflowWait, 'node_id' | 'token' | 'started_at'>;

const number = (config: Record<string, unknown>, key: string): number =>
  config[key] === undefined || config[key] === '' || config[key] === null ? 0 : Number(config[key]);

function waitNode(
  account: AccountState,
  run: WorkflowRun,
  node: WorkflowNode,
  event: SimulatorEvent,
  workflow: Workflow,
  view: RunView,
  records: ExecutionDraft[],
  state: SimulatorState,
): ReducerResult {
  const config = node.config;
  const kind = String(config.wait_type ?? '') as WaitKind;
  const zone = view.zone;
  const timeoutHours = number(config, 'timeout_hours');
  const timeoutAt = timeoutHours > 0 ? addMinutes(event.at, timeoutHours * 60, zone) : null;
  const facts = nodeFacts(workflow, node);

  switch (kind) {
    case 'period': {
      const minutes =
        number(config, 'days') * 1440 + number(config, 'hours') * 60 + number(config, 'minutes');
      if (!Number.isFinite(minutes) || minutes <= 0) {
        return failRun(account, run, node, event, workflow, 'invalid_wait', { config, ...facts });
      }
      const wakeAt = addMinutes(event.at, minutes, zone);
      return park(account, run, node, event, workflow, plan('period', wakeAt, 'due'), records, {
        minutes,
        wake_at: wakeAt,
        ...facts,
      });
    }
    case 'date': {
      const at = typeof config.at === 'string' ? config.at : '';
      if (!hasOffset(at)) {
        return failRun(account, run, node, event, workflow, 'invalid_wait', { at, ...facts });
      }
      const wakeAt = toZone(at, zone);
      if (instant(wakeAt) <= instant(event.at)) {
        return proceedLate(account, run, node, event, workflow, records, {
          target: wakeAt,
          ...facts,
        });
      }
      return park(account, run, node, event, workflow, plan('date', wakeAt, 'due'), records, {
        wake_at: wakeAt,
        ...facts,
      });
    }
    case 'appointment': {
      const appointment = view.appointment;
      if (!appointment) {
        return failRun(account, run, node, event, workflow, 'no_appointment', {
          contact_id: run.contact_id,
          ...facts,
        });
      }
      const relative = String(config.relative ?? 'at');
      const offset = number(config, 'hours') * 60 + number(config, 'minutes');
      const signed = relative === 'before' ? -offset : relative === 'after' ? offset : 0;
      const wakeAt = addMinutes(appointment.starts_at, signed, zone);
      const detail = {
        appointment_id: appointment.id,
        appointment_starts_at: appointment.starts_at,
        appointment_status: appointment.status,
        relative,
        offset_minutes: offset,
        target: wakeAt,
        ...facts,
      };
      if (instant(wakeAt) <= instant(event.at)) {
        // Late enrolment: the target has already passed, so the wait is over before it starts
        // and the run proceeds at once. The record says so; nothing is silently skipped (WAIT-003).
        return proceedLate(account, run, node, event, workflow, records, detail);
      }
      return park(
        account,
        run,
        node,
        event,
        workflow,
        { ...plan('appointment', wakeAt, 'due'), appointment_id: appointment.id },
        records,
        detail,
      );
    }
    case 'reply': {
      const channel = (typeof config.channel === 'string' ? config.channel : 'any') as
        'sms' | 'email' | 'any';
      return park(
        account,
        run,
        node,
        event,
        workflow,
        { ...plan('reply', timeoutAt, timeoutAt ? 'timeout' : null), reply_channel: channel },
        records,
        { channel, timeout_at: timeoutAt, ...facts },
      );
    }
    case 'condition': {
      const problems: string[] = [];
      const groups = readGroups(config.groups, 'the condition', problems);
      if (problems.length > 0) {
        return failRun(account, run, node, event, workflow, 'invalid_wait', { problems, ...facts });
      }
      if (conditionHolds(groups, view)) {
        return proceedLate(account, run, node, event, workflow, records, {
          condition_met: 'immediately',
          ...facts,
        });
      }
      return park(
        account,
        run,
        node,
        event,
        workflow,
        { ...plan('condition', timeoutAt, timeoutAt ? 'timeout' : null), condition: groups },
        records,
        { timeout_at: timeoutAt, ...facts },
      );
    }
    default:
      return failRun(account, run, node, event, workflow, 'invalid_wait', {
        wait_type: config.wait_type,
        ...facts,
      });
  }

  function plan(
    waitKind: WaitKind,
    wakeAt: string | null,
    reason: WorkflowWait['wake_reason'],
  ): WaitPlan {
    return {
      kind: waitKind,
      wake_at: wakeAt,
      wake_reason: reason,
      appointment_id: null,
      reply_channel: null,
      condition: null,
    };
  }
  // `state` is unused by design here: the wake is scheduled from the event's instant, not the
  // clock's, and both are the same during processing. Kept in the signature for symmetry.
  void state;
}

/** A wait whose target has already passed: recorded as a wait of zero length, then onward. */
function proceedLate(
  account: AccountState,
  run: WorkflowRun,
  node: WorkflowNode,
  event: SimulatorEvent,
  workflow: Workflow,
  records: ExecutionDraft[],
  detail: Record<string, unknown>,
): ReducerResult {
  const updated: WorkflowRun = { ...run, current_node_id: node.id };
  return result(
    { ...account, workflow_runs: put(account.workflow_runs, run.id, updated) },
    [
      ...records,
      record(
        'waiting',
        event,
        updated,
        node,
        { ...detail, late: true, released_at: event.at },
        'wait_target_passed',
      ),
    ],
    [advance(updated, node.id, null, event, workflow)],
  );
}

/** Parks the run and schedules its wake, when the wait has one. */
function park(
  account: AccountState,
  run: WorkflowRun,
  node: WorkflowNode,
  event: SimulatorEvent,
  workflow: Workflow,
  planned: WaitPlan,
  records: ExecutionDraft[],
  detail: Record<string, unknown>,
  reason: string | null = null,
  resumeInto: 'next_node' | 'same_node' = 'next_node',
): ReducerResult {
  const token = waitToken(run.id, node.id, event.sequence);
  const wait: WorkflowWait = { ...planned, node_id: node.id, token, started_at: event.at };
  const parked: WorkflowRun = { ...run, status: 'waiting', current_node_id: node.id, wait };
  const scheduled: ScheduledDraft[] = wait.wake_at
    ? [
        {
          at: wait.wake_at,
          type: 'WORKFLOW_RESUMED',
          payload: {
            workflow_run_id: run.id,
            resume_token: token,
            cause: wait.wake_reason === 'timeout' ? 'timeout' : 'time',
            resume_into: resumeInto,
          },
          source: { kind: 'workflow_wait', id: `${workflow.id}/${node.id}`, caused_by: event.id },
          description: `${workflow.name}: ${wait.wake_reason === 'timeout' ? 'wait times out' : 'wait ends'} for ${run.contact_id}`,
        },
      ]
    : [];
  return result(
    { ...account, workflow_runs: put(account.workflow_runs, run.id, parked) },
    [
      ...records,
      record(
        'waiting',
        event,
        parked,
        node,
        { ...detail, wait_kind: wait.kind, wake_at: wait.wake_at, token },
        reason,
      ),
    ],
    [],
    { scheduled },
  );
}

/* ---- WORKFLOW_RESUMED ------------------------------------------------------------------ */

export function workflowResumed(
  account: AccountState,
  event: SimulatorEvent,
  state: SimulatorState,
): ReducerResult {
  const runId = requireString(event.payload, 'workflow_run_id', event.type);
  const run = entity(account.workflow_runs, runId, 'workflow run', event.type);
  const workflow = entity(account.workflows, run.workflow_id, 'workflow', event.type);
  const token = requireString(event.payload, 'resume_token', event.type);
  const cause = optionalString(event.payload, 'cause') ?? 'time';

  if (run.status !== 'waiting' || !run.wait || run.wait.token !== token) {
    // The run moved on, exited, or was woken by something else first: this wake is stale.
    return result(account, [
      record(
        'action_skipped',
        event,
        run,
        nodeById(workflow, run.wait?.node_id ?? run.current_node_id),
        { token, status: run.status },
        'stale_resume',
      ),
    ]);
  }

  const node = nodeById(workflow, run.wait.node_id);
  const resumed: WorkflowRun = { ...run, status: 'active', wait: null };
  const view = viewFor(account, workflow, resumed, state.clock.timezone, event.at);
  const detail: Record<string, unknown> = {
    cause,
    wait_kind: run.wait.kind,
    waited_from: run.wait.started_at,
    ...(node ? nodeFacts(workflow, node) : {}),
  };
  if (run.wait.appointment_id) {
    const appointment = account.appointments[run.wait.appointment_id];
    detail.appointment_id = run.wait.appointment_id;
    detail.appointment_status = appointment?.status ?? 'missing';
    detail.appointment_starts_at = appointment?.starts_at ?? null;
  }
  if (cause === 'event') detail.released_by = optionalString(event.payload, 'event_id');

  const records: ExecutionDraft[] = [
    record(
      'input',
      event,
      resumed,
      node,
      detail,
      cause === 'timeout' ? 'wait_timed_out' : 'wait_released',
    ),
  ];
  const next =
    optionalString(event.payload, 'resume_into') === 'same_node' && node
      ? // A message held for the time window runs now, from the node itself.
        reenter(resumed, node, event, workflow)
      : advance(resumed, node?.id ?? null, null, event, workflow);
  void view;
  return result(
    { ...account, workflow_runs: put(account.workflow_runs, run.id, resumed) },
    records,
    [next],
    // A reply or condition wait woken by an event still has its timeout queued; drop it.
    { unschedule: [token] },
  );
}

/** Re-runs the node the run was parked on, rather than the one after it. */
function reenter(
  run: WorkflowRun,
  node: WorkflowNode,
  event: SimulatorEvent,
  workflow: Workflow,
): PendingEvent {
  // The node before this one is what "advanced" leads from; find it through the edges so the
  // next WORKFLOW_ADVANCED executes `node` again. When it is the entry node there is no
  // predecessor, and from_node_id null re-enters at the entry.
  const before = workflow.edges.find((edge) => edge.to === node.id);
  return {
    type: 'WORKFLOW_ADVANCED',
    at: event.at,
    origin: 'generated',
    source: { kind: 'workflow_wait', id: `${workflow.id}/${node.id}`, caused_by: event.id },
    payload: {
      workflow_run_id: run.id,
      from_node_id: before?.from ?? null,
      ...(before?.branch ? { branch: before.branch } : {}),
      reentering: node.id,
    },
  };
}

/** True while a run can still be advanced or woken. */
export const isLive = (run: WorkflowRun): boolean => ACTIVE.includes(run.status);

export { workflowZone };
