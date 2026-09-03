import { useId, useState } from 'react';

import { Button } from '@bloomlab/design-system';

import {
  FUNNEL_LEVERS,
  funnelOutcome,
  liftRate,
  money,
  parseFunnelInput,
  percent,
  whole,
  type FunnelInput,
  type FunnelRate,
} from '../funnelMath';
import styles from './embeds.module.css';

const RATE_LABELS: Record<FunnelRate, string> = {
  booking: 'Booking rate',
  show: 'Show rate',
  close: 'Close rate',
};

/**
 * Funnel math you can push on (Interactive kind="funnel-math"): move a rate and the counts,
 * revenue and the biggest leak recompute at once; below, what each single lift would buy. Pure
 * arithmetic from `funnelMath.ts`, deterministic, no simulator involved. Keyboard: sliders take
 * arrow keys, numbers take typing; results live in a polite live region.
 */
export function FunnelMathInteractive(attributes: Record<string, unknown>) {
  const initial = parseFunnelInput(attributes);
  const [input, setInput] = useState<FunnelInput>(initial);
  const id = useId();
  const outcome = funnelOutcome(input);
  const set = (key: keyof FunnelInput, value: number) =>
    setInput((current) => ({ ...current, [key]: value }));
  const changed = JSON.stringify(input) !== JSON.stringify(initial);

  return (
    <section
      className={styles.interactive}
      aria-labelledby={`${id}-title`}
      data-embed="interactive-funnel-math"
    >
      <p className={styles.embedLabel}>Try it</p>
      <h3 id={`${id}-title`} className={styles.interactiveTitle}>
        Push on one number
      </h3>
      <div className={styles.interactiveGrid}>
        <fieldset className={styles.controls}>
          <legend className={styles.legend}>The month</legend>
          <div className={styles.numberRow}>
            <label className={styles.numberField}>
              <span>Leads</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={100000}
                step={1}
                value={input.leads}
                onChange={(event) => set('leads', Math.max(0, Number(event.target.value) || 0))}
              />
            </label>
            <label className={styles.numberField}>
              <span>Average ticket</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={1000000}
                step={10}
                value={input.ticket}
                onChange={(event) => set('ticket', Math.max(0, Number(event.target.value) || 0))}
              />
            </label>
          </div>
          {(['booking', 'show', 'close'] as FunnelRate[]).map((rate) => (
            <div key={rate} className={styles.slider}>
              <span className={styles.sliderLabel}>
                <label htmlFor={`${id}-${rate}`}>{RATE_LABELS[rate]}</label>
                <output htmlFor={`${id}-${rate}`}>{percent(input[rate])}</output>
              </span>
              <input
                id={`${id}-${rate}`}
                type="range"
                min={0}
                max={100}
                step={1}
                value={Math.round(input[rate] * 100)}
                onChange={(event) => set(rate, Number(event.target.value) / 100)}
              />
            </div>
          ))}
          <Button variant="ghost" onClick={() => setInput(initial)} disabled={!changed}>
            Reset to the unit's numbers
          </Button>
        </fieldset>

        <div className={styles.results} aria-live="polite" data-testid="funnel-results">
          <p className={styles.resultLine}>
            <span className={styles.resultBig}>{whole(outcome.sales)} sales</span>
            <span className={styles.resultMeta}>
              {whole(outcome.stages[1]?.count ?? 0)} book · {whole(outcome.stages[2]?.count ?? 0)}{' '}
              show · {whole(outcome.sales)} buy
            </span>
          </p>
          <p className={styles.resultLine}>
            <span className={styles.resultBig}>{money(outcome.revenue)} a month</span>
            {outcome.profit !== null && input.ad_spend !== undefined && (
              <span className={styles.resultMeta}>
                {money(outcome.profit)} after {money(input.ad_spend)} of ads
              </span>
            )}
          </p>
          <p className={styles.leak}>
            Biggest leak: <strong>{whole(outcome.leak.lost)} people</strong> lost after{' '}
            {outcome.leak.label.toLowerCase()}.
          </p>
          <h4 className={styles.resultHeading}>One lift at a time</h4>
          <ul className={styles.levers}>
            {FUNNEL_LEVERS.map((lever) => {
              const lifted = liftRate(input, lever.rate, lever.target);
              const already = input[lever.rate] >= lever.target;
              return (
                <li key={lever.rate} className={styles.lever}>
                  <span>
                    {lever.label} to {percent(lever.target)}
                  </span>
                  <span className={styles.leverResult}>
                    {already
                      ? 'already there'
                      : `${whole(lifted.outcome.sales)} sales (+${lifted.extraSales}), ${money(lifted.outcome.revenue)}`}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
