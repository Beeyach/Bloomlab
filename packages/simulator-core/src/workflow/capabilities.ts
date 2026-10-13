import type { PendingEvent, SimulatorEvent, SimulatorEventType } from '../events.ts';
import type { AccountState, Workflow, WorkflowNode, WorkflowRunContext } from '../state.ts';
import { hasOffset } from '../time.ts';
import { appointmentIdOf } from '../reducers/appointments.ts';
import { readBranches } from './conditions.ts';
import { answerFor, readHeaders } from './endpoints.ts';
import { hasMergeFields, renderTemplate } from './merge.ts';
import type { RunView } from './view.ts';

/**
 * Workflow capability adapters (WFL-003, WFL-011, D-105).
 *
 * The registry (`content/ghl-features/`) says WHAT a feature is: its official name, its status,
 * its fidelity, its approximation note, the fields its configuration offers. This module says HOW
 * Bloomlab simulates it — which simulator event a trigger listens for and what it can filter on,
 * how an action's configuration is checked and what events it generates. A feature is runnable
 * only when both halves exist. No display label lives here, and no behaviour lives in the YAML.
 *
 * Nothing in this file is a hardcoded palette: the Lab renders whatever registry records exist
 * and asks `capabilityFor(id)` whether each one runs. A registry record with no adapter is shown
 * as practised in GHL rather than made to look runnable.
 */

/* ---- triggers ------------------------------------------------------------------------ */

export interface TriggerMatch {
  contact_id: string;
  context: Partial<WorkflowRunContext>;
  /** The filterable values this event exposes, by filter field key. */
  values: Record<string, string | number | boolean | string[] | null>;
}

export interface TriggerFilterField {
  key: string;
  /** The registry's own wording for the filter, for the inspector. */
  label: string;
  kind: 'text' | 'list' | 'number';
  /** Where a picker should draw options from, when the value is a reference. */
  reference?: 'forms' | 'surveys' | 'calendars' | 'tags' | 'pipelines' | 'stages' | 'statuses';
}

export interface TriggerCapability {
  kind: 'trigger';
  feature: string;
  /** The simulator events that can fire this trigger. */
  events: readonly SimulatorEventType[];
  filters: readonly TriggerFilterField[];
  /** A match with its values, or `null` when this event does not fire the trigger. */
  match(event: SimulatorEvent, account: AccountState): TriggerMatch | null;
}

const contactTags = (account: AccountState, contactId: string): string[] =>
  account.contacts[contactId]?.tags ?? [];

const str = (value: unknown): string | null => (typeof value === 'string' ? value : null);

