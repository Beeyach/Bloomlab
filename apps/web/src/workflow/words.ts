import type {
  AccountState,
  ExecutionRecord,
  Workflow,
  WorkflowNode,
  WorkflowRun,
} from '@bloomlab/simulator-core';
import type {
  ExecutionEventStatus,
  WorkflowNodeKind,
  WorkflowNodeStatus,
} from '@bloomlab/design-system';

import { simulatorTime } from '../crm/words';
import { featureName } from './palette';

/**
 * Words for the Workflow Lab (D-095 applied to workflows).
 *
 * The engine records structured facts; this module says them. Nothing here decides anything —
 * which branch matched, whether a wait is over — it only reads what the engine wrote.
 */

export { simulatorTime };

export const nodeKind = (node: WorkflowNode): WorkflowNodeKind =>
  node.type === 'branch' ? 'if_else' : node.type === 'goal' ? 'action' : node.type;

/** The node's real feature name, or what the type is called when no feature is chosen yet. */
export const nodeName = (node: WorkflowNode): string =>
  node.type === 'end' ? 'End' : featureName(node.ghl_feature_id);

const text = (value: unknown): string => (typeof value === 'string' ? value : '');
const num = (value: unknown): number => (typeof value === 'number' ? value : Number(value) || 0);

/** One concise line of configuration for the node face (WFL-005). Everything else is the inspector. */
export function configSummary(node: WorkflowNode, account: AccountState): string {
  const c = node.config;
  switch (node.ghl_feature_id) {
    case 'GHL-WF-SEND-SMS':
      return text(c.template) || 'No message yet';
    case 'GHL-WF-SEND-EMAIL':
      return text(c.subject) ? `Subject: ${text(c.subject)}` : 'No subject yet';
    case 'GHL-WF-ADD-CONTACT-TAG':
    case 'GHL-WF-REMOVE-CONTACT-TAG':
      return text(c.tag) || (Array.isArray(c.tag) ? c.tag.join(', ') : '') || 'No tag chosen';
    case 'GHL-WF-UPDATE-CONTACT-FIELD':
      return text(c.field)
        ? `${text(c.field)} = ${text(c.value) || String(c.value ?? '')}`
        : 'No field chosen';
    case 'GHL-WF-ASSIGN-TO-USER': {
      const users = Array.isArray(c.users)
        ? (c.users as string[])
        : text(c.users)
          ? [text(c.users)]
          : [];
      return users.length
        ? users.map((id) => account.users[id]?.name ?? id).join(', ')
        : 'Nobody chosen';
    }
    case 'GHL-WF-CREATE-UPDATE-OPPORTUNITY':
      return text(c.stage)
        ? `${account.pipelines[text(c.pipeline)]?.name ?? text(c.pipeline)} → ${text(c.stage)}`
        : 'No stage chosen';
    case 'GHL-WF-REMOVE-FROM-WORKFLOW': {
      const target = text(c.workflow);
      return target === 'this'
        ? 'This workflow'
        : target === 'all'
          ? 'All workflows'
          : (account.workflows[target]?.name ?? target ?? 'No workflow chosen');
    }
    case 'GHL-WF-SEND-INTERNAL-NOTIFICATION':
      return text(c.recipient)
        ? `${account.users[text(c.recipient)]?.name ?? text(c.recipient)} · ${text(c.channel) || 'in-app'}`
        : 'No recipient yet';
    case 'GHL-WF-WEBHOOK':
      return text(c.url) || 'No URL yet';
    case 'GHL-WF-WAIT':
      return waitSummary(c);
    case 'GHL-WF-IF-ELSE': {
      const branches = Array.isArray(c.branches) ? (c.branches as { name?: string }[]) : [];
      return branches.length
        ? `${branches.map((b) => b.name ?? '?').join(' / ')} / None`
        : 'No branches yet';
    }
    default:
      return node.type === 'end' ? 'Run ends here' : '';
  }
}

