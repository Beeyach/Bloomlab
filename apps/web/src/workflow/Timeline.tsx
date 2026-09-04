import { memo, useEffect, useMemo, useState } from 'react';

import {
  Button,
  ExecutionEvent,
  IconPause,
  IconPlay,
  ToolPanel,
  usePrefersReducedMotion,
} from '@bloomlab/design-system';
import type {
  AccountState,
  ExecutionRecord,
  Workflow,
  WorkflowRun,
} from '@bloomlab/simulator-core';

import { RUN_STATUS_WORDS, simulatorTime, timelineRow } from './words';
import styles from './workflow.module.css';

/**
 * The execution timeline (SIM-010, WFL-004, WFL-012).
 *
 * Every row is an execution record the engine wrote for the watched run, in the engine's order.
 * Playback steps a highlight through those same rows on a cadence — it animates the record, it
 * does not invent one — and drives the travelling dot on the canvas through the nodes the run
 * actually visited. The first time a test starts a run, playback begins on its own: the engine
 * has already finished and the account already holds the result; what plays is the recorded
 * trace (the signature moment). Skip and Pause only move the highlight. Under reduced motion the
 * cadence is off and the whole trace is shown at once.
 */

/** A request to play a run's trace from the start; a new token plays again even for the same run. */
export interface Autoplay {
  runId: string;
  token: number;
}

/** Record kinds after which the node at the playhead has settled into its recorded status. */
const SETTLED = new Set([
  'step_completed',
  'action_skipped',
  'failure',
  'waiting',
  'branch_result',
  'exit',
]);

export interface TimelineProps {
  workflow: Workflow;
  account: AccountState;
  timezone: string;
  runs: WorkflowRun[];
  watchedId: string | null;
  onWatch: (id: string | null) => void;
  records: ExecutionRecord[];
  /** Play this run's trace as soon as its rows exist (the first execution, WFL-012). */
  autoplay: Autoplay | null;
  /** Reported so the canvas can light the trail at the same place. */
  onPlayhead: (index: number | null, trail: string[], settled: boolean) => void;
}

const CADENCE_MS = 650;

