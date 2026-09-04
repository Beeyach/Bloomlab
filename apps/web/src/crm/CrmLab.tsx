import { useMemo, useState, useSyncExternalStore } from 'react';
import { useSearchParams } from 'react-router';

import {
  Button,
  ContactRow,
  Field,
  Input,
  Inspector,
  Select,
  Sheet,
  Stack,
  Surface,
} from '@bloomlab/design-system';

import { ContactDetail } from './ContactDetail';
import { CrmSetup } from './CrmSetup';
import { PipelineBoard } from './PipelineBoard';
import { createContact } from './commands';
import styles from './crm.module.css';
import { useCrmRun } from './useCrmRun';
import { fullName, ownerName, simulatorTime } from './words';

/**
 * The CRM Lab (CRM-001, CRM-003, CRM-004).
 *
 * One simulated GoHighLevel account, worked in for real: find a contact, change what it holds,
 * decide tag or field, assign it, create and move a deal, leave a note, owe somebody a task, and
 * read the history that came out of doing all that. Every change is a simulator event through the
 * command layer — there is no CRM store, and nothing here mutates the account.
 *
 * Three areas rather than one long page, because a CRM is three jobs: working the contacts,
 * working the pipeline, and deciding the structure both sit on. The area and the selected record
 * live in the URL, so a reload comes back to what the learner was looking at.
 *
 * Nothing here is holographic. The interface is quiet so a dense tool stays readable for an hour.
 */

const NARROW = '(max-width: 1023px)';

