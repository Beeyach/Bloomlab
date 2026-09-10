import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useSearchParams } from 'react-router';

import { Button, Field, Select, Sheet, Stack, Surface, ToolPanel } from '@bloomlab/design-system';
import { validateWorkflowGraph, type Workflow } from '@bloomlab/simulator-core';

import { Canvas } from './Canvas';
import { NodeInspector, type InspectorEdits } from './NodeInspector';
import { StepList } from './StepList';
import { TestPanel } from './TestPanel';
import { Timeline, type Autoplay } from './Timeline';
import { blankWorkflow, saveWorkflow } from './commands';
import {
  canRedo,
  canUndo,
  edit,
  isDirty,
  markSaved,
  redo,
  startHistory,
  undo,
  type DraftHistory,
} from './draft';
import * as graph from './graphEdit';
import { actions, type PaletteEntry } from './palette';
import { useWorkflowRun, DEFAULT_WORKFLOW_SCENARIO_ID, scenarioFor } from './useWorkflowRun';
import { simulatorTime } from './words';
import styles from './workflow.module.css';
import { playSound } from '../moments/sound';
import { useDraftCheckpoint, workflowDraftKey } from './useDraftCheckpoint';

/**
 * The Workflow Lab (WFL-001 … WFL-012).
 *
 * One saved simulator run; the workflows in its account; a draft of the one being edited, with
 * undo and redo over the draft; a canvas (or, on a phone, a vertical step editor); a palette
 * generated from the registry; a contextual inspector; a test panel; an execution timeline that
 * replays what the engine recorded. Every change to the account is a command; every run is the
 * engine's. The workflow and the selection live in the URL so a reload comes back to them.
 */

const NARROW = '(max-width: 767px)';

function subscribeNarrow(onChange: () => void) {
  if (typeof window.matchMedia !== 'function') return () => {};
  const query = window.matchMedia(NARROW);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}
const isNarrow = () => typeof window.matchMedia === 'function' && window.matchMedia(NARROW).matches;

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

type LowerTab = 'test' | 'timeline' | 'history';

