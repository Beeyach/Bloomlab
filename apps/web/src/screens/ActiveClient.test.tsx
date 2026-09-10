import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../data/db';
import { clientProgressId, ensureClients, saveClientNote } from '../clients/store';
import { ActiveClient } from './ActiveClient';

const client = 'CL-glowhaus-medspa';
const open = () =>
  render(
    <MemoryRouter>
      <ActiveClient />
    </MemoryRouter>,
  );
beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
});

describe('Home active client (DES-010)', () => {
  it('does not invent active work from seeded records or create any records on read', async () => {
    await ensureClients();
    const before = await db.sync_queue.toArray();
    open();
    expect(await screen.findByText(/No saved client work yet/)).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/clients');
    expect(await db.sync_queue.toArray()).toEqual(before);
  });
  it('reacts to real saved work and preserves the destination on remount', async () => {
    await ensureClients();
    const view = open();
    await screen.findByText(/No saved client work yet/);
    await saveClientNote(client, 'Verify the calendar owner.', 'discovery');
    expect(await screen.findByRole('link', { name: /Glowhaus/i })).toHaveAttribute(
      'href',
      `/clients/${client}`,
    );
    expect(screen.getByText(/Most recently worked with/)).toHaveTextContent('discovery');
    view.unmount();
    open();
    expect(await screen.findByRole('link', { name: /Glowhaus/i })).toBeInTheDocument();
  });
  it('excludes foreign, deleted and unknown-client work', async () => {
    await ensureClients();
    await saveClientNote(client, 'Private work.', 'discovery');
    const row = (await db.client_progress.get(clientProgressId(client)))!;
    await db.client_progress.put({ ...row, learner_id: 'foreign' });
    const view = open();
    await screen.findByText(/No saved client work yet/);
    view.unmount();
    await db.client_progress.put({ ...row, deleted_at: row.updated_at });
    const deleted = open();
    await screen.findByText(/No saved client work yet/);
    deleted.unmount();
    await db.client_progress.put({ ...row, client_id: 'CL-missing' });
    open();
    await screen.findByText(/No saved client work yet/);
  });
  it('shows a bounded loading state and recovers from a failed local read', async () => {
    const failed = vi
      .spyOn(db.client_progress, 'toArray')
      .mockRejectedValueOnce(new Error('storage'));
    open();
    expect(screen.getByRole('status')).toHaveTextContent('Reading saved client work');
    expect(await screen.findByRole('alert')).toHaveTextContent('Other study is still available');
    failed.mockRestore();
    fireEvent.click(screen.getByRole('button', { name: 'Retry client work' }));
    await screen.findByText(/No saved client work yet/);
  });
});
