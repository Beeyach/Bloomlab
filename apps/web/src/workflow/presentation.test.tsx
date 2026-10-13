import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { addNode, moveNode } from './graphEdit';
import { blankWorkflow } from './commands';
import { measuredPositions, movePresentedNode } from './canvasLayout';
import { ZonedDateTime } from './ZonedDateTime';
import { wallTimeInstant } from './wallTime';
import { edit, startHistory, undo, redo } from './draft';

describe('measured automatic workflow placement', () => {
  it('uses the measured trigger and card heights with a 28px gap', () => {
    let workflow = addNode(blankWorkflow(), 'GHL-WF-SEND-SMS', 'action').workflow;
    workflow = addNode(workflow, null, 'end').workflow;
    const positions = measuredPositions(workflow, { trigger: 140, n1: 121, n2: 96 });
    expect(positions.n1).toEqual({ x: 0, y: 168 });
    expect(positions.n2).toEqual({ x: 0, y: 317 });
    expect(workflow.nodes[0]?.position.y).toBe(150);
  });
  it('preserves manually arranged coordinates', () => {
    const workflow = moveNode(addNode(blankWorkflow(), null, 'end').workflow, 'n1', 89, 247);
    expect(measuredPositions(workflow, { trigger: 140, n1: 121 }).n1).toEqual({ x: 89, y: 247 });
  });
  it('keeps other displayed cards in place after a first nudge and supports undo and redo', () => {
    let workflow = addNode(blankWorkflow(), 'GHL-WF-SEND-SMS', 'action').workflow;
    workflow = addNode(workflow, null, 'end').workflow;
    const heights = { trigger: 140, n1: 121, n2: 96 };
    const positions = measuredPositions(workflow, heights);
    const moved = movePresentedNode(workflow, 'n1', 16, positions.n1!.y, positions);
    const history = edit(startHistory(workflow), moved);
    expect(measuredPositions(moved, heights).n2).toEqual(positions.n2);
    expect(measuredPositions(undo(history).present, heights)).toEqual(positions);
    expect(redo(undo(history)).present.nodes).toEqual(moved.nodes);
  });
});

describe('calendar-zone date and time choices', () => {
  it('applies the offset on the chosen date, independent of the computer zone', () => {
    expect(wallTimeInstant('2026-07-04', '09:30', 'America/Chicago')).toBe(
      '2026-07-04T09:30:00-05:00',
    );
    expect(wallTimeInstant('2026-12-04', '09:30', 'America/Chicago')).toBe(
      '2026-12-04T09:30:00-06:00',
    );
  });
  it('refuses the skipped spring hour and preserves an existing fall-back occurrence', () => {
    expect(wallTimeInstant('2026-03-08', '02:30', 'America/Chicago')).toBeNull();
    expect(
      wallTimeInstant('2026-11-01', '01:30', 'America/Chicago', '2026-11-01T01:30:00-06:00'),
    ).toBe('2026-11-01T01:30:00-06:00');
  });
  it('exposes labelled date and time fields, a zone, and emits an offset-bearing instant', () => {
    const onChange = vi.fn();
    render(
      <ZonedDateTime
        label="Starts at"
        value="2026-09-04T09:00:00-05:00"
        zone="America/Chicago"
        onChange={onChange}
      />,
    );
    expect(screen.getByLabelText('Starts at date')).toHaveAttribute('type', 'date');
    expect(screen.getByLabelText('Starts at time')).toHaveAttribute('type', 'time');
    expect(screen.getByText('America/Chicago')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Starts at date'), { target: { value: '2026-12-04' } });
    expect(onChange).toHaveBeenCalledWith('2026-12-04T09:00:00-06:00');
  });
});
