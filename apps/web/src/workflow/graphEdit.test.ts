import { describe, expect, it } from 'vitest';

import type { Workflow } from '@bloomlab/simulator-core';

import { blankWorkflow } from './commands';
import {
  addNode,
  branchNames,
  connect,
  disconnect,
  orderedSteps,
  removeNode,
  reorder,
  setNodeFeature,
  setSettings,
  setTrigger,
  setTriggerFilters,
} from './graphEdit';
import { paletteFrom, PALETTE } from './palette';

/**
 * The twelve editor operations as pure edits (WFL-002) and the registry-driven palette (WFL-011).
 * A definition goes in, a definition comes out, and nothing else is touched.
 */

const ids = (workflow: Workflow) => orderedSteps(workflow).map((step) => step.node.id);
const edges = (workflow: Workflow) =>
  workflow.edges.map((edge) => `${edge.from}>${edge.to}${edge.branch ? `:${edge.branch}` : ''}`);

const chain = (): Workflow => {
  let workflow = setTrigger(blankWorkflow('wf-t', 'T'), 'GHL-WF-CONTACT-CREATED');
  workflow = addNode(workflow, 'GHL-WF-SEND-SMS', 'action').workflow; // n1
  workflow = addNode(workflow, 'GHL-WF-ADD-CONTACT-TAG', 'action').workflow; // n2
  workflow = addNode(workflow, null, 'end').workflow; // n3
  return workflow;
};

describe('graph edits (WFL-002)', () => {
  it('adds steps in a chain and splices a step after a chosen one', () => {
    const base = chain();
    expect(ids(base)).toEqual(['n1', 'n2', 'n3']);
    expect(edges(base)).toEqual(['n1>n2', 'n2>n3']);
    const { workflow, node } = addNode(base, 'GHL-WF-WAIT', 'wait', 'n1');
    expect(node.id).toBe('n4');
    expect(ids(workflow)).toEqual(['n1', 'n4', 'n2', 'n3']);
    expect(edges(workflow).sort()).toEqual(['n1>n4', 'n2>n3', 'n4>n2']);
    expect(node.config).toEqual({ wait_type: 'period', days: 1 });
  });

  it('removes a step and closes the gap', () => {
    const workflow = removeNode(chain(), 'n2');
    expect(ids(workflow)).toEqual(['n1', 'n3']);
    expect(edges(workflow)).toEqual(['n1>n3']);
  });

  it('connects and disconnects, replacing what a step led to, and refuses a self-loop', () => {
    let workflow = connect(chain(), 'n1', 'n3');
    expect(edges(workflow).sort()).toEqual(['n1>n3', 'n2>n3']);
    workflow = disconnect(workflow, 'n1', 'n3');
    expect(edges(workflow)).toEqual(['n2>n3']);
    expect(connect(workflow, 'n2', 'n2')).toBe(workflow);
  });

  it('reorders along a chain in both directions', () => {
    const up = reorder(chain(), 'n2', 'up');
    expect(ids(up)).toEqual(['n2', 'n1', 'n3']);
    const down = reorder(chain(), 'n1', 'down');
    expect(ids(down)).toEqual(['n2', 'n1', 'n3']);
    // The first step has nothing above it; the last has nothing below.
    const fixed = chain();
    expect(reorder(fixed, 'n1', 'up')).toBe(fixed);
    expect(reorder(fixed, 'n3', 'down')).toBe(fixed);
  });

  it('names branch connections after the branches, with None last, and walks each path', () => {
    let workflow = setTrigger(blankWorkflow('wf-b', 'B'), 'GHL-WF-CONTACT-CREATED');
    workflow = addNode(workflow, 'GHL-WF-IF-ELSE', 'branch').workflow; // n1 with a "Yes" branch
    const branch = workflow.nodes[0]!;
    expect(branchNames(branch)).toEqual(['Yes', 'None']);
    workflow = addNode(workflow, 'GHL-WF-SEND-SMS', 'action', 'n1', 'Yes').workflow; // n2
    workflow = addNode(workflow, 'GHL-WF-SEND-EMAIL', 'action', 'n1', 'None').workflow; // n3
    expect(edges(workflow).sort()).toEqual(['n1>n2:Yes', 'n1>n3:None']);
    expect(orderedSteps(workflow).map((step) => [step.node.id, step.branch])).toEqual([
      ['n1', null],
      ['n2', 'Yes'],
      ['n3', 'None'],
    ]);
    // Connecting a branch replaces only that branch's connection.
    workflow = connect(workflow, 'n1', 'n3', 'Yes');
    expect(edges(workflow).sort()).toEqual(['n1>n3:None', 'n1>n3:Yes']);
  });

  it('changes a step’s feature, its type following the feature, and resets the config', () => {
    const workflow = setNodeFeature(chain(), 'n1', 'GHL-WF-WAIT');
    expect(workflow.nodes[0]).toMatchObject({
      type: 'wait',
      ghl_feature_id: 'GHL-WF-WAIT',
      config: { wait_type: 'period', days: 1 },
    });
  });

  it('sets the trigger, its filters and the settings without touching the steps', () => {
    let workflow = setTrigger(chain(), 'GHL-WF-APPOINTMENT-STATUS');
    workflow = setTriggerFilters(workflow, [
      { field: 'appointment_status', operator: 'is', value: 'no_show' },
    ]);
    workflow = setSettings(workflow, {
      allow_reentry: true,
      time_window: { days: [1, 2], start: '09:00', end: '17:00' },
    });
    expect(workflow.trigger).toEqual({
      ghl_feature_id: 'GHL-WF-APPOINTMENT-STATUS',
      filters: [{ field: 'appointment_status', operator: 'is', value: 'no_show' }],
    });
    expect(workflow.settings.allow_reentry).toBe(true);
    expect(workflow.settings.time_window?.days).toEqual([1, 2]);
    expect(ids(workflow)).toEqual(['n1', 'n2', 'n3']);
  });
});

