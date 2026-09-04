import { useEffect, useMemo, useState } from 'react';

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
 * actually visited. Under reduced motion the cadence is off and the highlight jumps.
 */

export interface TimelineProps {
  workflow: Workflow;
  account: AccountState;
  timezone: string;
  runs: WorkflowRun[];
  watchedId: string | null;
  onWatch: (id: string | null) => void;
  records: ExecutionRecord[];
  /** Reported so the canvas can light the trail at the same place. */
  onPlayhead: (index: number | null, trail: string[]) => void;
}

const CADENCE_MS = 650;

export function Timeline({
  workflow,
  account,
  timezone,
  runs,
  watchedId,
  onWatch,
  records,
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
      onPlayhead(null, trail);
      return;
    }
    const nodeId = mine[index]?.node_id ?? null;
    const at = nodeId ? trail.indexOf(nodeId) : -1;
    onPlayhead(at >= 0 ? at : null, trail);
  }, [index, mine, trail, onPlayhead]);

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
            {index !== null && !playing && (
              <Button size="sm" variant="ghost" onClick={() => setIndex(null)}>
                Clear
              </Button>
            )}
          </div>
        ) : undefined
      }
      data-testid="timeline"
    >
      {runs.length === 0 ? (
        <p className={styles.muted}>No run yet. Choose a test contact and run the workflow.</p>
      ) : (
        <>
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
                    {account.contacts[run.contact_id]
                      ? `${account.contacts[run.contact_id]?.first_name} ${account.contacts[run.contact_id]?.last_name ?? ''}`.trim()
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
