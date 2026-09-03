import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { db, ensureDevice, renameDevice } from '../data';
import { DeviceIdentity } from './DeviceIdentity';

beforeEach(async () => {
  await db.device.clear();
});

describe('DeviceIdentity (DATA-001 first interaction)', () => {
  it('shows the device once it exists and renames it through IndexedDB', async () => {
    render(
      <MemoryRouter>
        <DeviceIdentity />
      </MemoryRouter>,
    );
    expect(screen.getByRole('status')).toHaveTextContent(/preparing this device/i);

    await ensureDevice();
    const device = await renameDevice('Bench device');
    expect(await screen.findByText(device.label)).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Rename' }));
    const input = screen.getByRole('textbox', { name: 'Device name' });
    await user.clear(input);
    await user.type(input, 'Studio laptop');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Studio laptop')).toBeInTheDocument();
    await waitFor(async () => expect((await ensureDevice()).label).toBe('Studio laptop'));
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('refuses an empty name without losing the current one', async () => {
    const device = await renameDevice('Bench device');
    render(
      <MemoryRouter>
        <DeviceIdentity />
      </MemoryRouter>,
    );
    await screen.findByText(device.label);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Rename' }));
    await user.clear(screen.getByRole('textbox', { name: 'Device name' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/needs a name/i);
    expect((await ensureDevice()).label).toBe(device.label);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByText(device.label)).toBeInTheDocument();
  });
});
