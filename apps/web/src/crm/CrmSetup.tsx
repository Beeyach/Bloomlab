import { useState } from 'react';

import type { CustomFieldType } from '@bloomlab/simulator-core';
import { Button, Field, Input, Select, Textarea } from '@bloomlab/design-system';

import { NATIVE_LABELS } from '../content/featureNames';
import type { StoredRun } from '../simulator/store';
import { createPipeline, defineField, updatePipeline, type CrmOutcome } from './commands';
import styles from './crm.module.css';

/**
 * Setup: the definitions everything else is checked against (CRM-001).
 *
 * Fields and pipelines are edited here rather than inline on a record, because they are account
 * structure — changing them changes what every record can hold. That is also why the stage editor
 * asks where departing deals go rather than fixing it quietly (D-093).
 *
 * Nothing on this screen judges the learner's modelling. Defining a field, or not defining one and
 * using tags instead, are both allowed: CRM-003 is explicit that a poor-but-possible choice must
 * be possible, and that its cost shows up later rather than as a warning here.
 */

const TYPES: CustomFieldType[] = [
  'text',
  'number',
  'date',
  'checkbox',
  'dropdown',
  'phone',
  'email',
];

export interface CrmSetupProps {
  run: StoredRun;
  apply: (command: (run: StoredRun) => Promise<CrmOutcome>) => Promise<boolean>;
}

export function CrmSetup({ run, apply }: CrmSetupProps) {
  const account = run.state.account;
  return (
    <div className={styles.setupGrid}>
      <section aria-labelledby="crm-fields" className={styles.section}>
        <h2 id="crm-fields" className={styles.stageName}>
          {NATIVE_LABELS.customFields}
        </h2>
        <p className={styles.muted}>
          A field holds a value that can change. A tag records that something happened. Both are
          available, and which one fits is the decision.
        </p>
        <div>
          {Object.values(account.custom_fields).map((field) => (
            <div key={field.key} className={styles.definitionRow}>
              <span>{field.label}</span>
              <span className={styles.stageCount}>
                {field.type} · {field.object}
              </span>
              <span className={styles.definitionMeta}>
                {field.key}
                {field.options ? ` · ${field.options.join(', ')}` : ''}
              </span>
            </div>
          ))}
          {Object.keys(account.custom_fields).length === 0 && (
            <p className={styles.empty}>No custom fields yet.</p>
          )}
        </div>
        <NewFieldForm run={run} apply={apply} />
      </section>

      <section aria-labelledby="crm-pipelines" className={styles.section}>
        <h2 id="crm-pipelines" className={styles.stageName}>
          Pipelines
        </h2>
        {Object.values(account.pipelines).map((pipeline) => (
          <StageEditor key={pipeline.id} run={run} pipelineId={pipeline.id} apply={apply} />
        ))}
        <NewPipelineForm run={run} apply={apply} />
      </section>
    </div>
  );
}

