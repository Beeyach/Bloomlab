import { useEffect, useRef, useState } from 'react';

import type { Opportunity, Pipeline } from '@bloomlab/simulator-core';
import {
  Button,
  Field,
  Input,
  Inspector,
  PipelineCard,
  Select,
  Sheet,
  Stack,
} from '@bloomlab/design-system';

import type { StoredRun } from '../simulator/store';
import { fullActivityFor } from './activity';
import {
  addNote,
  assignOpportunity,
  moveOpportunity,
  updateOpportunity,
  type CrmOutcome,
} from './commands';
import styles from './crm.module.css';
import { contactName, daysSince, describeActivity, ownerName, simulatorTime } from './words';

/**
 * The pipeline as a working board (CRM-001, CRM-004).
 *
 * Desktop puts the stages side by side. Below 1024 the board becomes its own horizontal scroller
 * with snap points, so a wide pipeline never makes the *page* scroll sideways, and at phone widths
 * one stage fills the viewport.
 *
 * **There is no drag.** A stage move is a `<Select>` on the opportunity, which works with a
 * keyboard, with a screen reader and with a thumb, and commits exactly one simulator event when
 * it changes. Drag would be an enhancement on top of this, never the only way through, so the
 * accessible path is the one that exists rather than the fallback nobody tests.
 *
 * Below 1024 a stage switcher sits above the board: it names the stage in view and jumps to any
 * other, so a learner on a phone always knows where they are without scrolling to find out.
 */

export interface PipelineBoardProps {
  run: StoredRun;
  pipeline: Pipeline;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  narrow: boolean;
  apply: (command: (run: StoredRun) => Promise<CrmOutcome>) => Promise<boolean>;
}

export function PipelineBoard({
  run,
  pipeline,
  selectedId,
  onSelect,
  narrow,
  apply,
}: PipelineBoardProps) {
  const account = run.state.account;
  const deals = Object.values(account.opportunities).filter(
    (row) => row.pipeline_id === pipeline.id,
  );
  const selected = selectedId ? (account.opportunities[selectedId] ?? null) : null;

  const detail = selected ? (
    <OpportunityDetail run={run} opportunity={selected} pipeline={pipeline} apply={apply} />
  ) : null;

  const board = useRef<HTMLOListElement>(null);
  const [inView, setInView] = useState(pipeline.stages[0] ?? '');

  // Which stage column is in view, read from the board's own scroll position. Only wired when
  // the board is a scroller (narrow), and only ever sets local UI state — nothing here is saved.
  useEffect(() => {
    const element = board.current;
    if (!element || !narrow) return;
    const update = () => {
      const columns = [...element.querySelectorAll<HTMLElement>('[data-stage]')];
      const left = element.scrollLeft;
      let best = columns[0];
      for (const column of columns) {
        if (Math.abs(column.offsetLeft - left) < Math.abs((best?.offsetLeft ?? 0) - left)) {
          best = column;
        }
      }
      const stage = best?.dataset.stage;
      if (stage) setInView(stage);
    };
    update();
    element.addEventListener('scroll', update, { passive: true });
    return () => element.removeEventListener('scroll', update);
  }, [narrow, pipeline.stages]);

  const jumpTo = (stage: string) => {
    const column = board.current?.querySelector<HTMLElement>(`[data-stage="${CSS.escape(stage)}"]`);
    column?.scrollIntoView?.({ inline: 'start', block: 'nearest' });
    setInView(stage);
  };

  return (
    <div className={styles.workspace} data-detail={selected ? 'open' : 'closed'}>
      <div className={styles.listPane}>
        {narrow && (
          <ul className={styles.stageSwitch} aria-label="Go to stage" data-stage-switch>
            {pipeline.stages.map((stage) => (
              <li key={stage}>
                <button
                  type="button"
                  className={styles.stageSwitchButton}
                  aria-current={inView === stage ? 'true' : undefined}
                  onClick={() => jumpTo(stage)}
                >
                  {stage}
                </button>
              </li>
            ))}
          </ul>
        )}
        <ol ref={board} className={styles.board} aria-label={`${pipeline.name} stages`} data-board>
          {pipeline.stages.map((stage) => {
            const inStage = deals.filter((deal) => deal.stage === stage);
            return (
              <li key={stage} className={styles.stage} data-stage={stage}>
                <div className={styles.stageHead}>
                  <h3 className={styles.stageName}>{stage}</h3>
                  <span className={styles.stageCount}>
                    {inStage.length} {inStage.length === 1 ? 'deal' : 'deals'}
                  </span>
                </div>
                <ul className={styles.stageCards}>
                  {inStage.map((deal) => (
                    <li key={deal.id}>
                      <PipelineCard
                        contactName={contactName(account, deal.contact_id)}
                        value={deal.value}
                        stage={deal.stage}
                        ageDays={daysSince(deal.updated_at, run.state.clock.now)}
                        owner={ownerName(account, deal.owner_id)}
                        selected={deal.id === selectedId}
                        aria-pressed={deal.id === selectedId}
                        data-opportunity={deal.id}
                        onClick={() => onSelect(deal.id === selectedId ? null : deal.id)}
                      />
                    </li>
                  ))}
                  {inStage.length === 0 && <li className={styles.stageEmpty}>Nothing here.</li>}
                </ul>
              </li>
            );
          })}
        </ol>
      </div>

      {!narrow && selected && (
        <div className={styles.detailPane}>
          <Inspector title={selected.name} density="high" onClose={() => onSelect(null)}>
            {detail}
          </Inspector>
        </div>
      )}
      {narrow && (
        <Sheet
          open={Boolean(selected)}
          onClose={() => onSelect(null)}
          title={selected?.name ?? 'Opportunity'}
          side="bottom"
        >
          {detail}
        </Sheet>
      )}
    </div>
  );
}

