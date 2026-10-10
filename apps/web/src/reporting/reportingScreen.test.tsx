import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { buildReport, type SimulatorScenario } from '@bloomlab/simulator-core';
import { getFeatureFlags } from '@bloomlab/shared';
import { App } from '../app/App';
import { content } from '../content/bundle';
import { db } from '../data/db';
import { startRun } from '../simulator/store';
import { EvidenceDrawer } from './EvidenceDrawer';

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
});
afterEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
});

it('uses the consistent reset action label in Reporting', async () => {
  render(
    <MemoryRouter initialEntries={['/reporting']}>
      <App flags={getFeatureFlags('production')} />
    </MemoryRouter>,
  );
  expect(
    await screen.findByRole('button', { name: 'Reset account' }, { timeout: 8000 }),
  ).toBeInTheDocument();
});

it('shows evidence record facts separately without dot separators', async () => {
  const scenario = content.scenarios.find(
    (row) => row.id === 'SC-glowhaus-crm',
  ) as unknown as SimulatorScenario;
  const run = await startRun(scenario, db);
  const metric = { ...buildReport(run.state).metrics.leads, evidence_record_ids: ['maria'] };
  render(<EvidenceDrawer state={run.state} metric={metric} onClose={() => {}} />);
  const records = screen.getByTestId('evidence-records');
  expect(records).toHaveTextContent('Maria Delgado');
  expect(records).toHaveTextContent('contact maria');
  expect(records.textContent).not.toMatch(/[·•]| \| /);
});
