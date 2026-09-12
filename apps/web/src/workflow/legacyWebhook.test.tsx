import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { createRun, type SimulatorScenario } from '@bloomlab/simulator-core';

import { content } from '../content/bundle';
import { NodeInspector, type InspectorEdits } from './NodeInspector';
import { PALETTE } from './palette';
import { nodeName } from './words';

it.each([true, false])(
  'WEBHOOK-LEGACY-003 preserves method and header editing (legacy=%s)',
  (legacy) => {
    const scenario = content.scenarios.find(
      (row) => row.id === 'SC-glowhaus-incident-webhook-auth',
    ) as unknown as SimulatorScenario;
    const { account } = createRun(scenario);
    const workflow = account.workflows['wf-rota-sync']!;
    const node = workflow.nodes[0]!;
    if (legacy) node.ghl_feature_id = 'GHL-WF-WEBHOOK';
    node.config.method = legacy ? 'PATCH' : 'POST';
    const setConfig = vi.fn();
    const edits: InspectorEdits = {
      setConfig,
      setFeature: vi.fn(),
      setLabel: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
      remove: vi.fn(),
      reorder: vi.fn(),
      setTrigger: vi.fn(),
      setFilters: vi.fn(),
      rename: vi.fn(),
      setSettings: vi.fn(),
    };
    render(
      <NodeInspector
        workflow={workflow}
        account={account}
        selectedId={node.id}
        issues={[]}
        edits={edits}
        onClose={vi.fn()}
      />,
    );
    expect(nodeName(node)).toBe(legacy ? 'Saved webhook (legacy simulation)' : 'Custom Webhook');
    expect(screen.getByLabelText(/^method/)).toHaveValue(legacy ? 'PATCH' : 'POST');
    expect(screen.queryByRole('option', { name: 'PATCH' }) !== null).toBe(legacy);
    expect(screen.getByLabelText('Headers')).toHaveValue('Authorization=Bearer rota_live_4a71');
    expect(screen.queryByText(/A test contact cannot pass through/)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/^url/), {
      target: { value: 'https://example.test/new' },
    });
    expect(setConfig).toHaveBeenCalledWith(node.id, {
      ...node.config,
      url: 'https://example.test/new',
    });
    fireEvent.change(screen.getByLabelText('Headers'), {
      target: { value: 'Authorization=Bearer replacement' },
    });
    expect(setConfig).toHaveBeenLastCalledWith(node.id, {
      ...node.config,
      headers: { Authorization: 'Bearer replacement' },
    });
    expect(PALETTE.find((entry) => entry.id === 'GHL-WF-WEBHOOK')?.runnable).toBe(false);
    expect(PALETTE.find((entry) => entry.id === 'GHL-WF-CUSTOM-WEBHOOK')?.runnable).toBe(true);
  },
);