function TimelineInner({
  workflow,
  account,
  timezone,
  runs,
  watchedId,
  onWatch,
  records,
  autoplay,
  onPlayhead,
}: TimelineProps) {
  const reduced = usePrefersReducedMotion();
  // Playback state is kept with the run it belongs to, so a different run reads as stopped and
  // cleared without an effect having to reset anything.
  const [playback, setPlayback] = useState<{
    forRun: string | null;
    playing: boolean;
    index: number | null;
  }>({
    forRun: null,
    playing: false,
    index: null,
  });
  const playing = playback.forRun === watchedId && playback.playing;
  const index = playback.forRun === watchedId ? playback.index : null;
  const setPlaying = (next: boolean) =>
    setPlayback((current) => ({
      forRun: watchedId,
      playing: next,
      index: current.forRun === watchedId ? current.index : null,
    }));
  const setIndex = (next: number | null | ((current: number | null) => number | null)) =>
    setPlayback((current) => {
      const base = current.forRun === watchedId ? current.index : null;
      const resolved = typeof next === 'function' ? next(base) : next;
      return {
        forRun: watchedId,
        playing: current.forRun === watchedId ? current.playing : false,
        index: resolved,
      };
    });

  const mine = useMemo(
    () =>
      records
        .filter((row) => row.workflow_run_id === watchedId)
        .sort((a, b) => a.sequence - b.sequence),
    [records, watchedId],
  );
  const rows = useMemo(
    () => mine.map((row) => timelineRow(row, workflow, account, timezone)),
    [mine, workflow, account, timezone],
  );
  /** The nodes the run passed, in order and without repeats, for the canvas trail. */
  const trail = useMemo(() => {
    const out: string[] = [];
    for (const row of mine) {
      if (row.node_id && out.at(-1) !== row.node_id) out.push(row.node_id);
    }
    return out;
  }, [mine]);

  // A new autoplay request for the watched run starts its trace from the first row (or shows
  // the whole trace at once under reduced motion). Derived from props during render, so the
  // request is honoured exactly once and never re-fires on a re-render.
  const [autoFor, setAutoFor] = useState<number | null>(null);
  if (autoplay && autoplay.runId === watchedId && rows.length > 0 && autoFor !== autoplay.token) {
    setAutoFor(autoplay.token);
    setPlayback({
      forRun: watchedId,
      playing: !reduced,
      index: reduced ? rows.length - 1 : 0,
    });
  }

  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      setPlayback((current) => {
        const base = current.forRun === watchedId ? current.index : null;
        const next = base === null ? 0 : base + 1;
        if (next >= rows.length)
          return { forRun: watchedId, playing: false, index: rows.length - 1 };
        return { forRun: watchedId, playing: true, index: next };
      });
    }, CADENCE_MS);
    return () => clearInterval(timer);
  }, [playing, rows.length, watchedId]);

  useEffect(() => {
    if (index === null) {
      onPlayhead(null, trail, true);
      return;
    }
    const current = mine[index] ?? null;
    // The furthest node the trace has reached by this row (rows without a node — the trigger,
    // the exit — keep the position of the last one that had one). Before any node: -1, so
    // nothing on the canvas is revealed yet.
    let at = -1;
    for (let row = 0; row <= index; row += 1) {
      const nodeId = mine[row]?.node_id;
      if (nodeId) at = trail.indexOf(nodeId);
    }
    // The last row leaves the whole trace revealed; before that, the node at the playhead is
    // settled only once its own row has been reached.
    const settled = index >= rows.length - 1 || (current ? SETTLED.has(current.kind) : true);
    onPlayhead(at, trail, settled);
  }, [index, mine, trail, rows.length, onPlayhead]);

  const watched = runs.find((run) => run.id === watchedId) ?? null;

  return (
    <ToolPanel
      title="Execution timeline"
      density="high"
      actions={
        rows.length > 0 ? (
          <div className={styles.timelineTools}>
            <Button
              size="sm"
              variant="ghost"
              icon={playing ? <IconPause size={16} /> : <IconPlay size={16} />}
              onClick={() => {
                if (playing) {
                  setPlaying(false);
                } else if (reduced) {
                  // No cadence under reduced motion: the whole run is shown at once (MOT-002).
                  setPlayback({ forRun: watchedId, playing: false, index: rows.length - 1 });
                } else {
                  setIndex(null);
                  setPlaying(true);
                }
              }}
              aria-label={playing ? 'Pause playback' : 'Replay the run step by step'}
            >
              {playing ? 'Pause' : 'Replay'}
            </Button>
            {playing && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  setPlayback({ forRun: watchedId, playing: false, index: rows.length - 1 })
                }
                aria-label="Skip to the end of the run"
                data-testid="skip-playback"
              >
                Skip
              </Button>
            )}
            {index !== null && !playing && (
              <Button size="sm" variant="ghost" onClick={() => setIndex(null)}>
                Clear
              </Button>
            )}
          </div>
        ) : undefined
      }
      data-testid="timeline"
      data-playing={playing || undefined}
    >
      {runs.length === 0 ? (
        <p className={styles.muted}>No run yet. Choose a test contact and run the workflow.</p>
      ) : (
        <>
          <RunList
            runs={runs}
            contacts={account.contacts}
            timezone={timezone}
            watchedId={watchedId}
            onWatch={onWatch}
          />
          {watched && (
            <ol className={styles.timeline} aria-label={`What happened to ${watched.contact_id}`}>
              {rows.map((row, at) => (
                <ExecutionEvent
                  key={row.id}
                  time={row.time}
                  name={row.name}
                  detail={row.detail}
                  status={row.status}
                  branch={row.branch}
                  className={styles.timelineRow}
                  data-current={index === at || undefined}
                />
              ))}
            </ol>
          )}
        </>
      )}
    </ToolPanel>
  );
}

/** The runs of this workflow; memoised so a playback tick never re-lists them (PERF-002). */
const RunList = memo(function RunList({
  runs,
  contacts,
  timezone,
  watchedId,
  onWatch,
}: {
  runs: WorkflowRun[];
  contacts: AccountState['contacts'];
  timezone: string;
  watchedId: string | null;
  onWatch: (id: string | null) => void;
}) {
  return (
    <ul className={styles.runList} aria-label="Runs of this workflow">
      {runs.map((run) => (
        <li key={run.id}>
          <button
            type="button"
            className={styles.runItem}
            aria-pressed={run.id === watchedId}
            onClick={() => onWatch(run.id === watchedId ? null : run.id)}
            data-run={run.id}
          >
            <span>
              {contacts[run.contact_id]
                ? `${contacts[run.contact_id]?.first_name} ${contacts[run.contact_id]?.last_name ?? ''}`.trim()
                : run.contact_id}
            </span>
            <span className={styles.small}>
              {RUN_STATUS_WORDS[run.status]} · v{run.definition_version} ·{' '}
              {simulatorTime(run.enrolled_at, timezone)}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
});

/** Memoised: playback ticks re-render only what they change (PERF-002). */
export const Timeline = memo(TimelineInner);
