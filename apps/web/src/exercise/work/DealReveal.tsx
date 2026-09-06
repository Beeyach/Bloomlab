import { formatCurrency } from '@bloomlab/design-system';
import type { Exercise } from '@bloomlab/content-schema';

import { evaluatePricing, economicsFor, totalForMargin, type PricingResponse } from '../pricing';
import styles from './work.module.css';

/**
 * What the deal actually cost, shown once the attempt is in (EXR-016, PRI-002).
 *
 * None of this is available while the learner is pricing. That is deliberate: a desk that shows
 * the cost turns pricing into subtraction. Afterwards it is the whole lesson — here is what the
 * hours you kept cost to deliver, here is the contingency this client's risk asks for, here is
 * what your number made on it, and here is the smallest number that would have made the margin
 * this business works to.
 *
 * There is no "correct price" line, because there isn't one. Two quotes far apart can both clear
 * the floor, carry the risk and hold the margin.
 */
export function DealReveal({
  exercise,
  response,
}: {
  exercise: Exercise;
  response: PricingResponse;
}) {
  const config = exercise.pricing;
  const evaluation = evaluatePricing(exercise, economicsFor(exercise), response);
  if (!config || !evaluation) return null;

  const { basis, quote } = evaluation;
  const currency = config.currency;
  const money = (value: number) => formatCurrency(value, currency);
  const hours = (value: number) => `${trim(value)} ${value === 1 ? 'hour' : 'hours'}`;
  const margin = evaluation.projection.margin_percent;
  const healthy = totalForMargin(basis, config.margin.healthy_percent);
  const floorMargin = totalForMargin(basis, config.margin.floor_percent);

  return (
    <section aria-labelledby="reveal-title" className={styles.reveal} data-testid="deal-reveal">
      <h3 id="reveal-title" className={styles.deskTitle}>
        What this deal cost
      </h3>
      <dl className={styles.revealRows}>
        <dt>Scope you kept</dt>
        <dd>{hours(basis.scope_hours)}</dd>
        <dt>Revisions you included</dt>
        <dd>{hours(basis.revision_hours)}</dd>
        <dt>Compressing the timeline</dt>
        <dd>{hours(basis.rush_hours)}</dd>
        <dt>Delivery cost at {money(config.cost.hourly_cost)} an hour</dt>
        <dd>{money(basis.cost)}</dd>
        <dt>Contingency this client&rsquo;s risk asks for</dt>
        <dd>{money(basis.risk_allowance)}</dd>
        <dt>Cost plus contingency</dt>
        <dd>{money(basis.covered)}</dd>
      </dl>

      <dl className={styles.revealRows}>
        <dt>You quoted</dt>
        <dd data-testid="reveal-total">{quote.total === null ? 'Nothing' : money(quote.total)}</dd>
        <dt>Margin on the one-time work</dt>
        <dd data-testid="reveal-margin">
          {margin === null ? 'No price to measure' : `${margin}%`}
        </dd>
        <dt>{config.margin.floor_percent}% margin would have needed</dt>
        <dd>{money(floorMargin)}</dd>
        <dt>{config.margin.healthy_percent}% margin would have needed</dt>
        <dd>{money(healthy)}</dd>
      </dl>

      <p className={styles.deskNote}>
        Recurring revenue is not in that margin. {money(quote.recurring ?? 0)} a month is real
        money, and it is not what pays for building this.
      </p>
    </section>
  );
}

/** Hours read as hours: 6, not 6.0, and 6.5 rather than 6.50. */
const trim = (value: number): string => String(Math.round(value * 100) / 100);