function subscribeNarrow(onChange: () => void) {
  if (typeof window.matchMedia !== 'function') return () => {};
  const query = window.matchMedia(NARROW);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

const isNarrow = () => typeof window.matchMedia === 'function' && window.matchMedia(NARROW).matches;

/** The device wall time a run was last saved at — sync metadata, labelled as such, never simulator time. */
const savedAt = (iso: string): string => {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
};

type Area = 'contacts' | 'pipeline' | 'setup';
const AREAS: { id: Area; label: string }[] = [
  { id: 'contacts', label: 'Contacts' },
  { id: 'pipeline', label: 'Pipeline' },
  { id: 'setup', label: 'Setup' },
];

export default function CrmLab() {
  const {
    run,
    scenario,
    runs,
    loading,
    refusal,
    problem,
    apply,
    reset,
    switchRun,
    dismissRefusal,
  } = useCrmRun();
  const [params, setParams] = useSearchParams();
  const narrow = useSyncExternalStore(subscribeNarrow, isNarrow, () => false);
  const [confirmingReset, setConfirmingReset] = useState(false);

  const area: Area = AREAS.some((entry) => entry.id === params.get('area'))
    ? (params.get('area') as Area)
    : 'contacts';
  const selectedId = params.get('record');
  const setArea = (next: Area) => setParams({ area: next }, { replace: true });
  const setSelected = (id: string | null) =>
    setParams(id ? { area, record: id } : { area }, { replace: true });

  if (loading || !run || !scenario) {
    return (
      <Stack as="section" gap={3} className={styles.screen} aria-labelledby="crm-title">
        <h1 id="crm-title" className={styles.title}>
          CRM
        </h1>
        <p className={styles.lead}>{problem ?? 'Opening the training account…'}</p>
      </Stack>
    );
  }

  const account = run.state.account;
  const pipelines = Object.values(account.pipelines);
  const pipeline = pipelines[0] ?? null;

  return (
    <Stack as="section" gap={4} className={styles.screen} aria-labelledby="crm-title">
      <div className={styles.header}>
        <h1 id="crm-title" className={styles.title}>
          CRM
        </h1>
        <p className={styles.lead}>
          {account.account.name}. Everything you change here happens in the same simulated account
          the rest of Bloomlab runs on.
        </p>
      </div>

      <div className={styles.accountBar}>
        <dl className={styles.facts}>
          <div>
            <dt className={styles.factLabel} style={{ display: 'inline' }}>
              Account time
            </dt>
            <dd className={styles.factValue} style={{ display: 'inline' }}>
              {simulatorTime(run.state.clock.now, run.state.clock.timezone)}
            </dd>
          </div>
          <div>
            <dt className={styles.factLabel} style={{ display: 'inline' }}>
              Contacts
            </dt>
            <dd className={styles.factValue} style={{ display: 'inline' }}>
              {Object.keys(account.contacts).length}
            </dd>
          </div>
          <div>
            <dt className={styles.factLabel} style={{ display: 'inline' }}>
              Open deals
            </dt>
            <dd className={styles.factValue} style={{ display: 'inline' }}>
              {Object.values(account.opportunities).filter((row) => row.status === 'open').length}
            </dd>
          </div>
        </dl>
        <div className={styles.barActions}>
          {confirmingReset ? (
            <>
              <span className={styles.muted}>Reset the account to how it started?</span>
              <Button
                size="sm"
                variant="danger"
                onClick={() => {
                  setConfirmingReset(false);
                  void reset();
                }}
              >
                Reset account
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmingReset(false)}>
                Keep my work
              </Button>
            </>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setConfirmingReset(true)}>
              Reset account
            </Button>
          )}
        </div>
      </div>

      {runs.length > 1 && (
        <div className={styles.accountChoice} role="status">
          <p className={styles.muted}>
            This scenario has {runs.length} saved accounts, probably started on different devices.
            Each keeps its own history; switching changes none of them.
          </p>
          <Field label="Working in" id="crm-run-choice">
            <Select
              value={run.state.run_id}
              onChange={(event) => void switchRun(event.target.value)}
            >
              {runs.map((row, index) => (
                <option key={row.run_id} value={row.run_id}>
                  Account {runs.length - index}
                  {index === 0 ? ' (saved most recently)' : ''} · last saved{' '}
                  {savedAt(row.updated_at)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      )}

      <nav aria-label="CRM areas">
        <ul className={styles.modes}>
          {AREAS.map((entry) => (
            <li key={entry.id}>
              <button
                type="button"
                className={styles.mode}
                aria-current={area === entry.id ? 'page' : undefined}
                onClick={() => setArea(entry.id)}
              >
                {entry.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {refusal && (
        <Surface tone="snow" padding="md" className={styles.refusal} role="alert">
          <p className={styles.refusalTitle}>Bloomlab refused that change.</p>
          <p className={styles.refusalBody}>{refusal.message}</p>
          <div className={styles.actions}>
            <Button size="sm" variant="ghost" onClick={dismissRefusal}>
              Dismiss
            </Button>
          </div>
        </Surface>
      )}
      {problem && (
        <Surface tone="snow" padding="md" className={styles.refusal} role="alert">
          <p className={styles.refusalTitle}>That could not be saved.</p>
          <p className={styles.refusalBody}>{problem}</p>
        </Surface>
      )}

      {area === 'contacts' && (
        <ContactsArea
          run={run}
          selectedId={selectedId}
          onSelect={setSelected}
          narrow={narrow}
          apply={apply}
        />
      )}
      {area === 'pipeline' &&
        (pipeline ? (
          <PipelineBoard
            run={run}
            pipeline={pipeline}
            selectedId={selectedId}
            onSelect={setSelected}
            narrow={narrow}
            apply={apply}
          />
        ) : (
          <p className={styles.empty}>No pipelines yet. Setup is where they are created.</p>
        ))}
      {area === 'setup' && <CrmSetup run={run} apply={apply} />}
    </Stack>
  );
}

function ContactsArea({
  run,
  selectedId,
  onSelect,
  narrow,
  apply,
}: {
  run: ReturnType<typeof useCrmRun>['run'] & object;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  narrow: boolean;
  apply: ReturnType<typeof useCrmRun>['apply'];
}) {
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const account = run.state.account;

  // Filtering reads; it never writes. The list is derived from the run on every render.
  const contacts = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return Object.values(account.contacts)
      .filter((contact) => {
        if (!needle) return true;
        return [fullName(contact), contact.email, contact.phone, ...contact.tags]
          .filter(Boolean)
          .some((field) => String(field).toLowerCase().includes(needle));
      })
      .sort((a, b) => fullName(a).localeCompare(fullName(b)));
  }, [account.contacts, query]);

  const selected = selectedId ? (account.contacts[selectedId] ?? null) : null;
  const detail = selected ? <ContactDetail run={run} contact={selected} apply={apply} /> : null;

  return (
    <div className={styles.workspace} data-detail={selected ? 'open' : 'closed'}>
      <div className={styles.listPane}>
        <div className={styles.toolbar}>
          <div className={styles.search}>
            <Field label="Search contacts" hint="Name, email, phone or tag.">
              <Input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </Field>
          </div>
          <div className={styles.toolbarAction}>
            <Button size="sm" onClick={() => setCreating((open) => !open)}>
              {creating ? 'Cancel' : 'New contact'}
            </Button>
          </div>
        </div>

        {creating && <NewContactForm run={run} apply={apply} onDone={() => setCreating(false)} />}

        <p className={styles.count}>
          {contacts.length} of {Object.keys(account.contacts).length} contacts
        </p>
        <ul className={styles.rows}>
          {contacts.map((contact) => (
            <li key={contact.id}>
              <ContactRow
                name={fullName(contact)}
                hasPhone={Boolean(contact.phone)}
                hasEmail={Boolean(contact.email)}
                tags={contact.tags}
                owner={ownerName(account, contact.owner_id)}
                lastActivity={contact.dnd ? 'Do not disturb' : undefined}
                selected={contact.id === selectedId}
                data-contact={contact.id}
                onClick={() => onSelect(contact.id === selectedId ? null : contact.id)}
              />
            </li>
          ))}
        </ul>
        {contacts.length === 0 && <p className={styles.empty}>No contact matches that.</p>}
      </div>

      {!narrow && selected && (
        <div className={styles.detailPane}>
          <Inspector title={fullName(selected)} density="high" onClose={() => onSelect(null)}>
            {detail}
          </Inspector>
        </div>
      )}
      {narrow && (
        <Sheet
          open={Boolean(selected)}
          onClose={() => onSelect(null)}
          title={selected ? fullName(selected) : 'Contact'}
          side="bottom"
        >
          {detail}
        </Sheet>
      )}
    </div>
  );
}

function NewContactForm({
  run,
  apply,
  onDone,
}: {
  run: ReturnType<typeof useCrmRun>['run'] & object;
  apply: ReturnType<typeof useCrmRun>['apply'];
  onDone: () => void;
}) {
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [owner, setOwner] = useState('');

  return (
    <form
      className={styles.formGrid}
      onSubmit={(event) => {
        event.preventDefault();
        if (!first.trim()) return;
        void apply((r) =>
          createContact(r, {
            first_name: first.trim(),
            last_name: last.trim() || null,
            email: email.trim() || null,
            phone: phone.trim() || null,
            owner_id: owner || null,
          }),
        ).then((ok) => {
          if (ok) onDone();
        });
      }}
    >
      <Field label="First name" required>
        <Input value={first} onChange={(event) => setFirst(event.target.value)} />
      </Field>
      <Field label="Last name">
        <Input value={last} onChange={(event) => setLast(event.target.value)} />
      </Field>
      <Field label="Email">
        <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
      </Field>
      <Field label="Phone">
        <Input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} />
      </Field>
      <Field label="Owner">
        <Select value={owner} onChange={(event) => setOwner(event.target.value)}>
          <option value="">Unassigned</option>
          {Object.values(run.state.account.users).map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
        </Select>
      </Field>
      <div className={styles.actions}>
        <Button type="submit" variant="primary" size="sm">
          Create contact
        </Button>
      </div>
    </form>
  );
}
