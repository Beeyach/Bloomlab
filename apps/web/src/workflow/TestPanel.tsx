import { memo, useState } from 'react';

import { Button, Field, Input, Select, ToolPanel } from '@bloomlab/design-system';
import {
  nextScheduled,
  type GraphIssue,
  type SimulatorScenario,
  type SimulatorState,
  type Workflow,
} from '@bloomlab/simulator-core';

import type { StoredRun } from '../simulator/store';
import {
  advanceTime,
  bookAppointment,
  createTestContact,
  enrolTestContact,
  fireTriggerEvent,
  injectReply,
  injectScenarioAction,
  runNextEvent,
} from './commands';
import type { ExecutionResult } from './execution';
import { featureName, referenceOptions } from './palette';
import {
  buildTriggerEvent,
  defaultTriggerInput,
  directStartOutcome,
  triggerOutcomeFor,
  triggerTestOptions,
  type TriggerEventOption,
  type TriggerField,
  type TriggerTestInput,
} from './triggerTest';
import { operatorWords, simulatorTime } from './words';
import styles from './workflow.module.css';

/**
 * Testing a workflow (WFL-004, SIM-007, SIM-009, CONV-001).
 *
 * Two different things, kept apart on purpose:
 *
 * 1. **Test the trigger** (the default). Something happens to a contact — the kind of event the
 *    configured trigger listens for, made from the smallest real context — and the engine's
 *    trigger matcher and filters decide whether anyone enrols. The panel reads the outcome back
 *    from the account and says it plainly, including "the event happened and the trigger did not
 *    fire", which is the lesson most worth having.
 * 2. **Start at the first step** (a diagnostic). The contact is enrolled directly, skipping the
 *    trigger and its filters, to test the steps alone. The engine records that as a direct
 *    enrolment and the timeline never claims the GHL trigger fired.
 *
 * Every control is a command; the panel decides nothing itself. A run is refused while the saved
 * graph has problems, and says which.
 */

export interface TestPanelProps {
  run: StoredRun;
  scenario: SimulatorScenario;
  workflow: Workflow | null;
  /** Problems in the saved definition; a run is offered only when there are none. */
  issues: GraphIssue[];
  dirty: boolean;
  busy: boolean;
  perform: (
    command: (current: StoredRun) => Promise<ExecutionResult>,
  ) => Promise<ExecutionResult | null>;
  /** A run of this workflow just started (by the trigger or directly): watch it. */
  onRan: (runId: string) => void;
}

type Outcome =
  | { kind: 'enrolled'; contact: string; feature: string }
  | { kind: 'trigger_blocked'; contact: string; feature: string }
  | { kind: 'event_noop'; contact: string; feature: string; reason: string | null }
  | { kind: 'not_enrolled'; contact: string; feature: string; filters: string[] }
  | { kind: 'direct'; contact: string }
  | { kind: 'direct_blocked'; contact: string };

