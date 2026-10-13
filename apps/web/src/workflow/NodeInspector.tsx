import { memo } from 'react';

import {
  Button,
  Field,
  Input,
  Inspector,
  InspectorSection,
  Select,
  Textarea,
} from '@bloomlab/design-system';
import {
  CONDITION_FIELDS,
  CONDITION_OPERATORS,
  WAIT_KINDS,
  actionCapabilityFor,
  customFieldConditionFields,
  type AccountState,
  type Condition,
  type ConditionGroup,
  type GraphIssue,
  type Workflow,
  type WorkflowNode,
  type WorkflowTriggerFilter,
} from '@bloomlab/simulator-core';

import { branchNames, incoming, outgoing } from './graphEdit';
import {
  actions,
  type configFields,
  paletteEntry,
  savedNodeEntry,
  referenceFor,
  referenceOptions,
  triggerFilters,
  triggers,
} from './palette';
import { operatorWords } from './words';
import styles from './workflow.module.css';

/**
 * The contextual inspector (WFL-005, WFL-011).
 *
 * Every setting lives here, never on the canvas. The form for a step is generated from the
 * registry record's `config_fields` — a template field is a textarea with merge fields, a select
 * has the registry's options, a reference draws its options from the account — so a registry
 * addition appears here without a code change. Waits and If/Else have structured editors because
 * their configs are structured data (WFL-008, WFL-009). Conditions are field, operator, value:
 * there is nothing here that could be typed as an expression.
 */

export interface InspectorEdits {
  setFeature: (id: string, featureId: string) => void;
  setConfig: (id: string, config: Record<string, unknown>) => void;
  setLabel: (id: string, label: string | null) => void;
  connect: (from: string, to: string, branch: string | null) => void;
  disconnect: (from: string, to: string) => void;
  remove: (id: string) => void;
  reorder: (id: string, direction: 'up' | 'down') => void;
  setTrigger: (featureId: string) => void;
  setFilters: (filters: WorkflowTriggerFilter[]) => void;
  rename: (name: string) => void;
  setSettings: (patch: Partial<Workflow['settings']>) => void;
}

export interface NodeInspectorProps {
  workflow: Workflow;
  account: AccountState;
  /** `trigger`, `settings`, or a node id. */
  selectedId: string;
  issues: GraphIssue[];
  edits: InspectorEdits;
  onClose: () => void;
}

const text = (value: unknown): string =>
  typeof value === 'string' ? value : value === undefined || value === null ? '' : String(value);

function NodeInspectorInner({
  workflow,
  account,
  selectedId,
  issues,
  edits,
  onClose,
}: NodeInspectorProps) {
  if (selectedId === 'trigger') {
    return (
      <Inspector title="Trigger" onClose={onClose} density="high" data-testid="inspector">
        <TriggerEditor
          workflow={workflow}
          account={account}
          edits={edits}
          issues={issues.filter((issue) => issue.node_id === null)}
        />
      </Inspector>
    );
  }
  if (selectedId === 'settings') {
    return (
      <Inspector title="Workflow settings" onClose={onClose} density="high" data-testid="inspector">
        <SettingsEditor
          workflow={workflow}
          edits={edits}
          issues={issues.filter((issue) => issue.node_id === null)}
        />
      </Inspector>
    );
  }
  const node = workflow.nodes.find((row) => row.id === selectedId);
  if (!node) return null;
  const entry = savedNodeEntry(node);
  return (
    <Inspector
      title={node.type === 'end' ? 'End' : (entry?.name ?? 'Step')}
      onClose={onClose}
      density="high"
      data-testid="inspector"
    >
      <StepEditor
        workflow={workflow}
        account={account}
        node={node}
        edits={edits}
        issues={issues.filter((issue) => issue.node_id === node.id)}
      />
    </Inspector>
  );
}

/* ---- trigger ----------------------------------------------------------------------------- */