const TRIGGER_CAPABILITIES: TriggerCapability[] = [
  {
    kind: 'trigger',
    feature: 'GHL-WF-PAYMENT-RECEIVED',
    events: ['PAYMENT_RECEIVED', 'PAYMENT_FAILED'],
    filters: [
      { key: 'payment_status', label: 'Payment Status (success / failed)', kind: 'text' },
      { key: 'product', label: 'Global Product identifier', kind: 'text' },
      { key: 'source', label: 'Source', kind: 'text' },
      { key: 'amount', label: 'Amount', kind: 'number' },
    ],
    match: (event, account) => {
      const payment = account.payments[String(event.payload.payment_id)];
      return payment
        ? {
            contact_id: payment.contact_id,
            context: {},
            values: {
              payment_status: event.type === 'PAYMENT_FAILED' ? 'failed' : 'success',
              product: payment.product_id,
              amount: payment.amount,
              source: str(event.payload.payment_source) ?? 'manual',
            },
          }
        : null;
    },
  },
  {
    kind: 'trigger',
    feature: 'GHL-WF-REFUND',
    events: ['REFUND_ISSUED'],
    filters: [
      { key: 'product', label: 'Product identifier', kind: 'text' },
      { key: 'amount', label: 'Refund amount', kind: 'number' },
    ],
    match: (event, account) => {
      const payment = account.payments[String(event.payload.payment_id)];
      return payment
        ? {
            contact_id: payment.contact_id,
            context: {},
            values: { product: payment.product_id, amount: payment.amount },
          }
        : null;
    },
  },
  {
    kind: 'trigger',
    feature: 'GHL-WF-FORM-SUBMITTED',
    events: ['FORM_SUBMITTED'],
    filters: [{ key: 'form', label: 'Form is', kind: 'text', reference: 'forms' }],
    match: (event) => {
      const contactId = str(event.payload.contact_id);
      const formId = str(event.payload.form_id);
      if (!contactId || !formId) return null;
      return { contact_id: contactId, context: { form_id: formId }, values: { form: formId } };
    },
  },
  {
    kind: 'trigger',
    feature: 'GHL-WF-SURVEY-SUBMITTED',
    events: ['SURVEY_SUBMITTED'],
    filters: [{ key: 'survey', label: 'Survey is', kind: 'text', reference: 'surveys' }],
    match: (event) => {
      const contactId = str(event.payload.contact_id);
      const surveyId = str(event.payload.survey_id);
      if (!contactId || !surveyId) return null;
      return { contact_id: contactId, context: {}, values: { survey: surveyId } };
    },
  },
  {
    kind: 'trigger',
    feature: 'GHL-WF-CUSTOMER-BOOKED-APPOINTMENT',
    // A reschedule is treated as a new booking (registry: GHL-WF-APPOINTMENT-STATUS).
    events: ['APPOINTMENT_BOOKED', 'APPOINTMENT_RESCHEDULED'],
    filters: [
      { key: 'calendar', label: 'In Calendar', kind: 'text', reference: 'calendars' },
      { key: 'tag', label: 'Has tag', kind: 'list', reference: 'tags' },
    ],
    // Fires for bookings the customer makes; a staff booking uses Appointment Status instead,
    // which is the split the registry records. How the booking was made is remembered on the
    // appointment, so a reschedule of a staff booking is still a staff booking (CAL-003).
    match: (event, account) => {
      // The id the event produced, which for a booking that named none is the one the reducer
      // minted from it — otherwise an injected booking would fire nothing at all (D-145).
      const appointmentId = appointmentIdOf(event);
      if (!appointmentId) return null;
      // A reschedule names only the appointment; the contact and calendar come from the record.
      const appointment = account.appointments[appointmentId];
      const madeBy = str(event.payload.booked_by) ?? appointment?.booked_by ?? 'customer';
      if (madeBy === 'staff') return null;
      const contactId = str(event.payload.contact_id) ?? appointment?.contact_id ?? null;
      if (!contactId) return null;
      return {
        contact_id: contactId,
        context: { appointment_id: appointmentId },
        values: {
          calendar: str(event.payload.calendar_id) ?? appointment?.calendar_id ?? null,
          tag: contactTags(account, contactId),
        },
      };
    },
  },
  {
    kind: 'trigger',
    feature: 'GHL-WF-APPOINTMENT-STATUS',
    // Cancellation is one of this trigger's own statuses, so the event that cancels has to reach
    // it. Before Phase 14 it did not, and a workflow filtered to Cancelled could never run —
    // the whole no-show recovery skill was unreachable through the shared engine (CAL-003, D-131).
    events: [
      'APPOINTMENT_BOOKED',
      'APPOINTMENT_RESCHEDULED',
      'APPOINTMENT_CANCELLED',
      'APPOINTMENT_STATUS_CHANGED',
    ],
    filters: [
      {
        key: 'appointment_status',
        label: 'Appointment Status',
        kind: 'text',
        reference: 'statuses',
      },
      { key: 'calendar', label: 'In Calendar', kind: 'text', reference: 'calendars' },
      { key: 'tag', label: 'Tag', kind: 'list', reference: 'tags' },
    ],
    match: (event, account) => {
      const appointmentId = appointmentIdOf(event);
      if (!appointmentId) return null;
      const appointment = account.appointments[appointmentId];
      if (!appointment) return null;
      // A new booking is the status "New"; a cancellation is "Cancelled"; a change carries its
      // own status. A reschedule arrives as a new appointment, which is what the official
      // Appointment Status article says and what the registry records.
      const status =
        event.type === 'APPOINTMENT_STATUS_CHANGED'
          ? (str(event.payload.status) ?? appointment.status)
          : event.type === 'APPOINTMENT_CANCELLED'
            ? 'cancelled'
            : 'new';
      return {
        contact_id: appointment.contact_id,
        context: { appointment_id: appointmentId },
        values: {
          appointment_status: status,
          calendar: appointment.calendar_id,
          tag: contactTags(account, appointment.contact_id),
        },
      };
    },
  },
  {
    kind: 'trigger',
    feature: 'GHL-WF-CONTACT-CREATED',
    events: ['CONTACT_CREATED'],
    filters: [{ key: 'tag', label: 'Has tag', kind: 'list', reference: 'tags' }],
    match: (event, account) => {
      const contactId = str(event.payload.contact_id);
      if (!contactId) return null;
      return {
        contact_id: contactId,
        context: {},
        values: { tag: contactTags(account, contactId) },
      };
    },
  },
  {
    kind: 'trigger',
    feature: 'GHL-WF-CONTACT-TAG',
    events: ['TAG_ADDED', 'TAG_REMOVED'],
    filters: [
      { key: 'change', label: 'Tag Added / Tag Removed', kind: 'text' },
      { key: 'tag', label: 'Tag', kind: 'text', reference: 'tags' },
    ],
    match: (event) => {
      const contactId = str(event.payload.contact_id);
      const tag = str(event.payload.tag);
      if (!contactId || !tag) return null;
      return {
        contact_id: contactId,
        context: {},
        values: { change: event.type === 'TAG_ADDED' ? 'added' : 'removed', tag },
      };
    },
  },
  {
    kind: 'trigger',
    feature: 'GHL-WF-CUSTOMER-REPLIED',
    events: ['SMS_RECEIVED', 'EMAIL_RECEIVED'],
    filters: [
      { key: 'channel', label: 'Reply channel', kind: 'text' },
      { key: 'body', label: 'Contains phrase', kind: 'text' },
    ],
    match: (event) => {
      const contactId = str(event.payload.contact_id);
      if (!contactId) return null;
      return {
        contact_id: contactId,
        context: { message_id: `msg-${event.id}` },
        values: {
          channel: event.type === 'SMS_RECEIVED' ? 'sms' : 'email',
          body: str(event.payload.body) ?? '',
        },
      };
    },
  },
  {
    kind: 'trigger',
    feature: 'GHL-WF-PIPELINE-STAGE-CHANGED',
    events: ['PIPELINE_STAGE_CHANGED'],
    filters: [
      { key: 'pipeline', label: 'Pipeline', kind: 'text', reference: 'pipelines' },
      { key: 'stage', label: 'Moved to stage', kind: 'text', reference: 'stages' },
    ],
    match: (event, account) => {
      const opportunityId = str(event.payload.opportunity_id);
      const opportunity = opportunityId ? account.opportunities[opportunityId] : null;
      if (!opportunityId || !opportunity) return null;
      return {
        contact_id: opportunity.contact_id,
        context: { opportunity_id: opportunityId },
        values: { pipeline: opportunity.pipeline_id, stage: opportunity.stage },
      };
    },
  },
  {
    kind: 'trigger',
    feature: 'GHL-WF-OPPORTUNITY-STATUS-CHANGED',
    events: ['OPPORTUNITY_UPDATED'],
    filters: [
      { key: 'pipeline', label: 'Pipeline', kind: 'text', reference: 'pipelines' },
      { key: 'status', label: 'Status', kind: 'text' },
    ],
    match: (event, account) => {
      // Only an update that names a status is a status change.
      const status = str(event.payload.status);
      const opportunityId = str(event.payload.opportunity_id);
      const opportunity = opportunityId ? account.opportunities[opportunityId] : null;
      if (!status || !opportunityId || !opportunity) return null;
      return {
        contact_id: opportunity.contact_id,
        context: { opportunity_id: opportunityId },
        values: { pipeline: opportunity.pipeline_id, status },
      };
    },
  },
];

