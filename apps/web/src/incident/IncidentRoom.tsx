import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';

import { Button, Stack, StatusPill, cx } from '@bloomlab/design-system';
import {
  bookableSlots,
  contentEventName,
  type ExecutionRecord,
  type SimulatorScenario,
  type SimulatorState,
} from '@bloomlab/simulator-core';

import { content } from '../content/bundle';
import { currentRunId, rememberRun, savedRuns } from '../simulator/currentRun';
import { loadRun, resetStoredRun, startRun, type StoredRun } from '../simulator/store';
import { execute } from '../workflow/execution';
import { pendingCount } from '../reporting/window';
import {
  evidenceRecords,
  incidentCase,
  incidentCases,
  reproduce,
  type IncidentCase,
} from './incidents';
import styles from './incident.module.css';
import { ScenarioAttachments } from './ScenarioAttachments';

/**
 * The Incident Room (SIM-011, DES-013).
 *
 * Understated on purpose. There is no flashing, no siren, no looping alarm, no neon terminal and
 * no monospace anywhere a learner can see: a broken system in a real business is quiet, and what
 * is loud about it is a client who is unhappy. So the page is a case file — the symptom, what the
 * client said, the logs the system actually wrote, and the state of the account — in Bricolage
 * for the headings and Inter for everything else, with a single restrained warning rule down the
 * side of the complaint.
 *
 * It also never gives the answer away. What is rendered is the scenario's authored case facts,
 * which say what is observably wrong and nothing about why; the fault and the fix live in the
 * grading assertions of the exercises that use these scenarios, and a test proves the case facts
 * name neither (§26, §71). Hints belong to the exercise runner and start closed there.
 */

export default function IncidentRoom() {
  const { scenarioId } = useParams();
  const cases = useMemo(() => incidentCases(), []);
  const chosen = scenarioId ? incidentCase(scenarioId) : null;

  if (scenarioId && !chosen) {
    return (
      <Stack as="section" gap={3} className={styles.screen} aria-labelledby="incident-title">
        <h1 id="incident-title" className={styles.title}>
          No incident at this address.
        </h1>
        <p className={styles.muted}>
          <Link to="/incident" className={styles.inlineLink}>
            Back to the incident list
          </Link>
        </p>
      </Stack>
    );
  }

  return chosen ? <CaseFile row={chosen} /> : <CaseList cases={cases} />;
}

/* ---- the list ------------------------------------------------------------------------------ */

function CaseList({ cases }: { cases: IncidentCase[] }) {
  return (
    <Stack as="section" gap={5} className={styles.screen} aria-labelledby="incident-title">
      <header className={styles.header}>
        <h1 id="incident-title" className={styles.title}>
          Incidents
        </h1>
        <p className={styles.lead}>
          Something broke. Find out why. Each of these is a real account with a real failure in it,
          not a description of one — you reproduce it, read what the system wrote, and work out what
          is wrong before anybody tells you.
        </p>
      </header>
      <ul className={styles.caseList}>
        {cases.map((row) => (
          <li key={row.scenario_id} className={styles.caseCard}>
            <h2 className={styles.caseTitle}>
              <Link to={`/incident/${row.scenario_id}`} className={styles.caseLink}>
                {row.incident.title}
              </Link>
            </h2>
            <p className={styles.caseSymptom}>{row.incident.symptom}</p>
            <p className={styles.caseClient}>{clientName(row.client_id)}</p>
          </li>
        ))}
      </ul>
    </Stack>
  );
}

const clientName = (id: string): string =>
  content.clients.find((row) => row.id === id)?.business_name ?? id;

/* ---- one case ------------------------------------------------------------------------------- */

