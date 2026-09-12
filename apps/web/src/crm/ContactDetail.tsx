import { useState } from 'react';

import { instantForDay, type Contact } from '@bloomlab/simulator-core';
import { Button, Field, Input, Select, Stack, StatusPill, Textarea } from '@bloomlab/design-system';

import { NATIVE_LABELS } from '../content/featureNames';
import type { StoredRun } from '../simulator/store';
import { fullActivityFor } from './activity';
import {
  addNote,
  addTag,
  assignContact,
  createOpportunity,
  createTask,
  removeTag,
  setTaskCompleted,
  updateContact,
  type CrmOutcome,
} from './commands';
import styles from './crm.module.css';
import { activityBody, describeActivity, ownerName, simulatorDay, simulatorTime } from './words';

/**
 * One contact, in full (CRM-001).
 *
 * Nine areas have to be reachable without the record turning into nine stacked cards, so the
 * detail is one inspector with sub-navigation: the record itself, then its history, its notes and
 * its work. Each panel is dense rows rather than boxes.
 *
 * Every edit goes through the CRM command layer, so nothing here writes state and nothing here
 * knows a business rule — an invalid change comes back as a refusal the Lab shows.
 */

type Panel = 'record' | 'activity' | 'notes' | 'tasks';

const PANELS: { id: Panel; label: string }[] = [
  { id: 'record', label: 'Record' },
  { id: 'activity', label: 'Activity' },
  { id: 'notes', label: 'Notes' },
  { id: 'tasks', label: 'Tasks' },
];

export interface ContactDetailProps {
  run: StoredRun;
  contact: Contact;
  apply: (command: (run: StoredRun) => Promise<CrmOutcome>) => Promise<boolean>;
}

export function ContactDetail({ run, contact, apply }: ContactDetailProps) {
  const [panel, setPanel] = useState<Panel>('record');
  const account = run.state.account;
  const zone = run.state.clock.timezone;

  return (
    <Stack gap={3}>
      <ul className={styles.modes}>
        {PANELS.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className={styles.mode}
              aria-current={panel === item.id ? 'page' : undefined}
              onClick={() => setPanel(item.id)}
            >
              {item.label}
            </button>
          </li>
        ))}
      </ul>

      {panel === 'record' && <RecordPanel run={run} contact={contact} apply={apply} />}
      {panel === 'activity' && (
        <ol className={styles.activity}>
          {fullActivityFor(run.state, { contact_id: contact.id }).map((entry) => (
            <li key={entry.id} className={styles.activityRow}>
              <span className={styles.activityTime}>{simulatorTime(entry.at, zone)}</span>
              <div className={styles.activityWhat}>
                <span>{describeActivity(entry, account)}</span>
                {activityBody(entry) && (
                  <p className={styles.activityBody}>{activityBody(entry)}</p>
                )}
              </div>
            </li>
          ))}
          {fullActivityFor(run.state, { contact_id: contact.id }).length === 0 && (
            <li className={styles.empty}>Nothing has happened to this contact yet.</li>
          )}
        </ol>
      )}
      {panel === 'notes' && <NotesPanel run={run} contact={contact} apply={apply} />}
      {panel === 'tasks' && <TasksPanel run={run} contact={contact} apply={apply} />}
    </Stack>
  );
}

/* ---- the record itself -------------------------------------------------- */

