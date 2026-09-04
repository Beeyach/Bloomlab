import { useCallback, useEffect, useRef, useState } from 'react';

import type { SimulatorScenario } from '@bloomlab/simulator-core';

import { content } from '../content/bundle';
import { currentRunId, rememberRun, savedRuns, type RunSummary } from '../simulator/currentRun';
import { loadRun, resetStoredRun, startRun, type StoredRun } from '../simulator/store';
import type { EngineRefusal, ExecutionResult } from '../workflow/execution';
import { runWindow } from './window';

/**
 * The Reporting Lab's run (D-108, D-144).
 *
 * The same rule every other Lab follows, and deliberately the same shape as `useFunnelRun` and
 * `useCalendarRun`: one saved simulator run of the chosen scenario, resumed rather than
 * restarted, chosen by `currentRunId`. There is no reporting account, no reporting clock and no
 * analytics store — the Reporting Lab reads whatever run the CRM Lab, the Workflow Lab, the
 * Funnel Lab and the Calendar Lab are working in.
 *
 * The one action it adds is running the window: moving the clock to the end of the history the
 * scenario queued, through the same execution door every other Lab commits through.
 */

export const DEFAULT_REPORTING_SCENARIO_ID = 'SC-glowhaus-reporting';

export interface ReportingRunApi {
  run: StoredRun | null;
  scenario: SimulatorScenario | null;
  runs: RunSummary[];
  loading: boolean;
  busy: boolean;
  refusal: EngineRefusal | null;
  problem: string | null;
  advance: () => Promise<ExecutionResult | null>;
  reset: () => Promise<void>;
  switchRun: (runId: string) => Promise<void>;
}

export const scenarioFor = (id: string): SimulatorScenario | null =>
  (content.scenarios as unknown as SimulatorScenario[]).find((row) => row.id === id) ?? null;

export function useReportingRun(
  scenarioId: string = DEFAULT_REPORTING_SCENARIO_ID,
): ReportingRunApi {
  const [run, setRun] = useState<StoredRun | null>(null);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<EngineRefusal | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
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
      const chosen = await currentRunId(scenario.id);
      const resumed = chosen ? await loadRun(chosen) : null;
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

  const advance = useCallback(async () => {
    if (!run || !scenario || busy) return null;
    setProblem(null);
    setBusy(true);
    try {
      const result = await runWindow(run, scenario);
      if (!result) return null;
      if (result.ok) {
        setRefusal(null);
        setRun(result.run);
      } else {
        setRefusal(result.refusal);
      }
      return result;
    } catch (error) {
      setProblem(error instanceof Error ? error.message : 'The window could not be run.');
      return null;
    } finally {
      setBusy(false);
    }
  }, [run, scenario, busy]);

  const reset = useCallback(async () => {
    if (!run || !scenario) return;
    setProblem(null);
    setRefusal(null);
    try {
      setRun(await resetStoredRun(scenario, run.state.run_id));
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

  return { run, scenario, runs, loading, busy, refusal, problem, advance, reset, switchRun };
}