const STATUSES: Opportunity['status'][] = ['open', 'won', 'lost', 'abandoned'];

function OpportunityDetail({
  run,
  opportunity,
  pipeline,
  apply,
}: {
  run: StoredRun;
  opportunity: Opportunity;
  pipeline: Pipeline;
  apply: PipelineBoardProps['apply'];
}) {
  const account = run.state.account;
  const zone = run.state.clock.timezone;
  const [note, setNote] = useState('');
  const dealFields = Object.values(account.custom_fields).filter(
    (field) => field.object === 'opportunity',
  );

  return (
    <Stack gap={4}>
      <div className={styles.section}>
        <div className={styles.sectionRow}>
          <span className={styles.rowLabel}>Contact</span>
          <span className={styles.rowValue}>{contactName(account, opportunity.contact_id)}</span>
        </div>
        {/* The stage move: one control, one event, no drag required. */}
        <div className={styles.sectionRow}>
          <span className={styles.rowLabel}>Stage</span>
          <span className={styles.rowValue}>
            <Field label="Stage" id={`stage-${opportunity.id}`}>
              <Select
                value={opportunity.stage}
                onChange={(event) =>
                  void apply((r) => moveOpportunity(r, opportunity.id, event.target.value))
                }
              >
                {pipeline.stages.map((stage) => (
                  <option key={stage} value={stage}>
                    {stage}
                  </option>
                ))}
              </Select>
            </Field>
          </span>
        </div>
        <div className={styles.sectionRow}>
          <span className={styles.rowLabel}>Status</span>
          <span className={styles.rowValue}>
            <Field label="Status" id={`status-${opportunity.id}`}>
              <Select
                value={opportunity.status}
                onChange={(event) =>
                  void apply((r) =>
                    updateOpportunity(r, opportunity.id, {
                      status: event.target.value as Opportunity['status'],
                    }),
                  )
                }
              >
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status[0]?.toUpperCase()}
                    {status.slice(1)}
                  </option>
                ))}
              </Select>
            </Field>
          </span>
        </div>
        <div className={styles.sectionRow}>
          <span className={styles.rowLabel}>Owner</span>
          <span className={styles.rowValue}>
            <Field
              label="Opportunity owner"
              id={`owner-${opportunity.id}`}
              hint="May differ from the contact's owner."
            >
              <Select
                value={opportunity.owner_id ?? ''}
                onChange={(event) =>
                  void apply((r) =>
                    assignOpportunity(r, opportunity.id, event.target.value || null),
                  )
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
        <div className={styles.sectionRow}>
          <span className={styles.rowLabel}>Value</span>
          <span className={styles.rowValue}>
            <Field label="Value" id={`value-${opportunity.id}`}>
              <Input
                defaultValue={String(opportunity.value)}
                type="number"
                min={0}
                onBlur={(event) => {
                  const next = Number(event.target.value);
                  if (next === opportunity.value || Number.isNaN(next)) return;
                  void apply((r) => updateOpportunity(r, opportunity.id, { value: next }));
                }}
              />
            </Field>
          </span>
        </div>
      </div>

      {dealFields.length > 0 && (
        <section aria-labelledby={`odf-${opportunity.id}`} className={styles.section}>
          <h3 id={`odf-${opportunity.id}`} className={styles.stageName}>
            Opportunity fields
          </h3>
          {dealFields.map((field) => (
            <Field key={field.key} label={field.label}>
              {field.type === 'dropdown' ? (
                <Select
                  value={String(opportunity.custom_fields[field.key] ?? '')}
                  onChange={(event) =>
                    void apply((r) =>
                      updateOpportunity(r, opportunity.id, {
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
                  defaultValue={String(opportunity.custom_fields[field.key] ?? '')}
                  onBlur={(event) => {
                    if (String(opportunity.custom_fields[field.key] ?? '') === event.target.value)
                      return;
                    void apply((r) =>
                      updateOpportunity(r, opportunity.id, {
                        custom_fields: { [field.key]: event.target.value },
                      }),
                    );
                  }}
                />
              )}
            </Field>
          ))}
        </section>
      )}

      <section aria-labelledby={`oa-${opportunity.id}`} className={styles.section}>
        <h3 id={`oa-${opportunity.id}`} className={styles.stageName}>
          Activity
        </h3>
        <form
          className={styles.inlineForm}
          onSubmit={(event) => {
            event.preventDefault();
            if (!note.trim()) return;
            void apply((r) => addNote(r, { opportunity_id: opportunity.id }, note.trim())).then(
              (ok) => {
                if (ok) setNote('');
              },
            );
          }}
        >
          <div className={styles.inlineField}>
            <Field label="Note on this deal" hint="Internal only.">
              <Input value={note} onChange={(event) => setNote(event.target.value)} />
            </Field>
          </div>
          <Button type="submit" size="sm">
            Add note
          </Button>
        </form>
        <ol className={styles.activity}>
          {fullActivityFor(run.state, { opportunity_id: opportunity.id }).map((entry) => (
            <li key={entry.id} className={styles.activityRow}>
              <span className={styles.activityTime}>{simulatorTime(entry.at, zone)}</span>
              <div className={styles.activityWhat}>{describeActivity(entry, account)}</div>
            </li>
          ))}
        </ol>
      </section>
    </Stack>
  );
}