function CaseFile({ row }: { row: IncidentCase }) {
  const scenario = row.scenario as SimulatorScenario;
  const [run, setRun] = useState<StoredRun | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [showEverything, setShowEverything] = useState(false);
  const opening = useRef<string | null>(null);

  useEffect(() => {
    if (opening.current === scenario.id) return;
    opening.current = scenario.id;
    let cancelled = false;
    (async () => {
      const saved = await savedRuns(scenario.id);
      const chosen = saved.length > 0 ? await currentRunId(scenario.id) : null;
      const resumed = chosen ? await loadRun(chosen) : null;
      const next = resumed ?? (await startRun(scenario));
      if (!cancelled) {
        await rememberRun(scenario.id, next.state.run_id);
        setRun(next);
      }
    })().catch((error: unknown) => {
      if (!cancelled) {
        setProblem(error instanceof Error ? error.message : 'The account could not be opened.');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [scenario]);

  const play = useCallback(async () => {
    if (!run || busy) return;
    setBusy(true);
    setProblem(null);
    try {
      const result = await reproduce(run, scenario);
      if (result && result.ok) setRun(result.run);
      else if (result) setProblem(result.refusal.message);
    } finally {
      setBusy(false);
    }
  }, [run, scenario, busy]);

  const inject = useCallback(
    async (actionId: string) => {
      if (!run || busy) return;
      setBusy(true);
      setProblem(null);
      try {
        const result = await execute(run, scenario, { kind: 'inject_action', action_id: actionId });
        if (result.ok) setRun(result.run);
        else setProblem(result.refusal.message);
      } finally {
        setBusy(false);
      }
    },
    [run, scenario, busy],
  );

  const restart = useCallback(async () => {
    if (!run) return;
    setProblem(null);
    setRun(await resetStoredRun(scenario, run.state.run_id));
  }, [run, scenario]);

  if (!run) {
    return (
      <Stack as="section" gap={3} className={styles.screen} aria-labelledby="incident-title">
        <h1 id="incident-title" className={styles.title}>
          {row.incident.title}
        </h1>
        <p className={styles.muted}>{problem ?? 'Opening the account…'}</p>
      </Stack>
    );
  }

  const state = run.state;
  const pending = pendingCount(state);
  const evidence = evidenceRecords(state);
  const shown = showEverything ? state.execution : evidence;
  // What this scenario lets a learner do by hand: send another test lead, book again, qualify
  // somebody. The scenario decides, never this screen (SIM-009).
  const actions = [...(scenario.injectable_events ?? [])];

  return (
    <Stack as="article" gap={6} className={styles.screen} aria-labelledby="incident-title">
      <header className={styles.header}>
        <p className={styles.breadcrumb}>
          <Link to="/incident" className={styles.inlineLink}>
            Incidents
          </Link>
        </p>
        <h1 id="incident-title" className={styles.title}>
          {row.incident.title}
        </h1>
        <p className={styles.lead}>
          {clientName(row.client_id)} · {row.title}
        </p>
        <StatusPill label="Open" tone="warning" glyph="dot" />
      </header>

      {problem && (
        <p className={styles.refusal} role="alert">
          {problem}
        </p>
      )}

      <div className={styles.columns}>
        <section aria-labelledby="symptom-title" className={styles.panel}>
          <h2 id="symptom-title" className={styles.panelHeading}>
            The symptom
          </h2>
          <p className={styles.body}>{row.incident.symptom}</p>

          <h3 className={styles.subHeading}>What the client said</h3>
          <blockquote className={styles.complaint}>{row.incident.client_complaint}</blockquote>

          <h3 className={styles.subHeading}>Where to look</h3>
          <ul className={styles.list}>
            {row.incident.inspect.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>

          {row.incident.reproduce.length > 0 && (
            <>
              <h3 className={styles.subHeading}>How to reproduce it</h3>
              <ol className={styles.list}>
                {row.incident.reproduce.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ol>
            </>
          )}

          <div className={styles.actions}>
            {pending > 0 && (
              <Button
                variant="primary"
                loading={busy}
                onClick={() => void play()}
                data-testid="reproduce"
              >
                Run it
              </Button>
            )}
            {actions.map((action) => (
              <Button
                key={action.id}
                variant="secondary"
                loading={busy}
                onClick={() => void inject(action.id)}
                data-testid={`inject-${action.id}`}
              >
                {action.description}
              </Button>
            ))}
            <Button variant="ghost" onClick={() => void restart()} data-testid="incident-reset">
              Put it back
            </Button>
          </div>
          <p className={styles.muted}>
            {pending > 0
              ? `${pending} ${pending === 1 ? 'thing has' : 'things have'} not happened yet.`
              : 'Everything this scenario queued has happened.'}
          </p>
        </section>

        <div className={styles.evidence}>
          <SystemState state={state} />
          <Logs
            records={shown}
            everything={showEverything}
            onToggle={() => setShowEverything((current) => !current)}
            total={state.execution.length}
          />
        </div>
      </div>

      <ScenarioAttachments scenarioId={scenario.id} />
      <LabLinks state={state} scenarioId={scenario.id} />
    </Stack>
  );
}

/* ---- system state ---------------------------------------------------------------------------- */

function SystemState({ state }: { state: SimulatorState }) {
  const account = state.account;
  const contacts = Object.values(account.contacts);
  const runs = Object.values(account.workflow_runs);
  const conversations = Object.values(account.conversations);
  const messages = conversations.reduce((total, row) => total + row.messages.length, 0);
  const calendars = Object.values(account.calendars);

  return (
    <section aria-labelledby="state-title" className={styles.panel}>
      <h2 id="state-title" className={styles.panelHeading}>
        System state
      </h2>
      <p className={styles.muted}>Simulator time: {state.clock.now}</p>

      {contacts.length > 0 && (
        <>
          <h3 className={styles.subHeading}>Contacts</h3>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Phone</th>
                  <th scope="col">Email</th>
                  <th scope="col">Do not disturb</th>
                  <th scope="col">Tags</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((contact) => (
                  <tr key={contact.id} data-testid={`state-contact-${contact.id}`}>
                    <th scope="row">
                      {contact.first_name} {contact.last_name ?? ''}
                    </th>
                    <td className={cx(!contact.phone && styles.absent)}>
                      {contact.phone ?? 'None on the record'}
                    </td>
                    <td className={cx(!contact.email && styles.absent)}>
                      {contact.email ?? 'None on the record'}
                    </td>
                    <td>{contact.dnd ? 'Yes' : 'No'}</td>
                    <td>{contact.tags.length > 0 ? contact.tags.join(', ') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {runs.length > 0 && (
        <>
          <h3 className={styles.subHeading}>Workflow runs</h3>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Workflow</th>
                  <th scope="col">Contact</th>
                  <th scope="col">Status</th>
                  <th scope="col">Ended because</th>
                  <th scope="col">Enrolled</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((row) => (
                  <tr key={row.id} data-testid={`state-run-${row.id}`}>
                    <th scope="row">
                      {account.workflows[row.workflow_id]?.name ?? row.workflow_id}
                    </th>
                    <td>{row.contact_id}</td>
                    <td>{row.status}</td>
                    <td>{row.exit_reason ? words(row.exit_reason) : '—'}</td>
                    <td>{row.enrolled_at}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h3 className={styles.subHeading}>Messages</h3>
      <p className={styles.body} data-testid="state-messages">
        {messages === 0
          ? 'No message has been delivered on this account.'
          : `${messages} ${messages === 1 ? 'message' : 'messages'} across ${conversations.length} ${conversations.length === 1 ? 'conversation' : 'conversations'}.`}
      </p>

      {calendars.length > 0 && (
        <>
          <h3 className={styles.subHeading}>Calendars</h3>
          <ul className={styles.list} data-testid="state-calendars">
            {calendars.map((calendar) => {
              const openings = bookableSlots(account, calendar.id, state.clock.now).length;
              return (
                <li key={calendar.id}>
                  {calendar.name} · {calendar.type.replace('_', ' ')} ·{' '}
                  {calendar.staff_ids.length === 0
                    ? 'nobody on the team'
                    : `${calendar.staff_ids.length} on the team`}{' '}
                  ·{' '}
                  <span className={cx(openings === 0 && styles.absent)}>
                    {openings === 0 ? 'no times offered' : `${openings} times offered`}
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {Object.keys(account.external_endpoints).length > 0 && (
        <>
          <h3 className={styles.subHeading}>Outside services</h3>
          <p className={styles.muted}>
            Simulated. Bloomlab sends no request — this is what the scenario says each address
            answers with, so a refused credential and a failing service can be told apart. It is not
            a HighLevel setting.
          </p>
          <ul className={styles.list} data-testid="state-endpoints">
            {Object.values(account.external_endpoints).map((endpoint) => (
              <li key={endpoint.id}>
                {endpoint.url} ·{' '}
                {endpoint.auth
                  ? `expects a ${endpoint.auth.header} header`
                  : 'no credential required'}{' '}
                ·{' '}
                {endpoint.outage
                  ? `currently answering ${endpoint.outage.status}`
                  : `answers ${endpoint.ok_status} when the caller is accepted`}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

/* ---- logs -------------------------------------------------------------------------------------- */

function Logs({
  records,
  everything,
  onToggle,
  total,
}: {
  records: ExecutionRecord[];
  everything: boolean;
  onToggle: () => void;
  total: number;
}) {
  return (
    <section aria-labelledby="logs-title" className={styles.panel}>
      <h2 id="logs-title" className={styles.panelHeading}>
        Execution log
      </h2>
      <p className={styles.muted}>
        What the system did, in the order it did it. Not a terminal — this is the same execution
        history the Workflow Lab draws its timeline from.
      </p>
      <button
        type="button"
        className={styles.disclosure}
        aria-expanded={everything}
        onClick={onToggle}
        data-testid="log-toggle"
      >
        {everything ? 'Show what the system decided' : `Show every step (${total})`}
      </button>
      {records.length === 0 ? (
        <p className={styles.body} data-testid="log-empty">
          Nothing has run yet.
        </p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">What</th>
                <th scope="col">Step</th>
                <th scope="col">Reason</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr
                  key={record.id}
                  className={cx(
                    (record.kind === 'failure' || record.kind === 'action_skipped') &&
                      styles.problemRow,
                  )}
                  data-testid={`log-${record.id}`}
                >
                  <td>{record.at}</td>
                  <td>{words(record.kind)}</td>
                  <td>{String(record.data.node_label ?? record.node_id ?? '—')}</td>
                  <td className={styles.reason} data-testid={`log-reason-${record.id}`}>
                    {record.reason ? words(record.reason) : detailOf(record)}
                    {/*
                      A failed call says what came back as well as what went wrong. 401 and 503
                      are the difference between a credential to fix and a service to wait for,
                      so the status belongs beside the reason rather than behind a click.
                    */}
                    {typeof record.data.status === 'number' && record.reason && (
                      <span className={styles.detail}> · {String(record.data.status)}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/**
 * A machine token in the learner's words. The record stores tokens rather than sentences so a
 * change of wording never rewrites history, and this is the one place the wording lives.
 */
function words(token: string): string {
  const said: Record<string, string> = {
    missing_phone: 'The contact has no phone number',
    missing_email: 'The contact has no email address',
    dnd: 'The contact is on do-not-disturb',
    duplicate_enrolment: 'Already in this workflow, and re-entry is off',
    workflow_loop: 'Going round: stopped by the engine',
    webhook_auth: 'The service refused the credential',
    webhook_unavailable: 'The service is unavailable',
    webhook_server_error: 'The service returned an error',
    webhook_timeout: 'The service did not answer',
    webhook_error: 'The call did not succeed',
    unsupported_feature: 'This step is not something the engine runs',
    action_skipped: 'Step skipped',
    branch_result: 'Branch decided',
    failure: 'Failed',
    exit: 'Run ended',
    trigger: 'Trigger fired',
    step_completed: 'Step completed',
    step_started: 'Step started',
    input: 'Recorded',
    waiting: 'Waiting',
    completed: 'Completed',
    stale_advance: 'A continuation arrived after the run had ended',
    tag_not_present: 'The contact did not carry that tag',
    already_opened: 'Already opened',
    wait_released: 'The wait ended',
    wait_timed_out: 'The wait timed out',
    card_declined: 'The card was declined',
  };
  return said[token] ?? token.replace(/_/g, ' ');
}

/** For a record with no reason, the one fact worth putting in the row. */
function detailOf(record: ExecutionRecord): string {
  if (record.kind === 'branch_result') return `Took ${String(record.data.chosen ?? 'None')}`;
  if (typeof record.data.status === 'number') return `Answered ${record.data.status}`;
  if (typeof record.data.channel === 'string') return `Sent by ${record.data.channel}`;
  if (typeof record.data.form_id === 'string') return `Form ${record.data.form_id}`;
  return '—';
}

/* ---- where to go next ------------------------------------------------------------------------- */

function LabLinks({ state, scenarioId }: { state: SimulatorState; scenarioId: string }) {
  const account = state.account;
  const has = {
    workflow: Object.keys(account.workflows).length > 0,
    calendar: Object.keys(account.calendars).length > 0,
    funnel: Object.keys(account.funnels).length > 0,
    crm: Object.keys(account.contacts).length > 0,
  };
  const events = new Set(state.log.map((event) => contentEventName(event.type)));
  return (
    <section aria-labelledby="open-title" className={styles.panel}>
      <h2 id="open-title" className={styles.panelHeading}>
        Open it somewhere you can change it
      </h2>
      <p className={styles.muted}>
        These all open the same account. Fix what you find, then come back and run it again.
      </p>
      <ul className={styles.labLinks}>
        {has.workflow && (
          <li>
            <Link to={`/workflow?scenario=${scenarioId}`} className={styles.inlineLink}>
              Workflow Lab
            </Link>
          </li>
        )}
        {has.crm && (
          <li>
            <Link to={`/crm?scenario=${scenarioId}`} className={styles.inlineLink}>
              CRM Lab
            </Link>
          </li>
        )}
        {has.calendar && (
          <li>
            <Link to={`/calendar?scenario=${scenarioId}`} className={styles.inlineLink}>
              Calendar Lab
            </Link>
          </li>
        )}
        {has.funnel && (
          <li>
            <Link to={`/funnel?scenario=${scenarioId}`} className={styles.inlineLink}>
              Funnel Lab
            </Link>
          </li>
        )}
        {events.has('sms.sent') || events.has('email.sent') ? (
          <li>
            <Link to={`/conversations?scenario=${scenarioId}`} className={styles.inlineLink}>
              Conversations
            </Link>
          </li>
        ) : null}
      </ul>
    </section>
  );
}