export default function WorkflowLab() {
  const [params, setParams] = useSearchParams();
  const scenarioId = scenarioFor(params.get('scenario') ?? '')
    ? (params.get('scenario') as string)
    : DEFAULT_WORKFLOW_SCENARIO_ID;
  const {
    run,
    scenario,
    runs,
    loading,
    busy,
    refusal,
    problem,
    lastTiming,
    perform,
    reset,
    switchRun,
    dismissRefusal,
  } = useWorkflowRun(scenarioId);
  const narrow = useSyncExternalStore(subscribeNarrow, isNarrow, () => false);

  const workflowId = params.get('workflow');
  const selectedId = params.get('node');
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

  /**
   * The draft under edit, kept with the workflow id and account version it belongs to. The
   * history in force is derived: the stored one while it is for this workflow and either matches
   * the account's version or carries unsaved edits; otherwise a fresh history from what the account
   * holds (or a blank definition for a workflow that is not saved yet).
   */
  const checkpointKey =
    run && workflowId ? workflowDraftKey(run.state.run_id, run.generation, workflowId) : null;
  const checkpoint = useDraftCheckpoint(checkpointKey);
  const stored = checkpoint.checkpoint;
  const setStored = checkpoint.persist;
  const [watchedId, setWatchedId] = useState<string | null>(null);
  const [autoplay, setAutoplay] = useState<Autoplay | null>(null);
  const [playhead, setPlayhead] = useState<{
    index: number | null;
    trail: string[];
    settled: boolean;
  }>({ index: null, trail: [], settled: true });
  const [lowerTab, setLowerTab] = useState<LowerTab>('test');
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [sheet, setSheet] = useState<'inspector' | 'palette' | null>(null);
  const [addTarget, setAddTarget] = useState<{
    afterId: string | null;
    branch: string | null;
  } | null>(null);

  const account = run?.state.account ?? null;
  const saved: Workflow | null =
    account && workflowId ? (account.workflows[workflowId] ?? null) : null;
  const savedVersion = saved?.version ?? 0;

  // No workflow chosen yet: the URL takes the first the account has. A router change, not state.
  useEffect(() => {
    if (!account || workflowId) return;
    const first = Object.values(account.workflows).sort((a, b) => a.name.localeCompare(b.name))[0];
    if (first) setParam({ workflow: first.id });
  }, [account, workflowId, setParam]);

  const history: DraftHistory | null = useMemo(() => {
    if (!account || !workflowId || !checkpoint.ready) return null;
    if (
      stored &&
      stored.key === checkpointKey &&
      (stored.version === savedVersion || isDirty(stored.history))
    ) {
      return stored.history;
    }
    return startHistory(saved ?? blankWorkflow(workflowId));
  }, [account, workflowId, stored, saved, savedVersion, checkpoint.ready, checkpointKey]);

  const setHistory = useCallback(
    (update: (current: DraftHistory) => DraftHistory, version: number = savedVersion) => {
      if (!checkpointKey || !history) return;
      setStored({ key: checkpointKey, version, history: update(history) });
    },
    [checkpointKey, history, savedVersion, setStored],
  );

  const draft = history?.present ?? null;
  const issues = useMemo(
    () => (draft && account ? validateWorkflowGraph(draft, account) : []),
    [draft, account],
  );
  const savedIssues = useMemo(
    () => (saved && account ? validateWorkflowGraph(saved, account) : []),
    [saved, account],
  );
  const dirty = history ? isDirty(history) : false;

  const applyEdit = useCallback(
    (next: (current: Workflow) => Workflow) =>
      setHistory((current) => edit(current, next(current.present))),
    [setHistory],
  );

  const edits: InspectorEdits = useMemo(
    () => ({
      setFeature: (id, featureId) => applyEdit((w) => graph.setNodeFeature(w, id, featureId)),
      setConfig: (id, config) => applyEdit((w) => graph.setNodeConfig(w, id, config)),
      setLabel: (id, label) => applyEdit((w) => graph.updateNode(w, id, { label })),
      connect: (from, to, branch) => {
        applyEdit((w) => graph.connect(w, from, to, branch));
        void playSound('connect');
      },
      disconnect: (from, to) => applyEdit((w) => graph.disconnect(w, from, to)),
      remove: (id) => {
        applyEdit((w) => graph.removeNode(w, id));
        setParam({ node: null });
      },
      reorder: (id, direction) => applyEdit((w) => graph.reorder(w, id, direction)),
      setTrigger: (featureId) => applyEdit((w) => graph.setTrigger(w, featureId)),
      setFilters: (filters) => applyEdit((w) => graph.setTriggerFilters(w, filters)),
      rename: (name) => applyEdit((w) => graph.rename(w, name)),
      setSettings: (patch) => applyEdit((w) => graph.setSettings(w, patch)),
    }),
    [applyEdit, setParam],
  );

  const addStep = useCallback(
    (entry: PaletteEntry, afterId: string | null, branch: string | null) => {
      applyEdit((w) => {
        const type = entry.nodeType ?? 'action';
        const { workflow: next, node } = graph.addNode(
          w,
          entry.id,
          type,
          afterId ??
            (selectedId && selectedId !== 'trigger' && selectedId !== 'settings'
              ? selectedId
              : null),
          branch,
        );
        queueMicrotask(() => setParam({ node: node.id }));
        return next;
      });
      setSheet(null);
      setAddTarget(null);
      void playSound('connect');
    },
    [applyEdit, selectedId, setParam],
  );
  const addEnd = useCallback(
    (afterId: string | null, branch: string | null) => {
      applyEdit((w) => graph.addNode(w, null, 'end', afterId, branch).workflow);
      setSheet(null);
      setAddTarget(null);
    },
    [applyEdit],
  );

  const save = useCallback(async () => {
    if (!history || !scenario) return;
    const result = await perform((current) => saveWorkflow(current, scenario, history.present));
    if (result?.ok) {
      const accepted = result.run.state.account.workflows[history.present.id];
      if (accepted)
        setHistory(
          (current) => markSaved({ ...current, present: accepted }, accepted),
          accepted.version,
        );
    }
  }, [history, scenario, perform, setHistory]);

  // Undo / redo from the keyboard, anywhere on the screen except inside a text control.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      const mod = event.metaKey || event.ctrlKey;
      if (!mod) {
        if (event.key === 'Escape') setParam({ node: null });
        if (
          (event.key === 'Delete' || event.key === 'Backspace') &&
          selectedId &&
          selectedId !== 'trigger' &&
          selectedId !== 'settings'
        ) {
          event.preventDefault();
          edits.remove(selectedId);
        }
        return;
      }
      if (event.key.toLowerCase() === 'z' && event.shiftKey) {
        event.preventDefault();
        setHistory(redo);
      } else if (event.key.toLowerCase() === 'z') {
        event.preventDefault();
        setHistory(undo);
      } else if (event.key.toLowerCase() === 'y') {
        event.preventDefault();
        setHistory(redo);
      } else if (event.key.toLowerCase() === 's') {
        event.preventDefault();
        void save();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [save, selectedId, edits, setParam, setHistory]);

  const onPlayhead = useCallback(
    (index: number | null, trail: string[], settled: boolean) =>
      setPlayhead({ index, trail, settled }),
    [],
  );
  // A test just started a run: watch it and play its recorded trace (WFL-012). The engine has
  // finished by now; only the presentation moves.
  const onRan = useCallback(
    (id: string) => {
      void playSound('execution');
      setWatchedId(id);
      setAutoplay((current) => ({ runId: id, token: (current?.token ?? 0) + 1 }));
      if (narrow) setLowerTab('timeline');
    },
    [narrow],
  );

  const draftId = draft?.id ?? null;
  const runsOfThis = useMemo(
    () =>
      account && draftId
        ? Object.values(account.workflow_runs)
            .filter((row) => row.workflow_id === draftId)
            .sort((a, b) => b.enrolled_at.localeCompare(a.enrolled_at) || b.id.localeCompare(a.id))
        : [],
    [account, draftId],
  );

  if (loading || !run || !scenario || !account || !draft || !history) {
    return (
      <Stack as="section" gap={3} className={styles.screen} aria-labelledby="workflow-title">
        <h1 id="workflow-title" className={styles.title}>
          Workflow Lab
        </h1>
        <p className={styles.lead}>
          {checkpoint.readError
            ? 'The local workflow draft could not be read. Retry before editing so saved work is not replaced.'
            : (problem ?? 'Opening the account…')}
        </p>
        {checkpoint.readError && <Button onClick={checkpoint.retryRead}>Retry draft</Button>}
      </Stack>
    );
  }

  const workflows = Object.values(account.workflows).sort((a, b) => a.name.localeCompare(b.name));
  const watched = runsOfThis.find((row) => row.id === watchedId) ?? null;
  const versions = run.state.execution.filter(
    (row) =>
      row.workflow_id === draft.id &&
      (row.reason === 'workflow_created' || row.reason === 'workflow_updated'),
  );

  const inspector =
    selectedId &&
    (selectedId === 'trigger' ||
      selectedId === 'settings' ||
      draft.nodes.some((node) => node.id === selectedId)) ? (
      <NodeInspector
        workflow={draft}
        account={account}
        selectedId={selectedId}
        issues={issues}
        edits={edits}
        onClose={() => {
          setParam({ node: null });
          setSheet(null);
        }}
      />
    ) : null;

  const palette = (
    <ToolPanel title="Add a step" density="high" data-testid="palette">
      <p className={styles.muted}>
        {addTarget?.afterId || (selectedId && selectedId !== 'trigger' && selectedId !== 'settings')
          ? 'Placed after the selected step.'
          : 'Placed at the end.'}
      </p>
      <ul className={styles.paletteList}>
        {actions().map((entry) => (
          <li
            key={entry.id}
            className={styles.paletteItem}
            data-palette={entry.id}
            data-runnable={entry.runnable}
          >
            <span className={styles.paletteName}>{entry.name}</span>
            {entry.runnable ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  addStep(entry, addTarget?.afterId ?? null, addTarget?.branch ?? null)
                }
              >
                Add
              </Button>
            ) : (
              <span className={styles.practised}>Practised in GHL</span>
            )}
            {(entry.approximation || entry.practised) && (
              <p className={styles.paletteNote}>{entry.approximation ?? entry.practised}</p>
            )}
          </li>
        ))}
        <li className={styles.paletteItem} data-palette="end">
          <span className={styles.paletteName}>End</span>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => addEnd(addTarget?.afterId ?? null, addTarget?.branch ?? null)}
          >
            Add
          </Button>
        </li>
      </ul>
    </ToolPanel>
  );

  const lower = (
    <>
      <TestPanel
        run={run}
        scenario={scenario}
        workflow={saved}
        issues={savedIssues}
        dirty={dirty || !saved}
        busy={busy}
        perform={perform}
        onRan={onRan}
      />
      <Timeline
        workflow={saved ?? draft}
        account={account}
        timezone={run.state.clock.timezone}
        runs={runsOfThis}
        watchedId={watchedId}
        onWatch={setWatchedId}
        records={run.state.execution}
        autoplay={autoplay}
        onPlayhead={onPlayhead}
      />
    </>
  );

  const historyPanel = (
    <ToolPanel title="History" density="high" data-testid="history">
      {versions.length === 0 ? (
        <p className={styles.muted}>
          Not saved yet. This workflow exists only as a draft until you save it.
        </p>
      ) : (
        <ol className={styles.history}>
          {versions.map((row) => (
            <li key={row.id}>
              <span>
                Version {String(row.data.version)} ·{' '}
                {row.reason === 'workflow_created' ? 'created' : 'updated'} ·{' '}
                {String(row.data.nodes)} steps
              </span>
              <span>{simulatorTime(row.at, run.state.clock.timezone)}</span>
            </li>
          ))}
        </ol>
      )}
      {lastTiming && (
        <p className={styles.timing} data-testid="timing">
          Last run: {lastTiming.events_added} events, {lastTiming.records_added} records,{' '}
          {Math.round(lastTiming.compute_ms)} ms compute in the{' '}
          {lastTiming.ran_in === 'worker' ? 'worker' : 'main thread'},{' '}
          {Math.round(lastTiming.round_trip_ms)} ms round trip.
        </p>
      )}
    </ToolPanel>
  );

  return (
    <Stack as="section" gap={4} className={styles.screen} aria-labelledby="workflow-title">
      <div className={styles.header}>
        <h1 id="workflow-title" className={styles.title}>
          Workflow Lab
        </h1>
        <p className={styles.lead}>
          {account.account.name}. Build a workflow, run a real contact through it, and read what the
          account did.
        </p>
      </div>

      <div className={styles.accountBar}>
        <dl className={styles.facts}>
          <div>
            <dt>Account time</dt>
            <dd>{simulatorTime(run.state.clock.now, run.state.clock.timezone)}</dd>
          </div>
          <div>
            <dt>Workflows</dt>
            <dd>{workflows.length}</dd>
          </div>
          <div>
            <dt>Runs</dt>
            <dd>{Object.keys(account.workflow_runs).length}</dd>
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
                  checkpoint.clearMemory();
                  setWatchedId(null);
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
            This scenario has {runs.length} saved accounts. The CRM Lab and this Lab always open the
            same one.
          </p>
          <Field label="Working in" id="wf-run-choice">
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

      <div className={styles.workflowBar}>
        <Field label="Workflow" id="wf-choice" className={styles.workflowChoice}>
          <Select
            value={workflows.some((row) => row.id === draft.id) ? draft.id : '__new__'}
            onChange={(event) => {
              if (event.target.value === '__new__') {
                const fresh = blankWorkflow();
                setStored({
                  key: workflowDraftKey(run.state.run_id, run.generation, fresh.id),
                  version: 0,
                  history: startHistory(fresh),
                });
                setWatchedId(null);
                setParam({ workflow: fresh.id, node: 'trigger' });
              } else {
                setWatchedId(null);
                setParam({ workflow: event.target.value, node: null });
              }
            }}
          >
            {workflows.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name} · v{row.version}
              </option>
            ))}
            <option value="__new__">
              {workflows.some((row) => row.id === draft.id)
                ? 'New workflow…'
                : `${draft.name} (unsaved)`}
            </option>
          </Select>
        </Field>
        <div className={styles.toolbar} role="toolbar" aria-label="Editing">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setHistory(undo)}
            disabled={!canUndo(history)}
            data-testid="undo"
          >
            Undo
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setHistory(redo)}
            disabled={!canRedo(history)}
            data-testid="redo"
          >
            Redo
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setParam({ node: 'settings' })}>
            Settings
          </Button>
          {narrow && (
            <Button size="sm" variant="secondary" onClick={() => setSheet('palette')}>
              Add step
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => void save()}
            disabled={!dirty || busy}
            data-testid="save"
          >
            {saved ? 'Save changes' : 'Save workflow'}
          </Button>
          {dirty && <span className={styles.dirty}>Unsaved draft</span>}
        </div>
      </div>

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
      {checkpoint.writeError && (
        <Surface padding="md" role="alert">
          <p>
            The draft is still open, but could not be saved on this device. Keep this page open and
            retry.
          </p>
          <Button onClick={checkpoint.retryWrite}>Retry draft save</Button>
        </Surface>
      )}
      {problem && (
        <Surface tone="snow" padding="md" className={styles.refusal} role="alert">
          <p className={styles.refusalTitle}>That could not be saved.</p>
          <p className={styles.refusalBody}>{problem}</p>
        </Surface>
      )}

      {narrow ? (
        <>
          <StepList
            workflow={draft}
            account={account}
            selectedId={selectedId}
            onSelect={(id) => {
              setParam({ node: id });
              setSheet('inspector');
            }}
            onAddAfter={(afterId, branch) => {
              setAddTarget({ afterId, branch });
              setSheet('palette');
            }}
            watched={watched}
            records={run.state.execution}
            playhead={playhead.index}
            trail={playhead.trail}
            settled={playhead.settled}
          />
          <div role="tablist" aria-label="Test, timeline and history" className={styles.tabs}>
            {(['test', 'timeline', 'history'] as LowerTab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={lowerTab === tab}
                className={styles.tab}
                onClick={() => setLowerTab(tab)}
              >
                {tab === 'test' ? 'Test' : tab === 'timeline' ? 'Timeline' : 'History'}
              </button>
            ))}
          </div>
          {lowerTab === 'test' && (
            <TestPanel
              run={run}
              scenario={scenario}
              workflow={saved}
              issues={savedIssues}
              dirty={dirty || !saved}
              busy={busy}
              perform={perform}
              onRan={onRan}
            />
          )}
          {lowerTab === 'timeline' && (
            <Timeline
              workflow={saved ?? draft}
              account={account}
              timezone={run.state.clock.timezone}
              runs={runsOfThis}
              watchedId={watchedId}
              onWatch={setWatchedId}
              records={run.state.execution}
              autoplay={autoplay}
              onPlayhead={onPlayhead}
            />
          )}
          {lowerTab === 'history' && historyPanel}
          <Sheet
            open={sheet === 'inspector' && inspector !== null}
            onClose={() => setSheet(null)}
            title="Step"
            side="bottom"
          >
            {inspector}
          </Sheet>
          <Sheet
            open={sheet === 'palette'}
            onClose={() => setSheet(null)}
            title="Add a step"
            side="bottom"
          >
            {palette}
          </Sheet>
        </>
      ) : (
        <>
          <div className={styles.workspace}>
            <div className={styles.canvasColumn}>
              <Canvas
                workflow={draft}
                account={account}
                selectedId={selectedId}
                onSelect={(id) => setParam({ node: id })}
                onMove={(id, x, y) => {
                  applyEdit((w) => graph.moveNode(w, id, x, y));
                  void playSound('snap');
                }}
                watched={watched}
                records={run.state.execution}
                playhead={playhead.index}
                trail={playhead.trail}
                settled={playhead.settled}
              />
              <p className={styles.canvasHint}>
                Drag a step to move it, or select it and use the arrow keys. Connections and order
                are set in the inspector.
              </p>
            </div>
            <div className={styles.sideColumn}>
              {inspector ?? palette}
              {inspector && palette}
            </div>
          </div>
          <div className={styles.lower}>{lower}</div>
          {historyPanel}
        </>
      )}
    </Stack>
  );
}