function NewFieldForm({ apply }: CrmSetupProps) {
  const [key, setKey] = useState('');
  const [label, setLabel] = useState('');
  const [type, setType] = useState<CustomFieldType>('text');
  const [object, setObject] = useState<'contact' | 'opportunity'>('contact');
  const [options, setOptions] = useState('');

  return (
    <form
      className={styles.formGrid}
      onSubmit={(event) => {
        event.preventDefault();
        void apply((r) =>
          defineField(r, {
            key: key.trim(),
            label: label.trim(),
            type,
            object,
            options:
              type === 'dropdown'
                ? options
                    .split(',')
                    .map((option) => option.trim())
                    .filter(Boolean)
                : undefined,
          }),
        ).then((ok) => {
          if (ok) {
            setKey('');
            setLabel('');
            setOptions('');
          }
        });
      }}
    >
      <Field label="Label" required hint="What the team sees on the record.">
        <Input value={label} onChange={(event) => setLabel(event.target.value)} />
      </Field>
      <Field label="Key" required hint="Lower case, letters, digits and underscores.">
        <Input value={key} onChange={(event) => setKey(event.target.value)} />
      </Field>
      <Field label="Type" required>
        <Select value={type} onChange={(event) => setType(event.target.value as CustomFieldType)}>
          {TYPES.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Belongs to" required hint="Fixed once values exist.">
        <Select
          value={object}
          onChange={(event) => setObject(event.target.value as 'contact' | 'opportunity')}
        >
          <option value="contact">Contact</option>
          <option value="opportunity">Opportunity</option>
        </Select>
      </Field>
      {type === 'dropdown' && (
        <div className={styles.formWide}>
          <Field label="Options" required hint="Separated by commas.">
            <Input value={options} onChange={(event) => setOptions(event.target.value)} />
          </Field>
        </div>
      )}
      <div className={styles.actions}>
        <Button type="submit" variant="primary" size="sm">
          Define field
        </Button>
      </div>
    </form>
  );
}

/**
 * The stage editor.
 *
 * Stages are edited as a list because that is how the engine judges them: whether a change strands
 * deals depends on the whole new list, not on which button was pressed. When a stage holding deals
 * is about to leave, the form asks where they go and passes that as the migration — so a rename is
 * a deliberate instruction rather than something inferred from two lists of the same length.
 */
function StageEditor({ run, pipelineId, apply }: CrmSetupProps & { pipelineId: string }) {
  const pipeline = run.state.account.pipelines[pipelineId];
  const [draft, setDraft] = useState(pipeline?.stages.join('\n') ?? '');
  const [migrations, setMigrations] = useState<Record<string, string>>({});
  if (!pipeline) return null;

  const next = draft
    .split('\n')
    .map((stage) => stage.trim())
    .filter(Boolean);
  const held = new Set(
    Object.values(run.state.account.opportunities)
      .filter((deal) => deal.pipeline_id === pipeline.id)
      .map((deal) => deal.stage),
  );
  const leaving = pipeline.stages.filter((stage) => !next.includes(stage) && held.has(stage));

  return (
    <div className={styles.section}>
      <h3 className={styles.stageName}>{pipeline.name}</h3>
      <Field
        label={`Stages in ${pipeline.name}`}
        hint="One per line, in order. Reordering moves nothing."
      >
        <Textarea
          rows={Math.max(3, next.length + 1)}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
      </Field>
      {leaving.map((stage) => (
        <Field
          key={stage}
          label={`Move deals out of "${stage}" to`}
          required
          hint="This stage holds deals, so they need somewhere to go."
        >
          <Select
            value={migrations[stage] ?? ''}
            onChange={(event) =>
              setMigrations((previous) => ({ ...previous, [stage]: event.target.value }))
            }
          >
            <option value="">Choose a stage</option>
            {next.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </Field>
      ))}
      <div className={styles.actions}>
        <Button
          size="sm"
          onClick={() =>
            void apply((r) =>
              updatePipeline(r, pipeline.id, {
                stages: next,
                migrate: Object.fromEntries(
                  leaving
                    .filter((stage) => migrations[stage])
                    .map((stage) => [stage, migrations[stage] as string]),
                ),
              }),
            )
          }
        >
          Save stages
        </Button>
      </div>
    </div>
  );
}

function NewPipelineForm({ apply }: CrmSetupProps) {
  const [name, setName] = useState('');
  const [stages, setStages] = useState('');

  return (
    <form
      className={styles.formGrid}
      onSubmit={(event) => {
        event.preventDefault();
        void apply((r) =>
          createPipeline(r, {
            name: name.trim(),
            stages: stages
              .split(',')
              .map((stage) => stage.trim())
              .filter(Boolean),
          }),
        ).then((ok) => {
          if (ok) {
            setName('');
            setStages('');
          }
        });
      }}
    >
      <Field label="New pipeline" required>
        <Input value={name} onChange={(event) => setName(event.target.value)} />
      </Field>
      <Field label="Stages" required hint="Separated by commas, in order.">
        <Input value={stages} onChange={(event) => setStages(event.target.value)} />
      </Field>
      <div className={styles.actions}>
        <Button type="submit" variant="primary" size="sm">
          Create pipeline
        </Button>
      </div>
    </form>
  );
}
