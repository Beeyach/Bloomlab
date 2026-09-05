import { formatCurrency } from '@bloomlab/design-system';
import type { MetricValue } from '@bloomlab/simulator-core';

/**
 * How a reported number is written down (REP-001, §55).
 *
 * No pseudo-precision. A rate is a whole percentage unless a whole percentage would hide the
 * difference between two stages, in which case it gets one decimal and no more. A duration is
 * minutes until minutes stop being readable, then hours. Nothing is padded to look exact.
 *
 * And nothing is ever a confident zero. A rate with nothing to divide reads "Not enough data",
 * because 0% of nought visits is not a fact about the business.
 */

export const NOT_ENOUGH = 'Not enough data';

/** A fraction as a percentage. One decimal only when the whole number would round two rates together. */
export function percent(value: number | null, options: { precise?: boolean } = {}): string {
  if (value === null) return NOT_ENOUGH;
  const scaled = value * 100;
  if (options.precise && Math.abs(scaled - Math.round(scaled)) >= 0.05) {
    return `${scaled.toFixed(1)}%`;
  }
  return `${Math.round(scaled)}%`;
}

/** Minutes, in the unit a person would actually say. */
export function duration(minutes: number | null): string {
  if (minutes === null) return NOT_ENOUGH;
  if (minutes < 1) return 'Under a minute';
  if (minutes < 90) return `${Math.round(minutes)} min`;
  const hours = minutes / 60;
  if (hours < 36) return `${hours < 10 ? hours.toFixed(1) : Math.round(hours)} hr`;
  return `${Math.round(hours / 24)} days`;
}

export const money = (amount: number | null): string =>
  amount === null ? NOT_ENOUGH : formatCurrency(amount);

export const count = (value: number | null): string =>
  value === null ? NOT_ENOUGH : String(Math.round(value));

/** The headline reading of one metric, in its own unit. */
export function reading(metric: MetricValue): string {
  if (metric.value === null) return NOT_ENOUGH;
  switch (metric.unit) {
    case 'rate':
      return percent(metric.value, { precise: true });
    case 'money':
      return money(metric.value);
    case 'minutes':
      return duration(metric.value);
    case 'table':
      return `${metric.value} ${metric.value === 1 ? 'source' : 'sources'}`;
    case 'count':
    default:
      return count(metric.value);
  }
}

/**
 * The two counts behind a rate, written out. This is what makes a percentage checkable, so it
 * appears beside the number rather than behind a click wherever there is room.
 */
export function workings(metric: MetricValue): string | null {
  if (metric.numerator === null || metric.denominator === null) return null;
  if (metric.unit === 'rate') return `${metric.numerator} of ${metric.denominator}`;
  if (metric.id === 'revenue') {
    return `${money(metric.numerator)} in, ${money(metric.denominator)} refunded`;
  }
  if (metric.id === 'time_to_contact') {
    return `${metric.numerator} of ${metric.denominator} leads were messaged`;
  }
  return null;
}

/** Whether the number describes the account now or what happened over the window (§6). */
export const basisWords = (metric: MetricValue): string =>
  metric.basis === 'snapshot' ? 'As it stands now' : 'Over the window';

/** A stage-to-stage rate, with the loss said in people rather than only in percent. */
export const lossWords = (lost: number | null): string | null =>
  lost === null || lost <= 0 ? null : `${lost} lost here`;
