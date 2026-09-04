import { useCallback, useEffect, useRef, useState } from 'react';

import type { SimulatorScenario } from '@bloomlab/simulator-core';

import { content } from '../content/bundle';
import { currentRunId, rememberRun, savedRuns, type RunSummary } from '../simulator/currentRun';
import { loadRun, startRun, type StoredRun } from '../simulator/store';
import { resetWorkflowRun } from './commands';
import type { EngineRefusal, ExecutionResult, ExecutionTiming } from './execution';

/**
 * The Workflow Lab's run (D-096, D-108, D-109).
 *
 * One saved simulator run of the chosen scenario, resumed rather than restarted, chosen by the
 * same rule the CRM Lab uses so both Labs opened on one scenario are in the same account. Every
 * change goes through `perform`, which adopts an execution result: a success replaces the run, a
 * refusal or a crash keeps the run as it was and surfaces the reason.
 */

export const DEFAULT_WORKFLOW_SCENARIO_ID = 'SC-glowhaus-no-show';

export interface WorkflowRunState {
  run: StoredRun | null;
  scenario: SimulatorScenario | null;
  runs: RunSummary[];
  loading: boolean;
  busy: boolean;
  refusal: EngineRefusal | null;
  problem: string | null;
  /** How the last execution went, for the responsiveness readout (SIM-014). */
  lastTiming: ExecutionTiming | null;
}

export interface WorkflowRunApi extends WorkflowRunState {
  perform: (
    command: (current: StoredRun) => Promise<ExecutionResult>,
  ) => Promise<ExecutionResult | null>;
  reset: () => Promise<void>;
  switchRun: (runId: string) => Promise<void>;
  dismissRefusal: () => void;
}

export const scenarioFor = (id: string): SimulatorScenario | null =>
  (content.scenarios as unknown as SimulatorScenario[]).find((row) => row.id === id) ?? null;

export function useWorkflowRun(scenarioId: string = DEFAULT_WORKFLOW_SCENARIO_ID): WorkflowRunApi {
  const [run, setRun] = useState<StoredRun | null>(null);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<EngineRefusal | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [lastTiming, setLastTiming] = useState<ExecutionTiming | null>(null);
  const opening = useRef<string | null>(null);
  const scenario = scenarioFor(scenarioId);

  useEffect(() => {
    if (!scenario || opening.current === scenario.id) return;
    opening.current = scenario.id;
    let cancelled = false;
    setLoading(true);
    setRun(null);
    (async () => {
      const saved = await savedRuns(scenario.id);
      const currentId = await currentRunId(scenario.id);
      const resumed = currentId ? await loadRun(currentId) : null;
      const next = resumed ?? (await startRun(scenario));
      if (cancelled) return;
      setRuns(
        saved.length > 0
          ? saved
          : [{ run_id: next.state.run_id, updated_at: next.state.clock.now }],
      );
      setRun(next);
      setLoading(false);
    })().catch((error: unknown) => {
      if (cancelled) return;
      setProblem(error instanceof Error ? error.message : 'The account could not be opened.');
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [scenario]);

  const perform = useCallback(
    async (command: (current: StoredRun) => Promise<ExecutionResult>) => {
      if (!run || busy) return null;
      setProblem(null);
      setBusy(true);
      try {
        const result = await command(run);
        if (result.ok) {
          setRefusal(null);
          setRun(result.run);
          setLastTiming(result.timing);
        } else {
          setRefusal(result.refusal);
          setRun(result.run);
        }
        return result;
      } catch (error) {
        setProblem(error instanceof Error ? error.message : 'That could not be saved.');
        return null;
      } finally {
        setBusy(false);
      }
    },
    [run, busy],
  );

  const reset = useCallback(async () => {
    if (!run || !scenario) return;
    setProblem(null);
    setRefusal(null);
    try {
      setRun(await resetWorkflowRun(scenario, run.state.run_id));
    } catch (error) {
      setProblem(error instanceof Error ? error.message : 'The account could not be reset.');
    }
  }, [run, scenario]);

  const switchRun = useCallback(
    async (runId: string) => {
      if (!scenario) return;
      const loaded = await loadRun(runId);
      if (loaded) {
        await rememberRun(scenario.id, runId);
        setRun(loaded);
        setRefusal(null);
      }
    },
    [scenario],
  );

  return {
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
    dismissRefusal: () => setRefusal(null),
  };
}
