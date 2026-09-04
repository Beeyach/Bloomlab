import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useSearchParams } from 'react-router';

import {
  Button,
  Field,
  Input,
  Select,
  Sheet,
  StatusPill,
  Stack,
  Textarea,
  ToolPanel,
} from '@bloomlab/design-system';
import {
  FUNNEL_BLOCK_ROLES,
  FUNNEL_STEP_PURPOSES,
  isReferencingRole,
  validateFunnel,
  type AccountState,
  type Funnel,
  type FunnelBlockRole,
  type FunnelStepPurpose,
} from '@bloomlab/simulator-core';

import { blankFunnel, newFunnelId, saveFunnel } from './commands';
import * as edit from './edit';
import { AutopsyLens } from './AutopsyLens';
import { FunnelPage } from './FunnelPage';
import { VisitorRun } from './VisitorRun';
import {
  canRedo,
  canUndo,
  edit as pushEdit,
  isDirty,
  markSaved,
  redo,
  startHistory,
  undo,
  type FunnelHistory,
} from './history';
import { DEFAULT_FUNNEL_SCENARIO_ID, scenarioFor, useFunnelRun } from './useFunnelRun';
import {
  BLOCK_ROLE_HELP,
  BLOCK_ROLE_LABELS,
  BLOCK_ROLE_ORIGIN,
  ISSUE_TONE,
  ORIGIN_NOTE,
  REFERENCE_NOUN,
  STEP_PURPOSE_HELP,
  STEP_PURPOSE_LABELS,
} from './words';
import {
  DEFAULT_DEVICE,
  DEFAULT_MODE,
  FUNNEL_MODES,
  PREVIEW_DEVICES,
  PREVIEW_WIDTHS,
  rememberView,
  savedView,
  type FunnelMode,
  type PreviewDevice,
} from './view';
import styles from './funnel.module.css';

/**
 * The Funnel Lab (FUN-001 … FUN-003, EXR-011).
 *
 * A conversion architecture simulator, not a page builder: steps, the blocks inside them, what
 * each block is for, and which real account entity a capture block uses. Three modes over one
 * architecture — BUILD edits it, PREVIEW draws it at three widths, SIMULATE walks a visitor
 * through it and puts real events into the shared account.
 *
 * Nothing about the funnel lives here. The definition is account state reached by an event
 * (D-119); the run is the one every Lab shares (D-108); every execution goes through the one
 * door (D-109). What this screen owns is the draft under edit, the selection, and the mode.
 */

const NARROW = '(max-width: 767px)';

function subscribeNarrow(onChange: () => void) {
  if (typeof window.matchMedia !== 'function') return () => {};
  const query = window.matchMedia(NARROW);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}
const isNarrow = () => typeof window.matchMedia === 'function' && window.matchMedia(NARROW).matches;

const MODE_LABELS: Record<FunnelMode, string> = {
  build: 'Build',
  preview: 'Preview',
  simulate: 'Simulate',
};

const DEVICE_LABELS: Record<PreviewDevice, string> = {
  desktop: 'Desktop',
  tablet: 'Tablet',
  mobile: 'Mobile',
};

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