/* ---- actions ------------------------------------------------------------------------- */

export interface ActionContext {
  view: RunView;
  workflow: Workflow;
  node: WorkflowNode;
  runId: string;
  /** The event being reacted to (the WORKFLOW_ADVANCED that reached this node). */
  event: SimulatorEvent;
}

export interface ActionOutcome {
  /** Effects, as events that travel the ordinary processing path. */
  generated: PendingEvent[];
  /** Structured detail for the step record: rendered text, unresolved merge fields, targets. */
  data: Record<string, unknown>;
  /** Set when the action cannot run at all with this configuration and account. */
  failure?: { reason: string; detail: Record<string, unknown> };
}

export interface ActionCapability {
  kind: 'action';
  feature: string;
  /** Which node type carries this feature. */
  nodeType: 'action' | 'wait' | 'branch';
  /** Configuration problems, in words the inspector can show. Empty means runnable. */
  validate(config: Record<string, unknown>, account: AccountState): string[];
  /** Absent for `wait` and `branch`: the traversal owns their semantics. */
  execute?(context: ActionContext): ActionOutcome;
  /** Outbound messages honour the workflow's time window (D-102). */
  outbound?: boolean;
}

const text = (config: Record<string, unknown>, key: string): string | null => {
  const value = config[key];
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
};

