import { useMemo, useState } from 'react';
import { Link } from 'react-router';

import { Button, Stack, StatusPill, Surface, cx } from '@bloomlab/design-system';
import {
  buildReport,
  type MetricId,
  type MetricValue,
  type Report,
  type SimulatorState,
  type SourceRow,
  type StageRow,
} from '@bloomlab/simulator-core';

import { content } from '../content/bundle';
import { EvidenceDrawer } from './EvidenceDrawer';
import { useReportingRun } from './useReportingRun';
import { pendingCount } from './window';
import {
  NOT_ENOUGH,
  basisWords,
  count,
  duration,
  lossWords,
  money,
  percent,
  reading,
  workings,
} from './words';
import styles from './reporting.module.css';

/**
 * The Reporting Lab (REP-001, REP-002, D-134, D-144).
 *
 * Not a dashboard. The screen is an operating report: the chain a business actually runs down the
 * middle, the ten numbers underneath it with the two counts that made each one, and an evidence
 * drawer that opens the events and records behind any of them. No hero statistic, no health
 * score, no sparkline that means nothing, no card that exists to fill a row.
 *
 * Every figure on this screen is derived from the run by `buildReport`. React computes no rate
 * here and holds no cohort of its own — a second implementation of "booking rate" in this file is
 * exactly what the projection exists to prevent.
 *
 * And nothing on it says where the leak is. The stage table shows the largest loss because that
 * is an observation, and it is labelled as one; deciding what the business's problem is stays the
 * learner's job, which is the whole point of REP-002 (§48).
 */

const REPORTING_EXERCISE_ID = 'EX-FIX_IT-glowhaus-reporting-bottleneck';

export default function ReportingLab() {
  const { run, scenario, runs, loading, busy, refusal, problem, advance, reset, switchRun } =
    useReportingRun();
  const [openMetric, setOpenMetric] = useState<MetricId | null>(null);
  const [stage, setStage] = useState<StageRow['id'] | null>(null);
  const [source, setSource] = useState<string | null>(null);

  const state: SimulatorState | null = run?.state ?? null;
  // Memoised on the run itself, which is replaced wholesale by every commit, so the report is
  // rebuilt exactly when the facts change and not on every render.
  const report = useMemo<Report | null>(() => (state ? buildReport(state) : null), [state]);
  const pending = state ? pendingCount(state) : 0;

  if (loading || !run || !scenario || !report || !state) {
    return (
      <Stack as="section" gap={3} className={styles.screen} aria-labelledby="reporting-title">
        <h1 id="reporting-title" className={styles.title}>
          Reporting
        </h1>
        <p className={styles.muted}>{problem ?? 'Opening the account…'}</p>
      </Stack>
    );
  }

  const exercise = content.exercises.find((row) => row.id === REPORTING_EXERCISE_ID);

  return (
    <Stack as="article" gap={6} className={styles.screen} aria-labelledby="reporting-title">
      <header className={styles.header}>
        <h1 id="reporting-title" className={styles.title}>
          Reporting
        </h1>
        <p className={styles.lead}>
          {scenario.title}. Every number here is worked out from what this run actually did, and
          every one of them opens.
        </p>
        {runs.length > 1 && (
          <label className={styles.runPicker}>
            <span className={styles.fieldLabel}>Account</span>
            <select
              value={run.state.run_id}
              onChange={(event) => void switchRun(event.target.value)}
              data-testid="reporting-run"
            >
              {runs.map((row) => (
                <option key={row.run_id} value={row.run_id}>
                  {row.run_id}
                </option>
              ))}
            </select>
          </label>
        )}
      </header>

      {refusal && (
        <p className={styles.refusal} role="alert">
          {refusal.message}
        </p>
      )}

      {pending > 0 && (
        <Surface padding="md" tone="mist" className={styles.window} data-testid="reporting-window">
          <p className={styles.windowTitle}>
            {report.empty ? 'Nothing has happened yet.' : 'There is more history to run.'}
          </p>
          <p className={styles.muted}>
            {pending} {pending === 1 ? 'thing is' : 'things are'} still queued for this account.
            Running the window moves the clock through them, the same way the Time Machine does.
          </p>
          <Button
            variant="primary"
            loading={busy}
            onClick={() => void advance()}
            data-testid="run-window"
          >
            Run the window
          </Button>
        </Surface>
      )}

      {report.empty ? (
        <Surface padding="lg" className={styles.emptyState} data-testid="reporting-empty">
          <p className={styles.windowTitle}>Nothing to report on.</p>
          <p className={styles.muted}>
            No visits, no leads, no bookings and no money. There are no rates here because there is
            nothing to divide — a report on an empty account is empty, not zero.
          </p>
        </Surface>
      ) : (
        <>
          <StageChain
            report={report}
            selected={stage}
            onSelect={(id) => setStage((current) => (current === id ? null : id))}
          />

          <MetricTable
            report={report}
            onInspect={(id) => setOpenMetric(id)}
            openMetric={openMetric}
          />

          <SourceTable
            report={report}
            selected={source}
            onSelect={(name) => setSource((current) => (current === name ? null : name))}
          />

          <Speed report={report} />

          <Diagnosis
            report={report}
            stage={stage}
            onSelect={setStage}
            exerciseId={exercise ? exercise.id : null}
            exerciseTitle={exercise?.title ?? null}
          />
        </>
      )}

      <section aria-labelledby="reset-title" className={styles.resetArea}>
        <h2 id="reset-title" className={styles.panelHeading}>
          Start again
        </h2>
        <p className={styles.muted}>
          Everything this run has done goes back to where the scenario starts, and the report goes
          back with it. It is derived, so there is nothing else to clear.
        </p>
        <Button variant="ghost" onClick={() => void reset()} data-testid="reporting-reset">
          Reset this account
        </Button>
      </section>

      <EvidenceDrawer
        state={state}
        metric={openMetric ? report.metrics[openMetric] : null}
        onClose={() => setOpenMetric(null)}
      />
    </Stack>
  );
}

