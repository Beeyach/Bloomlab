import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it } from 'vitest';
import type { SimulatorScenario } from '@bloomlab/simulator-core';
import { content } from '../content/bundle';
import { db } from '../data/db';
import { loadRun, startRun } from '../simulator/store';
import { runCommand } from './commands';
import { AdvancedCrm } from './AdvancedCrm';

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
});
afterEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
});

it('separates generated notification facts for display without changing saved history', async () => {
  const scenario = content.scenarios.find(
    (row) => row.id === 'SC-glowhaus-crm',
  ) as unknown as SimulatorScenario;
  let run = await startRun(scenario, db);
  const events = [
    {
      type: 'OBJECT_SCHEMA_SAVED' as const,
      payload: {
        id: 'properties',
        name: 'Properties',
        fields: [{ key: 'ready', type: 'boolean', required: true }],
      },
    },
    {
      type: 'OBJECT_AUTOMATION_SAVED' as const,
      payload: {
        id: 'notify',
        schema_id: 'properties',
        on: 'created',
        field: 'ready',
        equals: true,
        recipient: 'priya',
        message: 'Review property',
        enabled: true,
      },
    },
    {
      type: 'OBJECT_RECORD_SAVED' as const,
      payload: {
        id: 'home-two',
        schema_id: 'properties',
        name: 'Home Two',
        values: { ready: true },
      },
    },
  ];
  for (const event of events) {
    const outcome = await runCommand(run, event, db);
    if (!outcome.ok) throw new Error(outcome.refusal.message);
    run = outcome.run;
  }
  const before = structuredClone(run.state.log);
  expect(before.at(-1)?.payload.message).toBe('Review property · Home Two');
  render(<AdvancedCrm run={run} area="objects" apply={async () => false} />);
  fireEvent.change(screen.getByTestId('object-picker'), { target: { value: 'properties' } });
  const message = screen.getByText('Review property');
  expect(message.closest('li')).toHaveTextContent('Review property Home Two');
  expect(message.closest('li')).toHaveTextContent('recorded, not delivered');
  expect(message.closest('li')?.textContent).not.toMatch(/[·•]| \| /);
  expect(run.state.log).toEqual(before);
  expect((await loadRun(run.state.run_id, db))?.state.log).toEqual(before);
});
