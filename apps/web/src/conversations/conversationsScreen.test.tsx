import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getFeatureFlags } from '@bloomlab/shared';
import type { SimulatorScenario, Workflow } from '@bloomlab/simulator-core';

import { App } from '../app/App';
import { content } from '../content/bundle';
import { db } from '../data/db';
import { ensureDevice } from '../data/device';
import { rememberRun } from '../simulator/currentRun';
import { loadRun, startRun } from '../simulator/store';
import { blankWorkflow, enrolTestContact, saveWorkflow } from '../workflow/commands';

/**
 * Conversations (CONV-001), through the real App at `/conversations`.
 *
 * A workflow that texts and then waits for a reply is saved and run through the command layer;
 * the inbox then shows the text with its sender, and replying as Maria releases the wait so the
 * workflow's next step lands in the same account. Nothing here is a mocked message.
 */

const flags = getFeatureFlags('production');
const scenario = (content.scenarios as unknown as SimulatorScenario[]).find(
  (row) => row.id === 'SC-glowhaus-no-show',
) as SimulatorScenario;

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <App flags={flags} />
    </MemoryRouter>,
  );

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
  await ensureDevice();
});

afterEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
});

const asker: Workflow = {
  ...blankWorkflow('wf-ask', 'Confirm by text'),
  trigger: { ghl_feature_id: 'GHL-WF-CONTACT-TAG', filters: [] },
  nodes: [
    {
      id: 's1',
      type: 'action',
      ghl_feature_id: 'GHL-WF-SEND-SMS',
      label: null,
      config: { template: 'Reply YES to confirm, {{contact.first_name}}.' },
      position: { x: 0, y: 0 },
    },
    {
      id: 'w1',
      type: 'wait',
      ghl_feature_id: 'GHL-WF-WAIT',
      label: null,
      config: { wait_type: 'reply', channel: 'sms' },
      position: { x: 0, y: 1 },
    },
    {
      id: 't1',
      type: 'action',
      ghl_feature_id: 'GHL-WF-ADD-CONTACT-TAG',
      label: null,
      config: { tag: 'confirmed' },
      position: { x: 0, y: 2 },
    },
  ],
  edges: [
    { from: 's1', to: 'w1', branch: null },
    { from: 'w1', to: 't1', branch: null },
  ],
};

describe('Conversations shows the account’s messages and a reply reaches the workflows (CONV-001)', () => {
  it('lists the text a workflow sent, names the sender, and releases the reply wait on reply', async () => {
    let run = await startRun(scenario);
    const direct = { createWorker: null };
    const saved = await saveWorkflow(run, scenario, asker, direct);
    if (!saved.ok) throw new Error(saved.refusal.message);
    const enrolled = await enrolTestContact(saved.run, scenario, 'wf-ask', 'maria', {}, direct);
    if (!enrolled.ok) throw new Error(enrolled.refusal.message);
    run = enrolled.run;
    await rememberRun(scenario.id, run.state.run_id);

    renderAt('/conversations');
    await screen.findByText('Account time', {}, { timeout: 8000 });
    const threads = await screen.findByRole('list', { name: 'Conversations' });
    fireEvent.click(within(threads).getByText('Maria Delgado'));
    const thread = await screen.findByTestId('thread');
    expect(within(thread).getByText('Reply YES to confirm, Maria.')).toBeInTheDocument();
    expect(within(thread).getByText(/sent by Confirm by text \(Send SMS\)/)).toBeInTheDocument();
    expect(screen.getByText('Waiting for a reply').nextElementSibling).toHaveTextContent('1');

    fireEvent.change(within(thread).getByLabelText('Message'), { target: { value: 'YES' } });
    fireEvent.click(within(thread).getByTestId('send-message'));
    await waitFor(() => expect(thread.querySelector('[data-direction="inbound"]')).not.toBeNull(), {
      timeout: 8000,
    });
    const inbound = thread.querySelector('[data-direction="inbound"]') as HTMLElement;
    expect(inbound).toHaveTextContent('YES');
    expect(inbound).toHaveTextContent(/Maria Delgado · Text/);

    await waitFor(async () => {
      const reloaded = await loadRun(run.state.run_id);
      expect(reloaded?.state.account.contacts.maria?.tags).toContain('confirmed');
      const askRun = Object.values(reloaded?.state.account.workflow_runs ?? {}).find(
        (row) => row.workflow_id === 'wf-ask',
      );
      expect(askRun?.status).toBe('completed');
    });
    expect(screen.getByText('Waiting for a reply').nextElementSibling).toHaveTextContent('0');
  });
});
