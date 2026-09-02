import type { ComponentPropsWithRef } from 'react';

import { cx } from '../utils/cx';
import { StatusPill, type StatusGlyph, type StatusTone } from './StatusPill';
import styles from './WorkflowNode.module.css';

export type WorkflowNodeKind = 'trigger' | 'action' | 'wait' | 'if_else' | 'end';
export type WorkflowNodeStatus = 'idle' | 'running' | 'waiting' | 'done' | 'skipped' | 'failed';

const KIND_LABELS: Record<WorkflowNodeKind, string> = {
  trigger: 'Trigger',
  action: 'Action',
  wait: 'Wait',
  if_else: 'If / Else',
  end: 'End',
};

const STATUS: Record<WorkflowNodeStatus, { label: string; tone: StatusTone; glyph: StatusGlyph }> =
  {
    idle: { label: 'Idle', tone: 'neutral', glyph: 'ring' },
    running: { label: 'Running', tone: 'execution', glyph: 'dot' },
    waiting: { label: 'Waiting', tone: 'warning', glyph: 'clock' },
    done: { label: 'Done', tone: 'success', glyph: 'check' },
    skipped: { label: 'Skipped', tone: 'neutral', glyph: 'skip' },
    failed: { label: 'Failed', tone: 'error', glyph: 'cross' },
  };

export interface WorkflowNodeProps extends ComponentPropsWithRef<'button'> {
  kind: WorkflowNodeKind;
  /** Real GHL feature name from the registry (spec §51, GHL-010). */
  name: string;
  /** One concise configuration line; everything else lives in the inspector (spec §53). */
  config?: string;
  status?: WorkflowNodeStatus;
  /** Registry fidelity B/C: clearly marked (spec §26, §51). */
  approximation?: boolean;
  selected?: boolean;
}

/** A workflow step on the canvas: action type, real feature name, concise config, status. */
export function WorkflowNode({
  kind,
  name,
  config,
  status = 'idle',
  approximation = false,
  selected = false,
  className,
  type = 'button',
  ...rest
}: WorkflowNodeProps) {
  const s = STATUS[status];
  return (
    <button
      type={type}
      className={cx(styles.node, styles[kind], className)}
      aria-pressed={selected}
      data-kind={kind}
      data-status={status}
      {...rest}
    >
      <span className={styles.accent} aria-hidden="true" />
      <span className={styles.body}>
        <span className={styles.kind}>{KIND_LABELS[kind]}</span>
        <span className={styles.name}>{name}</span>
        {config && <span className={styles.config}>{config}</span>}
        <span className={styles.foot}>
          <StatusPill label={s.label} tone={s.tone} glyph={s.glyph} live={status === 'running'} />
          {approximation && <span className={styles.approx}>Training approximation</span>}
        </span>
      </span>
    </button>
  );
}