export function waitSummary(c: Record<string, unknown>): string {
  switch (text(c.wait_type)) {
    case 'period': {
      const parts = [
        num(c.days) ? `${num(c.days)} d` : '',
        num(c.hours) ? `${num(c.hours)} h` : '',
        num(c.minutes) ? `${num(c.minutes)} min` : '',
      ].filter(Boolean);
      return parts.length ? `Wait ${parts.join(' ')}` : 'Wait: no duration yet';
    }
    case 'date':
      return text(c.at) ? `Until ${text(c.at)}` : 'Until a date: none yet';
    case 'appointment': {
      const relative = text(c.relative) || 'at';
      const offset = [
        num(c.hours) ? `${num(c.hours)} h` : '',
        num(c.minutes) ? `${num(c.minutes)} min` : '',
      ]
        .filter(Boolean)
        .join(' ');
      return relative === 'at'
        ? 'At the appointment time'
        : `${offset || '?'} ${relative} the appointment`;
    }
    case 'reply':
      return `Until the contact replies${text(c.channel) && c.channel !== 'any' ? ` by ${text(c.channel)}` : ''}${
        num(c.timeout_hours) ? `, or ${num(c.timeout_hours)} h` : ''
      }`;
    case 'condition':
      return `Until a condition is met${num(c.timeout_hours) ? `, or ${num(c.timeout_hours)} h` : ''}`;
    default:
      return 'Wait: choose what for';
  }
}

/* ---- status from a run ------------------------------------------------------------------- */

/** What a node is doing for one run, read from the run and its records. */
export function nodeStatus(
  node: WorkflowNode,
  run: WorkflowRun | null,
  records: ExecutionRecord[],
): WorkflowNodeStatus {
  if (!run) return 'idle';
  const mine = records.filter((row) => row.workflow_run_id === run.id && row.node_id === node.id);
  if (run.status === 'waiting' && run.wait?.node_id === node.id) return 'waiting';
  if (run.status === 'failed' && mine.some((row) => row.kind === 'failure')) return 'failed';
  if (
    mine.some((row) => row.kind === 'action_skipped') &&
    !run.completed_node_ids.includes(node.id)
  ) {
    return 'skipped';
  }
  if (run.completed_node_ids.includes(node.id)) return 'done';
  if (mine.some((row) => row.kind === 'action_skipped')) return 'skipped';
  if (run.status === 'active' && run.current_node_id === node.id) return 'running';
  return 'idle';
}

/**
 * What a node shows while the recorded run is being played back (WFL-012): nothing beyond the
 * playhead is revealed yet, the node at the playhead is running until its row has settled, and
 * everything before it shows what the engine recorded. With no playhead, the run's own status.
 * Presentation only — the run and its records are never changed by playback.
 */
export function playbackStatus(
  node: WorkflowNode,
  run: WorkflowRun | null,
  records: ExecutionRecord[],
  playhead: number | null,
  trail: string[],
  settled: boolean,
): WorkflowNodeStatus {
  const final = nodeStatus(node, run, records);
  if (playhead === null || !run) return final;
  const at = trail.indexOf(node.id);
  if (at === -1 || at > playhead) return 'idle';
  if (at < playhead || settled) return final;
  return final === 'idle' ? 'idle' : 'running';
}

export const RUN_STATUS_WORDS: Record<WorkflowRun['status'], string> = {
  active: 'Running',
  waiting: 'Waiting',
  completed: 'Completed',
  exited: 'Exited',
  failed: 'Failed',
};

/* ---- timeline ---------------------------------------------------------------------------- */

export interface TimelineRow {
  id: string;
  time: string;
  name: string;
  detail: string | undefined;
  status: ExecutionEventStatus;
  branch: string | undefined;
  node_id: string | null;
  sequence: number;
}

const REASON_WORDS: Record<string, string> = {
  wait_released: 'Wait ended',
  wait_timed_out: 'Wait timed out',
  wait_target_passed: 'Wait target had already passed',
  time_window: 'Held for the time window',
  duplicate_enrolment: 'Enrolment refused: already in this workflow',
  removed: 'Removed from workflow',
  completed: 'Run completed',
  appointment_cancelled: 'Pulled out: the appointment was cancelled',
  appointment_rescheduled: 'Pulled out: the appointment was rescheduled',
  missing_phone: 'Skipped: no phone number',
  missing_email: 'Skipped: no email address',
  dnd: 'Skipped: do not disturb',
  tag_already_present: 'Skipped: tag already present',
  tag_not_present: 'Skipped: tag not present',
  unsupported_feature: 'Failed: this step is not runnable in the simulator',
  no_appointment: 'Failed: no appointment to measure from',
  invalid_wait: 'Failed: the wait is not set up',
  invalid_branch: 'Failed: the branch is not set up',
  stale_resume: 'A wake arrived for a run that had moved on',
  workflow_created: 'Workflow saved',
  workflow_updated: 'Workflow updated',
  no_entry: 'Failed: no first step',
  ambiguous_entry: 'Failed: more than one first step',
  ambiguous_next: 'Failed: more than one next step',
  unknown_contact: 'Failed: the contact no longer exists',
};

