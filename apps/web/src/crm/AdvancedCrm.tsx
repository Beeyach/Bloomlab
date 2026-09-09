import { useState, type ReactNode } from 'react';
import { advancedCrm, segmentContacts, type SimulatorEventType } from '@bloomlab/simulator-core';
import { Button, Field, Input, Select } from '@bloomlab/design-system';
import { runCommand } from './commands';
import type { CrmSetupProps } from './CrmSetup';
import styles from './crm.module.css';

type Props = CrmSetupProps & { area: 'companies' | 'objects' | 'lists' };
const text = (data: FormData, key: string) => String(data.get(key) ?? '').trim();
const typed = (value: string, type: string) =>
  type === 'number'
    ? value === ''
      ? NaN
      : Number(value)
    : type === 'boolean'
      ? value === 'true'
        ? true
        : value === 'false'
          ? false
          : value
      : value;
export function Entry({
  label,
  name,
  value = '',
  type = 'text',
}: {
  label: string;
  name: string;
  value?: string;
  type?: string;
}) {
  return (
    <Field label={label}>
      <Input name={name} defaultValue={value} type={type} required />
    </Field>
  );
}
export function Choice({
  label,
  name,
  options,
}: {
  label: string;
  name: string;
  options: { id: string; name: string }[];
}) {
  return (
    <Field label={label}>
      <Select name={name} required>
        <option value="">Choose…</option>
        {options.map((row) => (
          <option key={row.id} value={row.id}>
            {row.name}
          </option>
        ))}
      </Select>
    </Field>
  );
}
export function SaveForm({
  title,
  type,
  apply,
  payload,
  children,
}: Pick<CrmSetupProps, 'apply'> & {
  title: string;
  type: SimulatorEventType;
  payload: (data: FormData) => Record<string, unknown>;
  children: ReactNode;
}) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  return (
    <form
      data-operation={type}
      className={styles.advancedForm}
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        setSaving(true);
        setSaved(false);
        void apply((run) => runCommand(run, { type, payload: payload(data) }))
          .then(setSaved)
          .finally(() => setSaving(false));
      }}
    >
      <h3>{title}</h3>
      {children}
      <Button type="submit" disabled={saving}>
        {saving ? 'Saving…' : title}
      </Button>
      <p role="status">{saved ? 'Saved in this training account.' : ''}</p>
    </form>
  );
}