const list = (config: Record<string, unknown>, key: string): string[] => {
  const value = config[key];
  if (Array.isArray(value))
    return value.filter((entry): entry is string => typeof entry === 'string');
  return typeof value === 'string' && value ? [value] : [];
};

const nodeSource = (context: ActionContext): PendingEvent['source'] => ({
  kind: 'workflow_node',
  id: `${context.workflow.id}/${context.node.id}`,
  caused_by: context.event.id,
});

/** Common payload on every effect a node produces, so a message or a tag can be attributed. */
const attribution = (context: ActionContext) => ({
  workflow_id: context.workflow.id,
  node_id: context.node.id,
  workflow_run_id: context.runId,
});

const STANDARD_CONTACT_FIELDS = ['first_name', 'last_name', 'email', 'phone', 'source', 'timezone'];

const ACTION_CAPABILITIES: ActionCapability[] = [
  {
    kind: 'action',
    feature: 'GHL-WF-SEND-SMS',
    nodeType: 'action',
    outbound: true,
    validate: (config) => (text(config, 'template') ? [] : ['Send SMS needs a message']),
    execute: (context) => {
      const { text: body, unresolved } = renderTemplate(
        text(context.node.config, 'template') ?? '',
        context.view,
      );
      const purpose = text(context.node.config, 'purpose');
      return {
        generated: [
          {
            type: 'SMS_SENT',
            at: context.event.at,
            origin: 'generated',
            source: nodeSource(context),
            payload: {
              contact_id: context.view.contact.id,
              body,
              ...(purpose ? { purpose } : {}),
              ...attribution(context),
            },
          },
        ],
        data: { channel: 'sms', body, unresolved },
      };
    },
  },
  {
    kind: 'action',
    feature: 'GHL-WF-SEND-EMAIL',
    nodeType: 'action',
    outbound: true,
    validate: (config) => [
      ...(text(config, 'subject') ? [] : ['Send Email needs a subject']),
      ...(text(config, 'body') ? [] : ['Send Email needs a body']),
    ],
    execute: (context) => {
      const subject = renderTemplate(text(context.node.config, 'subject') ?? '', context.view);
      const body = renderTemplate(text(context.node.config, 'body') ?? '', context.view);
      const purpose = text(context.node.config, 'purpose');
      return {
        generated: [
          {
            type: 'EMAIL_SENT',
            at: context.event.at,
            origin: 'generated',
            source: nodeSource(context),
            payload: {
              contact_id: context.view.contact.id,
              subject: subject.text,
              body: body.text,
              ...(purpose ? { purpose } : {}),
              ...attribution(context),
            },
          },
        ],
        data: {
          channel: 'email',
          subject: subject.text,
          body: body.text,
          unresolved: [...subject.unresolved, ...body.unresolved],
        },
      };
    },
  },
  {
    kind: 'action',
    feature: 'GHL-WF-ADD-CONTACT-TAG',
    nodeType: 'action',
    validate: (config) => (list(config, 'tag').length > 0 ? [] : ['Add Contact Tag needs a tag']),
    execute: (context) => ({
      generated: list(context.node.config, 'tag').map((tag) => ({
        type: 'TAG_ADDED' as const,
        at: context.event.at,
        origin: 'generated' as const,
        source: nodeSource(context),
        payload: { contact_id: context.view.contact.id, tag, ...attribution(context) },
      })),
      data: { tags: list(context.node.config, 'tag') },
    }),
  },
  {
    kind: 'action',
    feature: 'GHL-WF-REMOVE-CONTACT-TAG',
    nodeType: 'action',
    validate: (config) =>
      list(config, 'tag').length > 0 ? [] : ['Remove Contact Tag needs a tag'],
    execute: (context) => {
      // Removing a tag the contact does not carry is a no-op in GHL. The event still goes out so
      // the reducer records the step as skipped (`tag_not_present`) against this node, rather
      // than the step quietly vanishing from the timeline.
      const wanted = list(context.node.config, 'tag');
      return {
        generated: wanted.map((tag) => ({
          type: 'TAG_REMOVED' as const,
          at: context.event.at,
          origin: 'generated' as const,
          source: nodeSource(context),
          payload: { contact_id: context.view.contact.id, tag, ...attribution(context) },
        })),
        data: {
          tags: wanted,
          absent: wanted.filter((tag) => !context.view.contact.tags.includes(tag)),
        },
      };
    },
  },
  {
    kind: 'action',
    feature: 'GHL-WF-UPDATE-CONTACT-FIELD',
    nodeType: 'action',
    validate: (config, account) => {
      const field = text(config, 'field');
      const problems: string[] = [];
      if (!field) problems.push('Update Contact Field needs a field');
      else if (
        !STANDARD_CONTACT_FIELDS.includes(field) &&
        !(account.custom_fields[field] && account.custom_fields[field]?.object === 'contact')
      ) {
        problems.push(`There is no contact field called ${field}`);
      }
      if (config.value === undefined || config.value === null || config.value === '') {
        problems.push('Update Contact Field needs a value');
      }
      return problems;
    },
    execute: (context) => {
      const field = text(context.node.config, 'field') ?? '';
      const raw = context.node.config.value;
      const rendered =
        typeof raw === 'string'
          ? renderTemplate(raw, context.view)
          : { text: String(raw), unresolved: [] };
      const definition = context.view.account.custom_fields[field];
      if (
        !STANDARD_CONTACT_FIELDS.includes(field) &&
        (!definition || definition.object !== 'contact')
      ) {
        return {
          generated: [],
          data: { field },
          failure: { reason: 'unknown_field', detail: { field } },
        };
      }
      let value: string | number | boolean = rendered.text;
      if (definition?.type === 'number') {
        const numeric = Number(rendered.text);
        if (!Number.isFinite(numeric)) {
          return {
            generated: [],
            data: { field, value: rendered.text },
            failure: { reason: 'invalid_value', detail: { field, value: rendered.text } },
          };
        }
        value = numeric;
      } else if (definition?.type === 'checkbox') {
        value = ['true', 'yes', '1', 'on'].includes(rendered.text.trim().toLowerCase());
      } else if (
        definition?.type === 'dropdown' &&
        !(definition.options ?? []).includes(rendered.text)
      ) {
        return {
          generated: [],
          data: { field, value: rendered.text },
          failure: {
            reason: 'invalid_value',
            detail: { field, value: rendered.text, options: definition.options },
          },
        };
      }
      const payload = STANDARD_CONTACT_FIELDS.includes(field)
        ? { contact_id: context.view.contact.id, [field]: rendered.text || null }
        : { contact_id: context.view.contact.id, custom_fields: { [field]: value } };
      return {
        generated: [
          {
            type: 'CONTACT_UPDATED',
            at: context.event.at,
            origin: 'generated',
            source: nodeSource(context),
            payload: { ...payload, ...attribution(context) },
          },
        ],
        data: { field, value, unresolved: rendered.unresolved },
      };
    },
  },
  {
    kind: 'action',
    feature: 'GHL-WF-ASSIGN-TO-USER',
    nodeType: 'action',
    validate: (config, account) => {
      const users = list(config, 'users');
      if (users.length === 0) return ['Assign to User needs at least one user'];
      return users
        .filter((id) => !account.users[id])
        .map((id) => `There is no user ${id} in this account`);
    },
    execute: (context) => {
      const users = list(context.node.config, 'users').filter(
        (id) => context.view.account.users[id],
      );
      if (users.length === 0) {
        return {
          generated: [],
          data: {},
          failure: {
            reason: 'unknown_user',
            detail: { users: list(context.node.config, 'users') },
          },
        };
      }
      const onlyIfUnassigned = context.node.config.only_if_unassigned === true;
      if (onlyIfUnassigned && context.view.contact.owner_id) {
        return {
          generated: [],
          data: { skipped: 'already_assigned', owner_id: context.view.contact.owner_id },
        };
      }
      // Equal rotation: the user with the fewest contacts among those listed, ties by list order.
      const load = (id: string) =>
        Object.values(context.view.account.contacts).filter((row) => row.owner_id === id).length;
      const chosen = users.reduce(
        (best, id) => (load(id) < load(best) ? id : best),
        users[0] as string,
      );
      return {
        generated: [
          {
            type: 'CONTACT_ASSIGNED',
            at: context.event.at,
            origin: 'generated',
            source: nodeSource(context),
            payload: {
              contact_id: context.view.contact.id,
              owner_id: chosen,
              ...attribution(context),
            },
          },
        ],
        data: { owner_id: chosen, candidates: users },
      };
    },
  },
  {
    kind: 'action',
    feature: 'GHL-WF-CREATE-UPDATE-OPPORTUNITY',
    nodeType: 'action',
    validate: (config, account) => {
      const problems: string[] = [];
      const pipelineId = text(config, 'pipeline');
      const stage = text(config, 'stage');
      const pipeline = pipelineId ? account.pipelines[pipelineId] : null;
      if (!pipelineId) problems.push('Create/Update Opportunity needs a pipeline');
      else if (!pipeline) problems.push(`There is no pipeline ${pipelineId}`);
      if (!stage) problems.push('Create/Update Opportunity needs a stage');
      else if (pipeline && !pipeline.stages.includes(stage)) {
        problems.push(`${pipeline.name} has no stage called ${stage}`);
      }
      const status = text(config, 'status');
      if (status && !['open', 'won', 'lost', 'abandoned'].includes(status.toLowerCase())) {
        problems.push(`${status} is not an opportunity status`);
      }
      if (
        config.value !== undefined &&
        config.value !== '' &&
        !Number.isFinite(Number(config.value))
      ) {
        problems.push('Opportunity value must be a number');
      }
      return problems;
    },
    execute: (context) => {
      const pipelineId = text(context.node.config, 'pipeline') ?? '';
      const stage = text(context.node.config, 'stage') ?? '';
      const pipeline = context.view.account.pipelines[pipelineId];
      if (!pipeline || !pipeline.stages.includes(stage)) {
        return {
          generated: [],
          data: { pipeline: pipelineId, stage },
          failure: {
            reason: pipeline ? 'unknown_stage' : 'unknown_pipeline',
            detail: { pipeline: pipelineId, stage },
          },
        };
      }
      const status = text(context.node.config, 'status')?.toLowerCase() ?? null;
      const value =
        context.node.config.value !== undefined && context.node.config.value !== ''
          ? Number(context.node.config.value)
          : null;
      const existing = Object.values(context.view.account.opportunities)
        .filter(
          (row) => row.contact_id === context.view.contact.id && row.pipeline_id === pipelineId,
        )
        .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))[0];
      const generated: PendingEvent[] = [];
      if (existing) {
        if (existing.stage !== stage) {
          generated.push({
            type: 'PIPELINE_STAGE_CHANGED',
            at: context.event.at,
            origin: 'generated',
            source: nodeSource(context),
            payload: { opportunity_id: existing.id, stage, ...attribution(context) },
          });
        }
        if (status !== null || value !== null) {
          generated.push({
            type: 'OPPORTUNITY_UPDATED',
            at: context.event.at,
            origin: 'generated',
            source: nodeSource(context),
            payload: {
              opportunity_id: existing.id,
              ...(status !== null ? { status } : {}),
              ...(value !== null ? { value } : {}),
              ...attribution(context),
            },
          });
        }
        return {
          generated,
          data: { opportunity_id: existing.id, updated: true, stage, status, value },
        };
      }
      const id = `opp-${context.runId}-${context.node.id}`;
      generated.push({
        type: 'OPPORTUNITY_CREATED',
        at: context.event.at,
        origin: 'generated',
        source: nodeSource(context),
        payload: {
          opportunity_id: id,
          contact_id: context.view.contact.id,
          pipeline_id: pipelineId,
          stage,
          value: value ?? 0,
          ...(text(context.node.config, 'name')
            ? {
                name: renderTemplate(text(context.node.config, 'name') as string, context.view)
                  .text,
              }
            : {}),
          ...(status !== null ? { status } : {}),
          ...attribution(context),
        },
      });
      return { generated, data: { opportunity_id: id, created: true, stage, status, value } };
    },
  },
  {
    kind: 'action',
    feature: 'GHL-WF-REMOVE-FROM-WORKFLOW',
    nodeType: 'action',
    validate: (config) =>
      text(config, 'workflow')
        ? []
        : ['Remove from Workflow needs a target: this workflow, all workflows, or a named one'],
    execute: (context) => {
      const target = text(context.node.config, 'workflow') ?? 'this';
      const runs = Object.values(context.view.account.workflow_runs).filter(
        (run) =>
          run.contact_id === context.view.contact.id &&
          (run.status === 'active' || run.status === 'waiting') &&
          (target === 'all' ||
            run.workflow_id === (target === 'this' ? context.workflow.id : target)),
      );
      return {
        generated: runs.map((run) => ({
          type: 'WORKFLOW_EXITED' as const,
          at: context.event.at,
          origin: 'generated' as const,
          source: nodeSource(context),
          payload: { ...attribution(context), workflow_run_id: run.id, reason: 'removed' },
        })),
        data: {
          target,
          removed: runs.map((run) => run.id),
          removes_self: runs.some((run) => run.id === context.runId),
        },
      };
    },
  },
  {
    kind: 'action',
    feature: 'GHL-WF-SEND-INTERNAL-NOTIFICATION',
    nodeType: 'action',
    validate: (config, account) => {
      const problems: string[] = [];
      const channel = text(config, 'channel');
      if (!channel || !['email', 'sms', 'in-app'].includes(channel.toLowerCase())) {
        problems.push('Send Internal Notification needs a channel: Email, SMS or In-app');
      }
      const recipient = text(config, 'recipient');
      if (!recipient) problems.push('Send Internal Notification needs a recipient');
      else if (!account.users[recipient])
        problems.push(`There is no user ${recipient} in this account`);
      if (!text(config, 'message')) problems.push('Send Internal Notification needs a message');
      return problems;
    },
    execute: (context) => {
      const recipient = text(context.node.config, 'recipient') ?? '';
      if (!context.view.account.users[recipient]) {
        return {
          generated: [],
          data: { recipient },
          failure: { reason: 'unknown_user', detail: { recipient } },
        };
      }
      const message = renderTemplate(text(context.node.config, 'message') ?? '', context.view);
      return {
        generated: [
          {
            type: 'NOTIFICATION_SENT',
            at: context.event.at,
            origin: 'generated',
            source: nodeSource(context),
            payload: {
              contact_id: context.view.contact.id,
              recipient,
              channel: (text(context.node.config, 'channel') ?? 'in-app').toLowerCase(),
              message: message.text,
              ...attribution(context),
            },
          },
        ],
        data: { recipient, message: message.text, unresolved: message.unresolved },
      };
    },
  },
  {
    kind: 'action',
    feature: 'GHL-WF-CUSTOM-WEBHOOK',
    nodeType: 'action',
    validate: (config) => {
      const problems: string[] = [];
      const url = text(config, 'url');
      if (!url || !/^https?:\/\/\S+$/.test(url)) problems.push('Webhook needs an http(s) URL');
      const method = text(config, 'method');
      if (method && !['POST', 'GET', 'PUT', 'DELETE'].includes(method.toUpperCase())) {
        problems.push(`${method} is not a webhook method`);
      }
      const headers = config.headers;
      if (
        headers !== undefined &&
        (typeof headers !== 'object' || headers === null || Array.isArray(headers))
      ) {
        problems.push('Headers are key and value pairs');
      }
      return problems;
    },
    // No request leaves the sandbox. The simulator records the payload it would have sent and the
    // answer the scenario says that URL gives — 200 when it describes none, which is what every
    // scenario before Phase 15 meant and what the registry calls the approximation (D-139).
    execute: (context) => {
      const url = text(context.node.config, 'url') ?? '';
      const custom = context.node.config.custom_data;
      const rendered: Record<string, string> = {};
      const unresolved: string[] = [];
      if (custom && typeof custom === 'object' && !Array.isArray(custom)) {
        for (const [key, value] of Object.entries(custom as Record<string, unknown>)) {
          const out = renderTemplate(String(value), context.view);
          rendered[key] = out.text;
          unresolved.push(...out.unresolved);
        }
      }
      const body = {
        contact_id: context.view.contact.id,
        first_name: context.view.contact.first_name,
        email: context.view.contact.email,
        phone: context.view.contact.phone,
        tags: context.view.contact.tags,
        ...rendered,
      };
      const headers = readHeaders(context.node.config);
      const answer = answerFor(context.view.account, url, headers);
      return {
        generated: [
          {
            type: 'WEBHOOK_RESPONSE',
            at: context.event.at,
            origin: 'generated',
            source: nodeSource(context),
            payload: {
              endpoint: url,
              status: answer.status,
              body,
              method: (text(context.node.config, 'method') ?? 'POST').toUpperCase(),
              contact_id: context.view.contact.id,
              ...(answer.failure ? { failure_kind: answer.failure } : {}),
              ...(answer.endpoint_id ? { endpoint_id: answer.endpoint_id } : {}),
              ...attribution(context),
            },
          },
        ],
        data: {
          url,
          body,
          unresolved,
          simulated: true,
          // The header names sent, never their values: a log that prints a token is a log that
          // leaks one, and the learner needs to see which header was sent, not what was in it.
          header_names: Object.keys(headers).sort(),
          status: answer.status,
          ...(answer.failure ? { failure_kind: answer.failure } : {}),
          ...(answer.expected_header ? { expected_header: answer.expected_header } : {}),
        },
      };
    },
  },
  {
    kind: 'action',
    feature: 'GHL-WF-WAIT',
    nodeType: 'wait',
    validate: (config) => {
      const problems: string[] = [];
      const kind = text(config, 'wait_type');
      const number = (key: string) =>
        config[key] === undefined || config[key] === '' ? null : Number(config[key]);
      switch (kind) {
        case 'period': {
          const total =
            (number('days') ?? 0) * 1440 + (number('hours') ?? 0) * 60 + (number('minutes') ?? 0);
          if (
            ![number('days'), number('hours'), number('minutes')].every(
              (n) => n === null || (Number.isFinite(n) && n >= 0),
            )
          ) {
            problems.push('A set period of time needs whole, positive days, hours or minutes');
          } else if (total <= 0) problems.push('A set period of time must be longer than zero');
          break;
        }
        case 'date': {
          const at = text(config, 'at');
          if (!at || !hasOffset(at))
            problems.push('A specific date and time needs an instant with its offset');
          break;
        }
        case 'appointment': {
          const relative = text(config, 'relative');
          if (!relative || !['at', 'before', 'after'].includes(relative)) {
            problems.push('An appointment wait needs at, before or after');
          }
          if (relative && relative !== 'at') {
            const total = (number('hours') ?? 0) * 60 + (number('minutes') ?? 0);
            if (total <= 0) problems.push('Before or after needs hours or minutes');
          }
          break;
        }
        case 'reply': {
          const channel = text(config, 'channel');
          if (channel && !['sms', 'email', 'any'].includes(channel))
            problems.push('Reply channel must be sms, email or any');
          break;
        }
        case 'condition': {
          const { problems: shape } = readBranches([{ name: 'condition', groups: config.groups }]);
          problems.push(...shape.map((row) => row.replace('branch "condition"', 'the condition')));
          break;
        }
        default:
          problems.push(
            'Wait needs a type: a set period, a date, an appointment, a reply or a condition',
          );
      }
      const timeout = number('timeout_hours');
      if (timeout !== null && (!Number.isFinite(timeout) || timeout <= 0))
        problems.push('Timeout hours must be positive');
      return problems;
    },
  },
  {
    kind: 'action',
    feature: 'GHL-WF-IF-ELSE',
    nodeType: 'branch',
    validate: (config) => {
      const { branches, problems } = readBranches(config.branches);
      if (problems.length === 0 && branches.length === 0)
        problems.push('If/Else needs at least one branch');
      return problems;
    },
  },
];