const kindStatus = (record: ExecutionRecord): ExecutionEventStatus => {
  switch (record.kind) {
    case 'action_skipped':
      return 'skipped';
    case 'waiting':
      return 'waiting';
    case 'failure':
      return 'failed';
    case 'step_completed':
    case 'exit':
      return record.reason && record.reason !== 'completed' && record.kind === 'exit'
        ? 'info'
        : 'ok';
    default:
      return 'info';
  }
};

/** One record as a timeline row. Reads the record; never adds a fact it does not hold. */
export function timelineRow(
  record: ExecutionRecord,
  workflow: Workflow | null,
  account: AccountState,
  timezone: string,
): TimelineRow {
  const node = workflow?.nodes.find((row) => row.id === record.node_id) ?? null;
  const stepName = node ? nodeName(node) : null;
  const data = record.data;
  let name: string;
  let detail: string | undefined;
  let branch: string | undefined;
  switch (record.kind) {
    case 'trigger': {
      // Only a trigger reaction may be read as the GHL trigger firing. A direct enrolment (a test
      // contact started at the first step, a scenario, the Academy) says exactly that.
      const feature = featureName(text(data.trigger_feature));
      const viaTrigger =
        data.enrolled_by === 'trigger' || typeof data.trigger_event_id === 'string';
      if (viaTrigger) {
        name = `Enrolled by ${feature}`;
        detail = [
          triggerValuesWords(data.trigger_values),
          data.reentry === true ? 'Re-entry' : null,
        ]
          .filter(Boolean)
          .join(' · ');
        detail = detail || undefined;
      } else {
        name = data.test === true ? 'Started at the first step (test)' : 'Enrolled directly';
        detail = `${feature} was not fired; the trigger and its filters were skipped${
          data.reentry === true ? ' · Re-entry' : ''
        }`;
      }
      break;
    }
    case 'step_started':
      name = `${stepName ?? 'Step'} started`;
      break;
    case 'step_completed':
      name = stepName ? `${stepName} done` : 'Step done';
      detail = describeEffect(record, account);
      break;
    case 'branch_result':
      name = `${stepName ?? 'If/Else'} evaluated`;
      branch = text(data.chosen) || 'None';
      detail = branchDetail(data);
      break;
    case 'waiting':
      name = stepName ?? 'Wait';
      detail = data.wake_at
        ? `Until ${simulatorTime(text(data.wake_at), timezone)}`
        : record.reason === 'wait_target_passed'
          ? REASON_WORDS.wait_target_passed
          : 'Until something happens';
      if (record.reason === 'time_window' && text(data.held_until)) {
        detail = `Held until ${simulatorTime(text(data.held_until), timezone)} (time window)`;
      }
      break;
    case 'action_skipped':
      name = stepName ? `${stepName} skipped` : 'Skipped';
      detail = REASON_WORDS[record.reason ?? ''] ?? record.reason ?? undefined;
      break;
    case 'failure':
      name = stepName ? `${stepName} failed` : 'Run failed';
      detail = REASON_WORDS[record.reason ?? ''] ?? record.reason ?? undefined;
      break;
    case 'exit':
      name = REASON_WORDS[record.reason ?? 'completed'] ?? `Exited: ${record.reason}`;
      break;
    case 'input':
      name = REASON_WORDS[record.reason ?? ''] ?? (stepName ? `${stepName} ran` : 'Input');
      detail = inputDetail(record, timezone);
      break;
    default:
      name = record.kind;
  }
  return {
    id: record.id,
    time: simulatorTime(record.at, timezone),
    name,
    detail,
    status: kindStatus(record),
    branch,
    node_id: record.node_id,
    sequence: record.sequence,
  };
}