function TestPanelInner({
  run,
  scenario,
  workflow,
  issues,
  dirty,
  busy,
  perform,
  onRan,
}: TestPanelProps) {
  const account = run.state.account;
  const zone = run.state.clock.timezone;
  const contacts = Object.values(account.contacts).sort((a, b) =>
    a.first_name.localeCompare(b.first_name),
  );
  const [contactId, setContactId] = useState<string>(contacts[0]?.id ?? '');
  const [generating, setGenerating] = useState(false);
  const [draft, setDraft] = useState({ first_name: '', phone: '', email: '' });
  const [reply, setReply] = useState('');
  const [bookingAt, setBookingAt] = useState('');
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const chosen = account.contacts[contactId] ?? contacts[0] ?? null;
  const upcoming = nextScheduled(run.state);
  const calendar = Object.values(account.calendars)[0] ?? null;
  const appointments = Object.values(account.appointments)
    .filter((row) => chosen && row.contact_id === chosen.id)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const opportunities = Object.values(account.opportunities).filter(
    (row) => chosen && row.contact_id === chosen.id,
  );
  const [appointmentId, setAppointmentId] = useState<string>('');

  // The trigger test: which event, and what it needs.
  const options = workflow ? triggerTestOptions(workflow) : [];
  const [eventType, setEventType] = useState<string>('');
  const option: TriggerEventOption | null =
    options.find((row) => row.event === eventType) ?? options[0] ?? null;
  const [input, setInput] = useState<TriggerTestInput>({});
  const patch = (next: TriggerTestInput) => setInput((current) => ({ ...current, ...next }));
  const needs = (field: TriggerField) => option?.fields.includes(field) ?? false;
  const triggerName = workflow?.trigger.ghl_feature_id
    ? featureName(workflow.trigger.ghl_feature_id)
    : null;
  const filtersWords = (workflow?.trigger.filters ?? []).map(
    (filter) =>
      `${filter.field.replace(/_/g, ' ')} ${operatorWords(filter.operator)} ${String(filter.value ?? '')}`,
  );

  const runnable = workflow !== null && issues.length === 0 && !dirty && !busy;
  const canFire = runnable && option !== null;
  const canStart = runnable && chosen !== null;

  // Resolved values for the event: the chosen test contact stands in wherever a contact is needed,
  // and the first real option stands in for anything not picked yet.
  const defaults = defaultTriggerInput(
    account,
    chosen?.id ?? null,
    run.state.clock.now,
    option?.event,
  );
  const resolved: TriggerTestInput = {
    ...defaults,
    ...Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)),
    contact_id: chosen?.id,
    new_contact: draft.first_name
      ? { first_name: draft.first_name, phone: draft.phone || null, email: draft.email || null }
      : undefined,
  };
  const built = option ? buildTriggerEvent(option, resolved, account) : null;

  const fireTrigger = async () => {
    if (!workflow || !option || !built?.ok || !triggerName) return;
    const beforeLogLength = run.state.log.length;
    setOutcome(null);
    const result = await perform((current) =>
      fireTriggerEvent(current, scenario, built.event.type, built.event.payload),
    );
    if (!result?.ok) return;
    const triggerOutcome = triggerOutcomeFor(beforeLogLength, result.run.state, workflow.id);
    const subject =
      (built.event.contact_id && result.run.state.account.contacts[built.event.contact_id]) || null;
    const who = subject ? subject.first_name : 'the contact';
    if (triggerOutcome.kind === 'enrolled') {
      setOutcome({ kind: 'enrolled', contact: who, feature: triggerName });
      onRan(triggerOutcome.run.id);
    } else if (triggerOutcome.kind === 'blocked_reentry') {
      setOutcome({ kind: 'trigger_blocked', contact: who, feature: triggerName });
    } else if (triggerOutcome.kind === 'event_noop') {
      setOutcome({
        kind: 'event_noop',
        contact: who,
        feature: triggerName,
        reason: triggerOutcome.reason,
      });
    } else {
      setOutcome({
        kind: 'not_enrolled',
        contact: who,
        feature: triggerName,
        filters: filtersWords,
      });
    }
    setInput((current) => ({ ...current, body: '' }));
  };

  const startAtFirstStep = async () => {
    if (!workflow || !chosen) return;
    const beforeRunIds = new Set(Object.keys(run.state.account.workflow_runs));
    const beforeLogLength = run.state.log.length;
    setOutcome(null);
    const context = appointmentId ? { appointment_id: appointmentId } : {};
    const result = await perform((current) =>
      enrolTestContact(current, scenario, workflow.id, chosen.id, context),
    );
    if (!result?.ok) return;
    const directOutcome = directStartOutcome(
      beforeRunIds,
      beforeLogLength,
      result.run.state,
      workflow.id,
      chosen.id,
    );
    if (directOutcome.kind === 'started') {
      setOutcome({ kind: 'direct', contact: chosen.first_name });
      onRan(directOutcome.run.id);
    } else {
      setOutcome({ kind: 'direct_blocked', contact: chosen.first_name });
    }
  };

  const stageOptions = (() => {
    const opportunity = resolved.opportunity_id
      ? account.opportunities[resolved.opportunity_id]
      : null;
    return referenceOptions('stages', account, { pipeline: opportunity?.pipeline_id ?? null });
  })();

  return (
    <ToolPanel title="Test" density="high" data-testid="test-panel">
      <div className={styles.formGrid}>
        <Field
          label="Test contact"
          hint="An existing contact, or generate one below."
          id="test-contact"
        >
          <Select value={chosen?.id ?? ''} onChange={(event) => setContactId(event.target.value)}>
            {contacts.map((contact) => (
              <option key={contact.id} value={contact.id}>
                {contact.first_name} {contact.last_name ?? ''}
                {contact.phone ? '' : ' · no phone'}
                {contact.dnd ? ' · DND' : ''}
              </option>
            ))}
          </Select>
        </Field>
        <div className={styles.actions}>
          <Button size="sm" variant="ghost" onClick={() => setGenerating((open) => !open)}>
            {generating ? 'Cancel' : 'Generate a contact'}
          </Button>
        </div>
        {generating && (
          <form
            className={styles.formGrid}
            onSubmit={(event) => {
              event.preventDefault();
              if (!draft.first_name.trim()) return;
              void perform((current) =>
                createTestContact(current, scenario, {
                  first_name: draft.first_name.trim(),
                  phone: draft.phone.trim() || null,
                  email: draft.email.trim() || null,
                }),
              ).then((result) => {
                if (result?.ok) {
                  const made = Object.values(result.run.state.account.contacts).find(
                    (row) =>
                      row.first_name === draft.first_name.trim() &&
                      row.source === 'Workflow Lab test contact',
                  );
                  if (made) setContactId(made.id);
                  setGenerating(false);
                  setDraft({ first_name: '', phone: '', email: '' });
                }
              });
            }}
          >
            <Field label="First name" required id="gen-first">
              <Input
                value={draft.first_name}
                onChange={(event) => setDraft({ ...draft, first_name: event.target.value })}
              />
            </Field>
            <Field label="Phone" hint="Leave blank to test the no-phone path." id="gen-phone">
              <Input
                value={draft.phone}
                onChange={(event) => setDraft({ ...draft, phone: event.target.value })}
              />
            </Field>
            <Field label="Email" id="gen-email">
              <Input
                type="email"
                value={draft.email}
                onChange={(event) => setDraft({ ...draft, email: event.target.value })}
              />
            </Field>
            <div className={styles.actions}>
              <Button type="submit" size="sm" disabled={busy}>
                Create contact
              </Button>
            </div>
          </form>
        )}
      </div>

      {/* ---- 1. the trigger, for real ---------------------------------------------------- */}
      <section
        className={styles.testSection}
        aria-labelledby="trigger-test-title"
        data-testid="trigger-test"
      >
        <h3 id="trigger-test-title" className={styles.testTitle}>
          Test the trigger
        </h3>
        {!workflow || !triggerName ? (
          <p className={styles.muted}>Choose a trigger in the inspector first.</p>
        ) : options.length === 0 ? (
          <p className={styles.muted} data-testid="trigger-not-runnable">
            {triggerName} is practised in GHL and cannot fire in the simulator. You can still start{' '}
            {chosen ? chosen.first_name : 'a contact'} at the first step below.
          </p>
        ) : (
          <>
            <p className={styles.muted}>
              {triggerName}
              {filtersWords.length > 0 ? ` · filters: ${filtersWords.join(', ')}` : ' · no filters'}
              . The engine decides whether the event matches; nothing is enrolled by hand.
            </p>
            {options.length > 1 && (
              <Field label="What happens" id="trigger-event">
                <Select
                  value={option?.event ?? ''}
                  onChange={(event) => {
                    setEventType(event.target.value);
                    setInput({});
                  }}
                >
                  {options.map((row) => (
                    <option key={row.event} value={row.event}>
                      {row.label}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            {needs('form') && (
              <Field label="Form" id="trigger-form">
                <Select
                  value={resolved.form_id ?? ''}
                  onChange={(event) => patch({ form_id: event.target.value })}
                >
                  {referenceOptions('forms', account).map((row) => (
                    <option key={row.value} value={row.value}>
                      {row.label}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            {needs('survey') && (
              <Field label="Survey" id="trigger-survey">
                <Select
                  value={resolved.survey_id ?? ''}
                  onChange={(event) => patch({ survey_id: event.target.value })}
                >
                  {referenceOptions('surveys', account).map((row) => (
                    <option key={row.value} value={row.value}>
                      {row.label}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            {needs('calendar') && (
              <Field label="Calendar" id="trigger-calendar">
                <Select
                  value={resolved.calendar_id ?? ''}
                  onChange={(event) => patch({ calendar_id: event.target.value })}
                >
                  {referenceOptions('calendars', account).map((row) => (
                    <option key={row.value} value={row.value}>
                      {row.label}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            {needs('appointment') && (
              <Field
                label="Appointment"
                hint={
                  appointments.length === 0
                    ? `${chosen?.first_name ?? 'This contact'} has no appointment yet; book one below.`
                    : undefined
                }
                id="trigger-appointment"
              >
                <Select
                  value={resolved.appointment_id ?? ''}
                  onChange={(event) => patch({ appointment_id: event.target.value })}
                >
                  {appointments.map((row) => (
                    <option key={row.id} value={row.id}>
                      {simulatorTime(row.starts_at, zone)} · {row.status.replace('_', '-')}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            {needs('starts_at') && (
              <Field
                label="Starts at"
                hint="An instant with an offset, e.g. 2026-09-05T14:00:00-05:00"
                id="trigger-starts-at"
              >
                <Input
                  value={resolved.starts_at ?? ''}
                  onChange={(event) => patch({ starts_at: event.target.value })}
                />
              </Field>
            )}
            {needs('status') && (
              <Field label="New status" id="trigger-status">
                <Select
                  value={resolved.status ?? ''}
                  onChange={(event) => patch({ status: event.target.value })}
                >
                  {['confirmed', 'showed', 'no_show', 'cancelled'].map((status) => (
                    <option key={status} value={status}>
                      {status.replace('_', '-')}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            {needs('tag') && (
              <Field label="Tag" id="trigger-tag">
                <Select
                  value={resolved.tag ?? ''}
                  onChange={(event) => patch({ tag: event.target.value })}
                >
                  {referenceOptions('tags', account).map((row) => (
                    <option key={row.value} value={row.value}>
                      {row.label}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            {needs('body') && (
              <Field label={`${chosen?.first_name ?? 'The contact'} says`} id="trigger-body">
                <Input
                  value={resolved.body ?? ''}
                  onChange={(event) => patch({ body: event.target.value })}
                />
              </Field>
            )}
            {needs('opportunity') && (
              <Field
                label="Deal"
                hint={
                  opportunities.length === 0
                    ? `${chosen?.first_name ?? 'This contact'} has no deal.`
                    : undefined
                }
                id="trigger-opportunity"
              >
                <Select
                  value={resolved.opportunity_id ?? ''}
                  onChange={(event) => patch({ opportunity_id: event.target.value })}
                >
                  {opportunities.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name} · {row.stage}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            {needs('stage') && (
              <Field label="Moves to stage" id="trigger-stage">
                <Select
                  value={resolved.stage ?? ''}
                  onChange={(event) => patch({ stage: event.target.value })}
                >
                  <option value="">Choose a stage</option>
                  {stageOptions.map((row) => (
                    <option key={row.value} value={row.value}>
                      {row.label}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            {needs('opportunity_status') && (
              <Field label="Deal status" id="trigger-opportunity-status">
                <Select
                  value={resolved.opportunity_status ?? ''}
                  onChange={(event) => patch({ opportunity_status: event.target.value })}
                >
                  {['open', 'won', 'lost', 'abandoned'].map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            {needs('new_contact') && (
              <p className={styles.muted}>
                Fill in “Generate a contact” above: creating the contact is the event.
              </p>
            )}
            <div className={styles.actions}>
              <Button
                onClick={() => void fireTrigger()}
                disabled={!canFire || !built?.ok}
                data-testid="run-test"
              >
                {option ? `${option.label}: fire ${triggerName}` : `Fire ${triggerName}`}
              </Button>
            </div>
            {built && !built.ok && runnable && (
              <p className={styles.muted}>This needs {built.missing} first.</p>
            )}
          </>
        )}
      </section>

      {/* ---- 2. the steps alone -------------------------------------------------------- */}
      <section
        className={styles.testSection}
        aria-labelledby="first-step-title"
        data-testid="start-at-first-step"
      >
        <h3 id="first-step-title" className={styles.testTitle}>
          Start at the first step
        </h3>
        <p className={styles.muted}>
          Skips the trigger and its filters to test the steps on their own. The timeline will say
          the trigger was not fired.
        </p>
        {appointments.length > 0 && (
          <Field
            label="About which appointment"
            hint="For appointment-relative waits and merge fields."
            id="test-appointment"
          >
            <Select
              value={appointmentId}
              onChange={(event) => setAppointmentId(event.target.value)}
            >
              <option value="">Their next live appointment</option>
              {appointments.map((row) => (
                <option key={row.id} value={row.id}>
                  {simulatorTime(row.starts_at, zone)} · {row.status.replace('_', '-')}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <div className={styles.actions}>
          <Button
            variant="secondary"
            onClick={() => void startAtFirstStep()}
            disabled={!canStart}
            data-testid="start-first-step"
          >
            Start {chosen ? chosen.first_name : 'contact'} at the first step
          </Button>
        </div>
      </section>

      {outcome && (
        <p
          className={styles.outcome}
          role="status"
          data-testid="trigger-outcome"
          data-outcome={outcome.kind}
        >
          {outcome.kind === 'enrolled' &&
            `${outcome.feature} fired and enrolled ${outcome.contact}. Watch the run below.`}
          {outcome.kind === 'trigger_blocked' &&
            `${outcome.feature} matched for ${outcome.contact}, but they are already active in this workflow and re-entry is off. No second run was started.`}
          {outcome.kind === 'event_noop' &&
            `The event made no change for ${outcome.contact}${
              outcome.reason ? ` (${outcome.reason.replace(/_/g, ' ')})` : ''
            }, so ${outcome.feature} did not fire.`}
          {outcome.kind === 'not_enrolled' &&
            `The event happened, but ${outcome.feature} did not match this event directly${
              outcome.filters.length > 0
                ? `: the filters (${outcome.filters.join(', ')}) did not match`
                : ': the trigger did not match'
            }. Nothing was started by hand.`}
          {outcome.kind === 'direct' &&
            `${outcome.contact} was started at the first step. The trigger was not fired.`}
          {outcome.kind === 'direct_blocked' &&
            `${outcome.contact} is already active in this workflow, so Start at the first step did not create another run while re-entry is off.`}
        </p>
      )}

      {dirty && workflow && (
        <p className={styles.muted}>Save the workflow first: a test runs what the account holds.</p>
      )}
      {!dirty && issues.length > 0 && (
        <ul className={styles.problems} aria-label="Why this workflow cannot run yet">
          {issues.map((issue, at) => (
            <li key={`${issue.code}-${issue.node_id ?? ''}-${at}`}>{issue.message}</li>
          ))}
        </ul>
      )}

      <div className={styles.formGrid} style={{ marginTop: 'var(--bl-space-4)' }}>
        <p className={styles.muted}>
          Account time: {simulatorTime(run.state.clock.now, zone)}
          {upcoming
            ? ` · next: ${upcoming.description ?? upcoming.type} at ${simulatorTime(upcoming.at, zone)}`
            : ' · nothing queued'}
        </p>
        <div className={styles.actions} role="group" aria-label="Time Machine">
          <Button
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={() => void perform((c) => advanceTime(c, scenario, 'minute'))}
          >
            +1 minute
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={() => void perform((c) => advanceTime(c, scenario, 'hour'))}
          >
            +1 hour
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={() => void perform((c) => advanceTime(c, scenario, 'day'))}
          >
            +1 day
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={busy || !upcoming}
            onClick={() => void perform((c) => runNextEvent(c, scenario))}
          >
            Next event
          </Button>
        </div>
      </div>

      {chosen && (
        <div className={styles.formGrid} style={{ marginTop: 'var(--bl-space-4)' }}>
          <form
            className={styles.row}
            onSubmit={(event) => {
              event.preventDefault();
              if (!reply.trim()) return;
              void perform((current) =>
                injectReply(current, scenario, chosen.id, reply.trim(), 'sms'),
              ).then(() => setReply(''));
            }}
          >
            <Field
              label={`${chosen.first_name} replies by text`}
              id="inject-reply"
              className={styles.workflowChoice}
            >
              <Input value={reply} onChange={(event) => setReply(event.target.value)} />
            </Field>
            <Button type="submit" size="sm" variant="secondary" disabled={busy || !reply.trim()}>
              Send reply
            </Button>
          </form>
          {calendar && (
            <form
              className={styles.row}
              onSubmit={(event) => {
                event.preventDefault();
                if (!bookingAt) return;
                void perform((current) =>
                  bookAppointment(current, scenario, chosen.id, calendar.id, bookingAt),
                ).then(() => setBookingAt(''));
              }}
            >
              <Field
                label={`${chosen.first_name} books on ${calendar.name}`}
                hint="An instant with an offset, e.g. 2026-09-05T14:00:00-05:00"
                id="inject-booking"
                className={styles.workflowChoice}
              >
                <Input value={bookingAt} onChange={(event) => setBookingAt(event.target.value)} />
              </Field>
              <Button type="submit" size="sm" variant="secondary" disabled={busy || !bookingAt}>
                Book
              </Button>
            </form>
          )}
          {(scenario.injectable_events ?? []).length > 0 && (
            <div className={styles.actions} role="group" aria-label="Scenario events">
              {(scenario.injectable_events ?? []).map((action) => (
                <Button
                  key={action.id}
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() =>
                    void perform((current) => injectScenarioAction(current, scenario, action.id))
                  }
                >
                  {action.description ?? action.id}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}
    </ToolPanel>
  );
}

export type { SimulatorState };

/** Memoised: playback ticks re-render only what they change (PERF-002). */
export const TestPanel = memo(TestPanelInner);
