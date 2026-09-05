import type { ExecutionRecord, SimulatorScenario, SimulatorState } from '@bloomlab/simulator-core';

import { content } from '../content/bundle';
import type { StoredRun } from '../simulator/store';
import { execute, type ExecutionOptions, type ExecutionResult } from '../workflow/execution';
import { windowEnd } from '../reporting/window';

/**
 * The Incident surface's own reads (SIM-011, DES-013, D-142).
 *
 * An incident is an authored block on a scenario: a title, a symptom, what the client said, which
 * of the nine failures it stages, where to look and how to reproduce it. All of that is case
 * fact. None of it is the answer — the fault and the fix live in the grading assertions of the
 * exercises that use these scenarios, so the whole incident can be rendered without handing the
 * learner what they were asked to work out (§26, §71).
 *
 * Everything below is a read. Nothing here decides what went wrong, and nothing scores anything.
 */

/** The authored incident block, as the compiled scenario carries it. */
export interface Incident {
  title: string;
  symptom: string;
  client_complaint: string;
  failure_mode: string;
  inspect: string[];
  reproduce: string[];
}

export interface IncidentCase {
  scenario: SimulatorScenario;
  scenario_id: string;
  title: string;
  client_id: string;
  summary: string;
  incident: Incident;
}

type CompiledScenario = SimulatorScenario & {
  client?: string;
  summary?: string;
  incident?: Incident | null;
};

/** Every scenario in the bundle that stages an incident, in id order. */
export function incidentCases(): IncidentCase[] {
  return (content.scenarios as unknown as CompiledScenario[])
    .filter((row): row is CompiledScenario & { incident: Incident } => Boolean(row.incident))
    .map((row) => ({
      scenario: row,
      scenario_id: row.id,
      title: row.title ?? row.id,
      client_id: row.client ?? '',
      summary: row.summary ?? '',
      incident: row.incident,
    }))
    .sort((a, b) => a.scenario_id.localeCompare(b.scenario_id));
}

export const incidentCase = (scenarioId: string): IncidentCase | null =>
  incidentCases().find((row) => row.scenario_id === scenarioId) ?? null;

/**
 * Reproduces the incident: moves the run to the end of the history the scenario queued, through
 * the same execution door every Lab commits through. Returns null when nothing is queued, which
 * is a real case — a configuration incident like an empty booking page needs no events at all.
 */
export function reproduce(
  run: StoredRun,
  scenario: SimulatorScenario,
  options?: ExecutionOptions,
): Promise<ExecutionResult> | null {
  const end = windowEnd(run.state);
  if (!end) return null;
  return execute(run, scenario, { kind: 'advance_to', at: end }, options);
}

/**
 * The execution records worth showing beside an incident: what was skipped, what failed, what a
 * branch decided, and how each run ended. A step that merely started is noise here — the point is
 * what the system did about it.
 */
export const EVIDENCE_KINDS: readonly ExecutionRecord['kind'][] = [
  'trigger',
  'branch_result',
  'action_skipped',
  'failure',
  'exit',
];

export const evidenceRecords = (state: SimulatorState): ExecutionRecord[] =>
  state.execution.filter((record) => EVIDENCE_KINDS.includes(record.kind));

/** The whole execution history for one run, for a learner who wants to read every step. */
export const allRecords = (state: SimulatorState): ExecutionRecord[] => state.execution;
