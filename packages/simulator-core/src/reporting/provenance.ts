import {
  METRIC_DEFINITIONS,
  type MetricBasis,
  type MetricId,
  type MetricUnit,
} from './definitions.ts';

/**
 * What a reported number is made of (REP-001, D-135).
 *
 * A metric here is never a bare figure. It carries the rule that produced it, the two counts it
 * was made from, and the run's own events and records that back them — so "22 leads" can be
 * opened and read as twenty-two `CONTACT_CREATED` events with ids, and a learner who thinks a
 * number is wrong can settle it against the log instead of trusting the screen.
 *
 * `status` is the honest half. A rate whose denominator is zero has no value: it is `no_data`,
 * with `value` null, and every surface shows "Not enough data" rather than a confident 0%. There
 * is no such thing as a 0% conversion on nought visits.
 */

export type MetricStatus = 'ok' | 'no_data';

export interface MetricValue {
  id: MetricId;
  label: string;
  unit: MetricUnit;
  basis: MetricBasis;
  /**
   * The number, or null when there is nothing to measure. A rate is a fraction between 0 and 1,
   * never a pre-multiplied percentage: formatting belongs to the interface.
   */
  value: number | null;
  numerator: number | null;
  denominator: number | null;
  definition: string;
  /** What the denominator is made of, for the rates that have one. */
  denominator_note: string | null;
  status: MetricStatus;
  /** Log event ids this number was counted from. */
  evidence_event_ids: string[];
  /** Account record ids — contacts, appointments, opportunities, payments, visits. */
  evidence_record_ids: string[];
}

export interface MetricInput {
  id: MetricId;
  value: number | null;
  numerator?: number | null;
  denominator?: number | null;
  events?: readonly string[];
  records?: readonly string[];
}

/** Builds a metric from its parts, filling label, unit, basis and wording from the definition. */
export function metric(input: MetricInput): MetricValue {
  const definition = METRIC_DEFINITIONS[input.id];
  const numerator = input.numerator ?? null;
  const denominator = input.denominator ?? null;
  const status: MetricStatus = input.value === null ? 'no_data' : 'ok';
  return {
    id: input.id,
    label: definition.label,
    unit: definition.unit,
    basis: definition.basis,
    value: input.value,
    numerator,
    denominator,
    definition: definition.definition,
    denominator_note: definition.denominator,
    status,
    evidence_event_ids: [...(input.events ?? [])],
    evidence_record_ids: [...(input.records ?? [])],
  };
}

/**
 * A rate from its two counts. A zero denominator is not a zero rate — it is nothing to divide,
 * and the metric says so rather than showing 0% (§56).
 */
export function rate(
  id: MetricId,
  numerator: number,
  denominator: number,
  evidence: { events?: readonly string[]; records?: readonly string[] } = {},
): MetricValue {
  return metric({
    id,
    value: denominator === 0 ? null : numerator / denominator,
    numerator,
    denominator,
    events: evidence.events,
    records: evidence.records,
  });
}

/** The median of a list of numbers, or null when the list is empty. Deterministic and pure. */
export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle] as number;
  return ((sorted[middle - 1] as number) + (sorted[middle] as number)) / 2;
}

/** The mean of a list of numbers, or null when the list is empty. */
export function mean(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((total, value) => total + value, 0) / values.length;
}