describe('the palette is the registry (WFL-011)', () => {
  it('lists every workflow trigger and action, marks the ones the engine cannot run, and hardcodes none', () => {
    expect(PALETTE.length).toBeGreaterThanOrEqual(20);
    const goal = PALETTE.find((entry) => entry.id === 'GHL-WF-GOAL-EVENT');
    expect(goal).toMatchObject({ runnable: false, kind: 'action' });
    expect(goal?.practised).toBeTruthy();
    const sms = PALETTE.find((entry) => entry.id === 'GHL-WF-SEND-SMS');
    expect(sms).toMatchObject({ runnable: true, nodeType: 'action', name: 'Send SMS' });
    const wait = PALETTE.find((entry) => entry.id === 'GHL-WF-WAIT');
    expect(wait).toMatchObject({
      runnable: true,
      nodeType: 'wait',
      approximation: expect.any(String),
    });
    expect(PALETTE.find((entry) => entry.id === 'GHL-WF-CUSTOM-WEBHOOK')).toMatchObject({
      name: 'Custom Webhook',
      runnable: true,
      nodeType: 'action',
    });
    expect(PALETTE.find((entry) => entry.id === 'GHL-WF-WEBHOOK')).toMatchObject({
      name: 'Webhook',
      runnable: false,
      kind: 'action',
    });
  });

  it('a registry record added later appears without a code change, and is not shown as runnable', () => {
    const invented = {
      id: 'GHL-WF-SEND-CARRIER-PIGEON',
      official_name: 'Send Carrier Pigeon',
      area: 'Workflows',
      feature_type: 'action',
      implementation_type: 'native_ghl',
      status: 'current',
      simulation_fidelity: 'C',
      last_verified: '2026-09-04',
      source_url: 'https://help.gohighlevel.com/support/solutions/articles/000',
      known_limitations: ['A test record.'],
      skills: [],
      supported_configs: { filters: [], config_fields: [], options: [] },
      approximation_note: 'Conceptual demonstration — a test record.',
      aliases: [],
    } as const;
    const palette = paletteFrom([...PALETTE.map((entry) => entry.feature), invented as never]);
    const pigeon = palette.find((entry) => entry.id === invented.id);
    expect(pigeon).toMatchObject({ name: 'Send Carrier Pigeon', runnable: false, kind: 'action' });
    expect(pigeon?.practised).toBe('Conceptual demonstration — a test record.');
    // Runnable entries come first, so a non-running record never sits among them.
    const firstNonRunnable = palette.findIndex((entry) => !entry.runnable);
    expect(palette.slice(firstNonRunnable).every((entry) => !entry.runnable)).toBe(true);
  });
});
