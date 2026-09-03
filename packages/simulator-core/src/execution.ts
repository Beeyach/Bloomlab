/**
 * The execution log (spec §48, SIM-010). This is what Fix It exercises read, what the execution
 * timeline draws, and what Phase 15 builds troubleshooting on top of, so it stores structured
 * data rather than sentences: an interface derives readable text from `kind`, `data` and
 * `reason`, and a later change of wording never rewrites history.
 */

export const EXECUTION_KINDS = [
  /** What started a run, and the filters it passed. */
  'trigger',
  /** The data the run began with: the contact, the event payload, the values read. */
  'input',
  'step_started',
  'step_completed',
  /** An If/Else outcome, with the comparison that produced it. */
  'branch_result',
  /** An action that could not run: no phone, do-not-disturb, a missing field. */
  'action_skipped',
  /** Parked until an instant or an event. */
  'waiting',
  'failure',
  /** Why a run ended: completed, goal met, removed, duplicate enrolment refused. */
  'exit',
] as const;

export type ExecutionKind = (typeof EXECUTION_KINDS)[number];

export interface ExecutionRecord {
  /** Deterministic: the same run replayed mints the same record ids. */
  id: string;
  run_id: string;
  /** Simulator time. */
  at: string;
  /** Shares the run's ordering with the event log, so a timeline can merge the two. */
  sequence: number;
  kind: ExecutionKind;
  workflow_id: string | null;
  workflow_run_id: string | null;
  node_id: string | null;
  contact_id: string | null;
  /** The event that caused this record, when one did. */
  event_id: string | null;
  /** Structured detail: ids, values, comparisons, limits. Never a display string. */
  data: Record<string, unknown>;
  /** A machine token — `missing_phone`, `dnd`, `duplicate_enrolment`, `completed`. */
  reason: string | null;
}

export interface ExecutionDraft {
  kind: ExecutionKind;
  at: string;
  workflow_id?: string | null;
  workflow_run_id?: string | null;
  node_id?: string | null;
  contact_id?: string | null;
  event_id?: string | null;
  data?: Record<string, unknown>;
  reason?: string | null;
}

/** Mints a record. Identity comes from the run and its sequence, so replay reproduces it. */
export const executionRecord = (
  runId: string,
  sequence: number,
  draft: ExecutionDraft,
): ExecutionRecord => ({
  id: `xr-${runId}-${sequence}`,
  run_id: runId,
  at: draft.at,
  sequence,
  kind: draft.kind,
  workflow_id: draft.workflow_id ?? null,
  workflow_run_id: draft.workflow_run_id ?? null,
  node_id: draft.node_id ?? null,
  contact_id: draft.contact_id ?? null,
  event_id: draft.event_id ?? null,
  data: draft.data ?? {},
  reason: draft.reason ?? null,
});
