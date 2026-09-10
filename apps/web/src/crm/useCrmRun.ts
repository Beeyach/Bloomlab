import { useCallback, useEffect, useRef, useState } from 'react';

import type { SimulatorScenario } from '@bloomlab/simulator-core';

import { content } from '../content/bundle';
import { loadRun, resetStoredRun, startRun, type StoredRun } from '../simulator/store';
import { currentCrmRunId, rememberCrmRun, savedCrmRuns, type CrmRunSummary } from './currentRun';
import type { CrmOutcome, CrmRefusal } from './commands';

/**
 * The CRM Lab's run (D-096).
 *
 * The Lab works on one saved simulator run of the CRM scenario, and it resumes rather than
 * starting over: a reload, a second tab and a second device all land in the same account, which
 * is the whole point of a training account you can leave and come back to.
 *
 * **Which run, when there are several.** Two devices that each start the Lab offline genuinely
 * start two runs — that is Phase 10's rule and nothing here overrides it. The Lab does not merge
 * them and does not throw one away. It works on the run `currentCrmRunId` resolves — the one this
 * device chose, else the most recently updated (D-099) — lists the others so the screen can offer
 * them, and remembers a switch on the device. The exercise runtime reads the same rule, so a grade
 * is always of the account the learner can see.
 *
 * Nothing here starts a run on render. The effect runs once per scenario and guards against a
 * second start with a ref, because two `startRun` calls would be two accounts.
 */

export const CRM_SCENARIO_ID = 'SC-glowhaus-crm';

export interface CrmRunState {
  run: StoredRun | null;
  scenario: SimulatorScenario | null;
  /** Every saved run of this scenario, newest first, so the screen can offer the others. */
  runs: CrmRunSummary[];
  runIds: string[];
  loading: boolean;
  /** The last refusal, kept until the next command or an explicit dismissal. */
  refusal: CrmRefusal | null;
  /** Something that is not a simulator refusal — a storage failure, say. */
  problem: string | null;
}

export interface CrmRunApi extends CrmRunState {
  /** Runs a command and adopts its result. Refusals leave the run untouched. */
  apply: (command: (run: StoredRun) => Promise<CrmOutcome>) => Promise<boolean>;
  /** Back to the scenario's authored beginning, under a new generation (D-087). */
  reset: () => Promise<void>;
  switchRun: (runId: string) => Promise<void>;
  dismissRefusal: () => void;
}

const scenarioFor = (id: string): SimulatorScenario | null =>
  (content.scenarios as unknown as SimulatorScenario[]).find((row) => row.id === id) ?? null;

export function useCrmRun(scenarioId: string = CRM_SCENARIO_ID): CrmRunApi {
  const [run, setRun] = useState<StoredRun | null>(null);
  const [runs, setRuns] = useState<CrmRunSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refusal, setRefusal] = useState<CrmRefusal | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const starting = useRef(false);
  const applying = useRef(false);
  const scenario = scenarioFor(scenarioId);

  useEffect(() => {
    if (!scenario || starting.current) return;
    starting.current = true;
    let cancelled = false;
    (async () => {
      const saved = await savedCrmRuns(scenario.id);
      const currentId = await currentCrmRunId(scenario.id);
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
      setProblem(error instanceof Error ? error.message : 'The CRM account could not be opened.');
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [scenario]);

  const apply = useCallback(
    async (command: (current: StoredRun) => Promise<CrmOutcome>) => {
      if (!run) return false;
      if (applying.current) {
        setProblem('Another account change is still saving. Wait for it, then try again.');
        return false;
      }
      applying.current = true;
      setProblem(null);
      try {
        const outcome = await command(run);
        if (!outcome.ok) {
          setRefusal(outcome.refusal);
          setRun(outcome.run);
          return false;
        }
        setRefusal(null);
        setRun(outcome.run);
        return true;
      } catch (error) {
        setProblem(error instanceof Error ? error.message : 'That change could not be saved.');
        return false;
      } finally {
        applying.current = false;
      }
    },
    [run],
  );

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

  const switchRun = useCallback(async (runId: string) => {
    const loaded = await loadRun(runId);
    if (loaded) {
      await rememberCrmRun(runId);
      setRun(loaded);
      setRefusal(null);
    }
  }, []);

  return {
    run,
    scenario,
    runs,
    runIds: runs.map((row) => row.run_id),
    loading,
    refusal,
    problem,
    apply,
    reset,
    switchRun,
    dismissRefusal: () => setRefusal(null),
  };
}