function TriggerEditor({
  workflow,
  account,
  edits,
  issues,
}: {
  workflow: Workflow;
  account: AccountState;
  edits: InspectorEdits;
  issues: GraphIssue[];
}) {
  const entry = paletteEntry(workflow.trigger.ghl_feature_id);
  const filters = triggerFilters(workflow.trigger.ghl_feature_id);
  const current = workflow.trigger.filters;
  return (
    <div className={styles.formGrid}>
      <Field
        label="What starts this workflow"
        hint={entry?.approximation ?? entry?.practised ?? undefined}
        id="trigger-feature"
      >
        <Select
          value={workflow.trigger.ghl_feature_id}
          onChange={(event) => edits.setTrigger(event.target.value)}
        >
          <option value="">Choose a trigger</option>
          {triggers().map((option) => (
            <option key={option.id} value={option.id} disabled={!option.runnable}>
              {option.name}
              {option.runnable ? '' : ' (practised in GHL)'}
            </option>
          ))}
        </Select>
      </Field>
      <Problems issues={issues} />
      {filters.length > 0 && (
        <InspectorSection title="Filters">
          <div className={styles.formGrid}>
            {current.map((filter, index) => {
              const field = filters.find((row) => row.key === filter.field);
              const options = field?.reference ? referenceOptions(field.reference, account) : [];
              return (
                <div key={`${filter.field}-${index}`} className={styles.conditionRow}>
                  <Field label="Filter" id={`filter-${index}-field`}>
                    <Select
                      value={filter.field}
                      onChange={(event) =>
                        edits.setFilters(
                          current.map((row, at) =>
                            at === index ? { ...row, field: event.target.value } : row,
                          ),
                        )
                      }
                    >
                      {filters.map((row) => (
                        <option key={row.key} value={row.key}>
                          {row.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Comparison" id={`filter-${index}-op`}>
                    <Select
                      value={filter.operator}
                      onChange={(event) =>
                        edits.setFilters(
                          current.map((row, at) =>
                            at === index
                              ? {
                                  ...row,
                                  operator: event.target.value as WorkflowTriggerFilter['operator'],
                                }
                              : row,
                          ),
                        )
                      }
                    >
                      {CONDITION_OPERATORS.map((operator) => (
                        <option key={operator} value={operator}>
                          {operatorWords(operator)}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Value" id={`filter-${index}-value`}>
                    {options.length > 0 ? (
                      <Select
                        value={text(filter.value)}
                        onChange={(event) =>
                          edits.setFilters(
                            current.map((row, at) =>
                              at === index ? { ...row, value: event.target.value } : row,
                            ),
                          )
                        }
                      >
                        <option value="">Choose</option>
                        {options.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <Input
                        value={text(filter.value)}
                        onChange={(event) =>
                          edits.setFilters(
                            current.map((row, at) =>
                              at === index ? { ...row, value: event.target.value } : row,
                            ),
                          )
                        }
                      />
                    )}
                  </Field>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => edits.setFilters(current.filter((_, at) => at !== index))}
                  >
                    Remove
                  </Button>
                </div>
              );
            })}
            <div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  edits.setFilters([
                    ...current,
                    { field: filters[0]?.key ?? '', operator: 'is', value: '' },
                  ])
                }
              >
                Add filter
              </Button>
            </div>
          </div>
        </InspectorSection>
      )}
    </div>
  );
}

/* ---- settings ---------------------------------------------------------------------------- */

function SettingsEditor({
  workflow,
  edits,
  issues,
}: {
  workflow: Workflow;
  edits: InspectorEdits;
  issues: GraphIssue[];
}) {
  const hours = workflow.settings.time_window;
  return (
    <div className={styles.formGrid}>
      <Field label="Name" id="wf-name">
        <Input value={workflow.name} onChange={(event) => edits.rename(event.target.value)} />
      </Field>
      <label className={styles.checkbox}>
        <input
          type="checkbox"
          checked={workflow.settings.allow_reentry}
          onChange={(event) => edits.setSettings({ allow_reentry: event.target.checked })}
        />
        <span>Allow Re-Entry — a contact already in this workflow may enter it again</span>
      </label>
      <Field
        label="Timezone"
        hint="The zone waits and the time window are read in. Blank uses the account's."
        id="wf-tz"
      >
        <Input
          value={workflow.settings.timezone ?? ''}
          placeholder="America/Chicago"
          onChange={(event) => edits.setSettings({ timezone: event.target.value.trim() || null })}
        />
      </Field>
      <InspectorSection title="Time Window">
        <div className={styles.formGrid}>
          <label className={styles.checkbox}>
            <input
              type="checkbox"
              checked={hours !== null}
              onChange={(event) =>
                edits.setSettings({
                  time_window: event.target.checked
                    ? { days: [1, 2, 3, 4, 5], start: '09:00', end: '17:00' }
                    : null,
                })
              }
            />
            <span>Only send messages inside a window; hold the rest until it opens</span>
          </label>
          {hours && (
            <>
              <div className={styles.row} role="group" aria-label="Days">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, index) => {
                  const iso = index + 1;
                  const on = hours.days.includes(iso);
                  return (
                    <label key={day} className={styles.checkbox}>
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() =>
                          edits.setSettings({
                            time_window: {
                              ...hours,
                              days: on
                                ? hours.days.filter((d) => d !== iso)
                                : [...hours.days, iso].sort((a, b) => a - b),
                            },
                          })
                        }
                      />
                      <span>{day}</span>
                    </label>
                  );
                })}
              </div>
              <div className={styles.row}>
                <Field label="From" id="tw-start">
                  <Input
                    type="time"
                    value={hours.start}
                    onChange={(event) =>
                      edits.setSettings({ time_window: { ...hours, start: event.target.value } })
                    }
                  />
                </Field>
                <Field label="To" id="tw-end">
                  <Input
                    type="time"
                    value={hours.end}
                    onChange={(event) =>
                      edits.setSettings({ time_window: { ...hours, end: event.target.value } })
                    }
                  />
                </Field>
              </div>
            </>
          )}
        </div>
      </InspectorSection>
      <Problems issues={issues} />
    </div>
  );
}

/* ---- a step ------------------------------------------------------------------------------ */

function StepEditor({
  workflow,
  account,
  node,
  edits,
  issues,
}: {
  workflow: Workflow;
  account: AccountState;
  node: WorkflowNode;
  edits: InspectorEdits;
  issues: GraphIssue[];
}) {
  const entry = savedNodeEntry(node);
  const capability = actionCapabilityFor(node.ghl_feature_id);
  const problems = capability ? capability.validate(node.config, account) : [];
  const setConfig = (patch: Record<string, unknown>) =>
    edits.setConfig(node.id, { ...node.config, ...patch });
  const before = incoming(workflow, node.id);
  const after = outgoing(workflow, node.id);
  const others = workflow.nodes.filter((row) => row.id !== node.id);

  return (
    <div className={styles.formGrid}>
      {node.type !== 'end' && (
        <Field
          label="Action"
          hint={entry?.approximation ?? entry?.practised ?? undefined}
          id={`${node.id}-feature`}
        >
          <Select
            value={node.ghl_feature_id ?? ''}
            onChange={(event) => edits.setFeature(node.id, event.target.value)}
          >
            <option value="">Choose an action</option>
            {node.ghl_feature_id === 'GHL-WF-WEBHOOK' && (
              <option value="GHL-WF-WEBHOOK">Saved webhook (legacy simulation)</option>
            )}
            {actions().map((option) =>
              option.id === 'GHL-WF-WEBHOOK' && node.ghl_feature_id === option.id ? null : (
                <option key={option.id} value={option.id} disabled={!option.runnable}>
                  {option.name}
                  {option.runnable ? '' : ' (practised in GHL)'}
                </option>
              ),
            )}
          </Select>
        </Field>
      )}
      {entry && !entry.runnable && (
        <p className={styles.practised} role="note">
          {entry.name} is not simulated: {entry.practised} A test contact cannot pass through this
          step.
        </p>
      )}

      {node.type === 'wait' && <WaitEditor node={node} account={account} setConfig={setConfig} />}
      {node.type === 'branch' && (
        <BranchEditor node={node} account={account} setConfig={setConfig} />
      )}
      {node.type === 'action' && entry?.runnable && (
        <InspectorSection title="Settings">
          <div className={styles.formGrid}>
            {entry.feature.supported_configs.config_fields.map((field) => (
              <ConfigField
                key={field.name}
                node={node}
                field={field}
                account={account}
                setConfig={setConfig}
              />
            ))}
            {(node.ghl_feature_id === 'GHL-WF-SEND-SMS' ||
              node.ghl_feature_id === 'GHL-WF-SEND-EMAIL') && (
              <Field
                label="Purpose (Bloomlab only)"
                hint="A grading tag such as confirmation or reminder_24h. Not a GoHighLevel setting."
                id={`${node.id}-purpose`}
              >
                <Input
                  value={text(node.config.purpose)}
                  onChange={(event) =>
                    setConfig({ purpose: event.target.value.trim() || undefined })
                  }
                />
              </Field>
            )}
          </div>
        </InspectorSection>
      )}

      {(problems.length > 0 || issues.length > 0) && (
        <Problems
          issues={[
            ...issues,
            ...problems.map((message) => ({
              code: 'INVALID_CONFIG' as const,
              node_id: node.id,
              message,
            })),
          ]}
        />
      )}

      <InspectorSection title="Connections">
        <div className={styles.formGrid}>
          {before.length === 0 && (
            <p className={styles.muted}>
              Nothing leads here yet
              {workflow.nodes[0]?.id === node.id ? ' — this is the first step' : ''}.
            </p>
          )}
          {before.map((edge) => (
            <p key={`${edge.from}-${edge.to}`} className={styles.muted}>
              From {nameOf(workflow, edge.from)}
              {edge.branch ? ` (${edge.branch})` : ''}
            </p>
          ))}
          {node.type !== 'end' &&
            (node.type === 'branch' ? branchNames(node) : ['']).map((branch) => {
              const current = after.find(
                (edge) =>
                  (edge.branch ?? '').toLowerCase() === branch.toLowerCase() ||
                  (!branch && !edge.branch),
              );
              return (
                <Field
                  key={branch || 'next'}
                  label={branch ? `Branch "${branch}" goes to` : 'Then'}
                  id={`${node.id}-next-${branch || 'next'}`}
                >
                  <Select
                    value={current?.to ?? ''}
                    onChange={(event) => {
                      if (event.target.value === '') {
                        if (current) edits.disconnect(node.id, current.to);
                      } else {
                        edits.connect(node.id, event.target.value, branch || null);
                      }
                    }}
                  >
                    <option value="">Nothing (the run ends)</option>
                    {others.map((row) => (
                      <option key={row.id} value={row.id}>
                        {nameOf(workflow, row.id)}
                      </option>
                    ))}
                  </Select>
                </Field>
              );
            })}
          <div className={styles.actions}>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => edits.reorder(node.id, 'up')}
              disabled={before.length !== 1}
            >
              Move up
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => edits.reorder(node.id, 'down')}
              disabled={after.length !== 1}
            >
              Move down
            </Button>
            <Button size="sm" variant="danger" onClick={() => edits.remove(node.id)}>
              Remove step
            </Button>
          </div>
        </div>
      </InspectorSection>
    </div>
  );
}

