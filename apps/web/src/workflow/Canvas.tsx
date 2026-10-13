import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react';

import {
  InkSurface,
  Meta,
  WorkflowNode as NodeCard,
  cx,
  usePrefersReducedMotion,
  type WorkflowNodeStatus,
} from '@bloomlab/design-system';
import type {
  AccountState,
  ExecutionRecord,
  Workflow,
  WorkflowNode,
  WorkflowRun,
} from '@bloomlab/simulator-core';

import { COLUMN, ROW } from './graphEdit';
import { CARD_FALLBACK_HEIGHT, measuredPositions, type Positions } from './canvasLayout';
import { featureName, paletteEntry } from './palette';
import { configSummary, nodeKind, nodeName, playbackStatus } from './words';
import styles from './workflow.module.css';

/**
 * The canvas (WFL-001, WFL-005, WFL-007, WFL-012).
 *
 * Nodes are the design system's WorkflowNode, placed with transforms on an ink surface; edges are
 * one SVG. A node can be dragged with a pointer, and every drag has a non-drag twin (A11Y-006):
 * arrow keys move the selected node, and the inspector offers Move up / Move down for order. A
 * drag commits one edit when the pointer lifts — nothing is recorded while it moves.
 *
 * During a test run the node the contact is at is lit in the execution colour and a small dot
 * travels along the edges the run actually took, in the order the engine recorded (the signature
 * moment). Under reduced motion the dot appears where it is with no travel.
 */

export interface CanvasProps {
  workflow: Workflow;
  account: AccountState;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onMove: (id: string, x: number, y: number, positions: Positions) => void;
  /** The run whose status the nodes show, when one is being watched. */
  watched: WorkflowRun | null;
  records: ExecutionRecord[];
  /** Index into the ordered step trail during playback, or null when idle. */
  playhead: number | null;
  trail: string[];
  /** Whether the node at the playhead has reached its recorded status yet. */
  settled: boolean;
}

const CARD_WIDTH = 240;
const CARD_HEIGHT = CARD_FALLBACK_HEIGHT;
const PAD = 24;
const TRIGGER_Y = 0;

const center = (node: { position: { x: number; y: number } }) => ({
  x: node.position.x + PAD + CARD_WIDTH / 2,
  y: node.position.y + PAD + CARD_HEIGHT / 2,
});