/* ---- lookup -------------------------------------------------------------------------- */

const BY_FEATURE = new Map<string, TriggerCapability | ActionCapability>(
  [...TRIGGER_CAPABILITIES, ...ACTION_CAPABILITIES].map((capability) => [
    capability.feature,
    capability,
  ]),
);

export type Capability = TriggerCapability | ActionCapability;

/** The adapter for a registry feature, or `null` when Bloomlab does not simulate it. */
export const capabilityFor = (featureId: string | null | undefined): Capability | null =>
  featureId ? (BY_FEATURE.get(featureId) ?? null) : null;

export const triggerCapabilityFor = (
  featureId: string | null | undefined,
): TriggerCapability | null => {
  const found = capabilityFor(featureId);
  return found && found.kind === 'trigger' ? found : null;
};

export const actionCapabilityFor = (
  featureId: string | null | undefined,
): ActionCapability | null => {
  // Before the registry split, saved Custom Webhook simulations used this ID and allowed
  // PATCH. Preserve their execution/replay contract without advertising the standard
  // Webhook as a currently runnable native feature in capabilityFor or RUNNABLE_FEATURES.
  if (featureId === 'GHL-WF-WEBHOOK') {
    const current = actionCapabilityFor('GHL-WF-CUSTOM-WEBHOOK');
    if (!current) return null;
    return {
      ...current,
      feature: featureId,
      validate: (config, account) =>
        current.validate(
          text(config, 'method')?.toUpperCase() === 'PATCH'
            ? { ...config, method: 'POST' }
            : config,
          account,
        ),
    };
  }
  const found = capabilityFor(featureId);
  return found && found.kind === 'action' ? found : null;
};

/** Every feature the engine can run, for the Lab's capability predicate (WFL-011). */
export const RUNNABLE_FEATURES: readonly string[] = [...BY_FEATURE.keys()];

/** True when a node's configuration would reference a merge field the engine does not know. */
export const mentionsMergeFields = (config: Record<string, unknown>): boolean =>
  Object.values(config).some((value) => typeof value === 'string' && hasMergeFields(value));
