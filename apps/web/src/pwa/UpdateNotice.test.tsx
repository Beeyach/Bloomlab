import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createUpdates } from './updates';
import { UpdateNotice } from './UpdateNotice';

const active = vi.hoisted(() => ({ controller: null as ReturnType<typeof createUpdates> | null }));
vi.mock('./updates', async (loadOriginal) => {
  const original = await loadOriginal<{ createUpdates: typeof createUpdates }>();
  return {
    ...original,
    get updates() {
      return active.controller!;
    },
  };
});

const fetchBuild = vi.fn<() => Promise<string | null>>();
const reload = vi.fn();
beforeEach(() => {
  fetchBuild.mockReset().mockRejectedValue(new Error('offline'));
  reload.mockReset();
  active.controller = createUpdates('loaded-build', fetchBuild, reload);
});
afterEach(cleanup);

describe('DATA-003 visible update-check failure and recovery', () => {
  it('offers a retry before an update is known and clears the notice when the loaded build is current', async () => {
    render(<UpdateNotice />);
    expect(screen.queryByRole('region', { name: 'App update' })).not.toBeInTheDocument();
    await act(() => active.controller!.check());

    expect(screen.getByRole('status')).toHaveTextContent('Could not check for updates');
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    expect(screen.queryByText('Update available')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reload to update' })).not.toBeInTheDocument();

    let finish!: (build: string) => void;
    fetchBuild.mockImplementation(() => new Promise((resolve) => (finish = resolve)));
    fireEvent.click(screen.getByRole('button', { name: 'Check for updates' }));
    const checking = screen.getByRole('button', { name: 'Checking…' });
    expect(checking).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(checking);
    expect(fetchBuild).toHaveBeenCalledTimes(2);
    await act(async () => finish('loaded-build'));
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'App update' })).not.toBeInTheDocument(),
    );
    expect(reload).not.toHaveBeenCalled();
  });

  it('can retry during held call work, then offers only a blocked explicit reload for a newer build', async () => {
    const release = active.controller!.hold();
    render(<UpdateNotice />);
    await act(() => active.controller!.check());
    const retry = screen.getByRole('button', { name: 'Check for updates' });
    expect(retry).toBeEnabled();

    // Another failure must keep recovery available, without claiming that an update exists.
    fireEvent.click(retry);
    await waitFor(() => expect(retry).toHaveTextContent('Check for updates'));
    expect(screen.getByRole('status')).toHaveTextContent('Could not check for updates');
    fetchBuild.mockResolvedValue('new-build');
    fireEvent.click(retry);
    const update = await screen.findByRole('button', { name: 'Reload to update' });
    expect(update).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Finish the current call step first');
    expect(reload).not.toHaveBeenCalled();

    act(release);
    expect(update).toBeEnabled();
    expect(reload).not.toHaveBeenCalled();
    fireEvent.click(update);
    expect(reload).toHaveBeenCalledOnce();
  });
});