function RecordPanel({ run, contact, apply }: ContactDetailProps) {
  const account = run.state.account;
  const [tag, setTag] = useState('');
  const contactFields = Object.values(account.custom_fields).filter(
    (field) => field.object === 'contact',
  );
  const deals = Object.values(account.opportunities).filter((row) => row.contact_id === contact.id);

  return (
    <Stack gap={4}>
      <div className={styles.section}>
        <Details contact={contact} apply={apply} />
        <div className={styles.sectionRow}>
          <span className={styles.rowLabel}>Do not disturb</span>
          <span className={styles.rowValue}>
            <StatusPill
              label={contact.dnd ? 'On — no outbound messages' : 'Off'}
              tone={contact.dnd ? 'warning' : 'neutral'}
              glyph={contact.dnd ? 'cross' : 'check'}
            />
          </span>
          <Button
            size="sm"
            onClick={() => void apply((r) => updateContact(r, contact.id, { dnd: !contact.dnd }))}
          >
            {contact.dnd ? 'Turn off' : 'Turn on'}
          </Button>
        </div>
        <div className={styles.sectionRow}>
          <span className={styles.rowLabel}>Owner</span>
          <span className={styles.rowValue}>
            <Field label="Contact owner" id={`owner-${contact.id}`}>
              <Select
                value={contact.owner_id ?? ''}
                onChange={(event) =>
                  void apply((r) => assignContact(r, contact.id, event.target.value || null))
                }
              >
                <option value="">Unassigned</option>
                {Object.values(account.users).map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </Select>
            </Field>
          </span>
        </div>
      </div>

      <section aria-labelledby={`tags-${contact.id}`} className={styles.section}>
        <h3 id={`tags-${contact.id}`} className={styles.stageName}>
          Tags
        </h3>
        <ul className={styles.chips}>
          {contact.tags.map((name) => (
            <li key={name} className={styles.chip}>
              {name}
              <button
                type="button"
                className={styles.chipRemove}
                aria-label={`Remove tag ${name}`}
                onClick={() => void apply((r) => removeTag(r, contact.id, name))}
              >
                ×
              </button>
            </li>
          ))}
          {contact.tags.length === 0 && <li className={styles.missing}>No tags</li>}
        </ul>
        <form
          className={styles.inlineForm}
          onSubmit={(event) => {
            event.preventDefault();
            if (!tag.trim()) return;
            void apply((r) => addTag(r, contact.id, tag.trim())).then((ok) => {
              if (ok) setTag('');
            });
          }}
        >
          <div className={styles.inlineField}>
            <Field label="Add a tag" hint="An existing tag, or a new name to create one.">
              <Input
                value={tag}
                list={`tags-list-${contact.id}`}
                onChange={(event) => setTag(event.target.value)}
              />
            </Field>
          </div>
          <datalist id={`tags-list-${contact.id}`}>
            {account.tags.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
          <Button type="submit" size="sm">
            Add tag
          </Button>
        </form>
      </section>

      <section aria-labelledby={`fields-${contact.id}`} className={styles.section}>
        <h3 id={`fields-${contact.id}`} className={styles.stageName}>
          {NATIVE_LABELS.customFields}
        </h3>
        {contactFields.length === 0 && (
          <p className={styles.muted}>No contact fields are defined. Setup is where they live.</p>
        )}
        {contactFields.map((field) => (
          <Field key={field.key} label={field.label}>
            {field.type === 'dropdown' ? (
              <Select
                value={String(contact.custom_fields[field.key] ?? '')}
                onChange={(event) =>
                  void apply((r) =>
                    updateContact(r, contact.id, {
                      custom_fields: { [field.key]: event.target.value },
                    }),
                  )
                }
              >
                <option value="">Not set</option>
                {(field.options ?? []).map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            ) : (
              <Input
                defaultValue={String(contact.custom_fields[field.key] ?? '')}
                type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                onBlur={(event) => {
                  const raw = event.target.value;
                  const next = field.type === 'number' ? Number(raw) : raw;
                  if (String(contact.custom_fields[field.key] ?? '') === raw) return;
                  void apply((r) =>
                    updateContact(r, contact.id, { custom_fields: { [field.key]: next } }),
                  );
                }}
              />
            )}
          </Field>
        ))}
      </section>

      <section aria-labelledby={`deals-${contact.id}`} className={styles.section}>
        <h3 id={`deals-${contact.id}`} className={styles.stageName}>
          Opportunities
        </h3>
        {deals.length === 0 && <p className={styles.muted}>No opportunities for this contact.</p>}
        {deals.map((deal) => (
          <div key={deal.id} className={styles.sectionRow}>
            <span className={styles.rowLabel}>{deal.name}</span>
            <span className={styles.rowValue}>
              {deal.stage} · {account.pipelines[deal.pipeline_id]?.name ?? deal.pipeline_id} ·{' '}
              {ownerName(account, deal.owner_id)}
            </span>
          </div>
        ))}
        <NewOpportunityForm run={run} contact={contact} apply={apply} />
      </section>
    </Stack>
  );
}

function NewOpportunityForm({ run, contact, apply }: ContactDetailProps) {
  const pipelines = Object.values(run.state.account.pipelines);
  const [open, setOpen] = useState(false);
  const [pipelineId, setPipelineId] = useState(pipelines[0]?.id ?? '');
  const [stage, setStage] = useState(pipelines[0]?.stages[0] ?? '');
  const [name, setName] = useState('');
  const [value, setValue] = useState('');
  const stages = run.state.account.pipelines[pipelineId]?.stages ?? [];

  if (!open) {
    return (
      <div className={styles.actions}>
        <Button size="sm" onClick={() => setOpen(true)} disabled={pipelines.length === 0}>
          New opportunity
        </Button>
      </div>
    );
  }

  return (
    <form
      className={styles.formGrid}
      onSubmit={(event) => {
        event.preventDefault();
        void apply((r) =>
          createOpportunity(r, {
            contact_id: contact.id,
            pipeline_id: pipelineId,
            stage,
            name: name.trim() || undefined,
            value: value ? Number(value) : undefined,
          }),
        ).then((ok) => {
          if (ok) {
            setOpen(false);
            setName('');
            setValue('');
          }
        });
      }}
    >
      <div className={styles.formWide}>
        <Field label="Name" hint="What this deal is called.">
          <Input value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
      </div>
      <Field label="Pipeline" required>
        <Select
          value={pipelineId}
          onChange={(event) => {
            setPipelineId(event.target.value);
            setStage(run.state.account.pipelines[event.target.value]?.stages[0] ?? '');
          }}
        >
          {pipelines.map((pipeline) => (
            <option key={pipeline.id} value={pipeline.id}>
              {pipeline.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Stage" required>
        <Select value={stage} onChange={(event) => setStage(event.target.value)}>
          {stages.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Value">
        <Input
          type="number"
          min={0}
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      </Field>
      <div className={styles.actions}>
        <Button type="submit" variant="primary" size="sm">
          Create opportunity
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/* ---- notes and tasks ---------------------------------------------------- */

function NotesPanel({ run, contact, apply }: ContactDetailProps) {
  const [body, setBody] = useState('');
  const zone = run.state.clock.timezone;
  const notes = Object.values(run.state.account.notes)
    .filter((note) => note.contact_id === contact.id)
    .sort((a, b) => b.at.localeCompare(a.at));

  return (
    <Stack gap={3}>
      <form
        className={styles.section}
        onSubmit={(event) => {
          event.preventDefault();
          if (!body.trim()) return;
          void apply((r) => addNote(r, { contact_id: contact.id }, body.trim())).then((ok) => {
            if (ok) setBody('');
          });
        }}
      >
        <Field label="New note" hint="Internal only. The contact never sees this.">
          <Textarea rows={3} value={body} onChange={(event) => setBody(event.target.value)} />
        </Field>
        <div className={styles.actions}>
          <Button type="submit" size="sm" variant="primary">
            Add note
          </Button>
        </div>
      </form>
      <ol className={styles.activity}>
        {notes.map((note) => (
          <li key={note.id} className={styles.activityRow}>
            <span className={styles.activityTime}>{simulatorTime(note.at, zone)}</span>
            <div className={styles.activityWhat}>
              <span>{ownerName(run.state.account, note.author_id)}</span>
              <p className={styles.activityBody}>{note.body}</p>
            </div>
          </li>
        ))}
        {notes.length === 0 && <li className={styles.empty}>No notes on this contact.</li>}
      </ol>
    </Stack>
  );
}

function TasksPanel({ run, contact, apply }: ContactDetailProps) {
  const account = run.state.account;
  const zone = run.state.clock.timezone;
  const [title, setTitle] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [assignee, setAssignee] = useState('');
  const tasks = Object.values(account.tasks)
    .filter((task) => task.contact_id === contact.id)
    .sort((a, b) => (a.due_at ?? '').localeCompare(b.due_at ?? ''));

  return (
    <Stack gap={3}>
      <form
        className={styles.formGrid}
        onSubmit={(event) => {
          event.preventDefault();
          if (!title.trim()) return;
          void apply((r) =>
            createTask(r, {
              contact_id: contact.id,
              title: title.trim(),
              // A date input gives a day; 09:00 on it in the *account's* zone, written with that
              // zone's offset, so no device clock is ever part of when a task is due (D-098).
              due_at: dueAt ? instantForDay(dueAt, zone) : null,
              assigned_to: assignee || null,
            }),
          ).then((ok) => {
            if (ok) {
              setTitle('');
              setDueAt('');
            }
          });
        }}
      >
        <div className={styles.formWide}>
          <Field label="New task" required>
            <Input value={title} onChange={(event) => setTitle(event.target.value)} />
          </Field>
        </div>
        <Field label="Due">
          <Input type="date" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
        </Field>
        <Field label="Assign to">
          <Select value={assignee} onChange={(event) => setAssignee(event.target.value)}>
            <option value="">Nobody</option>
            {Object.values(account.users).map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </Select>
        </Field>
        <div className={styles.actions}>
          <Button type="submit" size="sm" variant="primary">
            Add task
          </Button>
        </div>
      </form>
      <ul className={styles.activity}>
        {tasks.map((task) => (
          <li key={task.id} className={styles.sectionRow}>
            <span className={styles.rowValue}>
              {task.title}
              {task.completed && ' — done'}
            </span>
            <span className={styles.activityTime}>
              {task.due_at ? simulatorDay(task.due_at, zone) : 'No due date'} ·{' '}
              {ownerName(account, task.assigned_to)}
            </span>
            <Button
              size="sm"
              onClick={() => void apply((r) => setTaskCompleted(r, task.id, !task.completed))}
            >
              {task.completed ? 'Reopen' : 'Complete'}
            </Button>
          </li>
        ))}
        {tasks.length === 0 && <li className={styles.empty}>No tasks on this contact.</li>}
      </ul>
    </Stack>
  );
}

/**
 * The standard fields: read as rows, edited as one form, saved as one `CONTACT_UPDATED` carrying
 * only what changed. A blank email or phone clears it — the Lab does not stop a learner from
 * removing the only way to reach someone; that is a fact the account then shows plainly.
 */
function Details({ contact, apply }: Pick<ContactDetailProps, 'contact' | 'apply'>) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => detailsOf(contact));

  if (!editing) {
    return (
      <>
        <Row label="Email" value={contact.email} missing="No email" />
        <Row label="Phone" value={contact.phone} missing="No phone" />
        <Row label="Source" value={contact.source} missing="No source recorded" />
        <Row label="Timezone" value={contact.timezone} missing="Account timezone" />
        <div className={styles.actions}>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setDraft(detailsOf(contact));
              setEditing(true);
            }}
          >
            Edit details
          </Button>
        </div>
      </>
    );
  }

  const set = (key: keyof ContactDetails) => (event: { target: { value: string } }) =>
    setDraft((previous) => ({ ...previous, [key]: event.target.value }));

  return (
    <form
      className={styles.formGrid}
      aria-label="Contact details"
      onSubmit={(event) => {
        event.preventDefault();
        const changes = changedDetails(contact, draft);
        if (Object.keys(changes).length === 0) {
          setEditing(false);
          return;
        }
        void apply((r) => updateContact(r, contact.id, changes)).then((ok) => {
          if (ok) setEditing(false);
        });
      }}
    >
      <Field label="First name" required>
        <Input value={draft.first_name} onChange={set('first_name')} />
      </Field>
      <Field label="Last name">
        <Input value={draft.last_name} onChange={set('last_name')} />
      </Field>
      <Field label="Email">
        <Input type="email" value={draft.email} onChange={set('email')} />
      </Field>
      <Field label="Phone">
        <Input type="tel" value={draft.phone} onChange={set('phone')} />
      </Field>
      <Field label="Source" hint="Where this contact came from.">
        <Input value={draft.source} onChange={set('source')} />
      </Field>
      <Field
        label="Timezone"
        hint="An IANA zone such as America/Chicago. Blank uses the account's."
      >
        <Input value={draft.timezone} onChange={set('timezone')} />
      </Field>
      <div className={`${styles.actions} ${styles.formWide}`}>
        <Button type="submit" variant="primary" size="sm">
          Save details
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

interface ContactDetails {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  source: string;
  timezone: string;
}

const detailsOf = (contact: Contact): ContactDetails => ({
  first_name: contact.first_name,
  last_name: contact.last_name ?? '',
  email: contact.email ?? '',
  phone: contact.phone ?? '',
  source: contact.source ?? '',
  timezone: contact.timezone ?? '',
});

/** Only what differs from the record, with blanks as null, so the event says exactly what moved. */
function changedDetails(contact: Contact, draft: ContactDetails) {
  const changes: Partial<{
    first_name: string;
    last_name: string | null;
    email: string | null;
    phone: string | null;
    source: string | null;
    timezone: string | null;
  }> = {};
  const trimmed = Object.fromEntries(
    Object.entries(draft).map(([key, value]) => [key, value.trim()]),
  ) as ContactDetails;
  if (trimmed.first_name && trimmed.first_name !== contact.first_name) {
    changes.first_name = trimmed.first_name;
  }
  for (const key of ['last_name', 'email', 'phone', 'source', 'timezone'] as const) {
    const next = trimmed[key] || null;
    if (next !== (contact[key] ?? null)) changes[key] = next;
  }
  return changes;
}

function Row({ label, value, missing }: { label: string; value: string | null; missing: string }) {
  return (
    <div className={styles.sectionRow}>
      <span className={styles.rowLabel}>{label}</span>
      <span className={value ? styles.rowValue : styles.missing}>{value ?? missing}</span>
    </div>
  );
}