export default function FunnelLab() {
  const [params, setParams] = useSearchParams();
  const scenarioId = scenarioFor(params.get('scenario') ?? '')
    ? (params.get('scenario') as string)
    : DEFAULT_FUNNEL_SCENARIO_ID;
  const { run, scenario, runs, loading, busy, refusal, problem, perform, reset, switchRun } =
    useFunnelRun(scenarioId);
  const narrow = useSyncExternalStore(subscribeNarrow, isNarrow, () => false);

  const funnelId = params.get('funnel');
  const stepId = params.get('step');
  const blockId = params.get('block');
  const setParam = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params);
      for (const [key, value] of Object.entries(patch)) {
        if (value === null) next.delete(key);
        else next.set(key, value);
      }
      setParams(next, { replace: true });
    },
    [params, setParams],
  );

  /** The mode and preview width, restored from this device before the first paint that uses them. */
  const [mode, setMode] = useState<FunnelMode>(DEFAULT_MODE);
  const [device, setDevice] = useState<PreviewDevice>(DEFAULT_DEVICE);
  const [viewLoaded, setViewLoaded] = useState(false);
  useEffect(() => {
    let cancelled = false;
    savedView()
      .then((view) => {
        if (cancelled) return;
        setMode(view.mode);
        setDevice(view.device);
        setViewLoaded(true);
      })
      .catch(() => setViewLoaded(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const chooseMode = useCallback((next: FunnelMode) => {
    setMode(next);
    void rememberView({ mode: next });
  }, []);
  const chooseDevice = useCallback((next: PreviewDevice) => {
    setDevice(next);
    void rememberView({ device: next });
  }, []);

  const [stored, setStored] = useState<{
    key: string;
    version: number;
    history: FunnelHistory;
  } | null>(null);
  const [sheet, setSheet] = useState<'inspector' | 'steps' | null>(null);
  const [confirmingReset, setConfirmingReset] = useState(false);
  /**
   * The Autopsy is a lens over whichever funnel is open, not a fourth mode (FUN-004, §40). BUILD,
   * PREVIEW and SIMULATE are what a learner *does* to a funnel and are remembered on the device;
   * reading its traffic is something they do beside any of the three, so it opens and closes here
   * and is not persisted.
   */
  const [autopsyOpen, setAutopsyOpen] = useState(false);

  const account = run?.state.account ?? null;
  const saved: Funnel | null = account && funnelId ? (account.funnels[funnelId] ?? null) : null;
  const savedVersion = saved?.version ?? 0;

  // No funnel chosen yet: the URL takes the first the account has. A router change, not state.
  useEffect(() => {
    if (!account || funnelId) return;
    const first = Object.values(account.funnels).sort((a, b) => a.name.localeCompare(b.name))[0];
    if (first) setParam({ funnel: first.id });
  }, [account, funnelId, setParam]);

  const history: FunnelHistory | null = useMemo(() => {
    if (!account || !funnelId) return null;
    if (
      stored &&
      stored.key === funnelId &&
      (stored.version === savedVersion || isDirty(stored.history))
    ) {
      return stored.history;
    }
    return startHistory(saved ?? blankFunnel(funnelId));
  }, [account, funnelId, saved, savedVersion, stored]);

  const draft = history?.present ?? null;

  const change = (next: Funnel) => {
    if (!history || !funnelId) return;
    setStored({ key: funnelId, version: savedVersion, history: pushEdit(history, next) });
  };

  const step = draft && stepId ? edit.findStep(draft, stepId) : null;

  // A selected step that no longer exists — removed, or the funnel changed — falls back to the
  // first step rather than leaving the editor pointing at nothing.
  useEffect(() => {
    if (!draft) return;
    if (draft.steps.length === 0) {
      if (stepId) setParam({ step: null, block: null });
      return;
    }
    if (!stepId || !edit.findStep(draft, stepId)) {
      setParam({ step: draft.steps[0]?.id ?? null, block: null });
    }
  }, [draft, stepId, setParam]);

  const problems = useMemo(
    () => (draft && account ? validateFunnel(draft, account) : []),
    [draft, account],
  );
  const errors = problems.filter((issue) => issue.severity === 'error');

  const save = async () => {
    if (!run || !scenario || !draft || !history) return;
    const result = await perform((current) => saveFunnel(current, scenario, draft));
    if (result?.ok && funnelId) {
      const accepted = result.run.state.account.funnels[draft.id] ?? draft;
      setStored({
        key: funnelId,
        version: accepted.version,
        history: markSaved({ ...history, present: draft }, draft),
      });
    }
  };

  const addFunnel = () => {
    const id = newFunnelId();
    setStored({ key: id, version: 0, history: startHistory(blankFunnel(id, 'New funnel')) });
    setParam({ funnel: id, step: null, block: null });
  };

  if (loading || !viewLoaded) {
    return (
      <div className={styles.screen}>
        <p className={styles.muted}>Opening the training account…</p>
      </div>
    );
  }

  if (!scenario || !run || !account) {
    return (
      <div className={styles.screen}>
        <h1 className={styles.title}>Funnel Lab</h1>
        <p className={styles.muted}>{problem ?? 'This scenario is not available.'}</p>
      </div>
    );
  }

  const funnels = Object.values(account.funnels).sort((a, b) => a.name.localeCompare(b.name));
  const dirty = history ? isDirty(history) : false;

  const inspector = draft && (
    <BlockInspector
      draft={draft}
      account={account}
      blockId={blockId}
      stepId={stepId}
      onChange={change}
      onSelect={(id) => setParam({ block: id })}
      onClose={() => {
        setParam({ block: null });
        setSheet(null);
      }}
    />
  );

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <h1 className={styles.title}>Funnel Lab</h1>
        <p className={styles.lead}>
          Conversion architecture for {scenario.title}. Build the steps and what is on them, preview
          the shape at three widths, then walk a visitor through it and watch the same account
          react.
        </p>
      </header>

      <div className={styles.accountBar}>
        <dl className={styles.facts}>
          <div>
            <dt>Account</dt>
            <dd>{account.account.name}</dd>
          </div>
          <div>
            <dt>Contacts</dt>
            <dd>{Object.keys(account.contacts).length}</dd>
          </div>
          <div>
            <dt>Workflows</dt>
            <dd>{Object.keys(account.workflows).length}</dd>
          </div>
          <div>
            <dt>Events</dt>
            <dd>{run.state.log.length}</dd>
          </div>
        </dl>
        <div className={styles.barActions}>
          {runs.length > 1 && (
            <Field label="Saved run">
              <Select
                value={run.state.run_id}
                onChange={(event) => void switchRun(event.target.value)}
              >
                {runs.map((row) => (
                  <option key={row.run_id} value={row.run_id}>
                    {savedAt(row.updated_at)}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Button variant="ghost" size="sm" onClick={() => setConfirmingReset(true)}>
            Reset account
          </Button>
        </div>
      </div>

      {problem && (
        <p className={styles.refusal} role="alert">
          {problem}
        </p>
      )}
      {refusal && (
        <p className={styles.refusal} role="alert" data-testid="funnel-refusal">
          {refusal.message}
        </p>
      )}

      <div className={styles.funnelBar}>
        <Field label="Funnel">
          <Select
            value={funnelId ?? ''}
            onChange={(event) => setParam({ funnel: event.target.value, step: null, block: null })}
            data-testid="funnel-picker"
          >
            {funnels.length === 0 && <option value="">No funnel yet</option>}
            {draft && !account.funnels[draft.id] && (
              <option value={draft.id}>{draft.name} (unsaved)</option>
            )}
            {funnels.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </Select>
        </Field>
        <Button variant="ghost" size="sm" onClick={addFunnel} data-testid="funnel-new">
          New funnel
        </Button>
        <div className={styles.modes} role="group" aria-label="Mode">
          {FUNNEL_MODES.map((row) => (
            <button
              key={row}
              type="button"
              className={styles.mode}
              aria-pressed={mode === row}
              onClick={() => chooseMode(row)}
              data-testid={`funnel-mode-${row}`}
            >
              {MODE_LABELS[row]}
            </button>
          ))}
        </div>
        <div className={styles.saveArea}>
          {dirty ? (
            <StatusPill label="Unsaved changes" tone="warning" glyph="dot" />
          ) : (
            <StatusPill
              label={saved ? `Saved · version ${saved.version}` : 'Not saved yet'}
              tone={saved ? 'success' : 'neutral'}
              glyph={saved ? 'check' : 'dash'}
            />
          )}
          <Button
            variant="ghost"
            size="sm"
            disabled={!history || !canUndo(history)}
            onClick={() =>
              history && funnelId
                ? setStored({ key: funnelId, version: savedVersion, history: undo(history) })
                : undefined
            }
            data-testid="funnel-undo"
          >
            Undo
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={!history || !canRedo(history)}
            onClick={() =>
              history && funnelId
                ? setStored({ key: funnelId, version: savedVersion, history: redo(history) })
                : undefined
            }
            data-testid="funnel-redo"
          >
            Redo
          </Button>
          <Button onClick={() => void save()} disabled={busy || !dirty} data-testid="funnel-save">
            Save
          </Button>
        </div>
      </div>

      {!draft ? (
        <p className={styles.muted}>
          This account has no funnel yet. Start one with <strong>New funnel</strong>.
        </p>
      ) : mode === 'build' ? (
        <div className={styles.buildLayout}>
          {narrow ? (
            <Button variant="ghost" size="sm" onClick={() => setSheet('steps')}>
              Steps ({draft.steps.length})
            </Button>
          ) : (
            <StepRail
              draft={draft}
              stepId={stepId}
              onSelect={(id) => setParam({ step: id, block: null })}
              onChange={change}
            />
          )}

          <div className={styles.buildMain}>
            <StepEditor
              draft={draft}
              step={step}
              blockId={blockId}
              onChange={change}
              onSelectBlock={(id) => {
                setParam({ block: id });
                if (narrow) setSheet('inspector');
              }}
            />
            {step && step.blocks.length > 0 && (
              <ToolPanel title="What this step looks like" density="high">
                <div className={styles.buildPreview}>
                  <p className={styles.muted}>
                    The same rendering Preview and Simulate use. The selected block is outlined.
                  </p>
                  <div className={styles.buildPreviewFrame} data-testid="funnel-build-preview">
                    <FunnelPage step={step} account={account} selectedBlockId={blockId} inert />
                  </div>
                </div>
              </ToolPanel>
            )}
            <ProblemPanel problems={problems} onGo={(id) => setParam({ step: id, block: null })} />
          </div>

          {!narrow && <div className={styles.inspectorColumn}>{inspector}</div>}
        </div>
      ) : mode === 'preview' ? (
        <PreviewMode
          draft={draft}
          account={account}
          stepId={stepId}
          device={device}
          blockId={blockId}
          onDevice={chooseDevice}
          onStep={(id) => setParam({ step: id })}
        />
      ) : (
        <div className={styles.simulateLayout}>
          {dirty && (
            <p className={styles.notice} data-testid="simulate-unsaved">
              You are walking the funnel as it is saved in the account. Save your changes to walk
              the version you are editing.
            </p>
          )}
          <VisitorRun
            funnel={saved ?? draft}
            run={run}
            scenario={scenario}
            busy={busy}
            perform={perform}
          />
        </div>
      )}

      {funnelId && (
        <section aria-labelledby="autopsy-title" className={styles.autopsyPanel}>
          <div className={styles.autopsyBar}>
            <h3 id="autopsy-title" className={styles.panelHeading}>
              Autopsy
            </h3>
            <button
              type="button"
              className={styles.autopsyToggle}
              aria-expanded={autopsyOpen}
              onClick={() => setAutopsyOpen((current) => !current)}
              data-testid="funnel-autopsy-toggle"
            >
              {autopsyOpen ? 'Close the autopsy' : 'Read the traffic'}
            </button>
          </div>
          {autopsyOpen && <AutopsyLens state={run.state} funnelId={funnelId} />}
        </section>
      )}

      {/*
        The sheets are the phone composition of the two side panels, so they exist only there.
        Rendering them at every width would put a second copy of the step list and the inspector
        in the page — the same controls twice, with the same names.
      */}
      {narrow && (
        <>
          <Sheet
            open={sheet === 'steps'}
            onClose={() => setSheet(null)}
            title="Steps"
            side="bottom"
          >
            {draft && (
              <StepRail
                draft={draft}
                stepId={stepId}
                onSelect={(id) => {
                  setParam({ step: id, block: null });
                  setSheet(null);
                }}
                onChange={change}
              />
            )}
          </Sheet>

          <Sheet
            open={sheet === 'inspector'}
            onClose={() => setSheet(null)}
            title="Block"
            side="bottom"
          >
            {inspector}
          </Sheet>
        </>
      )}

      <Sheet
        open={confirmingReset}
        onClose={() => setConfirmingReset(false)}
        title="Reset the training account?"
        side="bottom"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmingReset(false)}>
              Keep it
            </Button>
            <Button
              onClick={() => {
                setConfirmingReset(false);
                setStored(null);
                void reset();
              }}
              data-testid="funnel-reset-confirm"
            >
              Reset
            </Button>
          </>
        }
      >
        <p>
          Everything this run has done goes back to where the scenario starts: contacts, funnels,
          workflows, appointments and the whole event log. The other Labs share this account, so
          they reset with it.
        </p>
      </Sheet>

      {errors.length > 0 && mode === 'build' && (
        <p className={styles.hiddenSummary} data-testid="funnel-error-count">
          {errors.length} problem{errors.length === 1 ? '' : 's'} stop this funnel from running.
        </p>
      )}
    </div>
  );
}

/* ---- steps -------------------------------------------------------------------------------- */

function StepRail({
  draft,
  stepId,
  onSelect,
  onChange,
}: {
  draft: Funnel;
  stepId: string | null;
  onSelect: (id: string) => void;
  onChange: (next: Funnel) => void;
}) {
  const [name, setName] = useState('');
  const [purpose, setPurpose] = useState<FunnelStepPurpose>('capture');

  return (
    <ToolPanel title="Steps" density="high" className={styles.stepPanel}>
      <ol className={styles.stepList} data-testid="funnel-steps">
        {draft.steps.map((step, index) => (
          <li key={step.id} className={styles.stepRow} data-selected={step.id === stepId}>
            <button
              type="button"
              className={styles.stepButton}
              aria-current={step.id === stepId ? 'true' : undefined}
              onClick={() => onSelect(step.id)}
              data-purpose={step.purpose}
              data-testid={`funnel-step-${step.id}`}
            >
              <span className={styles.stepIndex}>{index + 1}</span>
              <span className={styles.stepName}>{step.name}</span>
              <span className={styles.stepPurpose}>{STEP_PURPOSE_LABELS[step.purpose]}</span>
              <span className={styles.stepCount}>
                {step.blocks.length} block{step.blocks.length === 1 ? '' : 's'}
              </span>
            </button>
            <div className={styles.stepMoves}>
              <Button
                variant="ghost"
                size="sm"
                disabled={index === 0}
                onClick={() => onChange(edit.moveStep(draft, step.id, index - 1))}
                data-testid={`funnel-step-up-${step.id}`}
              >
                Move up
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={index === draft.steps.length - 1}
                onClick={() => onChange(edit.moveStep(draft, step.id, index + 1))}
                data-testid={`funnel-step-down-${step.id}`}
              >
                Move down
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onChange(edit.removeStep(draft, step.id))}
                data-testid={`funnel-step-remove-${step.id}`}
              >
                Remove
              </Button>
            </div>
          </li>
        ))}
      </ol>

      <form
        className={styles.addStep}
        onSubmit={(event) => {
          event.preventDefault();
          if (!name.trim()) return;
          onChange(edit.addStep(draft, name.trim(), purpose));
          setName('');
        }}
      >
        <Field label="New step">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Consultation offer"
            data-testid="funnel-step-name"
          />
        </Field>
        <Field label="What it is for" hint={STEP_PURPOSE_HELP[purpose]}>
          <Select
            value={purpose}
            onChange={(event) => setPurpose(event.target.value as FunnelStepPurpose)}
            data-testid="funnel-step-purpose"
          >
            {FUNNEL_STEP_PURPOSES.map((row) => (
              <option key={row} value={row}>
                {STEP_PURPOSE_LABELS[row]}
              </option>
            ))}
          </Select>
        </Field>
        <Button type="submit" size="sm" data-testid="funnel-step-add">
          Add step
        </Button>
      </form>
    </ToolPanel>
  );
}

/* ---- blocks ------------------------------------------------------------------------------- */

function StepEditor({
  draft,
  step,
  blockId,
  onChange,
  onSelectBlock,
}: {
  draft: Funnel;
  step: ReturnType<typeof edit.findStep>;
  blockId: string | null;
  onChange: (next: Funnel) => void;
  onSelectBlock: (id: string) => void;
}) {
  const [role, setRole] = useState<FunnelBlockRole>('headline');

  if (!step) {
    return (
      <ToolPanel title="Step" density="high">
        <p className={styles.muted}>Add a step to start building.</p>
      </ToolPanel>
    );
  }

  return (
    <ToolPanel title={step.name} density="high" className={styles.blockPanel}>
      <div className={styles.stepSettings}>
        <Field label="Step name">
          <Input
            value={step.name}
            onChange={(event) => onChange(edit.renameStep(draft, step.id, event.target.value))}
            data-testid="funnel-step-rename"
          />
        </Field>
        <Field label="What it is for" hint={STEP_PURPOSE_HELP[step.purpose]}>
          <Select
            value={step.purpose}
            onChange={(event) =>
              onChange(edit.setStepPurpose(draft, step.id, event.target.value as FunnelStepPurpose))
            }
            data-testid="funnel-step-purpose-edit"
          >
            {FUNNEL_STEP_PURPOSES.map((row) => (
              <option key={row} value={row}>
                {STEP_PURPOSE_LABELS[row]}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Then the visitor goes to"
          hint="Where this step sends someone who finishes it."
        >
          <Select
            value={step.next_step_id ?? ''}
            onChange={(event) =>
              onChange(edit.setNextStep(draft, step.id, event.target.value || null))
            }
            data-testid="funnel-step-next"
          >
            <option value="">Nowhere — the funnel ends here</option>
            {draft.steps
              .filter((row) => row.id !== step.id)
              .map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
          </Select>
        </Field>
      </div>

      <ol className={styles.blockList} data-testid="funnel-blocks">
        {step.blocks.map((block, index) => (
          <li key={block.id} className={styles.blockRow} data-selected={block.id === blockId}>
            <button
              type="button"
              className={styles.blockButton}
              aria-current={block.id === blockId ? 'true' : undefined}
              onClick={() => onSelectBlock(block.id)}
              data-role={block.role}
              data-testid={`funnel-block-${block.id}`}
            >
              <span className={styles.blockRole}>{BLOCK_ROLE_LABELS[block.role]}</span>
              <span className={styles.blockText}>
                {block.headline ?? block.body ?? 'Nothing written yet'}
              </span>
              {isReferencingRole(block.role) && (
                <span className={styles.blockRef}>
                  {block.reference_id
                    ? `uses ${block.reference_id}`
                    : `no ${REFERENCE_NOUN[block.role]} connected`}
                </span>
              )}
            </button>
            <div className={styles.blockMoves}>
              <Button
                variant="ghost"
                size="sm"
                disabled={index === 0}
                onClick={() => onChange(edit.moveBlock(draft, block.id, index - 1))}
                data-testid={`funnel-block-up-${block.id}`}
              >
                Move up
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={index === step.blocks.length - 1}
                onClick={() => onChange(edit.moveBlock(draft, block.id, index + 1))}
                data-testid={`funnel-block-down-${block.id}`}
              >
                Move down
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onChange(edit.removeBlock(draft, block.id))}
                data-testid={`funnel-block-remove-${block.id}`}
              >
                Remove
              </Button>
            </div>
          </li>
        ))}
        {step.blocks.length === 0 && <li className={styles.muted}>Nothing on this step yet.</li>}
      </ol>

      <form
        className={styles.addBlock}
        onSubmit={(event) => {
          event.preventDefault();
          onChange(edit.addBlock(draft, step.id, role));
        }}
      >
        <Field
          label="Add a block"
          hint={`${BLOCK_ROLE_HELP[role]} ${ORIGIN_NOTE[BLOCK_ROLE_ORIGIN[role]]}`}
        >
          <Select
            value={role}
            onChange={(event) => setRole(event.target.value as FunnelBlockRole)}
            data-testid="funnel-block-role"
          >
            {FUNNEL_BLOCK_ROLES.map((row) => (
              <option key={row} value={row}>
                {BLOCK_ROLE_LABELS[row]}
              </option>
            ))}
          </Select>
        </Field>
        <Button type="submit" size="sm" data-testid="funnel-block-add">
          Add block
        </Button>
      </form>
    </ToolPanel>
  );
}

function BlockInspector({
  draft,
  account,
  blockId,
  stepId,
  onChange,
  onSelect,
  onClose,
}: {
  draft: Funnel;
  account: AccountState;
  blockId: string | null;
  stepId: string | null;
  onChange: (next: Funnel) => void;
  onSelect: (id: string | null) => void;
  onClose: () => void;
}) {
  const block = edit.findBlock(draft, blockId);
  if (!block) {
    return (
      <ToolPanel title="Block" density="high">
        <p className={styles.muted}>Pick a block to edit what it says and what it uses.</p>
      </ToolPanel>
    );
  }
  const choices = edit.referenceChoices(account, block.role);
  const origin = BLOCK_ROLE_ORIGIN[block.role];

  return (
    <ToolPanel title={BLOCK_ROLE_LABELS[block.role]} density="high" className={styles.inspector}>
      <p className={styles.originNote} data-origin={origin} data-testid="block-origin">
        {ORIGIN_NOTE[origin]}
      </p>
      <Stack gap={3}>
        <Field label="Headline" hint={BLOCK_ROLE_HELP[block.role]}>
          <Input
            value={block.headline ?? ''}
            onChange={(event) =>
              onChange(edit.editBlock(draft, block.id, { headline: event.target.value }))
            }
            data-testid="block-headline"
          />
        </Field>
        <Field label="Body">
          <Textarea
            rows={3}
            value={block.body ?? ''}
            onChange={(event) =>
              onChange(edit.editBlock(draft, block.id, { body: event.target.value }))
            }
            data-testid="block-body"
          />
        </Field>

        {isReferencingRole(block.role) && (
          <Field
            label={`Which ${REFERENCE_NOUN[block.role]}`}
            hint={
              choices.length === 0
                ? `This account has no ${REFERENCE_NOUN[block.role]} to connect to.`
                : (choices.find((row) => row.id === block.reference_id)?.detail ??
                  'Pick one from the account.')
            }
          >
            <Select
              value={block.reference_id ?? ''}
              onChange={(event) =>
                onChange(
                  edit.editBlock(draft, block.id, { reference_id: event.target.value || null }),
                )
              }
              data-testid="block-reference"
            >
              <option value="">Not connected</option>
              {choices.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </Select>
          </Field>
        )}

        {block.role === 'cta' && (
          <Field
            label="This button goes to"
            hint="Leave it on the step's own destination unless this button should branch away."
          >
            <Select
              value={block.target_step_id ?? ''}
              onChange={(event) =>
                onChange(
                  edit.editBlock(draft, block.id, { target_step_id: event.target.value || null }),
                )
              }
              data-testid="block-target"
            >
              <option value="">Wherever the step goes</option>
              {draft.steps
                .filter((row) => row.id !== stepId)
                .map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
            </Select>
          </Field>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            onSelect(null);
            onClose();
          }}
        >
          Done
        </Button>
      </Stack>
    </ToolPanel>
  );
}

function ProblemPanel({
  problems,
  onGo,
}: {
  problems: ReturnType<typeof validateFunnel>;
  onGo: (stepId: string) => void;
}) {
  return (
    <ToolPanel title="Before you simulate" density="high" className={styles.problemPanel}>
      {problems.length === 0 ? (
        <p className={styles.muted} data-testid="funnel-no-problems">
          Nothing is in the way. A visitor can walk this funnel.
        </p>
      ) : (
        <ul className={styles.problemList} data-testid="funnel-problems">
          {problems.map((issue, index) => (
            <li key={`${issue.code}-${index}`} data-severity={issue.severity}>
              <StatusPill
                label={ISSUE_TONE[issue.severity]}
                tone={issue.severity === 'error' ? 'error' : 'warning'}
                glyph={issue.severity === 'error' ? 'cross' : 'dot'}
              />
              <span>{issue.message}</span>
              {issue.step_id && (
                <Button variant="ghost" size="sm" onClick={() => onGo(issue.step_id as string)}>
                  Go to it
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </ToolPanel>
  );
}

/* ---- preview ------------------------------------------------------------------------------ */

function PreviewMode({
  draft,
  account,
  stepId,
  device,
  blockId,
  onDevice,
  onStep,
}: {
  draft: Funnel;
  account: AccountState;
  stepId: string | null;
  device: PreviewDevice;
  blockId: string | null;
  onDevice: (next: PreviewDevice) => void;
  onStep: (id: string) => void;
}) {
  const step = stepId ? edit.findStep(draft, stepId) : (draft.steps[0] ?? null);
  return (
    <div className={styles.previewLayout}>
      <div className={styles.previewBar}>
        <div className={styles.devices} role="group" aria-label="Preview width">
          {PREVIEW_DEVICES.map((row) => (
            <button
              key={row}
              type="button"
              className={styles.device}
              aria-pressed={device === row}
              onClick={() => onDevice(row)}
              data-testid={`funnel-device-${row}`}
            >
              {DEVICE_LABELS[row]}
              <span className={styles.deviceWidth}>{PREVIEW_WIDTHS[row]}px</span>
            </button>
          ))}
        </div>
        <Field label="Step">
          <Select
            value={step?.id ?? ''}
            onChange={(event) => onStep(event.target.value)}
            data-testid="funnel-preview-step"
          >
            {draft.steps.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {step ? (
        <div className={styles.previewStage}>
          <div
            className={styles.previewFrame}
            style={{ width: `${PREVIEW_WIDTHS[device]}px` }}
            data-device={device}
            data-testid="funnel-preview-frame"
          >
            <FunnelPage step={step} account={account} selectedBlockId={blockId} inert />
          </div>
        </div>
      ) : (
        <p className={styles.muted}>Add a step to preview it.</p>
      )}
    </div>
  );
}