/**
 * What the branch actually compared, in words: each condition with the value the run saw and the
 * value it wanted, so a learner reads why a branch was or was not taken (WFL-004, SIM-010).
 */
function branchDetail(data: Record<string, unknown>): string | undefined {
  const branches = Array.isArray(data.branches) ? (data.branches as Record<string, unknown>[]) : [];
  const lines: string[] = [];
  for (const branch of branches) {
    const groups = Array.isArray(branch.groups) ? (branch.groups as Record<string, unknown>[]) : [];
    const parts = groups.map((group) => {
      const conditions = Array.isArray(group.conditions)
        ? (group.conditions as Record<string, unknown>[])
        : [];
      return conditions
        .map((condition) => {
          const actual = condition.actual;
          const shown =
            actual === null || actual === undefined || actual === ''
              ? 'nothing'
              : Array.isArray(actual)
                ? actual.join(', ')
                : String(actual);
          const expected =
            condition.expected === null || condition.expected === undefined
              ? ''
              : ` ${String(condition.expected)}`;
          return `${text(condition.field)} ${operatorWords(text(condition.operator))}${expected} → saw ${shown} (${condition.passed ? 'yes' : 'no'})`;
        })
        .join(' and ');
    });
    lines.push(`${text(branch.name)}: ${parts.join(' or ')}`);
  }
  if (lines.length === 0) return data.fallback === true ? 'No branch matched' : undefined;
  return `${data.fallback === true ? 'No branch matched. ' : ''}${lines.join(' · ')}`;
}

function describeEffect(record: ExecutionRecord, account: AccountState): string | undefined {
  const d = record.data;
  if (text(d.channel) === 'sms' || text(d.channel) === 'email')
    return `${text(d.channel).toUpperCase()} sent`;
  if (text(d.tag)) return `Tag: ${text(d.tag)}`;
  if (text(d.recipient))
    return `Notified ${account.users[text(d.recipient)]?.name ?? text(d.recipient)}`;
  if (text(d.stage)) return `Stage: ${text(d.stage)}`;
  if (text(d.endpoint)) return `Webhook ${String(d.status ?? '')}`.trim();
  return undefined;
}

function inputDetail(record: ExecutionRecord, timezone: string): string | undefined {
  const d = record.data;
  if (record.reason === 'wait_released' || record.reason === 'wait_timed_out') {
    const parts = [
      text(d.cause) === 'event'
        ? 'released by a reply'
        : text(d.cause) === 'condition'
          ? 'condition met'
          : null,
      text(d.appointment_status)
        ? `appointment ${text(d.appointment_status).replace('_', '-')}`
        : null,
    ].filter(Boolean);
    return parts.length ? parts.join(' · ') : undefined;
  }
  if (Array.isArray(d.unresolved) && d.unresolved.length > 0) {
    return `Blank merge fields: ${(d.unresolved as string[]).join(', ')}`;
  }
  if (typeof d.version === 'number') return `Version ${d.version}`;
  if (text(d.held_until)) return `Held until ${simulatorTime(text(d.held_until), timezone)}`;
  return undefined;
}

/** The values a trigger matched on, as "field: value" pairs, so a learner sees why it fired. */
function triggerValuesWords(raw: unknown): string | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const pairs = Object.entries(raw as Record<string, unknown>)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(
      ([key, value]) =>
        `${key.replace(/_/g, ' ')}: ${Array.isArray(value) ? value.join(', ') : String(value)}`,
    );
  return pairs.length ? pairs.join(' · ') : null;
}

/** A comparison operator in plain words, for filters and conditions alike. */
export function operatorWords(operator: string): string {
  switch (operator) {
    case 'is':
      return 'is';
    case 'is_not':
      return 'is not';
    case 'contains':
      return 'contains';
    case 'not_contains':
      return 'does not contain';
    case 'exists':
      return 'has a value';
    case 'not_exists':
      return 'is empty';
    case 'gt':
      return 'is greater than';
    case 'lt':
      return 'is less than';
    default:
      return operator;
  }
}
