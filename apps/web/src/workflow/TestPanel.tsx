import { useState } from 'react';

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
  injectReply,
  injectScenarioAction,
  runNextEvent,
} from './commands';
import type { ExecutionResult } from './execution';
import { simulatorTime } from './words';
import styles from './workflow.module.css';

/**
 * Testing a workflow (WFL-004, SIM-007, SIM-009, CONV-001).
 *
 * Pick a contact the account already has, or generate one; run them through the saved
 * definition; move the clock; make things happen to them — a reply, a booking, one of the
 * scenario's authored events. Every control is a command; the panel decides nothing itself. Run is
 * refused while the graph has problems, and says which.
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
  onRan: (runId: string) => void;
}

export function TestPanel({
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
  const contacts = Object.values(account.contacts).sort((a, b) =>
    a.first_name.localeCompare(b.first_name),
  );
  const [contactId, setContactId] = useState<string>(contacts[0]?.id ?? '');
  const [generating, setGenerating] = useState(false);
  const [draft, setDraft] = useState({ first_name: '', phone: '', email: '' });
  const [reply, setReply] = useState('');
  const [bookingAt, setBookingAt] = useState('');
  const chosen = account.contacts[contactId] ?? contacts[0] ?? null;
  const upcoming = nextScheduled(run.state);
  const calendar = Object.values(account.calendars)[0] ?? null;
  const appointments = Object.values(account.appointments)
    .filter((row) => chosen && row.contact_id === chosen.id)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const [appointmentId, setAppointmentId] = useState<string>('');

  const canRun = workflow !== null && issues.length === 0 && chosen !== null && !busy;

  const runTest = async () => {
    if (!workflow || !chosen) return;
    const context = appointmentId ? { appointment_id: appointmentId } : {};
    const result = await perform((current) =>
      enrolTestContact(current, scenario, workflow.id, chosen.id, context),
    );
    if (result?.ok) {
      const latest = Object.values(result.run.state.account.workflow_runs)
        .filter((row) => row.workflow_id === workflow.id && row.contact_id === chosen.id)
        .sort((a, b) => b.enrolled_at.localeCompare(a.enrolled_at) || b.id.localeCompare(a.id))[0];
      if (latest) onRan(latest.id);
    }
  };

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
                  {simulatorTime(row.starts_at, run.state.clock.timezone)} ·{' '}
                  {row.status.replace('_', '-')}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <div className={styles.actions}>
          <Button onClick={() => void runTest()} disabled={!canRun} data-testid="run-test">
            Run {chosen ? chosen.first_name : 'contact'} through the workflow
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setGenerating((open) => !open)}>
            {generating ? 'Cancel' : 'Generate a contact'}
          </Button>
        </div>
        {dirty && (
          <p className={styles.muted}>
            Save the workflow first: a test runs what the account holds.
          </p>
        )}
        {!dirty && issues.length > 0 && (
          <ul className={styles.problems} aria-label="Why this workflow cannot run yet">
            {issues.map((issue, at) => (
              <li key={`${issue.code}-${issue.node_id ?? ''}-${at}`}>{issue.message}</li>
            ))}
          </ul>
        )}

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

      <div className={styles.formGrid} style={{ marginTop: 'var(--bl-space-4)' }}>
        <p className={styles.muted}>
          Account time: {simulatorTime(run.state.clock.now, run.state.clock.timezone)}
          {upcoming
            ? ` · next: ${upcoming.description ?? upcoming.type} at ${simulatorTime(upcoming.at, run.state.clock.timezone)}`
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