export function AdvancedCrm({ run, apply, area }: Props) {
  const account = run.state.account;
  const data = advancedCrm(account);
  const contacts = Object.values(account.contacts).map((row) => ({
    id: row.id,
    name: `${row.first_name} ${row.last_name ?? ''}`.trim(),
  }));
  const [schemaId, setSchemaId] = useState('');
  const schema = data.schemas[schemaId];
  const [fields, setFields] = useState([0]);
  const [rules, setRules] = useState([0]);
  if (area === 'companies')
    return (
      <section className={styles.advanced} aria-label="Companies">
        <h2>Companies and their contacts</h2>
        <p>
          A company groups the people at an organisation. Renaming it does not duplicate those
          people. These are training records, not a live HighLevel account.
        </p>
        {Object.values(account.companies).map((company) => (
          <section key={company.id}>
            <h3>{company.name}</h3>
            <p>{company.id}</p>
            <ul>
              {contacts
                .filter((contact) => account.contacts[contact.id]?.company_id === company.id)
                .map((contact) => (
                  <li key={contact.id}>{contact.name}</li>
                ))}
            </ul>
            <p>
              {
                contacts.filter(
                  (contact) => account.contacts[contact.id]?.company_id === company.id,
                ).length
              }{' '}
              associated contacts
            </p>
          </section>
        ))}
        {!Object.keys(account.companies).length && (
          <p>No companies yet. Create one, then associate an existing contact.</p>
        )}
        <SaveForm
          title="Save company"
          type="COMPANY_SAVED"
          apply={apply}
          payload={(d) => ({ id: text(d, 'id'), name: text(d, 'name') })}
        >
          <Entry label="Company identifier (reuse to rename)" name="id" />
          <Entry label="Company name" name="name" />
        </SaveForm>
        <SaveForm
          title="Link contact to company"
          type="COMPANY_CONTACT_LINKED"
          apply={apply}
          payload={(d) => ({
            id: text(d, 'contact'),
            company_id: text(d, 'company') === 'unlink' ? null : text(d, 'company'),
          })}
        >
          <Choice label="Contact" name="contact" options={contacts} />
          <Choice
            label="Company"
            name="company"
            options={[
              { id: 'unlink', name: 'No company — unlink' },
              ...Object.values(account.companies),
            ]}
          />
        </SaveForm>
      </section>
    );
  if (area === 'lists')
    return (
      <section className={styles.advanced} aria-label="Smart lists">
        <h2>Smart lists</h2>
        <p>
          Save rules, not a frozen audience. Membership below is recomputed from this account after
          contact, tag, field, company or opportunity changes. Saving a list never sends a message.
        </p>
        {Object.values(data.lists).map((list) => {
          const members = segmentContacts(account, list);
          return (
            <section key={list.id}>
              <h3>
                {list.name} · {members.length} of {contacts.length} contacts
              </h3>
              <p>
                {list.id} · Match {list.match}
              </p>
              <ul>
                {list.rules.map((rule, i) => (
                  <li key={i}>
                    {rule.field} {rule.operator} {String(rule.value)}
                  </li>
                ))}
              </ul>
              <ul>
                {members.map((row) => (
                  <li key={row.id}>
                    {row.first_name} {row.last_name}
                  </li>
                ))}
              </ul>
              {!members.length && <p>No contacts match these rules.</p>}
            </section>
          );
        })}
        {!Object.keys(data.lists).length && <p>No saved segments yet.</p>}
        <SaveForm
          title="Save smart list"
          type="SMART_LIST_SAVED"
          apply={apply}
          payload={(d) => ({
            id: text(d, 'id'),
            name: text(d, 'name'),
            match: text(d, 'match'),
            rules: rules.map((i) => ({
              field: text(d, `field-${i}`),
              operator: text(d, `operator-${i}`),
              value: typed(text(d, `value-${i}`), text(d, `type-${i}`)),
            })),
          })}
        >
          <Entry label="List identifier (reuse to replace rules)" name="id" />
          <Entry label="List name" name="name" />
          <Choice
            label="Match"
            name="match"
            options={[
              { id: 'all', name: 'All rules (AND)' },
              { id: 'any', name: 'Any rule (OR)' },
            ]}
          />
          {rules.map((i) => (
            <fieldset key={i}>
              <legend>Rule {i + 1}</legend>
              <Choice
                label="Field"
                name={`field-${i}`}
                options={[
                  ...[
                    'first_name',
                    'last_name',
                    'email',
                    'phone',
                    'source',
                    'tags',
                    'dnd',
                    'company_id',
                    'opportunity_status',
                  ],
                  ...Object.values(account.custom_fields)
                    .filter((f) => f.object === 'contact')
                    .map((f) => `custom_fields.${f.key}`),
                ].map((id) => ({ id, name: id.replaceAll('_', ' ') }))}
              />
              <Choice
                label="Operator"
                name={`operator-${i}`}
                options={['is', 'contains', 'empty', 'greater'].map((id) => ({ id, name: id }))}
              />
              <Choice
                label="Value type"
                name={`type-${i}`}
                options={['text', 'number', 'boolean'].map((id) => ({ id, name: id }))}
              />
              <Field label="Value (blank for empty; true or false for boolean)">
                <Input name={`value-${i}`} />
              </Field>
            </fieldset>
          ))}
          <Button
            type="button"
            variant="ghost"
            disabled={rules.length >= 20}
            onClick={() => setRules((rows) => [...rows, rows.length])}
          >
            Add rule
          </Button>
        </SaveForm>
        <p>
          This simulation supports one AND or OR group, not HighLevel’s nested groups, sharing or
          every channel-specific DND filter. Use the contact’s global DND flag here.
        </p>
      </section>
    );
  return (
    <section className={styles.advanced} aria-label="Custom objects">
      <h2>Custom objects</h2>
      <p>
        Use an object for repeated things with their own lifecycle, such as multiple properties per
        owner. A second “lead” object usually duplicates Contacts and loses native contact features.
        A tag, field or smart list is often enough.
      </p>
      <p>
        The Lab models text, number and boolean fields, labelled many-to-many record-to-contact
        associations, and a narrow object-created/updated → internal-notification automation. No
        external delivery, contact enrollment, bulk email, uniqueness rules or complete HighLevel
        object-workflow builder is implied.
      </p>
      <SaveForm
        title="Save object schema"
        type="OBJECT_SCHEMA_SAVED"
        apply={apply}
        payload={(d) => ({
          id: text(d, 'id'),
          name: text(d, 'name'),
          fields: fields.map((i) => ({
            key: text(d, `key-${i}`),
            type: text(d, `type-${i}`),
            required: text(d, `required-${i}`) === 'true',
          })),
        })}
      >
        <Entry label="Object identifier (reuse to edit schema)" name="id" />
        <Entry label="Object name" name="name" />
        {fields.map((i) => (
          <fieldset key={i}>
            <legend>Field {i + 1}</legend>
            <Entry label="Field key" name={`key-${i}`} />
            <Choice
              label="Field type"
              name={`type-${i}`}
              options={['text', 'number', 'boolean'].map((id) => ({ id, name: id }))}
            />
            <Choice
              label="Required"
              name={`required-${i}`}
              options={[
                { id: 'true', name: 'Yes' },
                { id: 'false', name: 'No' },
              ]}
            />
          </fieldset>
        ))}
        <Button
          type="button"
          variant="ghost"
          disabled={fields.length >= 30}
          onClick={() => setFields((rows) => [...rows, rows.length])}
        >
          Add field
        </Button>
      </SaveForm>
      <Field label="Object to work on">
        <Select
          data-testid="object-picker"
          value={schemaId}
          onChange={(event) => setSchemaId(event.target.value)}
        >
          <option value="">Choose an object…</option>
          {Object.values(data.schemas).map((row) => (
            <option key={row.id} value={row.id}>
              {row.name}
            </option>
          ))}
        </Select>
      </Field>
      {!Object.keys(data.schemas).length && <p>No object schemas yet.</p>}
      {schema && (
        <>
          <h3>{schema.name}</h3>
          <ul>
            {schema.fields.map((field) => (
              <li key={field.key}>
                {field.key} · {field.type} · {field.required ? 'required' : 'optional'}
              </li>
            ))}
          </ul>
          {Object.values(data.records)
            .filter((row) => row.schema_id === schema.id)
            .map((row) => (
              <section key={row.id}>
                <h3>{row.name}</h3>
                <p>
                  {row.id} · Updated at simulated time {row.updated_at}
                </p>
                <dl>
                  {Object.entries(row.values).map(([key, value]) => (
                    <div key={key}>
                      <dt>{key}</dt>
                      <dd>{String(value)}</dd>
                    </div>
                  ))}
                </dl>
                <ul>
                  {Object.values(data.associations)
                    .filter((a) => a.record_id === row.id)
                    .map((a) => (
                      <li key={a.id}>
                        {a.label}: {contacts.find((c) => c.id === a.contact_id)?.name}
                      </li>
                    ))}
                </ul>
              </section>
            ))}
          {!Object.values(data.records).some((row) => row.schema_id === schema.id) && (
            <p>No records for this object yet.</p>
          )}
          <SaveForm
            key={schema.id}
            title="Save object record"
            type="OBJECT_RECORD_SAVED"
            apply={apply}
            payload={(d) => ({
              id: text(d, 'id'),
              schema_id: schema.id,
              name: text(d, 'name'),
              values: Object.fromEntries(
                schema.fields
                  .filter((f) => f.required || text(d, `value-${f.key}`) !== '')
                  .map((f) => [f.key, typed(text(d, `value-${f.key}`), f.type)]),
              ),
            })}
          >
            <Entry label="Record identifier (reuse to update)" name="id" />
            <Entry label="Record name" name="name" />
            {schema.fields.map((f) => (
              <Field key={f.key} label={`${f.key} (${f.type})`}>
                {f.type === 'boolean' ? (
                  <Select name={`value-${f.key}`} required={f.required}>
                    <option value="">Not set</option>
                    <option value="true">True</option>
                    <option value="false">False</option>
                  </Select>
                ) : (
                  <Input
                    name={`value-${f.key}`}
                    type={f.type === 'number' ? 'number' : 'text'}
                    step="any"
                    required={f.required}
                  />
                )}
              </Field>
            ))}
          </SaveForm>
          <SaveForm
            title="Save association"
            type="OBJECT_ASSOCIATION_SAVED"
            apply={apply}
            payload={(d) => ({
              id: text(d, 'id'),
              record_id: text(d, 'record'),
              contact_id: text(d, 'contact'),
              label: text(d, 'label'),
            })}
          >
            <Entry label="Association identifier (reuse to relink)" name="id" />
            <Choice
              label="Object record"
              name="record"
              options={Object.values(data.records).filter((r) => r.schema_id === schema.id)}
            />
            <Choice label="Associated contact" name="contact" options={contacts} />
            <Entry label="Association label" name="label" />
          </SaveForm>
          <SaveForm
            title="Save object automation"
            type="OBJECT_AUTOMATION_SAVED"
            apply={apply}
            payload={(d) => {
              const field = schema.fields.find((f) => f.key === text(d, 'field'));
              return {
                id: text(d, 'id'),
                schema_id: schema.id,
                on: text(d, 'on'),
                field: text(d, 'field'),
                equals: typed(text(d, 'equals'), field?.type ?? 'text'),
                recipient: text(d, 'recipient'),
                message: text(d, 'message'),
                enabled: text(d, 'enabled') === 'true',
              };
            }}
          >
            <Entry label="Automation identifier (reuse to edit)" name="id" />
            <Choice
              label="Record event"
              name="on"
              options={[
                { id: 'created', name: 'Created' },
                { id: 'updated', name: 'Updated' },
              ]}
            />
            <Choice
              label="Condition field"
              name="field"
              options={schema.fields.map((f) => ({ id: f.key, name: `${f.key} (${f.type})` }))}
            />
            <Entry label="Equals (true or false for boolean)" name="equals" />
            <Choice
              label="Notify account user"
              name="recipient"
              options={Object.values(account.users)}
            />
            <Entry label="Internal notification message" name="message" />
            <Choice
              label="Automation enabled"
              name="enabled"
              options={[
                { id: 'true', name: 'Enabled' },
                { id: 'false', name: 'Disabled' },
              ]}
            />
          </SaveForm>
          <ul>
            {Object.values(data.automations)
              .filter((r) => r.schema_id === schema.id)
              .map((r) => (
                <li key={r.id}>
                  {r.id}: {r.on}, {r.field} is {String(r.equals)} → notify{' '}
                  {account.users[r.recipient]?.name} · {r.enabled ? 'enabled' : 'disabled'}
                </li>
              ))}
          </ul>
          <h3>Object automation log</h3>
          <ul>
            {run.state.log
              .filter(
                (e) =>
                  e.type === 'NOTIFICATION_SENT' &&
                  typeof e.payload.object_automation_id === 'string',
              )
              .map((e) => (
                <li key={e.id}>
                  {e.at}: {String(e.payload.message)} · recorded, not delivered
                </li>
              ))}
          </ul>
        </>
      )}
    </section>
  );
}