/* ---- the chain --------------------------------------------------------------------------- */

function StageChain({
  report,
  selected,
  onSelect,
}: {
  report: Report;
  selected: StageRow['id'] | null;
  onSelect: (id: StageRow['id']) => void;
}) {
  // The largest single loss, as an observation. It is not called the bottleneck, because which
  // stage a business should fix is a judgement about that business (§49).
  const biggest = report.stages.reduce<StageRow | null>(
    (worst, row) => (row.lost !== null && (!worst || row.lost > (worst.lost ?? 0)) ? row : worst),
    null,
  );
  return (
    <section aria-labelledby="chain-title" className={styles.panel}>
      <h2 id="chain-title" className={styles.panelHeading}>
        Visitor to sale
      </h2>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <caption className={styles.caption}>
            Each stage over the one before it. Counts are people and bookings, never estimates.
          </caption>
          <thead>
            <tr>
              <th scope="col">Stage</th>
              <th scope="col">Reached</th>
              <th scope="col">Of the stage before</th>
              <th scope="col">Lost here</th>
            </tr>
          </thead>
          <tbody>
            {report.stages.map((row) => (
              <tr
                key={row.id}
                className={cx(styles.row, selected === row.id && styles.rowSelected)}
              >
                <th scope="row">
                  <button
                    type="button"
                    className={styles.rowButton}
                    aria-pressed={selected === row.id}
                    onClick={() => onSelect(row.id)}
                    data-testid={`stage-${row.id}`}
                  >
                    {row.label}
                  </button>
                </th>
                <td className={styles.numeric}>{row.count}</td>
                <td className={styles.numeric}>
                  {row.rate === null ? (
                    <span className={styles.muted}>—</span>
                  ) : (
                    <>
                      {percent(row.rate, { precise: true })}
                      <span className={styles.workings}>
                        {row.count} of {row.from}
                      </span>
                    </>
                  )}
                </td>
                <td className={styles.numeric}>
                  {row.lost === null ? <span className={styles.muted}>—</span> : row.lost}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {biggest && biggest.lost !== null && (
        <p className={styles.observation} data-testid="largest-loss">
          Largest single loss: {biggest.lost} between {beforeOf(report, biggest)} and{' '}
          {biggest.label.toLowerCase()}. That is an observation about this window, not a verdict
          about the business.
        </p>
      )}
    </section>
  );
}

const beforeOf = (report: Report, stage: StageRow): string => {
  const at = report.stages.findIndex((row) => row.id === stage.id);
  return (report.stages[at - 1]?.label ?? 'the start').toLowerCase();
};

/* ---- the ten ----------------------------------------------------------------------------- */

function MetricTable({
  report,
  onInspect,
  openMetric,
}: {
  report: Report;
  onInspect: (id: MetricId) => void;
  openMetric: MetricId | null;
}) {
  return (
    <section aria-labelledby="metrics-title" className={styles.panel}>
      <h2 id="metrics-title" className={styles.panelHeading}>
        The numbers
      </h2>
      <ul className={styles.metrics}>
        {report.ordered.map((metric) => (
          <MetricRow
            key={metric.id}
            metric={metric}
            open={openMetric === metric.id}
            onInspect={() => onInspect(metric.id)}
          />
        ))}
      </ul>
    </section>
  );
}

function MetricRow({
  metric,
  open,
  onInspect,
}: {
  metric: MetricValue;
  open: boolean;
  onInspect: () => void;
}) {
  const [showCalculation, setShowCalculation] = useState(false);
  const detail = workings(metric);
  return (
    <li className={styles.metric} data-testid={`metric-${metric.id}`}>
      <div className={styles.metricHead}>
        <span className={styles.metricLabel}>{metric.label}</span>
        <span
          className={cx(styles.metricValue, metric.status === 'no_data' && styles.metricAbsent)}
          data-testid={`metric-value-${metric.id}`}
        >
          {reading(metric)}
        </span>
      </div>
      {detail && <p className={styles.workingsLine}>{detail}</p>}
      <p className={styles.metricBasis}>{basisWords(metric)}</p>
      <div className={styles.metricActions}>
        <button
          type="button"
          className={styles.disclosure}
          aria-expanded={showCalculation}
          onClick={() => setShowCalculation((current) => !current)}
          data-testid={`calculation-${metric.id}`}
        >
          Show calculation
        </button>
        <button
          type="button"
          className={styles.disclosure}
          aria-expanded={open}
          onClick={onInspect}
          data-testid={`evidence-${metric.id}`}
        >
          Open the evidence
        </button>
      </div>
      {showCalculation && (
        <div className={styles.calculation} data-testid={`calculation-body-${metric.id}`}>
          <p>{metric.definition}</p>
          {metric.denominator_note && <p className={styles.muted}>{metric.denominator_note}</p>}
          {metric.status === 'no_data' && (
            <p className={styles.muted}>
              There is nothing to divide, so there is no number. {NOT_ENOUGH}.
            </p>
          )}
        </div>
      )}
    </li>
  );
}

/* ---- sources ------------------------------------------------------------------------------ */

function SourceTable({
  report,
  selected,
  onSelect,
}: {
  report: Report;
  selected: string | null;
  onSelect: (name: string) => void;
}) {
  if (report.sources.length === 0) return null;
  const chosen = report.sources.find((row) => row.source === selected) ?? null;
  return (
    <section aria-labelledby="sources-title" className={styles.panel}>
      <h2 id="sources-title" className={styles.panelHeading}>
        Where they came from
      </h2>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <caption className={styles.caption}>
            Every row carries its own sample size. A source with two visits is not a better source
            than one with twenty; it is a source with two visits.
          </caption>
          <thead>
            <tr>
              <th scope="col">Source</th>
              <th scope="col">Visits</th>
              <th scope="col">Leads</th>
              <th scope="col">Booked</th>
              <th scope="col">Showed</th>
              <th scope="col">Sold</th>
              <th scope="col">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {report.sources.map((row) => (
              <tr
                key={row.source}
                className={cx(styles.row, selected === row.source && styles.rowSelected)}
              >
                <th scope="row">
                  <button
                    type="button"
                    className={styles.rowButton}
                    aria-pressed={selected === row.source}
                    onClick={() => onSelect(row.source)}
                    data-testid={`source-${row.source}`}
                  >
                    {row.source}
                  </button>
                </th>
                <td className={styles.numeric}>{row.visits}</td>
                <td className={styles.numeric}>{row.leads}</td>
                <td className={styles.numeric}>{row.booked}</td>
                <td className={styles.numeric}>{row.showed}</td>
                <td className={styles.numeric}>{row.sold}</td>
                <td className={styles.numeric}>{money(row.revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {chosen && <SourceDetail row={chosen} />}
    </section>
  );
}

function SourceDetail({ row }: { row: SourceRow }) {
  return (
    <div className={styles.sourceDetail} data-testid="source-detail">
      <p className={styles.detailTitle}>{row.source}</p>
      <p className={styles.muted}>
        {row.visits} {row.visits === 1 ? 'visit' : 'visits'} became {row.leads}{' '}
        {row.leads === 1 ? 'lead' : 'leads'} — {percent(row.conversion, { precise: true })}.
        {row.visits < 10 && ' On a sample this small, one more visit moves that a long way.'}
      </p>
      {row.contact_ids.length > 0 && (
        <p className={styles.muted}>Leads: {row.contact_ids.join(', ')}</p>
      )}
    </div>
  );
}

/* ---- speed and reach ----------------------------------------------------------------------- */

function Speed({ report }: { report: Report }) {
  const { speed, appointments } = report;
  return (
    <section aria-labelledby="speed-title" className={styles.panel}>
      <h2 id="speed-title" className={styles.panelHeading}>
        How fast, and who was reached
      </h2>
      <dl className={styles.definitions}>
        <div className={styles.definition}>
          <dt>Median time to first contact</dt>
          <dd>{duration(speed.median_minutes)}</dd>
        </div>
        <div className={styles.definition}>
          <dt>Mean, for comparison</dt>
          <dd>{duration(speed.mean_minutes)}</dd>
        </div>
        <div className={styles.definition}>
          <dt>Leads messaged</dt>
          <dd>{count(speed.contacted)}</dd>
        </div>
        <div className={styles.definition}>
          <dt>Leads nobody messaged</dt>
          <dd>
            {count(speed.never_contacted)}
            {speed.never_contacted_ids.length > 0 && (
              <span className={styles.workings}>{speed.never_contacted_ids.join(', ')}</span>
            )}
          </dd>
        </div>
      </dl>
      {speed.median_minutes !== null &&
        speed.mean_minutes !== null &&
        speed.mean_minutes > speed.median_minutes * 3 && (
          <p className={styles.observation}>
            The mean is a long way above the median, so a small number of long waits are pulling it
            up. The median is the one that describes the usual case.
          </p>
        )}
      <dl className={styles.definitions}>
        <div className={styles.definition}>
          <dt>Appointments booked</dt>
          <dd>{appointments.booked}</dd>
        </div>
        <div className={styles.definition}>
          <dt>Came due</dt>
          <dd>
            {appointments.due}
            <span className={styles.workings}>
              {appointments.cancelled} cancelled, {appointments.not_yet_due} still ahead
            </span>
          </dd>
        </div>
        <div className={styles.definition}>
          <dt>Showed</dt>
          <dd>{appointments.showed}</dd>
        </div>
        <div className={styles.definition}>
          <dt>Did not</dt>
          <dd>{appointments.no_show}</dd>
        </div>
      </dl>
    </section>
  );
}

/* ---- the workspace -------------------------------------------------------------------------- */

function Diagnosis({
  report,
  stage,
  onSelect,
  exerciseId,
  exerciseTitle,
}: {
  report: Report;
  stage: StageRow['id'] | null;
  onSelect: (id: StageRow['id'] | null) => void;
  exerciseId: string | null;
  exerciseTitle: string | null;
}) {
  const chosen = report.stages.find((row) => row.id === stage) ?? null;
  return (
    <section aria-labelledby="diagnosis-title" className={styles.panel}>
      <h2 id="diagnosis-title" className={styles.panelHeading}>
        Where is the leak?
      </h2>
      <p className={styles.muted}>
        Pick a stage to gather what this window says about it. Nothing here decides for you, and
        nothing is marked.
      </p>
      <div className={styles.stageChoices} role="group" aria-label="Stages">
        {report.stages.map((row) => (
          <button
            key={row.id}
            type="button"
            className={cx(styles.choice, stage === row.id && styles.choiceOn)}
            aria-pressed={stage === row.id}
            onClick={() => onSelect(stage === row.id ? null : row.id)}
            data-testid={`diagnose-${row.id}`}
          >
            {row.label}
          </button>
        ))}
      </div>
      {chosen && (
        <div className={styles.stageEvidence} data-testid="stage-evidence">
          <p className={styles.detailTitle}>{chosen.label}</p>
          <p>
            {chosen.count} reached this stage
            {chosen.from !== null && ` out of ${chosen.from} at the stage before`}.{' '}
            {lossWords(chosen.lost) ?? 'Nothing was lost getting here.'}
          </p>
          {chosen.id === 'showed' && (
            <p className={styles.muted}>
              {report.appointments.cancelled} cancelled and {report.appointments.not_yet_due} have
              not happened yet, so neither is counted against the show rate.
            </p>
          )}
          {chosen.id === 'leads' && (
            <p className={styles.muted}>
              Sources:{' '}
              {report.sources.map((row) => `${row.source} ${row.leads}/${row.visits}`).join(' · ')}
            </p>
          )}
          {chosen.id === 'booked' && (
            <p className={styles.muted}>
              Median time to first contact was {duration(report.speed.median_minutes)}, and{' '}
              {report.speed.never_contacted}{' '}
              {report.speed.never_contacted === 1 ? 'lead was' : 'leads were'} never messaged at
              all.
            </p>
          )}
        </div>
      )}
      {exerciseId && (
        <p className={styles.exerciseLink}>
          <StatusPill label="Graded" tone="info" />{' '}
          <Link to={`/exercise/${exerciseId}`} className={styles.inlineLink}>
            {exerciseTitle ?? 'Diagnose the bottleneck'}
          </Link>
        </p>
      )}
    </section>
  );
}