const nameOf = (workflow: Workflow, id: string): string => {
  const node = workflow.nodes.find((row) => row.id === id);
  if (!node) return id;
  const entry = savedNodeEntry(node);
  return `${node.type === 'end' ? 'End' : (entry?.name ?? 'Step')} (${node.id})`;
};

/* ---- registry-described fields ------------------------------------------------------------ */

type RegistryField = ReturnType<typeof configFields>[number];

function ConfigField({
  node,
  field,
  account,
  setConfig,
}: {
  node: WorkflowNode;
  field: RegistryField;
  account: AccountState;
  setConfig: (patch: Record<string, unknown>) => void;
}) {
  const id = `${node.id}-${field.name}`;
  const value = node.config[field.name];
  const label = field.name.replace(/_/g, ' ');
  const reference = field.type === 'reference' ? referenceFor(field.name) : null;
  const options = reference
    ? referenceOptions(reference, account, { pipeline: text(node.config.pipeline) || null })
    : (field.options ?? []).map((option) => ({
        value: option.toLowerCase() === option ? option : optionValue(field.name, option),
        label: option,
      }));

  if (field.type === 'boolean') {
    return (
      <label className={styles.checkbox}>
        <input
          type="checkbox"
          checked={value === true}
          onChange={(event) => setConfig({ [field.name]: event.target.checked })}
        />
        <span>{field.description ?? label}</span>
      </label>
    );
  }
  if (field.type === 'template') {
    return (
      <Field
        label={label}
        hint={
          field.description ??
          'Merge fields such as {{contact.first_name}} are filled from the contact.'
        }
        required={field.required}
        id={id}
      >
        <Textarea
          rows={3}
          value={text(value)}
          onChange={(event) => setConfig({ [field.name]: event.target.value })}
        />
      </Field>
    );
  }
  if (field.type === 'json' && (field.name === 'custom_data' || field.name === 'headers')) {
    return (
      <Field
        label={field.name === 'headers' ? 'Headers' : 'Custom data'}
        hint="One key=value per line; values may use merge fields."
        id={id}
      >
        <Textarea
          rows={3}
          value={Object.entries((value as Record<string, unknown>) ?? {})
            .map(([key, entry]) => `${key}=${String(entry)}`)
            .join('\n')}
          onChange={(event) =>
            setConfig({
              [field.name]: Object.fromEntries(
                event.target.value
                  .split('\n')
                  .map((line) => line.split('='))
                  .filter((parts) => parts[0]?.trim())
                  .map(([key, ...rest]) => [key!.trim(), rest.join('=').trim()]),
              ),
            })
          }
        />
      </Field>
    );
  }
  if (options.length > 0 || field.type === 'select') {
    const multiple = field.name === 'users';
    if (multiple) {
      const chosen = Array.isArray(value) ? (value as string[]) : [];
      return (
        <Field label={label} hint={field.description} required={field.required} id={id}>
          <div className={styles.formGrid} role="group" aria-label={label}>
            {options.map((option) => (
              <label key={option.value} className={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={chosen.includes(option.value)}
                  onChange={(event) =>
                    setConfig({
                      [field.name]: event.target.checked
                        ? [...chosen, option.value]
                        : chosen.filter((row) => row !== option.value),
                    })
                  }
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </Field>
      );
    }
    return (
      <Field label={label} hint={field.description} required={field.required} id={id}>
        <Select
          value={text(value)}
          onChange={(event) => setConfig({ [field.name]: event.target.value || undefined })}
        >
          <option value="">Choose</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </Field>
    );
  }
  return (
    <Field label={label} hint={field.description} required={field.required} id={id}>
      <Input
        type={field.type === 'number' || field.type === 'duration' ? 'number' : 'text'}
        value={text(value)}
        onChange={(event) =>
          setConfig({
            [field.name]:
              field.type === 'number' || field.type === 'duration'
                ? event.target.value === ''
                  ? undefined
                  : Number(event.target.value)
                : event.target.value,
          })
        }
      />
    </Field>
  );
}

/** Registry option labels are display words; the engine reads lower-case values. */
const optionValue = (fieldName: string, option: string): string =>
  fieldName === 'method' ? option.toUpperCase() : option.toLowerCase();

/* ---- waits ------------------------------------------------------------------------------- */

function WaitEditor({
  node,
  account,
  setConfig,
}: {
  node: WorkflowNode;
  account: AccountState;
  setConfig: (patch: Record<string, unknown>) => void;
}) {
  const c = node.config;
  const kind = text(c.wait_type);
  const numberField = (key: string, label: string) => (
    <Field label={label} id={`${node.id}-${key}`} key={key}>
      <Input
        type="number"
        min={0}
        value={text(c[key])}
        onChange={(event) =>
          setConfig({ [key]: event.target.value === '' ? undefined : Number(event.target.value) })
        }
      />
    </Field>
  );
  return (
    <InspectorSection title="Wait for">
      <div className={styles.formGrid}>
        <Field label="Wait type" id={`${node.id}-wait-type`}>
          <Select value={kind} onChange={(event) => setConfig({ wait_type: event.target.value })}>
            {WAIT_KINDS.map((option) => (
              <option key={option} value={option}>
                {WAIT_WORDS[option]}
              </option>
            ))}
          </Select>
        </Field>
        {kind === 'period' && (
          <div className={styles.row}>
            {[
              numberField('days', 'Days'),
              numberField('hours', 'Hours'),
              numberField('minutes', 'Minutes'),
            ]}
          </div>
        )}
        {kind === 'date' && (
          <Field
            label="Until"
            hint="An instant with an offset, e.g. 2026-09-10T09:00:00-05:00"
            id={`${node.id}-at`}
          >
            <Input value={text(c.at)} onChange={(event) => setConfig({ at: event.target.value })} />
          </Field>
        )}
        {kind === 'appointment' && (
          <>
            <Field label="Relative to the appointment" id={`${node.id}-relative`}>
              <Select
                value={text(c.relative) || 'at'}
                onChange={(event) => setConfig({ relative: event.target.value })}
              >
                <option value="before">Before</option>
                <option value="at">At the appointment time</option>
                <option value="after">After</option>
              </Select>
            </Field>
            {text(c.relative) && c.relative !== 'at' && (
              <div className={styles.row}>
                {[numberField('hours', 'Hours'), numberField('minutes', 'Minutes')]}
              </div>
            )}
          </>
        )}
        {kind === 'reply' && (
          <Field label="Channel" id={`${node.id}-channel`}>
            <Select
              value={text(c.channel) || 'any'}
              onChange={(event) => setConfig({ channel: event.target.value })}
            >
              <option value="any">Any</option>
              <option value="sms">SMS</option>
              <option value="email">Email</option>
            </Select>
          </Field>
        )}
        {kind === 'condition' && (
          <GroupsEditor
            groups={readGroups(c.groups)}
            account={account}
            onChange={(groups) => setConfig({ groups })}
            label="Continue when"
          />
        )}
        {(kind === 'reply' || kind === 'condition') &&
          numberField('timeout_hours', 'Give up after (hours)')}
      </div>
    </InspectorSection>
  );
}

const WAIT_WORDS: Record<(typeof WAIT_KINDS)[number], string> = {
  period: 'A set period of time',
  date: 'A specific date and time',
  appointment: 'An upcoming appointment or booking',
  reply: 'The contact to reply',
  condition: 'Specific conditions to be met',
};

/* ---- If/Else ----------------------------------------------------------------------------- */

interface RawBranch {
  name: string;
  groups: ConditionGroup[];
}

const readGroups = (raw: unknown): ConditionGroup[] =>
  Array.isArray(raw)
    ? raw.map((group) => ({
        conditions: Array.isArray((group as { conditions?: unknown }).conditions)
          ? ((group as { conditions: Condition[] }).conditions ?? []).map((condition) => ({
              field: text(condition.field),
              operator: (condition.operator ?? 'is') as Condition['operator'],
              ...(condition.value !== undefined ? { value: condition.value } : {}),
            }))
          : [],
      }))
    : [];

const readBranches = (raw: unknown): RawBranch[] =>
  Array.isArray(raw)
    ? raw.map((branch) => ({
        name: text((branch as { name?: unknown }).name),
        groups: readGroups((branch as { groups?: unknown }).groups),
      }))
    : [];

function BranchEditor({
  node,
  account,
  setConfig,
}: {
  node: WorkflowNode;
  account: AccountState;
  setConfig: (patch: Record<string, unknown>) => void;
}) {
  const branches = readBranches(node.config.branches);
  const write = (next: RawBranch[]) => setConfig({ branches: next });
  return (
    <InspectorSection title="Branches">
      <div className={styles.formGrid}>
        <p className={styles.muted}>
          Checked top to bottom; the first that matches wins. None is taken when nothing matches.
        </p>
        {branches.map((branch, index) => (
          <div key={index} className={styles.branchBox}>
            <div className={styles.row}>
              <Field
                label={`Branch ${index + 1} name`}
                id={`${node.id}-branch-${index}`}
                className={styles.workflowChoice}
              >
                <Input
                  value={branch.name}
                  onChange={(event) =>
                    write(
                      branches.map((row, at) =>
                        at === index ? { ...row, name: event.target.value } : row,
                      ),
                    )
                  }
                />
              </Field>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => write(branches.filter((_, at) => at !== index))}
              >
                Remove branch
              </Button>
            </div>
            <GroupsEditor
              groups={branch.groups}
              account={account}
              onChange={(groups) =>
                write(branches.map((row, at) => (at === index ? { ...row, groups } : row)))
              }
              label="Matches when"
            />
          </div>
        ))}
        <div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              write([
                ...branches,
                {
                  name: `Branch ${branches.length + 1}`,
                  groups: [
                    { conditions: [{ field: 'contact.tags', operator: 'contains', value: '' }] },
                  ],
                },
              ])
            }
          >
            Add branch
          </Button>
        </div>
      </div>
    </InspectorSection>
  );
}

function GroupsEditor({
  groups,
  account,
  onChange,
  label,
}: {
  groups: ConditionGroup[];
  account: AccountState;
  onChange: (groups: ConditionGroup[]) => void;
  label: string;
}) {
  const fields = [...CONDITION_FIELDS, ...customFieldConditionFields({ account })];
  const update = (groupAt: number, conditions: Condition[]) =>
    onChange(groups.map((group, at) => (at === groupAt ? { conditions } : group)));
  return (
    <div className={styles.formGrid}>
      <p className={styles.small}>{label}</p>
      {groups.map((group, groupAt) => (
        <div key={groupAt} className={styles.groupBox}>
          {groupAt > 0 && <p className={styles.small}>or</p>}
          {group.conditions.map((condition, at) => {
            const needsValue = !['exists', 'not_exists'].includes(condition.operator);
            const listField = fields.find((row) => row.field === condition.field);
            const options =
              condition.field === 'contact.tags'
                ? referenceOptions('tags', account)
                : condition.field === 'appointment.status'
                  ? referenceOptions('statuses', account)
                  : condition.field === 'opportunity.stage'
                    ? referenceOptions('stages', account)
                    : [];
            return (
              <div key={at} className={styles.conditionRow}>
                <Field label="Field" id={`cond-${groupAt}-${at}-field`}>
                  <Select
                    value={condition.field}
                    onChange={(event) =>
                      update(
                        groupAt,
                        group.conditions.map((row, i) =>
                          i === at ? { ...row, field: event.target.value } : row,
                        ),
                      )
                    }
                  >
                    {fields.map((row) => (
                      <option key={row.field} value={row.field}>
                        {row.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Comparison" id={`cond-${groupAt}-${at}-op`}>
                  <Select
                    value={condition.operator}
                    onChange={(event) =>
                      update(
                        groupAt,
                        group.conditions.map((row, i) =>
                          i === at
                            ? { ...row, operator: event.target.value as Condition['operator'] }
                            : row,
                        ),
                      )
                    }
                  >
                    {CONDITION_OPERATORS.map((operator) => (
                      <option key={operator} value={operator}>
                        {operatorWords(operator)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Value" id={`cond-${groupAt}-${at}-value`}>
                  {!needsValue ? (
                    <Input value="" disabled aria-label="No value needed" />
                  ) : options.length > 0 ? (
                    <Select
                      value={text(condition.value)}
                      onChange={(event) =>
                        update(
                          groupAt,
                          group.conditions.map((row, i) =>
                            i === at ? { ...row, value: event.target.value } : row,
                          ),
                        )
                      }
                    >
                      <option value="">Choose</option>
                      {options.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <Input
                      type={listField?.kind === 'number' ? 'number' : 'text'}
                      value={text(condition.value)}
                      onChange={(event) =>
                        update(
                          groupAt,
                          group.conditions.map((row, i) =>
                            i === at
                              ? {
                                  ...row,
                                  value:
                                    listField?.kind === 'number' && event.target.value !== ''
                                      ? Number(event.target.value)
                                      : event.target.value,
                                }
                              : row,
                          ),
                        )
                      }
                    />
                  )}
                </Field>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    update(
                      groupAt,
                      group.conditions.filter((_, i) => i !== at),
                    )
                  }
                  aria-label="Remove condition"
                >
                  Remove
                </Button>
              </div>
            );
          })}
          <div className={styles.actions}>
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                update(groupAt, [
                  ...group.conditions,
                  { field: 'contact.tags', operator: 'contains', value: '' },
                ])
              }
            >
              And…
            </Button>
            {groups.length > 1 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onChange(groups.filter((_, at) => at !== groupAt))}
              >
                Remove group
              </Button>
            )}
          </div>
        </div>
      ))}
      <div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() =>
            onChange([
              ...groups,
              { conditions: [{ field: 'contact.source', operator: 'is', value: '' }] },
            ])
          }
        >
          Or…
        </Button>
      </div>
    </div>
  );
}

function Problems({ issues }: { issues: GraphIssue[] }) {
  if (issues.length === 0) return null;
  return (
    <ul className={styles.problems} aria-label="Problems" data-testid="problems">
      {issues.map((issue, at) => (
        <li key={`${issue.code}-${at}`}>{issue.message}</li>
      ))}
    </ul>
  );
}

/** Memoised: playback ticks re-render only what they change (PERF-002). */
export const NodeInspector = memo(NodeInspectorInner);
