import { useMemo } from 'react';

import { cx } from '@bloomlab/design-system';
import {
  FUNNEL_REACH_LEVELS,
  funnelAutopsy,
  type AutopsyRate,
  type FunnelAutopsy,
  type SimulatorState,
} from '@bloomlab/simulator-core';

import styles from './funnel.module.css';

/**
 * The Funnel Autopsy (FUN-004, EXR-010, D-137).
 *
 * Six views of one funnel's own traffic: where it came from, how much of it became a lead, how
 * far down each step it got, how many started the form against how many finished it, how many
 * booked, and where the sessions that ended ended.
 *
 * Forensic, not an analytics suite. No heatmap, no live-visitor counter, no health score, no
 * sparkline, no giant KPI card — a table with its sample size beside it says more than any of
 * those and can be checked. Every number comes from `funnelAutopsy`, the same projection the
 * FUNNEL AUTOPSY exercise and the tests read, so the Lab and the graded work can never disagree
 * about what the traffic did.
 *
 * It also says nothing about *why*. A drop-off is a place sessions ended; calling that a bad
 * headline is a hypothesis, and forming one is the learner's job.
 */

export function AutopsyLens({ state, funnelId }: { state: SimulatorState; funnelId: string }) {
  const autopsy = useMemo(() => funnelAutopsy(state, funnelId), [state, funnelId]);
  if (!autopsy) return null;

  if (autopsy.empty) {
    return (
      <div className={styles.autopsy} data-testid="autopsy-empty">
        <p className={styles.muted}>
          No traffic has reached this funnel. There are no rates here because there is nothing to
          divide — walk a visitor through it in Simulate, or open a scenario that carries its own
          history.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.autopsy} data-testid="autopsy">
      <p className={styles.muted}>
        {autopsy.visits} {autopsy.visits === 1 ? 'visit' : 'visits'} to {autopsy.funnel_name}. Every
        rate below carries the two counts it was made from.
      </p>

      <Traffic autopsy={autopsy} />
      <Conversion autopsy={autopsy} />
      <Reach autopsy={autopsy} />
      <Forms autopsy={autopsy} />
      <Booking autopsy={autopsy} />
      <DropOff autopsy={autopsy} />
    </div>
  );
}

const NOT_ENOUGH = 'Not enough data';

const asPercent = (value: number | null): string =>
  value === null ? NOT_ENOUGH : `${Math.round(value * 100)}%`;

const of = (rate: AutopsyRate): string => `${rate.numerator} of ${rate.denominator}`;

function View({
  id,
  title,
  note,
  children,
}: {
  id: string;
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={`autopsy-${id}`}
      className={styles.autopsyView}
      data-testid={`autopsy-${id}`}
    >
      <h4 id={`autopsy-${id}`} className={styles.autopsyHeading}>
        {title}
      </h4>
      {note && <p className={styles.muted}>{note}</p>}
      {children}
    </section>
  );
}

/* 1 */
function Traffic({ autopsy }: { autopsy: FunnelAutopsy }) {
  return (
    <View
      id="traffic"
      title="Traffic source"
      note="Sample size sits beside every rate. A source with two visits is a source with two visits."
    >
      <div className={styles.autopsyTableWrap}>
        <table className={styles.autopsyTable}>
          <thead>
            <tr>
              <th scope="col">Source</th>
              <th scope="col">Visits</th>
              <th scope="col">Became a lead</th>
              <th scope="col">Rate</th>
            </tr>
          </thead>
          <tbody>
            {autopsy.traffic.map((row) => (
              <tr key={row.source}>
                <th scope="row">{row.source}</th>
                <td>{row.visits}</td>
                <td>{row.leads}</td>
                <td>
                  {asPercent(row.conversion)}
                  {row.visits < 10 && (
                    <span className={styles.autopsyAside}>on {row.visits} visits</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </View>
  );
}

/* 2 */
function Conversion({ autopsy }: { autopsy: FunnelAutopsy }) {
  return (
    <View
      id="conversion"
      title="Conversion rate"
      note="Visits that ended up identified as a contact."
    >
      <p className={styles.autopsyFigure}>{asPercent(autopsy.conversion.value)}</p>
      <p className={styles.autopsyWorkings}>{of(autopsy.conversion)} visits</p>
    </View>
  );
}

/* 3 */
function Reach({ autopsy }: { autopsy: FunnelAutopsy }) {
  return (
    <View
      id="reach"
      title="Scroll behaviour"
      note="How far down each step the traffic got, measured in the step's own blocks. Not pixels: Bloomlab models conversion architecture, so depth is counted in the things a visitor was shown."
    >
      <div className={styles.autopsyTableWrap}>
        <table className={styles.autopsyTable}>
          <thead>
            <tr>
              <th scope="col">Step</th>
              <th scope="col">Views</th>
              {FUNNEL_REACH_LEVELS.map((level) => (
                <th key={level} scope="col">
                  {level}
                </th>
              ))}
              <th scope="col">Deepest block reached</th>
            </tr>
          </thead>
          <tbody>
            {autopsy.reach.map((row) => (
              <tr key={row.step_id}>
                <th scope="row">{row.step_name}</th>
                <td>{row.views}</td>
                {FUNNEL_REACH_LEVELS.map((level) => (
                  <td key={level}>{row.by_level[level]}</td>
                ))}
                <td>
                  {row.deepest_blocks_seen} of {row.blocks}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </View>
  );
}

/* 4 */
function Forms({ autopsy }: { autopsy: FunnelAutopsy }) {
  return (
    <View
      id="forms"
      title="Form completion"
      note="Starting is not submitting, and the two are counted apart."
    >
      <p className={styles.autopsyFigure}>{asPercent(autopsy.form_completion.value)}</p>
      <p className={styles.autopsyWorkings}>
        {autopsy.form_completion.submissions} submitted, {autopsy.form_completion.starts} started
      </p>
    </View>
  );
}

/* 5 */
function Booking({ autopsy }: { autopsy: FunnelAutopsy }) {
  return (
    <View id="booking" title="Booking rate" note={autopsy.booking_denominator}>
      <p className={styles.autopsyFigure}>{asPercent(autopsy.booking.value)}</p>
      <p className={styles.autopsyWorkings}>{of(autopsy.booking)} leads</p>
    </View>
  );
}

/* 6 */
function DropOff({ autopsy }: { autopsy: FunnelAutopsy }) {
  const worst = autopsy.drop_off.reduce((most, row) => (row.left > most ? row.left : most), 0);
  return (
    <View
      id="dropoff"
      title="Drop-off"
      note="Where sessions ended without going further. Where, not why."
    >
      <div className={styles.autopsyTableWrap}>
        <table className={styles.autopsyTable}>
          <thead>
            <tr>
              <th scope="col">Step</th>
              <th scope="col">Reached it</th>
              <th scope="col">Ended here</th>
              <th scope="col">Share of those who reached it</th>
            </tr>
          </thead>
          <tbody>
            {autopsy.drop_off.map((row) => (
              <tr
                key={row.step_id}
                className={cx(worst > 0 && row.left === worst && styles.autopsyWorst)}
              >
                <th scope="row">{row.step_name}</th>
                <td>{row.reached}</td>
                <td>{row.left}</td>
                <td>{asPercent(row.share)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {worst > 0 && (
        <p className={styles.muted}>
          The marked row is where the most sessions ended. That is where, and it is not yet a
          reason.
        </p>
      )}
    </View>
  );
}
