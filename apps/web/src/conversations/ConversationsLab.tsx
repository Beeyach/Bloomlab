import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { Button, Field, Select, Stack, Surface, Textarea } from '@bloomlab/design-system';
import type { AccountState, Message } from '@bloomlab/simulator-core';

import { fullName, simulatorTime } from '../crm/words';
import { injectReply } from '../workflow/commands';
import { execute } from '../workflow/execution';
import { featureName } from '../workflow/palette';
import {
  DEFAULT_WORKFLOW_SCENARIO_ID,
  scenarioFor,
  useWorkflowRun,
} from '../workflow/useWorkflowRun';
import styles from './conversations.module.css';

/**
 * Conversations (CONV-001).
 *
 * Every SMS and email the simulated account has sent or received, per contact, read straight out
 * of the run that the Workflow Lab and the CRM Lab are working in. Nothing here is a message a
 * screen made up: an outbound message carries the workflow and the step that sent it, and an
 * inbound one is an event the learner injected — as the contact replying, or as a staff member
 * writing back. A reply is a real `SMS_RECEIVED` / `EMAIL_RECEIVED`: it releases a reply wait,
 * fires Customer Replied, and whatever the workflows do next shows up here as new messages.
 */

const channelWord = (channel: Message['channel']) => (channel === 'sms' ? 'Text' : 'Email');

function threadsOf(account: AccountState) {
  return Object.values(account.conversations)
    .filter((thread) => thread.messages.length > 0)
    .map((thread) => ({ thread, contact: account.contacts[thread.contact_id] ?? null }))
    .sort((a, b) => (b.thread.last_message_at ?? '').localeCompare(a.thread.last_message_at ?? ''));
}

