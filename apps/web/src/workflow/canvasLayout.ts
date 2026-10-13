import type { Workflow } from '@bloomlab/simulator-core';
import { orderedSteps, ROW, tidy } from './graphEdit';

export const CARD_FALLBACK_HEIGHT = 96;
export const CARD_GAP = 28;
const LEGACY_ROW = 120;
export type Positions = Record<string, { x: number; y: number }>;

/** Display-only spacing for the editor's canonical layouts; custom coordinates remain exact. */
export function measuredPositions(workflow: Workflow, heights: Record<string, number>): Positions {
  const canonical = tidy(workflow);
  const isAutomatic = [ROW, LEGACY_ROW].some((row) =>
    workflow.nodes.every((node, index) => {
      const expected = canonical.nodes[index]!.position;
      return node.position.x === expected.x && node.position.y === (expected.y / ROW) * row;
    }),
  );
  if (!isAutomatic)
    return Object.fromEntries(workflow.nodes.map((node) => [node.id, node.position]));
  const positions: Positions = {};
  let y = (heights.trigger ?? CARD_FALLBACK_HEIGHT) + CARD_GAP;
  for (const { node } of orderedSteps(workflow)) {
    positions[node.id] = { x: node.position.x, y };
    y += (heights[node.id] ?? CARD_FALLBACK_HEIGHT) + CARD_GAP;
  }
  return positions;
}

/** A deliberate move captures the displayed layout in the same undoable edit. */
export function movePresentedNode(
  workflow: Workflow,
  id: string,
  x: number,
  y: number,
  positions: Positions,
): Workflow {
  return {
    ...workflow,
    nodes: workflow.nodes.map((node) => ({
      ...node,
      position:
        node.id === id
          ? { x: Math.round(x), y: Math.round(y) }
          : (positions[node.id] ?? node.position),
    })),
  };
}
