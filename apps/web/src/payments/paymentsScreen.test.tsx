import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRun } from '@bloomlab/simulator-core';
import type { CrmRunApi } from '../crm/useCrmRun';
import PaymentsLab from './PaymentsLab';

const mocked = vi.hoisted(() => ({ state: {} as CrmRunApi }));
vi.mock('../crm/useCrmRun', () => ({
  CRM_SCENARIO_ID: 'SC-glowhaus-crm',
  useCrmRun: () => mocked.state,
}));
const open = () =>
  render(
    <MemoryRouter>
      <PaymentsLab />
    </MemoryRouter>,
  );
beforeEach(() => {
  mocked.state = {
    run: null,
    scenario: null,
    runs: [],
    runIds: [],
    loading: true,
    problem: null,
    refusal: null,
    apply: vi.fn(async () => false),
    reset: vi.fn(async () => {}),
    switchRun: vi.fn(async () => {}),
    dismissRefusal: vi.fn(),
  };
});
describe('Payments Lab state boundaries', () => {
  it('announces loading without a simulated success', () => {
    open();
    expect(screen.getByRole('status')).toHaveTextContent('Opening the shared training account');
    expect(screen.queryByText(/Saved in this training account/)).toBeNull();
  });
  it('reports a storage failure without inventing an empty account', () => {
    mocked.state.loading = false;
    mocked.state.problem = 'Storage is unavailable';
    open();
    expect(screen.getByRole('alert')).toHaveTextContent('Storage is unavailable');
    expect(screen.queryByText('No Lab prices yet.')).toBeNull();
  });
  it('distinguishes a genuinely empty catalog and displays a refusal', () => {
    mocked.state.loading = false;
    mocked.state.run = {
      generation: 'test',
      checkpoints: [],
      state: createRun({
        id: 'SC-empty',
        simulation_time: '2026-09-09T09:00:00Z',
        timezone: 'UTC',
        seed: 25,
        initial_account_state: {},
      }),
    };
    mocked.state.refusal = {
      code: 'INVALID_PAYLOAD',
      message: 'That invoice is already paid.',
      detail: {},
    };
    open();
    expect(screen.getByText(/No Lab prices yet/)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('That invoice is already paid');
    expect(screen.getByText(/No card, provider or real charge/)).toBeInTheDocument();
  });
});