export default function ConversationsLab() {
  const [params, setParams] = useSearchParams();
  const scenarioId = scenarioFor(params.get('scenario') ?? '')
    ? (params.get('scenario') as string)
    : DEFAULT_WORKFLOW_SCENARIO_ID;
  const { run, scenario, loading, busy, refusal, problem, perform, dismissRefusal } =
    useWorkflowRun(scenarioId);
  const selectedId = params.get('contact');
  const [body, setBody] = useState('');
  const [channel, setChannel] = useState<'sms' | 'email'>('sms');
  const [asStaff, setAsStaff] = useState(false);

  const account = run?.state.account ?? null;
  const threads = useMemo(() => (account ? threadsOf(account) : []), [account]);
  const contacts = account
    ? Object.values(account.contacts).sort((a, b) => fullName(a).localeCompare(fullName(b)))
    : [];

  if (loading || !run || !scenario || !account) {
    return (
      <Stack as="section" gap={3} className={styles.screen} aria-labelledby="inbox-title">
        <h1 id="inbox-title" className={styles.title}>
          Conversations
        </h1>
        <p className={styles.lead}>{problem ?? 'Opening the account…'}</p>
      </Stack>
    );
  }

  const selected = selectedId ? (account.contacts[selectedId] ?? null) : null;
  const thread = selected ? (account.conversations[selected.id] ?? null) : null;
  const timezone = run.state.clock.timezone;

  const send = async () => {
    if (!selected || !body.trim()) return;
    if (asStaff) {
      await perform((current) =>
        execute(current, scenario, {
          kind: 'process',
          event: {
            type: channel === 'sms' ? 'SMS_SENT' : 'EMAIL_SENT',
            at: current.state.clock.now,
            origin: 'injected',
            source: { kind: 'injector_action', id: 'conversations' },
            payload:
              channel === 'sms'
                ? { contact_id: selected.id, body: body.trim() }
                : { contact_id: selected.id, subject: 'From the front desk', body: body.trim() },
          },
        }),
      );
    } else {
      await perform((current) => injectReply(current, scenario, selected.id, body.trim(), channel));
    }
    setBody('');
  };

  return (
    <Stack as="section" gap={4} className={styles.screen} aria-labelledby="inbox-title">
      <div className={styles.header}>
        <h1 id="inbox-title" className={styles.title}>
          Conversations
        </h1>
        <p className={styles.lead}>
          {account.account.name}. Every text and email the account has sent or received, and who
          sent it. Reply as the contact to see what the workflows do next.
        </p>
      </div>

      <dl className={styles.facts}>
        <div>
          <dt>Account time</dt>
          <dd>{simulatorTime(run.state.clock.now, timezone)}</dd>
        </div>
        <div>
          <dt>Threads</dt>
          <dd>{threads.length}</dd>
        </div>
        <div>
          <dt>Waiting for a reply</dt>
          <dd>
            {
              Object.values(account.workflow_runs).filter(
                (row) => row.status === 'waiting' && row.wait?.kind === 'reply',
              ).length
            }
          </dd>
        </div>
      </dl>

      {refusal && (
        <Surface tone="snow" padding="md" className={styles.refusal} role="alert">
          <p className={styles.refusalTitle}>Bloomlab refused that.</p>
          <p className={styles.refusalBody}>{refusal.message}</p>
          <div className={styles.actions}>
            <Button size="sm" variant="ghost" onClick={dismissRefusal}>
              Dismiss
            </Button>
          </div>
        </Surface>
      )}

      <div className={styles.workspace} data-thread={selected ? 'open' : 'closed'}>
        <div className={styles.listPane}>
          <Field label="Start a thread with" id="inbox-contact">
            <Select
              value={selected?.id ?? ''}
              onChange={(event) =>
                setParams(
                  event.target.value
                    ? { scenario: scenario.id, contact: event.target.value }
                    : { scenario: scenario.id },
                  { replace: true },
                )
              }
            >
              <option value="">Choose a contact</option>
              {contacts.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {fullName(contact)}
                </option>
              ))}
            </Select>
          </Field>
          {threads.length === 0 ? (
            <p className={styles.muted}>
              No messages yet. Run a contact through a workflow in the{' '}
              <Link to={`/workflow?scenario=${scenario.id}`} className={styles.link}>
                Workflow Lab
              </Link>
              , or start a thread here.
            </p>
          ) : (
            <ul className={styles.threads} aria-label="Conversations">
              {threads.map(({ thread: row, contact }) => {
                const last = row.messages.at(-1);
                return (
                  <li key={row.id}>
                    <button
                      type="button"
                      className={styles.threadRow}
                      aria-pressed={selected?.id === row.contact_id}
                      onClick={() =>
                        setParams(
                          { scenario: scenario.id, contact: row.contact_id },
                          { replace: true },
                        )
                      }
                      data-thread={row.contact_id}
                    >
                      <span className={styles.threadName}>
                        {contact ? fullName(contact) : row.contact_id}
                      </span>
                      <span className={styles.threadMeta}>
                        {last
                          ? `${channelWord(last.channel)} · ${simulatorTime(last.at, timezone)}`
                          : ''}
                      </span>
                      {last && <span className={styles.threadPreview}>{last.body}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {selected && (
          <div className={styles.threadPane} data-testid="thread">
            <h2 className={styles.threadTitle}>
              {fullName(selected)}
              {selected.dnd ? ' · Do not disturb' : ''}
            </h2>
            <ol className={styles.messages} aria-label={`Messages with ${fullName(selected)}`}>
              {(thread?.messages ?? []).map((message) => (
                <li
                  key={message.id}
                  className={styles.message}
                  data-direction={message.direction}
                  data-channel={message.channel}
                >
                  <span className={styles.bubble}>
                    {message.subject && <span className={styles.subject}>{message.subject}</span>}
                    {message.body}
                  </span>
                  <span className={styles.meta}>
                    {message.direction === 'inbound' ? `${fullName(selected)} · ` : ''}
                    {channelWord(message.channel)} · {simulatorTime(message.at, timezone)}
                    {message.workflow_id
                      ? ` · sent by ${account.workflows[message.workflow_id]?.name ?? message.workflow_id}${
                          message.node_id
                            ? ` (${featureName(
                                account.workflows[message.workflow_id]?.nodes.find(
                                  (node) => node.id === message.node_id,
                                )?.ghl_feature_id,
                              )})`
                            : ''
                        }`
                      : message.direction === 'outbound'
                        ? ' · sent by staff'
                        : ''}
                  </span>
                </li>
              ))}
              {(thread?.messages ?? []).length === 0 && (
                <li className={styles.muted}>Nothing yet. Write the first message below.</li>
              )}
            </ol>
            <form
              className={styles.composer}
              onSubmit={(event) => {
                event.preventDefault();
                void send();
              }}
            >
              <div className={styles.composerRow}>
                <Field label="Writing as" id="inbox-as">
                  <Select
                    value={asStaff ? 'staff' : 'contact'}
                    onChange={(event) => setAsStaff(event.target.value === 'staff')}
                  >
                    <option value="contact">{fullName(selected)} (a reply)</option>
                    <option value="staff">Staff (an outbound message)</option>
                  </Select>
                </Field>
                <Field label="Channel" id="inbox-channel">
                  <Select
                    value={channel}
                    onChange={(event) => setChannel(event.target.value as 'sms' | 'email')}
                  >
                    <option value="sms">Text</option>
                    <option value="email">Email</option>
                  </Select>
                </Field>
              </div>
              <Field label="Message" id="inbox-body">
                <Textarea rows={2} value={body} onChange={(event) => setBody(event.target.value)} />
              </Field>
              <div className={styles.actions}>
                <Button
                  type="submit"
                  size="sm"
                  disabled={busy || !body.trim()}
                  data-testid="send-message"
                >
                  {asStaff ? 'Send' : `Reply as ${selected.first_name}`}
                </Button>
              </div>
            </form>
          </div>
        )}
      </div>
    </Stack>
  );
}