function CanvasInner({
  workflow,
  account,
  selectedId,
  onSelect,
  onMove,
  watched,
  records,
  playhead,
  trail,
  settled,
}: CanvasProps) {
  const [dragging, setDragging] = useState<{
    id: string;
    dx: number;
    dy: number;
    x: number;
    y: number;
  } | null>(null);
  const surface = useRef<HTMLDivElement>(null);
  const [heights, setHeights] = useState<Record<string, number>>({});
  const positions = useMemo(() => measuredPositions(workflow, heights), [workflow, heights]);
  useLayoutEffect(() => {
    const cards = surface.current?.querySelectorAll<HTMLElement>('[data-measure-node]');
    if (!cards) return;
    const measure = () => {
      const next = Object.fromEntries(
        [...cards]
          .map((card) => [card.dataset.measureNode!, card.getBoundingClientRect().height])
          .filter(([, height]) => Number(height) > 0),
      );
      setHeights((current) =>
        Object.keys(next).every((id) => current[id] === next[id]) &&
        Object.keys(current).length === Object.keys(next).length
          ? current
          : next,
      );
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    cards.forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, [workflow]);
  const reduced = usePrefersReducedMotion();

  const width = Math.max(
    ...workflow.nodes.map((node) => positions[node.id]!.x + CARD_WIDTH + PAD * 2),
    COLUMN + PAD * 2,
  );
  const height =
    Math.max(
      ...workflow.nodes.map(
        (node) => positions[node.id]!.y + (heights[node.id] ?? CARD_HEIGHT) + PAD * 2,
      ),
      ROW * 2 + PAD * 2,
    ) + ROW;

  const positionOf = (node: WorkflowNode) =>
    dragging && dragging.id === node.id ? { x: dragging.x, y: dragging.y } : positions[node.id]!;

  const onPointerDown = (node: WorkflowNode) => (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    onSelect(node.id);
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    setDragging({
      id: node.id,
      dx: event.clientX - positionOf(node).x,
      dy: event.clientY - positionOf(node).y,
      ...positionOf(node),
    });
  };
  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    setDragging({
      ...dragging,
      x: Math.max(0, event.clientX - dragging.dx),
      y: Math.max(0, event.clientY - dragging.dy),
    });
  };
  const onPointerUp = () => {
    if (!dragging) return;
    const node = workflow.nodes.find((row) => row.id === dragging.id);
    if (node && (positions[node.id]!.x !== dragging.x || positions[node.id]!.y !== dragging.y)) {
      onMove(dragging.id, dragging.x, dragging.y, positions);
    }
    setDragging(null);
  };

  // Keyboard: arrows nudge the selected node; Shift moves further. One edit per key press.
  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (!selectedId) return;
      const node = workflow.nodes.find((row) => row.id === selectedId);
      if (!node) return;
      const step = event.shiftKey ? 64 : 16;
      const moves: Record<string, [number, number]> = {
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
      };
      const move = moves[event.key];
      if (!move) return;
      event.preventDefault();
      onMove(
        node.id,
        Math.max(0, positions[node.id]!.x + move[0]),
        Math.max(0, positions[node.id]!.y + move[1]),
        positions,
      );
    },
    [selectedId, workflow.nodes, onMove, positions],
  );

  useEffect(() => {
    if (!dragging) return;
    const up = () => setDragging(null);
    window.addEventListener('pointercancel', up);
    return () => window.removeEventListener('pointercancel', up);
  }, [dragging]);

  const trigger = paletteEntry(workflow.trigger.ghl_feature_id);
  const entry = workflow.nodes.reduce<WorkflowNode | null>(
    (found, node) =>
      found ? found : workflow.edges.some((edge) => edge.to === node.id) ? null : node,
    null,
  );

  // Where the travelling dot sits: on the node at the playhead (nowhere before the first node),
  // else on the run's current node.
  const dotNode =
    playhead !== null
      ? playhead >= 0
        ? (workflow.nodes.find((node) => node.id === trail[playhead]) ?? null)
        : null
      : watched && watched.current_node_id
        ? (workflow.nodes.find((node) => node.id === watched.current_node_id) ?? null)
        : null;
  const lit = new Set(playhead !== null && playhead >= 0 ? trail.slice(0, playhead + 1) : []);

  return (
    <InkSurface depth="deep" padding="none" className={styles.canvas}>
      <div
        ref={surface}
        className={styles.canvasInner}
        style={{ width, height }}
        role="application"
        aria-label="Workflow canvas. Select a step, then use the arrow keys to move it."
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onClick={(event) => {
          if (event.target === event.currentTarget) onSelect(null);
        }}
        data-testid="workflow-canvas"
      >
        <svg className={styles.edges} width={width} height={height} aria-hidden="true">
          {entry && (
            <g>
              <line
                x1={PAD + CARD_WIDTH / 2}
                y1={TRIGGER_Y + PAD + (heights.trigger ?? CARD_HEIGHT)}
                x2={center(positionedNode(entry, positionOf)).x}
                y2={positionOf(entry).y + PAD}
                className={styles.edge}
              />
              <circle
                className={styles.connectorDot}
                r={3}
                cx={(PAD + CARD_WIDTH / 2 + center(positionedNode(entry, positionOf)).x) / 2}
                cy={
                  (TRIGGER_Y + PAD + (heights.trigger ?? CARD_HEIGHT) + positionOf(entry).y + PAD) /
                  2
                }
              />
            </g>
          )}
          {workflow.edges.map((edge) => {
            const from = workflow.nodes.find((node) => node.id === edge.from);
            const to = workflow.nodes.find((node) => node.id === edge.to);
            if (!from || !to) return null;
            const a = center(positionedNode(from, positionOf));
            const b = center(positionedNode(to, positionOf));
            const start = {
              x: a.x,
              y: positionOf(from).y + PAD + (heights[from.id] ?? CARD_HEIGHT),
            };
            const end = { x: b.x, y: positionOf(to).y + PAD };
            const mid = (start.y + end.y) / 2;
            const active = lit.has(edge.from) && lit.has(edge.to);
            return (
              <g key={`${edge.from}-${edge.to}-${edge.branch ?? ''}`}>
                <path
                  d={`M ${start.x} ${start.y} C ${start.x} ${mid}, ${end.x} ${mid}, ${end.x} ${end.y}`}
                  className={cx(styles.edge, active && styles.edgeActive)}
                />
                <circle className={styles.connectorDot} r={3} cx={(start.x + end.x) / 2} cy={mid} />
                {edge.branch && (
                  <text x={(start.x + end.x) / 2 + 6} y={mid - 4} className={styles.edgeLabel}>
                    {edge.branch}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        <div
          data-measure-node="trigger"
          className={styles.triggerCard}
          style={{ transform: `translate(${PAD}px, ${TRIGGER_Y + PAD}px)` }}
        >
          <NodeCard
            kind="trigger"
            name={trigger ? trigger.name : 'Choose a trigger'}
            config={
              workflow.trigger.filters.length > 0 ? (
                <Meta
                  items={workflow.trigger.filters.map((filter) => ({
                    kind: 'text',
                    label: `${filter.field} ${filter.operator} ${String(filter.value ?? '')}`,
                  }))}
                />
              ) : trigger ? (
                'No filters'
              ) : (
                'What starts this workflow?'
              )
            }
            status={watched ? 'done' : 'idle'}
            approximation={Boolean(trigger?.approximation)}
            selected={selectedId === 'trigger'}
            onClick={() => onSelect('trigger')}
            data-node="trigger"
          />
        </div>

        {workflow.nodes.map((node) => {
          const position = positionOf(node);
          const status: WorkflowNodeStatus = playbackStatus(
            node,
            watched,
            records,
            playhead,
            trail,
            settled,
          );
          const runnable =
            node.type === 'end' || paletteEntry(node.ghl_feature_id)?.runnable === true;
          return (
            <div
              key={node.id}
              data-measure-node={node.id}
              className={styles.placed}
              style={{ transform: `translate(${position.x + PAD}px, ${position.y + PAD}px)` }}
              data-dragging={dragging?.id === node.id || undefined}
              onPointerDown={onPointerDown(node)}
            >
              <NodeCard
                kind={nodeKind(node)}
                name={
                  runnable
                    ? nodeName(node)
                    : `${featureName(node.ghl_feature_id)} (practised in GHL)`
                }
                config={configSummary(node, account)}
                status={runnable ? status : 'failed'}
                approximation={Boolean(paletteEntry(node.ghl_feature_id)?.approximation)}
                selected={selectedId === node.id}
                className={styles.placedNode}
                onClick={() => onSelect(node.id)}
                data-node={node.id}
              />
            </div>
          );
        })}

        {dotNode && (
          <span
            className={styles.travelling}
            data-testid="travelling-contact"
            style={
              {
                transform: `translate(${positionOf(dotNode).x + PAD + CARD_WIDTH - 7}px, ${positionOf(dotNode).y + PAD - 7}px)`,
                transition: reduced ? 'none' : undefined,
              } as CSSProperties
            }
            aria-hidden="true"
          />
        )}

        {workflow.nodes.length === 0 && (
          <div className={styles.emptyCanvas}>
            <p>
              No steps yet. Add the first one from the palette, or pick a trigger to start with.
            </p>
          </div>
        )}
      </div>
    </InkSurface>
  );
}

const positionedNode = (
  node: WorkflowNode,
  positionOf: (node: WorkflowNode) => { x: number; y: number },
): { position: { x: number; y: number } } => ({ position: positionOf(node) });

/** Memoised: playback ticks re-render only what they change (PERF-002). */
export const Canvas = memo(CanvasInner);
